// Fotos freistellen (Hintergrund entfernen) – ohne Rechenlast auf dem Server.
//
// Die Maske rechnet ein Helfer-Gerät: ein Handy mit eingebauter Freistellung (iOS ab 17, Android mit ML Kit) über die App.
// Starke Handys stellen das eigene Foto direkt beim Upload frei (PUT /api/medien/:id/freistellen). Alles andere landet in einer
// Warteschlange: Helfer holen Aufträge in Päckchen, reservieren sie kurz, laden das Foto in Anzeigegröße und schicken nur die
// Maske (Graustufenbild, weiß = Motiv) zurück. Der Server legt die Maske über das Foto und speichert eine WebP-Datei mit
// Transparenz. Der Fotograf wird benachrichtigt und entscheidet, ob die freigestellte Version gezeigt wird – bis dahin bleibt
// überall das Original sichtbar.
//
// Helfen dürfen Administratoren und Moderatoren (sie sehen alle Fotos ohnehin) sowie Benutzer, die ein Administrator dafür
// freigeschaltet hat – jeweils erst nach dem eigenen Häkchen im Konto. Benutzer ohne Moderationsrolle bekommen nur Fotos, die
// der Fotograf mit der Community teilt (eingereicht oder freigegeben), und die eigenen.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { istModerator, FREISTELL_ARTEN, datentraegerVon } from '../../shared/konstanten.js';
import { KontoFehler } from './konten.js';
import { ValidierungsFehler } from './validierung.js';
import { sicheresBild, mitBildSperre, MAX_PIXEL_FOTO } from './medien.js';

export { FREISTELL_ARTEN };
const RESERVIERUNG_MS = 10 * 60 * 1000;
const MAX_VERSUCHE = 3;
const MAX_PAECKCHEN = 50;
// Anteil des Bildes, den das Motiv einnehmen darf – darunter oder darüber ist die Maske mit großer Sicherheit falsch
const MINDEST_ANTEIL = 0.02;
const HOECHST_ANTEIL = 0.97;

export const freiDateiVon = (datei) => `${String(datei).replace(/\.[^.]+$/, '')}-frei.webp`;
/** Verkleinerte Fassung nur für Helfer-Geräte (siehe helferBild). */
export const helferDateiVon = (datei) => `${String(datei).replace(/\.[^.]+$/, '')}-helfer.webp`;
const HELFER_PX = 1200;

export function erstelleFreistellDienst(db, { dateien, benachrichtigungen, konfiguration }) {
  const q = {
    medium: db.prepare('SELECT * FROM medien WHERE id = ?'),
    auftrag: db.prepare('SELECT * FROM freistell_auftraege WHERE id = ?'),
    auftragZuMedium: db.prepare('SELECT * FROM freistell_auftraege WHERE medien_id = ?'),
    einreihen: db.prepare("INSERT OR IGNORE INTO freistell_auftraege (medien_id) VALUES (?)"),
    freigeben: db.prepare(`UPDATE freistell_auftraege SET status = 'offen', reserviert_von = NULL, reserviert_bis = NULL
      WHERE status = 'in_arbeit' AND reserviert_bis < ?`),
    reservieren: db.prepare(`UPDATE freistell_auftraege SET status = 'in_arbeit', reserviert_von = @benutzer, reserviert_bis = @bis
      WHERE id = @id AND status = 'offen'`),
    fertig: db.prepare(`UPDATE freistell_auftraege SET status = 'fertig', erledigt_von = ?, reserviert_von = NULL, reserviert_bis = NULL, erledigt_am = datetime('now')
      WHERE id = ?`),
    // Tageslimit: heute erledigte plus gerade reservierte Aufträge dieses Helfers
    heuteVon: db.prepare(`SELECT (SELECT COUNT(*) FROM freistell_auftraege WHERE erledigt_von = @b AND erledigt_am >= datetime('now', '-1 day'))
      + (SELECT COUNT(*) FROM freistell_auftraege WHERE reserviert_von = @b AND status = 'in_arbeit') AS n`),
    fehlschlag: db.prepare(`UPDATE freistell_auftraege SET versuche = versuche + 1, reserviert_von = NULL, reserviert_bis = NULL,
      status = CASE WHEN versuche + 1 >= @max THEN 'fehler' ELSE 'offen' END, erledigt_am = CASE WHEN versuche + 1 >= @max THEN datetime('now') END
      WHERE id = @id AND status = 'in_arbeit' AND reserviert_von = @benutzer`),
    ergebnisSetzen: db.prepare(`UPDATE medien SET frei_datei = ?, frei_status = ?,
      groesse_gesamt = COALESCE(groesse_gesamt, 0) + ? WHERE id = ?`),
    statusSetzen: db.prepare('UPDATE medien SET frei_status = ? WHERE id = ?'),
    verwerfen: db.prepare(`UPDATE medien SET frei_datei = NULL, frei_status = 'abgelehnt',
      groesse_gesamt = MAX(0, COALESCE(groesse_gesamt, 0) - ?) WHERE id = ?`),
    anzahlen: db.prepare(`SELECT status, COUNT(*) AS n FROM freistell_auftraege GROUP BY status`),
    helfer: db.prepare(`SELECT COUNT(*) AS n FROM benutzer WHERE gesperrt = 0 AND freistellen_hilft = 1
      AND (freistellen_helfer = 1 OR rolle IN ('admin', 'moderator'))`),
    zuPruefen: db.prepare("SELECT COUNT(*) AS n FROM medien WHERE frei_status = 'fertig'"),
  };

  const aktiv = () => Boolean(konfiguration.fotosFreistellen);
  const freigeschaltet = (b) => Boolean(b && !b.gesperrt && (istModerator(b) || b.freistellen_helfer === 1));
  const darfHelfen = (b) => aktiv() && freigeschaltet(b) && b.freistellen_hilft === 1;
  const geeignet = (m) => Boolean(m && FREISTELL_ARTEN.includes(m.art) && String(m.mime).startsWith('image/'));

  // Plattform des Fotos (sonst die erste des Katalogeintrags) – für „Disc oder Modul?“
  const plattformVon = db.prepare(`SELECT COALESCE((SELECT p.name FROM plattformen p WHERE p.id = m.plattform_id),
      (SELECT j.value FROM katalog k, json_each(k.plattformen) j WHERE k.id = m.katalog_id LIMIT 1)) AS plattform,
      (SELECT k.typ FROM katalog k WHERE k.id = m.katalog_id) AS typ FROM medien m WHERE m.id = ?`);
  /**
   * Discs und Verpackungen von Disc-Spielen (Hüllen) werden nur auf Wunsch freigestellt: Die Fehlerquote ist dort zu hoch
   * (spiegelnde Discs, Hüllen mit Folie). Alles andere kommt nach dem Upload automatisch in die Warteschlange.
   */
  function nurAufWunsch(m) {
    if (m.art === 'foto_disc') return true;
    if (!['foto_vorne', 'foto_hinten', 'foto_komplett'].includes(m.art)) return false;
    // Verpackungen von Spielen: nur Modul-Spiele (Karton) automatisch – Disc-Hüllen, PC und unbekannte Plattformen auf Wunsch.
    // Verpackungen von Figuren, Merch und Konsolen bleiben automatisch.
    const z = plattformVon.get(m.id);
    if (z?.typ !== 'spiel') return false;
    return datentraegerVon(z.plattform ?? '') !== 'modul';
  }

  /** Nach dem Upload: Foto in die Warteschlange, wenn die Art passt (einmal je Foto) – Discs und Disc-Hüllen nur auf Wunsch. */
  function einreihen(mediumId) {
    if (!aktiv()) return false;
    const m = q.medium.get(Number(mediumId));
    if (!geeignet(m) || m.frei_status || nurAufWunsch(m)) return false;
    return q.einreihen.run(m.id).changes > 0;
  }

  /** Fotograf (oder Moderation) fordert das Freistellen ausdrücklich an – auch für Discs und Disc-Hüllen, auch nach Ablehnung. */
  function anfordern(benutzer, mediumId) {
    if (!aktiv()) throw new KontoFehler('Das Freistellen ist auf diesem Server ausgeschaltet.', 404);
    const m = q.medium.get(Number(mediumId));
    if (!m || (m.benutzer_id !== benutzer.id && !istModerator(benutzer))) throw new KontoFehler('Foto nicht gefunden.', 404);
    if (!geeignet(m)) throw new ValidierungsFehler({ art: 'Freigestellt werden nur Fotos des Gegenstands (Figur, Karte, Modul, Disc, Gerät, Verpackung).' });
    if (m.frei_datei) throw new KontoFehler('Zu diesem Foto gibt es schon eine freigestellte Version.', 409);
    const a = q.auftragZuMedium.get(m.id);
    if (a && ['offen', 'in_arbeit'].includes(a.status)) {
      db.prepare('UPDATE freistell_auftraege SET manuell = 1 WHERE id = ?').run(a.id);
      return { ok: true, status: a.status };
    }
    db.transaction(() => {
      if (a) db.prepare('DELETE FROM freistell_auftraege WHERE id = ?').run(a.id);
      db.prepare('INSERT INTO freistell_auftraege (medien_id, manuell) VALUES (?, 1)').run(m.id);
      q.statusSetzen.run(null, m.id);
    })();
    return { ok: true, status: 'offen' };
  }

  /** Alle vorhandenen, noch nie freigestellten Fotos einreihen (Administration, z. B. nach dem Einschalten). */
  function nachholen() {
    if (!aktiv()) return 0;
    const ids = db.prepare(`SELECT id, art FROM medien m WHERE m.frei_status IS NULL AND m.mime LIKE 'image/%'
      AND m.art IN (${FREISTELL_ARTEN.map(() => '?').join(', ')})
      AND NOT EXISTS (SELECT 1 FROM freistell_auftraege a WHERE a.medien_id = m.id)`).all(...FREISTELL_ARTEN)
      .filter((m) => !nurAufWunsch(m)).map((m) => m.id);
    const rein = db.transaction((liste) => liste.reduce((s, id) => s + q.einreihen.run(id).changes, 0));
    return rein(ids);
  }

  /**
   * Abgelaufene Reservierungen wieder freigeben (Helfer hat nicht geliefert, z. B. App geschlossen) und automatisch
   * eingereihte Discs bzw. Disc-Hüllen aus der Zeit vor „nur auf Wunsch“ aus der Schlange nehmen.
   */
  function raeumeAuf() {
    const offen = db.prepare(`SELECT a.id, m.id AS mid, m.art FROM freistell_auftraege a JOIN medien m ON m.id = a.medien_id
      WHERE a.status = 'offen' AND a.manuell = 0 AND m.art IN ('foto_disc', 'foto_vorne', 'foto_hinten', 'foto_komplett')`).all();
    const weg = offen.filter((a) => nurAufWunsch({ id: a.mid, art: a.art }));
    if (weg.length) db.transaction(() => { for (const a of weg) db.prepare('DELETE FROM freistell_auftraege WHERE id = ?').run(a.id); })();
    return q.freigeben.run(Date.now()).changes;
  }

  /** Nächste Aufträge für ein Helfer-Gerät reservieren. */
  function naechste(benutzer, anzahl = 20) {
    if (!aktiv()) throw new KontoFehler('Das Freistellen ist auf diesem Server ausgeschaltet.', 404);
    if (!darfHelfen(benutzer)) throw new KontoFehler('Dein Konto ist nicht als Helfer-Gerät freigeschaltet – oder das Häkchen im Konto fehlt.', 403);
    raeumeAuf();
    // Tageslimit des Helfers (0 = unbegrenzt): Mit nur zwei Geräten liefe das Handy sonst, bis die Schlange leer ist
    const limit = tageslimit(benutzer);
    const heute = q.heuteVon.get({ b: benutzer.id }).n;
    const rest = limit ? Math.max(0, limit - heute) : Infinity;
    const n = Math.min(Math.max(1, Math.min(MAX_PAECKCHEN, Number.parseInt(anzahl, 10) || 20)), rest);
    const antwort = (liste) => ({ auftraege: liste, limit: limit || null, heute, rest: limit ? Math.max(0, rest - liste.length) : null });
    if (n <= 0) return antwort([]);
    // Ohne Moderationsrolle nur geteilte Fotos anderer (eingereicht/freigegeben) und die eigenen
    const sichtbar = istModerator(benutzer) ? '' : "AND (m.benutzer_id = @benutzer OR m.sichtbarkeit IN ('eingereicht', 'freigegeben'))";
    const offen = db.prepare(`SELECT a.id, a.medien_id, m.art FROM freistell_auftraege a JOIN medien m ON m.id = a.medien_id
      WHERE a.status = 'offen' ${sichtbar} ORDER BY a.erstellt_am LIMIT @n`).all({ benutzer: benutzer.id, n });
    const bis = Date.now() + RESERVIERUNG_MS;
    const liste = [];
    for (const a of offen) {
      if (q.reservieren.run({ id: a.id, benutzer: benutzer.id, bis }).changes) {
        liste.push({ id: a.id, medien_id: a.medien_id, art: a.art, bild_url: `/api/freistellen/${a.id}/bild`, reserviert_bis: bis });
      }
    }
    return antwort(liste);
  }

  /** Höchstens so viele Fotos am Tag je Helfer-Gerät (0 = unbegrenzt); gilt ab dem gespeicherten Wert, sonst Standard 50. */
  const tageslimit = (b) => (Number.isInteger(b?.freistellen_limit) ? Math.max(0, b.freistellen_limit) : 50);

  /**
   * Foto für den Helfer, der den Auftrag gerade hält – bewusst verkleinert (höchstens HELFER_PX): Für die Maske reicht das,
   * der Server skaliert sie aufs Original. Wer sich das Bild trotz der App beschafft, hat nur eine kleine Fassung.
   * Die Fassung wird einmal erzeugt und neben dem Foto abgelegt (fällt mit dem Foto weg).
   */
  async function helferBild(benutzer, auftragId) {
    const a = q.auftrag.get(Number(auftragId));
    if (!a || a.status !== 'in_arbeit' || a.reserviert_von !== benutzer.id) throw new KontoFehler('Auftrag nicht gefunden oder nicht (mehr) reserviert.', 404);
    const m = q.medium.get(a.medien_id);
    if (!m) throw new KontoFehler('Foto nicht gefunden.', 404);
    const ziel = dateien.pfadVon(helferDateiVon(m.datei));
    try {
      await fs.access(ziel);
      return ziel;
    } catch { /* noch nicht erzeugt */ }
    const temp = `${ziel}.${process.pid}-${Date.now()}.tmp`;
    try {
      await mitBildSperre(() => sharp(dateien.pfadVon(m.anzeige_datei ?? m.datei), { limitInputPixels: MAX_PIXEL_FOTO, failOn: 'error' })
        .rotate().resize({ width: HELFER_PX, height: HELFER_PX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(temp));
      await fs.rename(temp, ziel);
    } finally {
      await fs.rm(temp, { force: true });
    }
    return ziel;
  }

  /**
   * Maske (Graustufenbild, weiß = Motiv; beliebige Größe) über das Foto legen → WebP mit Transparenz neben dem Original.
   * Liefert { datei, groesse }. Wirft bei unplausibler Maske (fast nichts oder fast alles ist Motiv).
   */
  async function freistellen(m, maskePuffer) {
    const quelle = dateien.pfadVon(m.anzeige_datei ?? m.datei);
    const ziel = freiDateiVon(m.datei);
    return mitBildSperre(async () => {
      // Foto als rohe RGB-Daten (gespeicherte Fotos sind schon gedreht und ohne Alpha) – in zwei Schritten, weil sharp
      // „removeAlpha“ sonst erst nach „joinChannel“ anwendet und die neue Transparenz gleich wieder entfernt
      const basis = await sharp(quelle, { limitInputPixels: MAX_PIXEL_FOTO, failOn: 'error' }).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const { width, height } = basis.info;
      if (!width || !height || basis.info.channels !== 3) throw new ValidierungsFehler({ maske: 'Das Foto konnte nicht gelesen werden.' });
      const maske = await (await sicheresBild(maskePuffer, { limitInputPixels: 25_000_000, failOn: 'error' }))
        .removeAlpha().greyscale().resize({ width, height, fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
      if (maske.info.channels !== 1) throw new ValidierungsFehler({ maske: 'Die Maske muss ein Graustufenbild sein (weiß = Motiv).' });
      let summe = 0;
      // Rahmen des Motivs (Maskenwert ab 32) für den Zuschnitt
      let links = width; let rechts = -1; let oben = height; let unten = -1;
      for (let i = 0; i < maske.data.length; i++) {
        const w = maske.data[i];
        summe += w;
        if (w >= 32) {
          const x = i % width; const y = (i - x) / width;
          if (x < links) links = x;
          if (x > rechts) rechts = x;
          if (y < oben) oben = y;
          if (y > unten) unten = y;
        }
      }
      const anteil = summe / (255 * maske.data.length);
      if (anteil < MINDEST_ANTEIL || anteil > HOECHST_ANTEIL) {
        throw new ValidierungsFehler({ maske: `Die Maske ist unplausibel (${Math.round(anteil * 100)} % des Bildes als Motiv).` });
      }
      const temp = dateien.pfadVon(`${ziel}.${process.pid}-${Date.now()}.tmp`);
      try {
        // Auf das Motiv zuschneiden (mit 3 % Rand) – erst zusammensetzen, dann ausschneiden
        const rgba = await sharp(basis.data, { raw: { width, height, channels: 3 } })
          .joinChannel(maske.data, { raw: { width, height, channels: 1 } }).raw().toBuffer();
        const rand = Math.round(Math.max(width, height) * 0.03);
        const ausschnitt = rechts < 0 ? { left: 0, top: 0, width, height } : {
          left: Math.max(0, links - rand), top: Math.max(0, oben - rand),
          width: Math.min(width, rechts + rand + 1) - Math.max(0, links - rand),
          height: Math.min(height, unten + rand + 1) - Math.max(0, oben - rand),
        };
        await sharp(rgba, { raw: { width, height, channels: 4 } })
          .extract(ausschnitt)
          .webp({ quality: 90, alphaQuality: 90 })
          .toFile(temp);
        await fs.rename(temp, dateien.pfadVon(ziel));
      } finally {
        await fs.rm(temp, { force: true });
      }
      return { datei: ziel, groesse: (await fs.stat(dateien.pfadVon(ziel))).size };
    });
  }

  /** Ergebnis eines Helfers zu einem reservierten Auftrag. */
  async function ergebnis(benutzer, auftragId, maskePuffer) {
    const a = q.auftrag.get(Number(auftragId));
    if (!a || a.status !== 'in_arbeit' || a.reserviert_von !== benutzer.id) throw new KontoFehler('Auftrag nicht gefunden oder nicht (mehr) reserviert.', 409);
    const m = q.medium.get(a.medien_id);
    if (!m) throw new KontoFehler('Foto nicht gefunden.', 404);
    let frei;
    try {
      frei = await freistellen(m, maskePuffer);
    } catch (fehler) {
      q.fehlschlag.run({ id: a.id, benutzer: benutzer.id, max: MAX_VERSUCHE });
      throw fehler;
    }
    if (m.frei_datei && m.frei_datei !== frei.datei) dateien.loesche(m.frei_datei);
    db.transaction(() => {
      // Eigenes Foto: Der Helfer ist zugleich der Fotograf – trotzdem prüfen lassen, er hat die Maske nicht gesehen
      q.ergebnisSetzen.run(frei.datei, 'fertig', frei.groesse, m.id);
      q.fertig.run(benutzer.id, a.id);
    })();
    // Höchstens eine Meldung am Tag, die hochzählt („5 Fotos …“) – nie per E-Mail (Kategorie „Freigestellte Fotos“)
    if (m.benutzer_id) {
      benachrichtigungen?.sendeGesammelt(m.benutzer_id, {
        art: 'freistellen', schluessel: 'freistellen',
        titel: (n) => (n === 1 ? 'Ein Foto ist freigestellt – jetzt prüfen' : `${n} Fotos sind freigestellt – jetzt prüfen`),
        text: () => 'Helfer-Geräte haben den Hintergrund entfernt. Vergleiche Original und Ergebnis und entscheide, was gezeigt wird.',
        link: '#/freistellen-pruefen',
      });
    }
    return { ok: true, medien_id: m.id };
  }

  /** Helfer meldet: Dieses Foto konnte nicht freigestellt werden (nach drei Versuchen bleibt es beim Original). */
  function fehler(benutzer, auftragId) {
    const r = q.fehlschlag.run({ id: Number(auftragId), benutzer: benutzer.id, max: MAX_VERSUCHE });
    if (!r.changes) throw new KontoFehler('Auftrag nicht gefunden oder nicht (mehr) reserviert.', 409);
    return { ok: true };
  }

  /** Eigenes Foto direkt beim Upload freigestellt (starkes Handy): Maske vom Fotografen, auf Wunsch gleich angenommen. */
  async function eigenesErgebnis(benutzer, mediumId, maskePuffer, { angenommen = false } = {}) {
    if (!aktiv()) throw new KontoFehler('Das Freistellen ist auf diesem Server ausgeschaltet.', 404);
    const m = q.medium.get(Number(mediumId));
    if (!m || m.benutzer_id !== benutzer.id) throw new KontoFehler('Foto nicht gefunden.', 404);
    if (!geeignet(m)) throw new ValidierungsFehler({ art: 'Freigestellt werden nur Fotos des Gegenstands (Figur, Karte, Modul, Gerät, Verpackung).' });
    const frei = await freistellen(m, maskePuffer);
    if (m.frei_datei && m.frei_datei !== frei.datei) dateien.loesche(m.frei_datei);
    db.transaction(() => {
      q.ergebnisSetzen.run(frei.datei, angenommen ? 'angenommen' : 'fertig', frei.groesse, m.id);
      const a = q.auftragZuMedium.get(m.id);
      if (a) q.fertig.run(benutzer.id, a.id);
    })();
    return { ok: true, frei_status: angenommen ? 'angenommen' : 'fertig' };
  }

  /** Fotograf (oder Moderation) nimmt die freigestellte Version an oder lehnt sie ab (Original bleibt). */
  async function entscheide(benutzer, mediumId, annehmen) {
    const m = q.medium.get(Number(mediumId));
    if (!m || (m.benutzer_id !== benutzer.id && !istModerator(benutzer))) throw new KontoFehler('Foto nicht gefunden.', 404);
    if (!m.frei_datei) throw new KontoFehler('Zu diesem Foto gibt es keine freigestellte Version.', 409);
    if (annehmen) {
      q.statusSetzen.run('angenommen', m.id);
      return { frei_status: 'angenommen' };
    }
    let groesse = 0;
    try { groesse = (await fs.stat(dateien.pfadVon(m.frei_datei))).size; } catch { /* schon weg */ }
    q.verwerfen.run(groesse, m.id);
    dateien.loesche(m.frei_datei);
    return { frei_status: 'abgelehnt' };
  }

  /**
   * Freigestellte Fotos, die noch auf die Entscheidung warten (Seite „Freistellungen prüfen“): eigene, für Moderatoren auch
   * die geteilten Fotos anderer.
   * Liefert die ältesten zuerst, höchstens `grenze` Stück, und die Gesamtzahl.
   */
  function zuPruefenListe(benutzer, { grenze = 60, alle = false, uebernommen = false } = {}) {
    const mod = istModerator(benutzer) ? 1 : 0;
    const n = Math.min(Math.max(Number(grenze) || (uebernommen ? 200 : 60), 1), uebernommen ? 500 : 200);
    // Der Fotograf entscheidet selbst. Moderatoren sehen außerdem (nur geteilte Fotos, private bleiben beim Fotografen):
    // Fotos ohne Fotografen (nach Kontolöschung überlassen), Fotos, die seit 30 Tagen ungeprüft liegen, und mit „alle“ jedes.
    // „uebernommen“: schon übernommene Freistellungen (zum Zurücknehmen) – eigene, für Moderatoren mit „alle“ auch geteilte anderer
    const wo = uebernommen
      ? `m.frei_status = 'angenommen' AND m.frei_datei IS NOT NULL
      AND (m.benutzer_id = @b OR (@mod = 1 AND m.sichtbarkeit IN ('eingereicht', 'freigegeben') AND (m.benutzer_id IS NULL OR @alle = 1)))`
      : `m.frei_status = 'fertig' AND m.frei_datei IS NOT NULL
      AND (m.benutzer_id = @b OR (@mod = 1 AND m.sichtbarkeit IN ('eingereicht', 'freigegeben') AND (m.benutzer_id IS NULL OR @alle = 1
        OR COALESCE((SELECT fa.erledigt_am FROM freistell_auftraege fa WHERE fa.medien_id = m.id), m.erstellt_am) < datetime('now', '-30 days'))))`;
    const werte = { mod, alle: alle && mod ? 1 : 0, b: benutzer.id };
    const fotos = db.prepare(`SELECT m.id, m.katalog_id, m.art, m.titel, m.datei, m.anzeige_datei, m.frei_datei, m.benutzer_id,
        k.titel AS katalog_titel, k.typ AS katalog_typ, v.farbe AS variante_farbe, v.bezeichnung AS variante,
        COALESCE((SELECT fa.erledigt_am FROM freistell_auftraege fa WHERE fa.medien_id = m.id), m.erstellt_am) < datetime('now', '-30 days') AS lange
      FROM medien m JOIN katalog k ON k.id = m.katalog_id LEFT JOIN katalog_varianten v ON v.id = m.variante_id
      WHERE ${wo} ORDER BY ${uebernommen ? 'k.titel COLLATE NOCASE, m.id' : 'm.benutzer_id IS NOT @b, m.id'} LIMIT @n`).all({ ...werte, n });
    const gesamt = db.prepare(`SELECT COUNT(*) FROM medien m WHERE ${wo}`).pluck().get(werte);
    return { gesamt, fotos };
  }

  /**
   * Einmalig: schon vorhandene freigestellte Fassungen (aus der Zeit vor dem Zuschnitt) auf das Motiv zuschneiden.
   * Läuft im Hintergrund nach dem Start; ein Vermerk in „datenpakete“ verhindert Wiederholungen. Liefert die Anzahl.
   */
  async function zuschnittNachholen() {
    const VERMERK = 'freistellen-zuschnitt-v1';
    if (db.prepare('SELECT 1 FROM datenpakete WHERE name = ?').get(VERMERK)) return 0;
    const liste = db.prepare('SELECT id, frei_datei FROM medien WHERE frei_datei IS NOT NULL').all();
    let geaendert = 0;
    for (const m of liste) {
      try {
        const pfad = dateien.pfadVon(m.frei_datei);
        const vorher = (await fs.stat(pfad)).size;
        const neu = await mitBildSperre(async () => {
          const { data, info } = await sharp(pfad, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const { width, height } = info;
          let links = width; let rechts = -1; let oben = height; let unten = -1;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              if (data[(y * width + x) * 4 + 3] >= 32) {
                if (x < links) links = x;
                if (x > rechts) rechts = x;
                if (y < oben) oben = y;
                if (y > unten) unten = y;
              }
            }
          }
          if (rechts < 0) return null;
          const rand = Math.round(Math.max(width, height) * 0.03);
          const a = { left: Math.max(0, links - rand), top: Math.max(0, oben - rand) };
          a.width = Math.min(width, rechts + rand + 1) - a.left;
          a.height = Math.min(height, unten + rand + 1) - a.top;
          if (a.width >= width * 0.97 && a.height >= height * 0.97) return null; // schon (fast) passend
          // Neuer Dateiname: Bilder werden lange zwischengespeichert, unter dem alten Namen sähe man weiter die alte Fassung
          const name = `${String(m.frei_datei).replace(/\.webp$/, '')}-z.webp`;
          const temp = `${dateien.pfadVon(name)}.${process.pid}-${Date.now()}.tmp`;
          await sharp(data, { raw: { width, height, channels: 4 } }).extract(a).webp({ quality: 90, alphaQuality: 90 }).toFile(temp);
          await fs.rename(temp, dateien.pfadVon(name));
          return { name, groesse: (await fs.stat(dateien.pfadVon(name))).size };
        });
        if (neu) {
          db.prepare('UPDATE medien SET frei_datei = ?, groesse_gesamt = MAX(0, COALESCE(groesse_gesamt, 0) + ?) WHERE id = ?')
            .run(neu.name, neu.groesse - vorher, m.id);
          dateien.loesche(m.frei_datei);
          geaendert += 1;
        }
      } catch { /* Datei fehlt oder ist nicht lesbar – überspringen */ }
    }
    db.prepare("INSERT OR IGNORE INTO datenpakete (name, pruefsumme, eingespielt_am) VALUES (?, 'erledigt', datetime('now'))").run(VERMERK);
    return geaendert;
  }

  /** Stand für die Administration. */
  function statistik() {
    raeumeAuf();
    const je = Object.fromEntries(q.anzahlen.all().map((z) => [z.status, z.n]));
    return {
      aktiv: aktiv(), offen: je.offen ?? 0, inArbeit: je.in_arbeit ?? 0, fertig: je.fertig ?? 0, fehler: je.fehler ?? 0,
      zuPruefen: q.zuPruefen.get().n, helfer: q.helfer.get().n,
    };
  }

  /** Für Konto und App: darf dieses Konto helfen, hilft es, ist die Funktion an? */
  const stand = (b) => ({
    aktiv: aktiv(), freigeschaltet: freigeschaltet(b), hilft: b?.freistellen_hilft === 1, darfHelfen: darfHelfen(b),
    limit: b ? tageslimit(b) : null, heute: b ? q.heuteVon.get({ b: b.id }).n : 0,
    // Freigestellte Fotos, die auf die Entscheidung dieses Kontos warten (Seite „Freistellungen prüfen“)
    zuPruefen: b ? zuPruefenListe(b, { grenze: 1 }).gesamt : 0,
  });

  return { aktiv, einreihen, anfordern, nurAufWunsch, nachholen, raeumeAuf, zuschnittNachholen, naechste, helferBild, ergebnis, fehler, eigenesErgebnis, entscheide, zuPruefenListe, statistik, stand, darfHelfen };
}
