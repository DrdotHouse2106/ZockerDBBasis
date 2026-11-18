// Datenpakete: Stammdaten wie Figurenserien (Serie, Unterserien, Figuren mit Farben) als Datei statt als Migration.
// Jedes Paket aus pakete/index.js wird beim Start einmal eingespielt; ändert sich die Datei, wird es erneut abgeglichen.
// Eingespielt wird nur, was fehlt – vorhandene Serien, Figuren und Farben (auch von der Community gepflegte) bleiben unverändert.
// Ein Paket darf nach dem Einspielen auf dem Server wieder entfernt werden (die Daten bleiben in der Datenbank).
// Aufbau und Anleitung: pakete/LIESMICH.md
import crypto from 'node:crypto';
import { normaleNummer } from '../services/serien.js';

const farbenAlsJson = (farben) => JSON.stringify(farben.map((f) => (typeof f === 'string' ? { name: f, hex: null } : { name: f.name, hex: f.hex ?? null })));
const leseFarben = (json) => { try { return JSON.parse(json || '[]'); } catch { return []; } };

/** Prüfsumme des Paketinhalts – ändert sich das Paket, wird es erneut abgeglichen. */
export const paketPruefsumme = (paket) => crypto.createHash('sha256').update(JSON.stringify(paket)).digest('hex');

/** Ein Paket einspielen (idempotent). Liefert, was neu angelegt wurde. */
export function paketEinspielen(db, paket) {
  const ergebnis = { serien: 0, figuren: 0, farben: 0 };
  const q = {
    serie: db.prepare('SELECT * FROM serien WHERE name = ? AND ueber_id IS ?'),
    neueSerie: db.prepare(`INSERT INTO serien (name, ueber_id, merch_kategorie, hersteller, jahr, nummer_praefix, nummer_von, nummer_bis, nicht_erschienen,
      hinweis, farben, mit_farben, sortierung, status) VALUES (@name, @ueber_id, @merch_kategorie, @hersteller, @jahr, @nummer_praefix, @nummer_von, @nummer_bis,
      @nicht_erschienen, @hinweis, @farben, @mit_farben, @sortierung, 'freigegeben') RETURNING *`),
    sortierung: db.prepare('SELECT COALESCE(MAX(sortierung), 0) + 1 FROM serien WHERE ueber_id IS ?').pluck(),
    figur: db.prepare("SELECT id FROM katalog WHERE serie_id = ? AND COALESCE(serien_nummer, '') = COALESCE(?, '') AND titel = ? COLLATE NOCASE"),
    neueFigur: db.prepare(`INSERT OR IGNORE INTO katalog (quelle, externe_id, typ, titel, plattformen, hersteller, erscheinungsjahr, status, serie_id, serien_nummer)
      VALUES ('eigen', @externe_id, 'merch', @titel, '[]', @hersteller, @jahr, 'freigegeben', @serie_id, @nummer) RETURNING id`),
    farbe: db.prepare('SELECT 1 FROM katalog_varianten WHERE katalog_id = ? AND (farbe = ? OR bezeichnung = ?)'),
    neueFarbe: db.prepare("INSERT INTO katalog_varianten (katalog_id, bezeichnung, farbe, status) VALUES (?, ?, ?, 'freigegeben')"),
  };

  /** Serie holen oder anlegen; Farben, Nummernbereich und Hinweis nur ergänzen, wo noch nichts gepflegt ist. */
  function serieVon(angaben, ueber = null) {
    let s = q.serie.get(angaben.name, ueber?.id ?? null);
    if (!s) {
      s = q.neueSerie.get({
        name: angaben.name, ueber_id: ueber?.id ?? null, merch_kategorie: angaben.merch_kategorie ?? ueber?.merch_kategorie ?? 'figur',
        hersteller: angaben.hersteller ?? ueber?.hersteller ?? null, jahr: angaben.jahr ?? null, nummer_praefix: angaben.nummer_praefix ?? null,
        nummer_von: angaben.nummer_von ?? null, nummer_bis: angaben.nummer_bis ?? null, nicht_erschienen: angaben.nicht_erschienen ?? null,
        hinweis: angaben.hinweis ?? null, farben: angaben.farben?.length ? farbenAlsJson(angaben.farben) : null,
        mit_farben: (angaben.mit_farben ?? Boolean(ueber?.mit_farben)) ? 1 : 0, sortierung: q.sortierung.get(ueber?.id ?? null),
      });
      ergebnis.serien += 1;
      return s;
    }
    const setze = (spalte, wert) => db.prepare(`UPDATE serien SET ${spalte} = ? WHERE id = ?`).run(wert, s.id);
    if (angaben.farben?.length && !leseFarben(s.farben).length) setze('farben', farbenAlsJson(angaben.farben));
    if (angaben.nummer_von !== undefined) setze('nummer_von', angaben.nummer_von);
    if (angaben.nummer_bis !== undefined) setze('nummer_bis', angaben.nummer_bis);
    if (angaben.nicht_erschienen && !s.nicht_erschienen) setze('nicht_erschienen', angaben.nicht_erschienen);
    if (angaben.hinweis && !s.hinweis) setze('hinweis', angaben.hinweis);
    return q.serie.get(angaben.name, ueber?.id ?? null);
  }

  /** Figuren einer Serie aus der Liste „Nr; Name; Farben“ (x = gab es, - = gab es nicht, ? = unbekannt). */
  function figuren(s, liste = '') {
    const palette = leseFarben(s.farben).map((f) => f.name);
    for (const zeile of String(liste).split('\n').map((z) => z.trim()).filter(Boolean)) {
      const [nrRoh, titel, farbenRoh = ''] = zeile.split(';').map((t) => t.trim());
      if (!titel || titel === '?') continue;
      const nummer = normaleNummer(nrRoh, s.nummer_praefix);
      let id = q.figur.get(s.id, nummer, titel)?.id;
      if (!id) {
        id = q.neueFigur.get({ externe_id: `paket:${s.id}:${nummer ?? titel}`, titel, hersteller: s.hersteller, jahr: s.jahr, serie_id: s.id, nummer })?.id;
        if (!id) continue;
        ergebnis.figuren += 1;
      }
      if (!s.mit_farben) continue;
      farbenRoh.split(/\s+/).filter(Boolean).slice(0, palette.length).forEach((a, j) => {
        if (!/^[xr✓]$/i.test(a) || q.farbe.get(id, palette[j], palette[j])) return;
        q.neueFarbe.run(id, palette[j], palette[j]);
        ergebnis.farben += 1;
      });
    }
  }

  db.transaction(() => {
    const haupt = serieVon(paket.serie);
    figuren(haupt, paket.serie.liste);
    for (const unter of paket.unterserien ?? []) figuren(serieVon(unter, haupt), unter.liste);
  })();
  return ergebnis;
}

/** Alle Pakete abgleichen, deren Inhalt neu ist oder sich geändert hat. Fehler eines Pakets halten den Start nicht auf. */
export function datenpaketeEinspielen(db, pakete) {
  const stand = db.prepare('SELECT pruefsumme FROM datenpakete WHERE name = ?').pluck();
  const merken = db.prepare(`INSERT INTO datenpakete (name, pruefsumme, eingespielt_am) VALUES (?, ?, datetime('now'))
    ON CONFLICT (name) DO UPDATE SET pruefsumme = excluded.pruefsumme, eingespielt_am = excluded.eingespielt_am`);
  const berichte = [];
  for (const paket of pakete) {
    const summe = paketPruefsumme(paket);
    if (stand.get(paket.name) === summe) continue;
    try {
      const r = paketEinspielen(db, paket);
      merken.run(paket.name, summe);
      berichte.push({ name: paket.name, ...r });
    } catch (fehler) {
      console.warn(`[datenpakete] ${paket.name}: ${fehler.message}`);
    }
  }
  return berichte;
}
