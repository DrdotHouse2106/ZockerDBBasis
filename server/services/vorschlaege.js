// Vorschläge für den gemeinsamen Katalog – Ergänzungen zu „Titel vorschlagen“:
// - Fotos zum Vorschlag: helfen der Moderation, den Titel zu erkennen. Sie sind nur für den Einsender und das
//   Moderationsteam sichtbar, werden nicht veröffentlicht und nach der Entscheidung gelöscht.
// - Plattform vorschlagen: fehlende Systeme (z. B. Radofin 1292). Mit eigener Moderation prüft das Team hier,
//   selbst gehostet geht der Vorschlag an zockerdb.de; nach der Aufnahme dort wird die Plattform hier angelegt.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { istModerator } from '../../shared/konstanten.js';
import { KontoFehler } from './konten.js';
import { ValidierungsFehler } from './validierung.js';

export const MAX_BELEGFOTOS = 4;
const PLATTFORM_TYPEN = ['konsole', 'handheld', 'computer', 'sonstige'];
// Nach der Entscheidung bleiben die Fotos noch kurz erhalten (z. B. falls eine Freigabe zurückgenommen wird)
const AUFBEWAHREN_TAGE = 14;

export function pruefePlattformVorschlag(eingabe = {}) {
  const fehler = {};
  const name = String(eingabe.name ?? '').replace(/\s+/g, ' ').trim();
  if (!name || name.length > 100) fehler.name = 'Bitte den Namen der Plattform angeben (höchstens 100 Zeichen).';
  const jahrText = String(eingabe.erscheinungsjahr ?? '').trim();
  const jahr = jahrText ? Number(jahrText) : null;
  if (jahr !== null && (!Number.isInteger(jahr) || jahr < 1950 || jahr > 2100)) fehler.erscheinungsjahr = 'Bitte ein gültiges Jahr angeben.';
  if (Object.keys(fehler).length) throw new ValidierungsFehler(fehler);
  return {
    name,
    hersteller: String(eingabe.hersteller ?? '').trim().slice(0, 60) || null,
    erscheinungsjahr: jahr,
    typ: PLATTFORM_TYPEN.includes(eingabe.typ) ? eingabe.typ : 'konsole',
    hinweis: String(eingabe.hinweis ?? '').trim().slice(0, 1000) || null,
  };
}

/** Bild einlesen, drehen (EXIF), verkleinern und als WebP ohne Metadaten (z. B. GPS) speichern. */
export async function speichereBelegfoto(dateien, quelle) {
  const datei = `v-${crypto.randomUUID()}.webp`;
  try {
    await sharp(quelle, { limitInputPixels: 100_000_000, failOn: 'error' }).rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 })
      .toFile(dateien.pfadVon(datei));
  } catch {
    dateien.loesche(datei);
    throw new KontoFehler('Das Bild konnte nicht gelesen werden. Bitte JPG, PNG oder WebP verwenden.', 400);
  }
  return { datei, groesse: (await fs.stat(dateien.pfadVon(datei))).size };
}

export function erstelleVorschlagDienst(db, { katalog, dateien, zentrale, plattformen, benachrichtigungen }) {
  const q = {
    fotos: db.prepare('SELECT * FROM vorschlag_fotos WHERE katalog_id = ? ORDER BY id'),
    anzahl: db.prepare('SELECT COUNT(*) AS n FROM vorschlag_fotos WHERE katalog_id = ?'),
    einfuegen: db.prepare('INSERT INTO vorschlag_fotos (katalog_id, benutzer_id, datei, groesse) VALUES (?, ?, ?, ?) RETURNING *'),
    foto: db.prepare('SELECT * FROM vorschlag_fotos WHERE id = ?'),
    perDatei: db.prepare('SELECT f.*, k.erstellt_von FROM vorschlag_fotos f LEFT JOIN katalog k ON k.id = f.katalog_id WHERE f.datei = ?'),
    vorschlag: db.prepare('SELECT * FROM plattform_vorschlaege WHERE id = ?'),
  };

  const fotoObjekt = (f) => ({ id: f.id, url: `/api/dateien/${f.datei}` });
  const fotos = (katalogId) => q.fotos.all(Number(katalogId)).map(fotoObjekt);

  /** Eigener, noch nicht freigegebener Eintrag des Benutzers – nur dazu dürfen Fotos hochgeladen werden. */
  function eigenerVorschlag(benutzer, katalogId) {
    const e = katalog.holeEintrag(Number(katalogId));
    if (!e || e.quelle !== 'eigen' || e.erstellt_von !== benutzer.id) throw new KontoFehler('Katalogeintrag nicht gefunden.', 404);
    if (e.status === 'freigegeben' || e.zentral_status === 'freigegeben') throw new KontoFehler('Der Eintrag ist schon im Katalog – Fotos sind nicht mehr nötig.', 409);
    return e;
  }

  async function fotoHinzu(benutzer, katalogId, quelle) {
    const e = eigenerVorschlag(benutzer, katalogId);
    if (q.anzahl.get(e.id).n >= MAX_BELEGFOTOS) throw new KontoFehler(`Höchstens ${MAX_BELEGFOTOS} Fotos je Vorschlag.`, 409);
    const { datei, groesse } = await speichereBelegfoto(dateien, quelle);
    q.einfuegen.run(e.id, benutzer.id, datei, groesse);
    // Selbst gehostet und bereits an zockerdb.de gegangen: Foto gleich hinterherschicken
    await sendeAnZentrale(e.id).catch(() => null);
    return fotos(e.id);
  }

  function fotoEntfernen(benutzer, fotoId) {
    const f = q.foto.get(Number(fotoId));
    const e = f && katalog.holeEintrag(f.katalog_id);
    if (!f || !(f.benutzer_id === benutzer.id || istModerator(benutzer))) throw new KontoFehler('Foto nicht gefunden.', 404);
    db.prepare('DELETE FROM vorschlag_fotos WHERE id = ?').run(f.id);
    dateien.loesche(f.datei);
    return e ? fotos(e.id) : [];
  }

  /** Zugriff auf eine Datei: Einsender und Moderationsteam. */
  function darfSehen(benutzer, datei) {
    const f = q.perDatei.get(datei);
    return Boolean(f && benutzer && (f.benutzer_id === benutzer.id || istModerator(benutzer)));
  }

  /** Noch nicht übertragene Fotos eines an zockerdb.de eingereichten Eintrags nachsenden. */
  async function sendeAnZentrale(katalogId) {
    const e = katalog.holeEintrag(Number(katalogId));
    if (!zentrale?.aktiv || !e?.zentral_id || e.zentral_status !== 'eingereicht') return 0;
    let gesendet = 0;
    for (const f of q.fotos.all(e.id).filter((x) => !x.zentral_gesendet)) {
      const bild = await fs.readFile(dateien.pfadVon(f.datei)).catch(() => null);
      if (!bild) continue;
      await zentrale.anfrage(`/api/zentral/einreichungen/${e.zentral_id}/foto`, { methode: 'PUT', bild, bildTyp: 'image/webp', zeit: 30_000 });
      db.prepare('UPDATE vorschlag_fotos SET zentral_gesendet = 1 WHERE id = ?').run(f.id);
      gesendet += 1;
    }
    return gesendet;
  }

  /** Fotos entschiedener oder gelöschter Vorschläge entfernen. */
  function aufraeumen() {
    const alt = db.prepare(`SELECT f.id, f.datei FROM vorschlag_fotos f LEFT JOIN katalog k ON k.id = f.katalog_id
      WHERE k.id IS NULL
         OR (k.status IN ('freigegeben', 'abgelehnt') AND COALESCE(k.geprueft_am, k.aktualisiert_am) < datetime('now', ?))
         OR (k.zentral_status IN ('freigegeben', 'abgelehnt') AND f.erstellt_am < datetime('now', ?))`)
      .all(`-${AUFBEWAHREN_TAGE} days`, `-${AUFBEWAHREN_TAGE} days`);
    for (const f of alt) {
      db.prepare('DELETE FROM vorschlag_fotos WHERE id = ?').run(f.id);
      dateien.loesche(f.datei);
    }
    return alt.length;
  }

  // ── Plattformen ─────────────────────────────────────────────
  const vorschlagObjekt = (v) => v && ({
    id: v.id, name: v.name, hersteller: v.hersteller, erscheinungsjahr: v.erscheinungsjahr, typ: v.typ, hinweis: v.hinweis,
    status: v.status, antwort: v.antwort, plattform_id: v.plattform_id, erstellt_am: v.erstellt_am, entschieden_am: v.entschieden_am,
    ...(v.eingereicht_von !== undefined ? { eingereicht_von: v.eingereicht_von } : {}),
  });

  /** Neuer Vorschlag. Mit eigener Moderation bleibt er hier, sonst geht er an zockerdb.de (falls verbunden). */
  async function plattformVorschlagen(benutzer, eingabe) {
    const d = pruefePlattformVorschlag(eingabe);
    if (!katalog.moderiert() && !zentrale?.aktiv) throw new KontoFehler('Ohne Verbindung zu zockerdb.de gibt es niemanden, der Vorschläge prüft.', 409);
    const vorhanden = plattformen.zuordnen(d.name);
    if (vorhanden) throw new ValidierungsFehler({ name: `Die Plattform gibt es schon: „${vorhanden.name}“.` });
    const offen = db.prepare("SELECT COUNT(*) AS n FROM plattform_vorschlaege WHERE benutzer_id = ? AND status = 'offen'").get(benutzer.id).n;
    if (offen >= 20) throw new KontoFehler('Du hast schon viele offene Vorschläge. Bitte warte, bis sie geprüft sind.', 429);
    const v = db.prepare(`INSERT INTO plattform_vorschlaege (benutzer_id, name, hersteller, erscheinungsjahr, typ, hinweis)
      VALUES (@benutzer_id, @name, @hersteller, @erscheinungsjahr, @typ, @hinweis) RETURNING *`).get({ ...d, benutzer_id: benutzer.id });
    let ziel = 'hier';
    if (!katalog.moderiert()) {
      ziel = 'zockerdb.de';
      try {
        const r = await zentrale.anfrage('/api/zentral/plattform-vorschlag', { methode: 'POST', daten: d });
        db.prepare('UPDATE plattform_vorschlaege SET zentral_id = ? WHERE id = ?').run(Number(r.id) || null, v.id);
      } catch (e) {
        // Nicht angekommen: Vorschlag wieder entfernen, damit er erneut gesendet werden kann
        db.prepare('DELETE FROM plattform_vorschlaege WHERE id = ?').run(v.id);
        throw new KontoFehler(e.message, 502);
      }
    }
    return { ...vorschlagObjekt(q.vorschlag.get(v.id)), ziel };
  }

  const eigenePlattformVorschlaege = (benutzer) => db.prepare('SELECT * FROM plattform_vorschlaege WHERE benutzer_id = ? ORDER BY id DESC LIMIT 50')
    .all(benutzer.id).map(vorschlagObjekt);

  const offenePlattformVorschlaege = () => db.prepare(`SELECT v.*, COALESCE(b.anzeigename, b.benutzername, CASE WHEN v.instanz_id IS NOT NULL THEN 'eine Installation' END) AS eingereicht_von
    FROM plattform_vorschlaege v LEFT JOIN benutzer b ON b.id = v.benutzer_id WHERE v.status = 'offen' ORDER BY v.id`).all().map(vorschlagObjekt);

  /** Plattform anlegen (falls noch nicht vorhanden) und bisher unverknüpfte Katalogeinträge mit diesem Namen verknüpfen. */
  function legePlattformAn({ name, kurz, hersteller, typ, erscheinungsjahr }) {
    let p = plattformen.zuordnen(name);
    if (!p) {
      p = db.prepare(`INSERT INTO plattformen (name, kurz, hersteller, typ, erscheinungsjahr) VALUES (?, ?, ?, ?, ?) RETURNING *`)
        .get(name, (kurz || name).slice(0, 20), hersteller || 'Sonstige', PLATTFORM_TYPEN.includes(typ) ? typ : 'konsole', erscheinungsjahr ?? null);
      plattformen.indexNeuLaden();
    }
    const muster = `%${name.replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
    for (const k of db.prepare("SELECT id, plattformen FROM katalog WHERE plattformen LIKE ? ESCAPE '\\'").all(muster)) {
      plattformen.verknuepfeKatalog(k.id, JSON.parse(k.plattformen || '[]'));
    }
    return plattformen.zuordnen(name);
  }

  /** Moderation: annehmen (legt die Plattform an) oder ablehnen. Benachrichtigt den Einsender. */
  function entscheidePlattform(id, { annehmen, daten = {}, antwort }, moderator) {
    const v = q.vorschlag.get(Number(id));
    if (!v || v.status !== 'offen') throw new KontoFehler('Vorschlag nicht gefunden oder schon entschieden.', 404);
    const text = String(antwort ?? '').trim().slice(0, 1000) || null;
    let plattform = null;
    if (annehmen) {
      const d = { ...pruefePlattformVorschlag({ ...v, ...daten }), kurz: String(daten.kurz ?? '').trim().slice(0, 20) };
      plattform = legePlattformAn(d);
      db.prepare("UPDATE plattform_vorschlaege SET status = 'angenommen', plattform_id = ?, antwort = ?, entschieden_am = datetime('now') WHERE id = ?")
        .run(plattform.id, text, v.id);
    } else {
      db.prepare("UPDATE plattform_vorschlaege SET status = 'abgelehnt', antwort = ?, entschieden_am = datetime('now') WHERE id = ?")
        .run(text ?? 'Ohne Begründung abgelehnt.', v.id);
    }
    if (v.benutzer_id && v.benutzer_id !== moderator?.id) benachrichtige(v.benutzer_id, v.name, annehmen, text);
    return { ...vorschlagObjekt(q.vorschlag.get(v.id)), plattform };
  }

  function benachrichtige(benutzerId, name, angenommen, text) {
    benachrichtigungen?.sende(benutzerId, angenommen
      ? { art: 'freigabe', titel: `Plattform „${name}“ aufgenommen`, text: text ?? 'Du kannst sie jetzt für deine Einträge auswählen. Danke!', link: '#/katalog' }
      : { art: 'ablehnung', titel: `Plattform „${name}“ nicht aufgenommen`, text: text ?? 'Ohne Begründung abgelehnt.' });
  }

  /** Selbst gehostet: Stand der an zockerdb.de gegangenen Vorschläge abfragen und angenommene Plattformen übernehmen. */
  async function pruefePlattformVorschlaege() {
    const offen = db.prepare("SELECT * FROM plattform_vorschlaege WHERE status = 'offen' AND zentral_id IS NOT NULL").all();
    if (!offen.length || !zentrale?.aktiv) return 0;
    const r = await zentrale.anfrage(`/api/zentral/plattform-vorschlaege?ids=${offen.map((v) => v.zentral_id).join(',')}`);
    let geaendert = 0;
    for (const z of r.vorschlaege ?? []) {
      const v = offen.find((x) => x.zentral_id === Number(z.id));
      if (!v || !['angenommen', 'abgelehnt'].includes(z.status)) continue;
      let plattformId = null;
      if (z.status === 'angenommen' && z.plattform?.name) plattformId = legePlattformAn(pruefeZentralePlattform(z.plattform)).id;
      db.prepare("UPDATE plattform_vorschlaege SET status = ?, antwort = ?, plattform_id = ?, entschieden_am = datetime('now') WHERE id = ?")
        .run(z.status, String(z.antwort ?? '').slice(0, 1000) || null, plattformId, v.id);
      if (v.benutzer_id) benachrichtige(v.benutzer_id, z.plattform?.name ?? v.name, z.status === 'angenommen', z.antwort || null);
      geaendert += 1;
    }
    return geaendert;
  }

  // Daten von zockerdb.de nur geprüft übernehmen
  const pruefeZentralePlattform = (p) => ({
    ...pruefePlattformVorschlag(p), kurz: String(p.kurz ?? '').trim().slice(0, 20),
  });

  return {
    fotos, fotoHinzu, fotoEntfernen, darfSehen, sendeAnZentrale, aufraeumen,
    plattformVorschlagen, eigenePlattformVorschlaege, offenePlattformVorschlaege, entscheidePlattform, legePlattformAn, pruefePlattformVorschlaege,
  };
}
