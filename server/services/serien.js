// Figurenserien für Merch (z. B. Monster in my Pocket, Funko Pop!).
// Aufbau: Serie → Unterserie (Hersteller, Jahr, Nummernbereich mit Präfix, nie erschienene Nummern, Farbpalette) → Figur (Katalogeintrag
// mit serie_id und Nummer) → Farbe (Ausgabe der Figur in katalog_varianten) – Farben nur bei Serien mit „mit_farben“ (z. B. nicht bei Funko Pop!).
// Serien sind wie Katalogeinträge zuerst privat; die Moderation gibt sie frei. Vorschläge von Sammlern (neue Figur oder Farbe in einer
// freigegebenen Serie) bleiben privat, bis ein Foto als Beleg dabei ist – erst dann gehen sie an die Moderation (ohne Beleg wäre die Prüfung kaum möglich). Der Fortschritt zählt nur, was es wirklich gab:
// nie erschienene Nummern nicht, und je Figur nur die Farben, in denen sie erschienen ist.
import { istModerator, MERCH_KATEGORIEN } from '../../shared/konstanten.js';
import { ValidierungsFehler } from './validierung.js';
import { fotoDateiSql } from './cover.js';

const MAX_SPANNE = 2000;
const MAX_FARBEN = 40;

/** „82-96, 100“ → Set der Nummern (höchstens MAX_SPANNE). */
export function nummernAusText(text) {
  const menge = new Set();
  for (const teil of String(text ?? '').split(/[,;\s]+/).filter(Boolean)) {
    const m = teil.match(/^(\d{1,6})(?:[-–](\d{1,6}))?$/);
    if (!m) continue;
    const von = Number(m[1]);
    const bis = m[2] ? Number(m[2]) : von;
    for (let n = Math.min(von, bis); n <= Math.max(von, bis) && menge.size < MAX_SPANNE; n++) menge.add(n);
  }
  return menge;
}

/** Nummer einer Figur ohne Präfix: „#4“, „W12“, „ 4 “ → „4“ bzw. „12“; sonst der gekürzte Text (z. B. „4a“). */
export function normaleNummer(roh, praefix) {
  let t = String(roh ?? '').trim().replace(/^#/, '');
  if (praefix && t.toUpperCase().startsWith(praefix.toUpperCase())) t = t.slice(praefix.length);
  return t.trim().replace(/^#/, '').slice(0, 12) || null;
}

const farbenLesen = (json) => {
  try { const f = json ? JSON.parse(json) : []; return Array.isArray(f) ? f.filter((x) => x && typeof x.name === 'string') : []; } catch { return []; }
};

export function erstelleSerienDienst(db, { katalog = null, erweiterungen = null, vorschlaege = null } = {}) {
  const SICHTBAR = "(s.status = 'freigegeben' OR s.erstellt_von = @benutzer OR @moderator = 1)";
  const KATALOG_SICHTBAR = "(k.status = 'freigegeben' OR k.erstellt_von = @benutzer OR @moderator = 1)";
  const VARIANTE_SICHTBAR = "(v.status = 'freigegeben' OR v.erstellt_von = @benutzer OR @moderator = 1)";
  const par = (b) => ({ benutzer: b?.id ?? -1, moderator: istModerator(b) ? 1 : 0 });
  const moderiert = () => Boolean(katalog?.moderiert?.());

  const holeRoh = (id, b) => db.prepare(`SELECT s.* FROM serien s WHERE s.id = @id AND ${SICHTBAR}`).get({ id: Number(id), ...par(b) });
  const darfBearbeiten = (zeile, b) => Boolean(zeile && b && (istModerator(b) || (zeile.erstellt_von === b.id && zeile.status !== 'freigegeben')));

  function serieZuObjekt(z, b) {
    if (!z) return null;
    return {
      id: z.id, name: z.name, ueber_id: z.ueber_id, merch_kategorie: z.merch_kategorie, hersteller: z.hersteller, jahr: z.jahr,
      nummer_praefix: z.nummer_praefix, nummer_von: z.nummer_von, nummer_bis: z.nummer_bis, nicht_erschienen: z.nicht_erschienen,
      hinweis: z.hinweis, mit_farben: Boolean(z.mit_farben), farben: z.mit_farben ? farbenLesen(z.farben) : [], status: z.status, eigene: z.erstellt_von === b?.id, bearbeitbar: darfBearbeiten(z, b),
    };
  }

  /**
   * Figuren einer (Unter-)Serie mit ihren Farben und dem eigenen Besitz.
   * `nurFreigegeben`: nur freigegebene Figuren und Farben, ohne Fotos (z. B. für Erfolge – eigene Vorschläge zählen dort nicht).
   */
  function figurenVon(serieIds, b, { nurFreigegeben = false } = {}) {
    if (!serieIds.length) return [];
    const p = { ...par(nurFreigegeben ? null : b), ids: JSON.stringify(serieIds) };
    const figuren = db.prepare(`SELECT k.id, k.titel, k.cover_url, k.serie_id, k.serien_nummer, k.status, k.erstellt_von, s.status AS serie_status
      FROM katalog k JOIN serien s ON s.id = k.serie_id WHERE k.serie_id IN (SELECT value FROM json_each(@ids)) AND ${KATALOG_SICHTBAR}`).all(p);
    if (!figuren.length) return [];
    const kids = JSON.stringify(figuren.map((f) => f.id));
    const farben = db.prepare(`SELECT v.id, v.katalog_id, v.farbe, v.bezeichnung, v.status, v.erstellt_von FROM katalog_varianten v
      WHERE v.katalog_id IN (SELECT value FROM json_each(@kids)) AND ${VARIANTE_SICHTBAR}`).all({ ...p, kids });
    const besitz = db.prepare(`SELECT id, katalog_id, variante_id FROM artikel WHERE benutzer_id = @benutzer AND bestand = 'besitz'
      AND katalog_id IN (SELECT value FROM json_each(@kids))`).all({ benutzer: b?.id ?? -1, kids });
    // Fotos der Figuren (freigegeben oder eigene): je Farbe (Variante) und allgemein – das Foto der Figur zuerst, sonst die Verpackung
    const fotos = nurFreigegeben ? [] : db.prepare(`SELECT m.katalog_id, m.variante_id, '/api/dateien/' || ${fotoDateiSql('m')} AS url FROM medien m
      WHERE m.katalog_id IN (SELECT value FROM json_each(@kids)) AND m.art IN ('foto_figur', 'foto_karte_vorne', 'foto_vorne') AND m.mime LIKE 'image/%'
        AND (m.sichtbarkeit = 'freigegeben' OR m.benutzer_id = @benutzer)
      ORDER BY m.art IN ('foto_figur', 'foto_karte_vorne') DESC, m.sichtbarkeit = 'freigegeben' DESC, m.id`).all({ benutzer: b?.id ?? -1, kids });
    const fotoVon = (katalogId, varianteId) => fotos.find((x) => x.katalog_id === katalogId && x.variante_id === varianteId)?.url ?? null;
    // Vorschläge, die noch ein Foto als Beleg brauchen, um zur Moderation zu gehen
    const belegMoeglich = Boolean(b && moderiert() && !istModerator(b));
    return figuren.map((f) => {
      const meine = besitz.filter((a) => a.katalog_id === f.id);
      return {
        katalog_id: f.id, titel: f.titel, cover_url: f.cover_url, serie_id: f.serie_id, nummer: f.serien_nummer, status: f.status,
        // Bild der Kachel: Katalog-Bild, sonst ein Foto ohne Farbe, sonst irgendeins der Figur
        foto_url: f.cover_url ?? fotoVon(f.id, null) ?? fotos.find((x) => x.katalog_id === f.id)?.url ?? null,
        bearbeitbar: Boolean(b && (istModerator(b) || (f.erstellt_von === b.id && f.status !== 'freigegeben'))),
        beleg_fehlt: belegMoeglich && f.erstellt_von === b.id && f.status === 'privat' && f.serie_status === 'freigegeben',
        farben: farben.filter((v) => v.katalog_id === f.id).map((v) => ({
          variante_id: v.id, farbe: v.farbe || v.bezeichnung, status: v.status, eigener_vorschlag: v.erstellt_von === b?.id && v.status !== 'freigegeben',
          beleg_fehlt: belegMoeglich && v.erstellt_von === b.id && v.status === 'privat' && f.status === 'freigegeben',
          besitz: meine.filter((a) => a.variante_id === v.id).map((a) => a.id),
          foto_url: fotoVon(f.id, v.id),
        })),
        besitz: meine.map((a) => a.id),
      };
    });
  }

  /** Erwartete Nummern einer Unterserie (Bereich ohne nie erschienene) – leer, wenn kein Bereich gepflegt ist. */
  function erwarteteNummern(s) {
    if (!Number.isInteger(s.nummer_von) || !Number.isInteger(s.nummer_bis) || s.nummer_bis < s.nummer_von) return [];
    const nie = nummernAusText(s.nicht_erschienen);
    const liste = [];
    for (let n = s.nummer_von; n <= s.nummer_bis && liste.length < MAX_SPANNE; n++) if (!nie.has(n)) liste.push(String(n));
    return liste;
  }

  /** Fortschritt einer Unterserie: Figuren (je Nummer bzw. je Figur) und Farben (nur erschienene). */
  function fortschritt(s, figuren) {
    const erwartet = erwarteteNummern(s);
    const nie = nummernAusText(s.nicht_erschienen);
    const zaehlend = figuren.filter((f) => !(f.nummer && /^\d+$/.test(f.nummer) && nie.has(Number(f.nummer))));
    const figurenBesitz = zaehlend.filter((f) => f.besitz.length);
    const gesamtFiguren = erwartet.length
      ? new Set([...erwartet, ...zaehlend.map((f) => f.nummer ?? `id${f.katalog_id}`)]).size
      : zaehlend.length;
    const besessenNummern = new Set(figurenBesitz.map((f) => f.nummer ?? `id${f.katalog_id}`));
    const farben = s.mit_farben ? zaehlend.flatMap((f) => f.farben) : [];
    return {
      figuren: { besitz: besessenNummern.size, gesamt: gesamtFiguren },
      farben: { besitz: farben.filter((v) => v.besitz.length).length, gesamt: farben.length },
    };
  }

  const summe = (liste) => liste.reduce((a, f) => ({
    figuren: { besitz: a.figuren.besitz + f.figuren.besitz, gesamt: a.figuren.gesamt + f.figuren.gesamt },
    farben: { besitz: a.farben.besitz + f.farben.besitz, gesamt: a.farben.gesamt + f.farben.gesamt },
  }), { figuren: { besitz: 0, gesamt: 0 }, farben: { besitz: 0, gesamt: 0 } });

  /**
   * Alle sichtbaren Serien als Baum (Serie mit Unterserien), je mit eigenem Fortschritt. „Meine Serien“ (meine = true) stehen oben:
   * Serien, denen man folgt, aus denen man Figuren hat oder die man selbst angelegt hat.
   */
  function liste(b) {
    const zeilen = db.prepare(`SELECT s.* FROM serien s WHERE ${SICHTBAR} ORDER BY s.sortierung, s.name COLLATE NOCASE`).all(par(b));
    const figuren = figurenVon(zeilen.map((z) => z.id), b);
    const fort = new Map(zeilen.map((z) => [z.id, fortschritt(z, figuren.filter((f) => f.serie_id === z.id))]));
    const gefolgt = new Set(db.prepare('SELECT serie_id FROM serien_folgen WHERE benutzer_id = ?').pluck().all(b?.id ?? -1));
    const baum = zeilen.filter((z) => !z.ueber_id).map((z) => {
      const kinder = zeilen.filter((k) => k.ueber_id === z.id).map((k) => ({ ...serieZuObjekt(k, b), fortschritt: fort.get(k.id) }));
      const f = summe([fort.get(z.id), ...kinder.map((k) => k.fortschritt)]);
      const folge = gefolgt.has(z.id);
      const besitz = f.figuren.besitz > 0;
      return { ...serieZuObjekt(z, b), kinder, fortschritt: f, folge, meine: folge || besitz || z.erstellt_von === b?.id };
    });
    return [...baum.filter((s) => s.meine), ...baum.filter((s) => !s.meine)];
  }

  /**
   * Fortschritt je freigegebener Hauptserie, aus der jemand mindestens eine Figur besitzt (für Serien-Erfolge).
   * Es zählen nur freigegebene Serien, Figuren und Farben – eigene Vorschläge verändern den Stand nicht.
   */
  function fortschrittJeSerie(benutzerId) {
    const ids = db.prepare(`SELECT DISTINCT COALESCE(s.ueber_id, s.id) FROM artikel a JOIN katalog k ON k.id = a.katalog_id
      JOIN serien s ON s.id = k.serie_id WHERE a.benutzer_id = ? AND a.bestand = 'besitz'`).pluck().all(benutzerId);
    const b = { id: benutzerId };
    return ids.map((id) => {
      const z = db.prepare("SELECT * FROM serien WHERE id = ? AND status = 'freigegeben' AND ueber_id IS NULL").get(id);
      if (!z) return null;
      const kinder = db.prepare("SELECT * FROM serien WHERE ueber_id = ? AND status = 'freigegeben'").all(z.id);
      const figuren = figurenVon([z.id, ...kinder.map((k) => k.id)], b, { nurFreigegeben: true });
      const f = summe([z, ...kinder].map((s) => fortschritt(s, figuren.filter((x) => x.serie_id === s.id))));
      return { serie_id: z.id, name: z.name, besitz: f.figuren.besitz, gesamt: f.figuren.gesamt };
    }).filter((x) => x && x.besitz > 0);
  }

  /** Einer Hauptserie folgen bzw. nicht mehr folgen („Meine Serien“). */
  function folgen(b, id, an) {
    const z = holeRoh(id, b);
    if (!z) return null;
    const haupt = z.ueber_id ? holeRoh(z.ueber_id, b) ?? z : z;
    if (an) db.prepare('INSERT OR IGNORE INTO serien_folgen (benutzer_id, serie_id) VALUES (?, ?)').run(b.id, haupt.id);
    else db.prepare('DELETE FROM serien_folgen WHERE benutzer_id = ? AND serie_id = ?').run(b.id, haupt.id);
    return { serie_id: haupt.id, folge: Boolean(an) };
  }

  // Spiele zur Serie (Unterserien zeigen die Spiele ihrer Hauptserie)
  const spieleVon = (serieId, b) => db.prepare(`SELECT k.id, k.titel, k.erscheinungsjahr, k.cover_url, k.plattformen FROM serien_spiele ss
    JOIN katalog k ON k.id = ss.katalog_id WHERE ss.serie_id = @serie AND ${KATALOG_SICHTBAR} ORDER BY k.erscheinungsjahr, k.titel`)
    .all({ serie: serieId, ...par(b) })
    .map((k) => ({ ...k, plattformen: (() => { try { return JSON.parse(k.plattformen || '[]'); } catch { return []; } })() }));

  /** Spiele der (Haupt-)Serie festlegen – nur, wer die Serie bearbeiten darf; nur sichtbare Spiele des Katalogs. */
  function spieleSetzen(b, id, ids = []) {
    const z = holeRoh(id, b);
    if (!z) return null;
    const haupt = z.ueber_id ? holeRoh(z.ueber_id, b) ?? z : z;
    if (!darfBearbeiten(haupt, b)) throw new ValidierungsFehler({ serie: 'Spiele einer freigegebenen Serie kann nur die Moderation verknüpfen.' });
    const gueltig = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger))].slice(0, 20)
      .filter((kid) => db.prepare(`SELECT 1 FROM katalog k WHERE k.id = @id AND k.typ = 'spiel' AND ${KATALOG_SICHTBAR}`).get({ id: kid, ...par(b) }));
    db.transaction(() => {
      db.prepare('DELETE FROM serien_spiele WHERE serie_id = ?').run(haupt.id);
      for (const kid of gueltig) db.prepare('INSERT INTO serien_spiele (serie_id, katalog_id) VALUES (?, ?)').run(haupt.id, kid);
    })();
    return hole(z.id, b);
  }

  /** Figurenserien zu einem Spiel (für die Spieleseite): Name, Anzahl Figuren und eigener Besitz. */
  function zuSpiel(katalogId, b) {
    return db.prepare(`SELECT s.id, s.name, s.jahr, s.hersteller,
        (SELECT COUNT(*) FROM katalog f WHERE f.serie_id IN (SELECT id FROM serien WHERE id = s.id OR ueber_id = s.id) AND f.status = 'freigegeben') AS figuren,
        (SELECT COUNT(DISTINCT a.katalog_id) FROM artikel a JOIN katalog f ON f.id = a.katalog_id
          WHERE a.benutzer_id = @benutzer AND a.bestand = 'besitz' AND f.serie_id IN (SELECT id FROM serien WHERE id = s.id OR ueber_id = s.id)) AS besitz
      FROM serien_spiele ss JOIN serien s ON s.id = ss.serie_id WHERE ss.katalog_id = @katalog AND ${SICHTBAR} ORDER BY s.name`)
      .all({ katalog: Number(katalogId), ...par(b) });
  }

  /** Eine Serie mit Unterserien; bei einer Unterserie (oder Serie ohne Unterserien) die Figurenliste mit Farbtabelle. */
  function hole(id, b) {
    const z = holeRoh(id, b);
    if (!z) return null;
    const ueber = z.ueber_id ? serieZuObjekt(holeRoh(z.ueber_id, b), b) : null;
    const kinderZeilen = db.prepare(`SELECT s.* FROM serien s WHERE s.ueber_id = @id AND ${SICHTBAR} ORDER BY s.sortierung, s.name COLLATE NOCASE`).all({ id: z.id, ...par(b) });
    const alleFiguren = figurenVon([z.id, ...kinderZeilen.map((k) => k.id)], b);
    const kinder = kinderZeilen.map((k) => ({ ...serieZuObjekt(k, b), fortschritt: fortschritt(k, alleFiguren.filter((f) => f.serie_id === k.id)) }));
    const eigeneFiguren = alleFiguren.filter((f) => f.serie_id === z.id);
    const eigenerFortschritt = fortschritt(z, eigeneFiguren);
    // Zeilen der Tabelle: jede erwartete Nummer (auch ohne erfasste Figur), dazu alle Figuren außerhalb des Bereichs
    const nie = nummernAusText(z.nicht_erschienen);
    const erwartet = erwarteteNummern(z);
    const zeilen = erwartet.map((n) => ({ nummer: n, figuren: eigeneFiguren.filter((f) => f.nummer === n) }));
    for (const f of eigeneFiguren) {
      if (!erwartet.includes(f.nummer)) zeilen.push({ nummer: f.nummer, figuren: [f], nicht_erschienen: Boolean(f.nummer && nie.has(Number(f.nummer))) });
    }
    zeilen.sort((a, c) => (Number(a.nummer) || Infinity) - (Number(c.nummer) || Infinity) || String(a.nummer ?? '').localeCompare(String(c.nummer ?? ''))
      || String(a.figuren[0]?.titel ?? '').localeCompare(String(c.figuren[0]?.titel ?? '')));
    // Spalten: Farbpalette der Serie, dazu Farben, die bei Figuren gepflegt sind, aber in der Palette fehlen
    const palette = z.mit_farben ? farbenLesen(z.farben) : [];
    const extra = z.mit_farben ? [...new Set(eigeneFiguren.flatMap((f) => f.farben.map((v) => v.farbe)))].filter((f) => !palette.some((p) => p.name === f)) : [];
    return {
      ...serieZuObjekt(z, b), ueber, kinder,
      spiele: spieleVon(z.ueber_id ?? z.id, b),
      spalten: [...palette, ...extra.map((name) => ({ name, hex: null }))],
      zeilen,
      fortschritt: kinder.length ? summe([eigenerFortschritt, ...kinder.map((k) => k.fortschritt)]) : eigenerFortschritt,
      fortschritt_eigen: eigenerFortschritt,
    };
  }

  function pruefe(eingabe, b, vorher = null) {
    const fehler = {};
    const text = (wert, max) => { const t = String(wert ?? '').trim(); return t ? t.slice(0, max) : null; };
    const zahl = (wert, min, max, feld) => {
      if (wert === undefined || wert === null || wert === '') return null;
      const n = Number(wert);
      if (!Number.isInteger(n) || n < min || n > max) { fehler[feld] = `Bitte eine Zahl von ${min} bis ${max}.`; return null; }
      return n;
    };
    const d = {
      name: text(eingabe.name, 100),
      hersteller: text(eingabe.hersteller, 80),
      jahr: zahl(eingabe.jahr, 1950, 2100, 'jahr'),
      nummer_praefix: text(eingabe.nummer_praefix, 5),
      nummer_von: zahl(eingabe.nummer_von, 0, 100000, 'nummer_von'),
      nummer_bis: zahl(eingabe.nummer_bis, 0, 100000, 'nummer_bis'),
      nicht_erschienen: text(eingabe.nicht_erschienen, 200),
      hinweis: text(eingabe.hinweis, 500),
      merch_kategorie: MERCH_KATEGORIEN.some((k) => k.value === eingabe.merch_kategorie) ? eingabe.merch_kategorie : (vorher?.merch_kategorie ?? 'figur'),
      // Farbvarianten (z. B. Monster in my Pocket) – bei Funko Pop! & Co. aus; Unterserien übernehmen sonst die Einstellung der Hauptserie
      mit_farben: eingabe.mit_farben === undefined ? null : (eingabe.mit_farben === true || eingabe.mit_farben === 1 || eingabe.mit_farben === 'true' ? 1 : 0),
    };
    if (!d.name) fehler.name = 'Bitte einen Namen angeben.';
    if (d.nummer_von !== null && d.nummer_bis !== null && (d.nummer_bis < d.nummer_von || d.nummer_bis - d.nummer_von >= MAX_SPANNE)) {
      fehler.nummer_bis = `Der Bereich muss aufsteigend sein und höchstens ${MAX_SPANNE} Nummern umfassen.`;
    }
    if ((d.nummer_von === null) !== (d.nummer_bis === null)) fehler.nummer_bis = 'Bitte Anfang und Ende des Nummernbereichs angeben.';
    let farben = Array.isArray(eingabe.farben) ? eingabe.farben : [];
    farben = farben.slice(0, MAX_FARBEN).map((f) => ({ name: text(typeof f === 'string' ? f : f?.name, 40), hex: /^#[0-9a-f]{6}$/i.test(f?.hex ?? '') ? f.hex.toLowerCase() : null }))
      .filter((f) => f.name);
    d.farben = farben.length ? JSON.stringify(farben.filter((f, i) => farben.findIndex((g) => g.name.toLowerCase() === f.name.toLowerCase()) === i)) : null;
    // Unterserie: nur unter einer Hauptserie (zwei Ebenen)
    if (eingabe.ueber_id !== undefined && eingabe.ueber_id !== null && eingabe.ueber_id !== '') {
      const ueber = holeRoh(eingabe.ueber_id, b);
      if (!ueber || ueber.ueber_id) fehler.ueber_id = 'Diese Serie kann keine Unterserie aufnehmen.';
      else if (vorher && ueber.id === vorher.id) fehler.ueber_id = 'Eine Serie kann nicht unter sich selbst stehen.';
      else { d.ueber_id = ueber.id; if (d.mit_farben === null) d.mit_farben = ueber.mit_farben ? 1 : 0; }
    } else d.ueber_id = null;
    // Status: Sammler reichen ein, die Moderation gibt frei
    const gewuenscht = eingabe.status ?? vorher?.status ?? 'privat';
    d.status = istModerator(b) ? (['privat', 'eingereicht', 'freigegeben'].includes(gewuenscht) ? gewuenscht : 'privat')
      : (gewuenscht === 'eingereicht' ? 'eingereicht' : (vorher?.status === 'freigegeben' ? 'freigegeben' : 'privat'));
    if (d.mit_farben === null) d.mit_farben = vorher ? (vorher.mit_farben ? 1 : 0) : 0;
    if (Object.keys(fehler).length) throw new ValidierungsFehler(fehler);
    return d;
  }

  function anlegen(b, eingabe = {}) {
    const d = pruefe(eingabe, b);
    const sortierung = db.prepare('SELECT COALESCE(MAX(sortierung), 0) + 1 FROM serien WHERE ueber_id IS @ueber_id').pluck().get({ ueber_id: d.ueber_id });
    const { id } = db.prepare(`INSERT INTO serien (name, ueber_id, merch_kategorie, hersteller, jahr, nummer_praefix, nummer_von, nummer_bis, nicht_erschienen, hinweis,
      farben, mit_farben, sortierung, status, erstellt_von) VALUES (@name, @ueber_id, @merch_kategorie, @hersteller, @jahr, @nummer_praefix, @nummer_von, @nummer_bis,
      @nicht_erschienen, @hinweis, @farben, @mit_farben, @sortierung, @status, @erstellt_von) RETURNING id`).get({ ...d, sortierung, erstellt_von: b.id });
    return hole(id, b);
  }

  function aendern(b, id, eingabe = {}) {
    const vorher = holeRoh(id, b);
    if (!vorher) return null;
    if (!darfBearbeiten(vorher, b)) throw new ValidierungsFehler({ serie: 'Freigegebene Serien kann nur die Moderation ändern.' });
    const d = pruefe({ ...serieZuObjekt(vorher, b), ...eingabe }, b, vorher);
    if (d.ueber_id && db.prepare('SELECT 1 FROM serien WHERE ueber_id = ?').get(vorher.id)) {
      throw new ValidierungsFehler({ ueber_id: 'Diese Serie hat selbst Unterserien und kann deshalb nicht untergeordnet werden.' });
    }
    db.prepare(`UPDATE serien SET name = @name, ueber_id = @ueber_id, merch_kategorie = @merch_kategorie, hersteller = @hersteller, jahr = @jahr,
      nummer_praefix = @nummer_praefix, nummer_von = @nummer_von, nummer_bis = @nummer_bis, nicht_erschienen = @nicht_erschienen, hinweis = @hinweis,
      farben = @farben, mit_farben = @mit_farben, status = @status WHERE id = @id`).run({ ...d, id: vorher.id });
    // Einreichen bzw. Freigeben einer Hauptserie gilt auch für ihre noch nicht freigegebenen Unterserien
    if (d.status !== vorher.status && ['eingereicht', 'freigegeben'].includes(d.status)) {
      db.prepare("UPDATE serien SET status = ? WHERE ueber_id = ? AND status <> 'freigegeben'").run(d.status, vorher.id);
    }
    return hole(vorher.id, b);
  }

  function loeschen(b, id) {
    const z = holeRoh(id, b);
    if (!z) return false;
    if (!darfBearbeiten(z, b)) throw new ValidierungsFehler({ serie: 'Freigegebene Serien kann nur die Moderation löschen.' });
    db.prepare('DELETE FROM serien WHERE id = ?').run(z.id); // Figuren behalten ihren Katalogeintrag (serie_id wird leer)
    return true;
  }

  /** Figur anlegen: eigener Katalogeintrag (Merch) mit Serie und Nummer – bei Moderatoren in freigegebenen Serien gleich freigegeben. */
  function figurAnlegen(b, serieId, eingabe = {}, katalogDienst = katalog) {
    const s = holeRoh(serieId, b);
    if (!s) return null;
    const titel = String(eingabe.titel ?? '').trim().slice(0, 200);
    if (!titel) throw new ValidierungsFehler({ titel: 'Bitte den Namen der Figur angeben.' });
    const nummer = normaleNummer(eingabe.nummer, s.nummer_praefix);
    const veroeffentlichen = istModerator(b) && s.status === 'freigegeben';
    // In freigegebenen Serien wächst die Liste mit der Community: neue Figuren sind zuerst privat und gehen mit einem Foto als Beleg zur Moderation
    const eintrag = katalogDienst.legeEigenenAn({ typ: 'merch', titel, plattformen: [] }, b, { veroeffentlichen });
    db.prepare('UPDATE katalog SET serie_id = ?, serien_nummer = ? WHERE id = ?').run(s.id, nummer, eintrag.id);
    const belegNoetig = eintrag.status === 'privat' && s.status === 'freigegeben' && moderiert() && !istModerator(b);
    return { katalog_id: eintrag.id, titel, nummer, status: eintrag.status, beleg_noetig: belegNoetig };
  }

  /** Figur bearbeiten (Name, Nummer, Unterserie) – eigene private oder als Moderation. */
  function figurAendern(b, katalogId, eingabe = {}) {
    const k = db.prepare('SELECT * FROM katalog WHERE id = ?').get(Number(katalogId));
    if (!k || !k.serie_id) return null;
    if (!(istModerator(b) || (k.erstellt_von === b.id && k.status !== 'freigegeben'))) throw new ValidierungsFehler({ figur: 'Freigegebene Figuren kann nur die Moderation ändern.' });
    const ziel = eingabe.serie_id ? holeRoh(eingabe.serie_id, b) : holeRoh(k.serie_id, b);
    if (!ziel) throw new ValidierungsFehler({ serie_id: 'Unbekannte Serie.' });
    const titel = eingabe.titel !== undefined ? String(eingabe.titel).trim().slice(0, 200) : k.titel;
    if (!titel) throw new ValidierungsFehler({ titel: 'Bitte den Namen der Figur angeben.' });
    const nummer = eingabe.nummer !== undefined ? normaleNummer(eingabe.nummer, ziel.nummer_praefix) : k.serien_nummer;
    db.prepare("UPDATE katalog SET titel = ?, serie_id = ?, serien_nummer = ?, aktualisiert_am = datetime('now') WHERE id = ?").run(titel, ziel.id, nummer, k.id);
    return { katalog_id: k.id, titel, nummer, serie_id: ziel.id };
  }

  /**
   * Farbe einer Figur setzen: „ja“ (gab es) oder „nein“ (gab es nicht – Ausgabe entfernen). Nur bei Serien mit Farben. Eine Farbe, die jemand
   * in der Sammlung hat, lässt sich nicht entfernen. (Früheres „selten“ wird wie „ja“ behandelt – Seltenheit ist eine Einschätzung, keine Tatsache.)
   */
  function farbeSetzen(b, katalogId, { farbe, zustand } = {}) {
    const k = db.prepare('SELECT * FROM katalog WHERE id = ?').get(Number(katalogId));
    if (!k || !k.serie_id) return null;
    const serie = db.prepare('SELECT mit_farben FROM serien WHERE id = ?').get(k.serie_id);
    if (!serie?.mit_farben) throw new ValidierungsFehler({ farbe: 'In dieser Serie gibt es keine Farbvarianten.' });
    const name = String(farbe ?? '').trim().slice(0, 40);
    if (!name) throw new ValidierungsFehler({ farbe: 'Bitte eine Farbe angeben.' });
    if (zustand === 'selten') zustand = 'ja';
    if (!['nein', 'ja'].includes(zustand)) throw new ValidierungsFehler({ zustand: 'Ungültige Angabe.' });
    const vorhanden = db.prepare(`SELECT * FROM katalog_varianten WHERE katalog_id = ? AND (farbe = ? OR (farbe IS NULL AND bezeichnung = ?))
      AND (status = 'freigegeben' OR erstellt_von = ? OR ?)`).get(k.id, name, name, b.id, istModerator(b) ? 1 : 0);
    const pflegt = istModerator(b) || (k.erstellt_von === b.id && k.status !== 'freigegeben');
    if (zustand === 'ja') {
      if (vorhanden) return { farbe: name, zustand, variante_id: vorhanden.id, status: vorhanden.status };
      // Moderation bei freigegebenen Figuren direkt; Sammler schlagen vor – zuerst privat, mit Foto als Beleg geht es an die Moderation
      const status = istModerator(b) && k.status === 'freigegeben' ? 'freigegeben' : 'privat';
      const { id } = db.prepare(`INSERT INTO katalog_varianten (katalog_id, bezeichnung, farbe, status, erstellt_von)
        VALUES (?, ?, ?, ?, ?) RETURNING id`).get(k.id, name, name, status, b.id);
      return { farbe: name, zustand, variante_id: id, status, beleg_noetig: !pflegt && k.status === 'freigegeben' && moderiert() };
    }
    if (!vorhanden) return { farbe: name, zustand };
    const eigenerVorschlag = vorhanden.erstellt_von === b.id && vorhanden.status !== 'freigegeben';
    if (!pflegt && !eigenerVorschlag) throw new ValidierungsFehler({ farbe: 'Diese Farbe ist schon erfasst – Änderungen daran pflegt die Moderation.' });
    if (db.prepare('SELECT 1 FROM artikel WHERE variante_id = ? LIMIT 1').get(vorhanden.id)) {
      throw new ValidierungsFehler({ farbe: 'Diese Farbe steht bereits in einer Sammlung und kann nicht entfernt werden.' });
    }
    db.prepare('DELETE FROM katalog_varianten WHERE id = ?').run(vorhanden.id);
    return { farbe: name, zustand };
  }

  /**
   * Liste einfügen (wer die Serie pflegen darf): je Zeile „Nr; Name; Farben“. Die Farben stehen in der Reihenfolge der Farbspalten der Serie:
   * x (oder R) = gibt es, - = gab es nicht (fehlende Angaben bleiben unverändert). Vorhandene Figuren (gleiche Nummer und gleicher Name)
   * werden ergänzt, neue angelegt. Trennzeichen: Semikolon oder Tabulator.
   */
  function listeEinfuegen(b, serieId, text) {
    const s = holeRoh(serieId, b);
    if (!s) return null;
    if (!darfBearbeiten(s, b)) throw new ValidierungsFehler({ liste: 'Listen einfügen kann, wer die Serie pflegt.' });
    const palette = farbenLesen(s.farben).map((f) => f.name);
    const ergebnis = { neu: 0, ergaenzt: 0, farben: 0, fehler: [] };
    const zeilen = String(text ?? '').split(/\r?\n/).map((z) => z.trim()).filter(Boolean).slice(0, 1000);
    db.transaction(() => {
      zeilen.forEach((zeile, i) => {
        const teile = zeile.split(/\t|;/).map((t) => t.trim());
        const [nrRoh, titel, farbenRoh = ''] = teile;
        if (!titel) { ergebnis.fehler.push(`Zeile ${i + 1}: Name fehlt`); return; }
        const nummer = normaleNummer(nrRoh, s.nummer_praefix);
        let figur = db.prepare('SELECT id FROM katalog WHERE serie_id = ? AND COALESCE(serien_nummer, \'\') = COALESCE(?, \'\') AND titel = ? COLLATE NOCASE').get(s.id, nummer, titel);
        if (figur) ergebnis.ergaenzt++;
        else {
          figur = { id: figurAnlegen(b, s.id, { nummer, titel }).katalog_id };
          ergebnis.neu++;
        }
        // Farben: entweder Einzelzeichen je Spalte („x - R x“) oder durch Leerzeichen getrennte Angaben (weitere Spalten wie Tabulator sind auch erlaubt)
        const angaben = (teile.length > 3 ? teile.slice(2) : farbenRoh.split(/\s+/)).filter((a) => a !== '');
        if (s.mit_farben) angaben.slice(0, palette.length).forEach((a, j) => {
          const zustand = /^[xr✓]$/i.test(a) ? 'ja' : /^[-–]$/.test(a) ? 'nein' : null;
          if (!zustand) return;
          try { farbeSetzen(b, figur.id, { farbe: palette[j], zustand }); if (zustand !== 'nein') ergebnis.farben++; } catch (e) { ergebnis.fehler.push(`Zeile ${i + 1}, ${palette[j]}: ${Object.values(e.fehler ?? {})[0] ?? e.message}`); }
        });
      });
    })();
    return ergebnis;
  }

  /**
   * Foto als Beleg zu einem eigenen Vorschlag (neue Figur in einer freigegebenen Serie oder neue Farbe einer freigegebenen Figur):
   * Das Foto sieht nur die Moderation, der Vorschlag geht damit in die Warteschlange.
   */
  async function belegHinzu(b, katalogId, varianteId, datei) {
    if (!moderiert() || !vorschlaege) throw new ValidierungsFehler({ beleg: 'Hier gibt es keine Moderation, die Vorschläge prüft.' });
    const k = db.prepare('SELECT k.*, s.status AS serie_status FROM katalog k JOIN serien s ON s.id = k.serie_id WHERE k.id = ?').get(Number(katalogId));
    if (!k) return null;
    if (varianteId) {
      const v = db.prepare('SELECT * FROM katalog_varianten WHERE id = ? AND katalog_id = ?').get(Number(varianteId), k.id);
      if (!v || v.erstellt_von !== b.id || !['privat', 'eingereicht'].includes(v.status) || k.status !== 'freigegeben') return null;
      await vorschlaege.belegSpeichern(b, { katalogId: k.id, varianteId: v.id }, datei);
      if (v.status === 'privat') {
        db.prepare("UPDATE katalog_varianten SET status = 'eingereicht', eingereicht_am = datetime('now') WHERE id = ?").run(v.id);
        erweiterungen?.melde('katalog.eingereicht');
      }
      return { status: 'eingereicht', fotos: vorschlaege.variantenFotos(v.id).length };
    }
    if (k.erstellt_von !== b.id || !['privat', 'eingereicht'].includes(k.status) || k.serie_status !== 'freigegeben') return null;
    await vorschlaege.belegSpeichern(b, { katalogId: k.id }, datei);
    if (k.status === 'privat') {
      db.prepare("UPDATE katalog SET status = 'eingereicht', eingereicht_am = datetime('now') WHERE id = ?").run(k.id);
      erweiterungen?.melde('katalog.eingereicht');
    }
    return { status: 'eingereicht', fotos: vorschlaege.fotos(k.id).length };
  }

  /** Eigene (selbst angelegte) Serien – für Datenauskunft und Export. */
  const eigene = (benutzerId) => db.prepare('SELECT id, name, ueber_id, status, erstellt_am FROM serien WHERE erstellt_von = ?').all(benutzerId);

  return { liste, folgen, hole, fortschrittJeSerie, spieleSetzen, zuSpiel, anlegen, aendern, loeschen, figurAnlegen, figurAendern, farbeSetzen, listeEinfuegen, belegHinzu, eigene };
}
