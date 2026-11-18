// CSV-Import (CLZ Games, Tabellen, eigener CSV-Export): erst analysieren, dann mit (angepasster) Spaltenzuordnung importieren.
import { Router } from 'express';
import { leseCsv, erkenneZuordnung, zeileZuArtikel, IMPORT_FELDER } from '../services/csvimport.js';
import { pruefeArtikel, ValidierungsFehler } from '../services/validierung.js';

const MAX_ZEILEN = 5000;

export function importCsvRouter({ db, plattformen, erweiterungen, nachzuordnung, dateien }) {
  const router = Router();
  const felder = ['benutzer_id', 'typ', 'titel', 'plattform', 'plattform_id', 'katalog_id', 'barcode', 'zustand', 'vollstaendigkeit', 'region',
    'farbe', 'edition', 'modellnummer', 'seriennummer', 'notizen', 'kaufpreis', 'kaufdatum', 'anzahl', 'marktwert', 'importiert_aus', 'merch_kategorie', 'bestand',
    'lagerort_ort', 'lagerort_regal', 'lagerort_fach', 'spielstatus', 'durchgespielt_am', 'import_id'];
  const einfuegen = db.prepare(`INSERT INTO artikel (${felder.join(', ')}) VALUES (${felder.map((f) => `@${f}`).join(', ')})`);
  // Abgleich mit dem öffentlichen Katalog: gleicher Titel, möglichst gleiche Plattform – nur bei eindeutigem Treffer
  // (auch über den Originaltitel – CLZ Games exportiert oft englische Titel, der Katalog zeigt deutsche)
  // Zwei Abfragen statt „titel = … OR titel_original = …“: so nutzt jede ihren Index (mit OR durchsuchte SQLite den ganzen Katalog – je Zeile).
  // „+k.status“/„+k.typ“ halten SQLite davon ab, stattdessen den Index auf status zu nehmen (der trifft fast alle Einträge).
  const trefferNach = (spalte) => db.prepare(`SELECT k.id FROM katalog k
    WHERE k.${spalte} = @titel COLLATE NOCASE AND +k.status = 'freigegeben' AND +k.typ = @typ
      AND (@plattform IS NULL OR EXISTS (SELECT 1 FROM katalog_plattformen kp WHERE kp.katalog_id = k.id AND kp.plattform_id = @plattform))
    LIMIT 2`);
  const nachTitel = trefferNach('titel');
  const nachOriginal = trefferNach('titel_original');
  const katalogTreffer = { all: (p) => { const t = nachTitel.all(p); return t.length ? t : nachOriginal.all(p); } };
  // Zuerst über den Barcode: bekannte Zuordnungen (eigene zuerst, dann die häufigste), passend zu Typ und Plattform
  const barcodeTreffer = db.prepare(`SELECT k.id FROM barcode_zuordnungen z JOIN katalog k ON k.id = z.katalog_id
    WHERE z.code = @code AND k.status = 'freigegeben' AND k.typ = @typ
      AND (@plattform IS NULL OR EXISTS (SELECT 1 FROM katalog_plattformen kp WHERE kp.katalog_id = k.id AND kp.plattform_id = @plattform))
    GROUP BY k.id ORDER BY SUM(z.benutzer_id = @benutzer) DESC, COUNT(*) DESC LIMIT 1`);

  function lies(req) {
    const text = String(req.body?.text ?? '');
    if (!text.trim()) throw new ValidierungsFehler({ datei: 'Die Datei ist leer.' });
    const csv = leseCsv(text);
    if (!csv.kopf.length || !csv.zeilen.length) throw new ValidierungsFehler({ datei: 'Keine Datenzeilen gefunden. Die erste Zeile muss die Spaltenüberschriften enthalten.' });
    if (csv.zeilen.length > MAX_ZEILEN) throw new ValidierungsFehler({ datei: `Maximal ${MAX_ZEILEN.toLocaleString('de-DE')} Zeilen pro Import. Bitte die Datei aufteilen.` });
    return csv;
  }

  function vorbereiten(artikel) {
    const p = plattformen.zuordnen(artikel.plattform);
    return { ...artikel, plattform_id: p?.id ?? null, plattform: p?.name ?? artikel.plattform };
  }

  router.post('/import/csv/analyse', (req, res) => {
    const csv = lies(req);
    const zuordnung = erkenneZuordnung(csv.kopf);
    res.json({
      trennzeichen: csv.trennzeichen,
      kopf: csv.kopf,
      zeilen: csv.zeilen.length,
      felder: IMPORT_FELDER.map(({ feld, titel, pflicht }) => ({ feld, titel, pflicht: Boolean(pflicht) })),
      zuordnung,
      vorschau: csv.zeilen.slice(0, 8).map((z) => vorbereiten(zeileZuArtikel(z, zuordnung))),
    });
  });

  router.post('/import/csv', (req, res) => {
    const csv = lies(req);
    const zuordnung = {};
    for (const { feld } of IMPORT_FELDER) {
      const i = req.body?.zuordnung?.[feld];
      if (Number.isInteger(i) && i >= 0 && i < csv.kopf.length) zuordnung[feld] = i;
    }
    if (zuordnung.titel === undefined) throw new ValidierungsFehler({ zuordnung: 'Bitte die Spalte für den Titel auswählen.' });
    const standardTyp = ['spiel', 'konsole', 'zubehoer', 'merch'].includes(req.body?.standardTyp) ? req.body.standardTyp : 'spiel';
    const abgleich = req.body?.katalogAbgleich !== false;

    let importiert = 0;
    let verknuepft = 0;
    const fehlerhaft = [];
    let importId = null;
    db.transaction(() => {
      // Der Import bekommt eine Kennung – darüber lässt er sich später rückgängig machen
      const dateiname = typeof req.body?.datei === 'string' ? req.body.datei.replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 120) || null : null;
      importId = db.prepare('INSERT INTO importe (benutzer_id, quelle, datei) VALUES (?, ?, ?) RETURNING id').pluck().get(req.benutzer.id, 'csv', dateiname);
      csv.zeilen.forEach((zeile, index) => {
        try {
          const roh = zeileZuArtikel(zeile, zuordnung, { standardTyp });
          // z. B. CLZ „Wish List“: nicht in die Sammlung übernehmen, aber in der Liste der übersprungenen Zeilen nennen
          if (roh.ueberspringen) throw new ValidierungsFehler({ sammlungsstatus: roh.ueberspringen });
          const artikel = vorbereiten(pruefeArtikel(roh));
          artikel.katalog_id = null;
          if (abgleich) {
            const perBarcode = artikel.barcode
              ? barcodeTreffer.get({ code: artikel.barcode, typ: artikel.typ, plattform: artikel.plattform_id, benutzer: req.benutzer.id }) : null;
            const treffer = perBarcode ? [perBarcode] : katalogTreffer.all({ titel: artikel.titel, typ: artikel.typ, plattform: artikel.plattform_id });
            if (treffer.length === 1) { artikel.katalog_id = treffer[0].id; verknuepft++; }
          }
          einfuegen.run({ ...artikel, benutzer_id: req.benutzer.id, importiert_aus: 'csv', import_id: importId });
          importiert++;
        } catch (fehler) {
          if (!(fehler instanceof ValidierungsFehler)) throw fehler;
          if (fehlerhaft.length < 200) fehlerhaft.push({ zeile: index + 2, titel: zeile[zuordnung.titel] ?? null, fehler: fehler.fehler });
        }
      });
      if (importiert) db.prepare('UPDATE importe SET anzahl = ? WHERE id = ?').run(importiert, importId);
      else db.prepare('DELETE FROM importe WHERE id = ?').run(importId);
    })();
    erweiterungen.melde('benutzer.geaendert', req.benutzer.id);
    // Was ohne genauen Treffer blieb, im Hintergrund weiter zuordnen (tolerant und notfalls online) – die Antwort wartet nicht darauf
    const nachtrag = abgleich && importiert > verknuepft ? nachzuordnung?.starte(req.benutzer) ?? null : null;
    res.json({ importiert, verknuepft, fehlerhaft, fehlerGesamt: csv.zeilen.length - importiert, nachzuordnung: nachtrag, import_id: importiert ? importId : null });
  });

  // ── Letzte Importe und Rückgängigmachen ──
  // „bearbeitet“ = seit dem Import geändert (aktualisiert_am später als erstellt_am) oder mit eigenem Foto; die automatische
  // Katalog-Zuordnung zählt nicht als Bearbeitung
  const BEARBEITET = "(a.aktualisiert_am > a.erstellt_am OR a.bild_datei IS NOT NULL)";
  const importListe = db.prepare(`SELECT i.id, i.quelle, i.datei, i.anzahl, i.erstellt_am, i.rueckgaengig_am,
      (SELECT COUNT(*) FROM artikel a WHERE a.import_id = i.id) AS vorhanden,
      (SELECT COUNT(*) FROM artikel a WHERE a.import_id = i.id AND ${BEARBEITET}) AS bearbeitet,
      (SELECT COUNT(*) FROM artikel a WHERE a.import_id = i.id AND a.katalog_id IS NULL) AS ohne_katalog
    FROM importe i WHERE i.benutzer_id = ? ORDER BY i.id DESC LIMIT 10`);
  router.get('/import/liste', (req, res) => res.json({ importe: importListe.all(req.benutzer.id) }));

  router.delete('/import/:id', (req, res) => {
    const imp = db.prepare('SELECT * FROM importe WHERE id = ? AND benutzer_id = ?').get(Number(req.params.id), req.benutzer.id);
    if (!imp) return res.status(404).json({ fehler: 'Import nicht gefunden.' });
    const nurUnveraendert = req.query.nur_unveraendert === '1';
    const zeilen = db.prepare(`SELECT a.id, a.bild_datei FROM artikel a WHERE a.import_id = ? AND a.benutzer_id = ?${nurUnveraendert ? ` AND NOT ${BEARBEITET}` : ''}`)
      .all(imp.id, req.benutzer.id);
    db.transaction(() => {
      const loeschen = db.prepare('DELETE FROM artikel WHERE id = ?');
      for (const z of zeilen) loeschen.run(z.id);
      if (!db.prepare('SELECT 1 FROM artikel WHERE import_id = ?').get(imp.id)) db.prepare("UPDATE importe SET rueckgaengig_am = datetime('now') WHERE id = ?").run(imp.id);
    })();
    dateien?.loesche(zeilen.map((z) => z.bild_datei).filter(Boolean));
    erweiterungen.melde('benutzer.geaendert', req.benutzer.id);
    res.json({ entfernt: zeilen.length, uebrig: db.prepare('SELECT COUNT(*) FROM artikel WHERE import_id = ?').pluck().get(imp.id) });
  });

  // Nachträgliche Zuordnung für Exemplare ohne Katalogtreffer: starten (alle = auch schon vergeblich versuchte) und Stand abfragen
  router.post('/import/zuordnen', (req, res) => res.json(nachzuordnung.starte(req.benutzer, { alle: req.body?.alle !== false })));
  router.get('/import/zuordnen', (req, res) => res.json(nachzuordnung.stand(req.benutzer.id)));
  router.get('/import/zuordnen/liste', (req, res) => res.json(nachzuordnung.liste(req.benutzer, { ab: Number(req.query.ab) || 0 })));

  return router;
}
