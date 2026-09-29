import crypto from 'node:crypto';
import { Router } from 'express';
import {
  ARTIKELTYPEN, ZUSTAENDE, VOLLSTAENDIGKEITEN, REGIONEN, HERKUNFT, BESTAND, beschriftung,
} from '../../shared/konstanten.js';
import { pruefeArtikel, ValidierungsFehler } from '../services/validierung.js';

const CSV_SPALTEN = [
  ['id', 'ID'],
  ['typ', 'Artikeltyp', (w) => beschriftung(ARTIKELTYPEN, w)],
  ['titel', 'Titel'],
  ['plattform', 'Plattform'],
  ['region', 'Region', (w) => beschriftung(REGIONEN, w)],
  ['zustand', 'Zustand', (w) => beschriftung(ZUSTAENDE, w)],
  ['vollstaendigkeit', 'Vollständigkeit', (w) => beschriftung(VOLLSTAENDIGKEITEN, w)],
  ['farbe', 'Farbe'],
  ['edition', 'Edition/Variante'],
  ['modellnummer', 'Modellnummer'],
  ['seriennummer', 'Seriennummer'],
  ['barcode', 'Barcode'],
  ['anzahl', 'Anzahl'],
  ['kaufpreis', 'Kaufpreis (EUR)', (w) => (w == null ? '' : w.toFixed(2).replace('.', ','))],
  ['kaufdatum', 'Kaufdatum', (w) => (w ? w.split('-').reverse().join('.') : '')],
  ['herkunft', 'Herkunft', (w) => beschriftung(HERKUNFT, w)],
  ['konvolut_name', 'Konvolut'],
  ['marktwert', 'Marktwert (EUR)', (w) => (w == null ? '' : w.toFixed(2).replace('.', ','))],
  ['bestand', 'Bestand', (w) => beschriftung(BESTAND, w)],
  ['abgang_am', 'Verkauft/abgegeben am', (w) => (w ? w.split('-').reverse().join('.') : '')],
  ['verkaufspreis', 'Verkaufspreis (EUR)', (w) => (w == null ? '' : w.toFixed(2).replace('.', ','))],
  ['notizen', 'Eigene Notizen'],
  ['erstellt_am', 'Erfasst am'],
];

function csvFeld(wert) {
  let text = wert == null ? '' : String(wert);
  // Formel-Injektion in Excel/LibreOffice verhindern: Zellen, die mit = + - @ beginnen, als Text markieren
  if (typeof wert === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportRouter({ db, plattformen, erweiterungen }) {
  const router = Router();
  const datumHeute = () => new Date().toISOString().slice(0, 10);

  router.get('/export.json', (req, res) => {
    const artikel = db.prepare('SELECT * FROM artikel WHERE benutzer_id = ? ORDER BY id').all(req.benutzer.id)
      .map(({ benutzer_id: _b, bild_datei: _d, bild_groesse: _g, ...rest }) => rest);
    const eigeneKatalogeintraege = db.prepare(`SELECT * FROM katalog WHERE quelle = 'eigen'
      AND id IN (SELECT katalog_id FROM artikel WHERE benutzer_id = @b UNION SELECT id FROM katalog WHERE erstellt_von = @b)
      ORDER BY id`).all({ b: req.benutzer.id }).map(({ erstellt_von: _e, ...rest }) => rest);
    res.attachment(`zockerdb-${datumHeute()}.json`);
    const konvolute = db.prepare('SELECT * FROM konvolute WHERE benutzer_id = ? ORDER BY id').all(req.benutzer.id).map(({ benutzer_id: _b, ...rest }) => rest);
    res.json({ format: 'zockerdb', version: 1, exportiert_am: new Date().toISOString(), artikel, eigeneKatalogeintraege, konvolute });
  });

  /**
   * Datenauskunft (Art. 15 und 20 DSGVO): alle personenbezogenen Daten des Kontos in maschinenlesbarer Form.
   * Geheimnisse (Passwort-Hash, 2FA-Geheimnis, Zugangsdaten, Sitzungs-Tokens) werden nicht ausgegeben.
   */
  router.get('/export/datenauskunft.json', (req, res) => {
    const b = req.benutzer.id;
    const alle = (sql) => db.prepare(sql).all(b);
    const konto = db.prepare(`SELECT id, benutzername, anzeigename, email, rolle, gesperrt, totp_aktiv, sammlung_oeffentlich, benachrichtigung_email, steam_id,
        freigabe_token IS NOT NULL AS freigabe_link_aktiv, freigabe_wert, speicher_limit_mb, bedingungen_akzeptiert_am, erstellt_am, letzte_anmeldung
      FROM benutzer WHERE id = ?`).get(b);
    res.attachment(`zockerdb-datenauskunft-${datumHeute()}.json`);
    res.json({
      hinweis: 'Datenauskunft nach Art. 15 DSGVO. Nicht enthalten sind Geheimnisse wie Passwort-Hash, 2FA-Schlüssel, Sitzungs-Tokens und Zugangsdaten.',
      erstellt_am: new Date().toISOString(),
      konto: { ...konto, totp_aktiv: Boolean(konto.totp_aktiv) },
      angemeldete_geraete: alle('SELECT geraet, erstellt_am, laeuft_ab FROM sitzungen WHERE benutzer_id = ? AND stufe = \'voll\' ORDER BY erstellt_am'),
      sammlung: alle('SELECT * FROM artikel WHERE benutzer_id = ? ORDER BY id').map(({ benutzer_id: _b, ...rest }) => rest),
      konvolute: alle('SELECT * FROM konvolute WHERE benutzer_id = ? ORDER BY id').map(({ benutzer_id: _b, ...rest }) => rest),
      eigene_katalogeintraege: alle("SELECT id, typ, titel, plattformen, erscheinungsjahr, hersteller, status, erstellt_am FROM katalog WHERE erstellt_von = ? ORDER BY id"),
      scans_und_dokumente: alle('SELECT id, katalog_id, art, titel, sichtbarkeit, originalname, mime, groesse, erstellt_am FROM medien WHERE benutzer_id = ? ORDER BY id'),
      kommentare: alle('SELECT katalog_id, text, erstellt_am, aktualisiert_am FROM kommentare WHERE benutzer_id = ? ORDER BY id'),
      benachrichtigungen: alle('SELECT art, titel, text, gelesen, erstellt_am FROM benachrichtigungen WHERE benutzer_id = ? ORDER BY id'),
      // Daten aus Zusatzmodulen
      ...erweiterungen.sammle('datenauskunft', b),
    });
  });

  // CSV im deutschen Excel-Format: Semikolon als Trenner, Dezimalkomma, UTF-8 mit BOM.
  router.get('/export.csv', (req, res) => {
    const artikel = db.prepare(`SELECT a.*, k.name AS konvolut_name FROM artikel a LEFT JOIN konvolute k ON k.id = a.konvolut_id
      WHERE a.benutzer_id = ? ORDER BY a.titel COLLATE NOCASE`).all(req.benutzer.id);
    const zeilen = [
      CSV_SPALTEN.map(([, kopf]) => csvFeld(kopf)).join(';'),
      ...artikel.map((a) => CSV_SPALTEN.map(([feld, , format]) => csvFeld(format ? format(a[feld]) : a[feld])).join(';')),
    ];
    res.attachment(`zockerdb-${datumHeute()}.csv`);
    res.type('text/csv; charset=utf-8').send(`﻿${zeilen.join('\r\n')}\r\n`);
  });

  // Import einer zuvor exportierten JSON-Datei. Artikel werden ergänzt, nicht ersetzt.
  router.post('/import', (req, res) => {
    const daten = req.body;
    const liste = Array.isArray(daten) ? daten : daten?.artikel;
    if (!Array.isArray(liste)) return res.status(400).json({ fehler: 'Unbekanntes Dateiformat. Bitte eine Export-Datei dieser App verwenden.' });

    const katalogIds = new Map();
    const katalogEinfuegen = db.prepare(`
      INSERT INTO katalog (quelle, externe_id, typ, titel, plattformen, erscheinungsjahr, hersteller, cover_url, beschreibung, erstellt_von, status)
      VALUES ('eigen', @externe_id, @typ, @titel, @plattformen, @erscheinungsjahr, @hersteller, @cover_url, @beschreibung, @erstellt_von, 'privat')
      RETURNING id`);
    const eigenerMitExternerId = db.prepare("SELECT id, erstellt_von FROM katalog WHERE quelle = 'eigen' AND externe_id = ?");
    // Nur freigegebene oder eigene Katalogeinträge dürfen verknüpft werden
    const katalogVorhanden = db.prepare("SELECT id FROM katalog WHERE id = ? AND (status = 'freigegeben' OR erstellt_von = ?)");
    const felder = ['benutzer_id', 'typ', 'titel', 'plattform', 'katalog_id', 'barcode', 'cover_url', 'zustand', 'vollstaendigkeit', 'region',
      'farbe', 'edition', 'modellnummer', 'seriennummer', 'notizen', 'kaufpreis', 'kaufdatum', 'anzahl', 'marktwert', 'plattform_id',
      'herkunft', 'konvolut_id', 'kaufpreis_anteilig', 'bestand', 'abgang_am', 'verkaufspreis', 'digital_quelle'];
    const einfuegen = db.prepare(`INSERT INTO artikel (${felder.join(', ')}) VALUES (${felder.map((f) => `@${f}`).join(', ')})`);

    const fehlerhaft = [];
    let importiert = 0;
    // Konvolute neu anlegen (alte ID → neue ID)
    const konvolutIds = new Map();
    db.transaction(() => {
      for (const k of Array.isArray(daten?.konvolute) ? daten.konvolute : []) {
        if (!k?.name) continue;
        const { id } = db.prepare(`INSERT INTO konvolute (benutzer_id, name, preis, kaufdatum, quelle, notizen, aufteilung)
          VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(req.benutzer.id, String(k.name).slice(0, 200), Number.isFinite(k.preis) ? k.preis : null,
          /^\d{4}(-\d{2}(-\d{2})?)?$/.test(k.kaufdatum ?? '') ? k.kaufdatum : null, k.quelle ? String(k.quelle).slice(0, 200) : null,
          k.notizen ? String(k.notizen).slice(0, 5000) : null, k.aufteilung === 'wert' ? 'wert' : 'gleich');
        konvolutIds.set(k.id, id);
      }
      for (const eintrag of daten?.eigeneKatalogeintraege ?? []) {
        if (!eintrag?.titel || !eintrag?.externe_id) continue;
        const vorhanden = eigenerMitExternerId.get(String(eintrag.externe_id));
        if (vorhanden?.erstellt_von === req.benutzer.id) {
          katalogIds.set(eintrag.id, vorhanden.id);
          continue;
        }
        const { id } = katalogEinfuegen.get({
          externe_id: vorhanden ? crypto.randomUUID() : String(eintrag.externe_id), typ: eintrag.typ ?? 'spiel', titel: String(eintrag.titel),
          plattformen: typeof eintrag.plattformen === 'string' ? eintrag.plattformen : JSON.stringify(eintrag.plattformen ?? []),
          erscheinungsjahr: eintrag.erscheinungsjahr ?? null, hersteller: eintrag.hersteller ?? null,
          cover_url: eintrag.cover_url ?? null, beschreibung: eintrag.beschreibung ?? null, erstellt_von: req.benutzer.id,
        });
        katalogIds.set(eintrag.id, id);
      }
      liste.forEach((roh, index) => {
        try {
          const artikel = pruefeArtikel({ ...roh, katalog_id: null, konvolut_id: null });
          artikel.konvolut_id = konvolutIds.get(roh?.konvolut_id) ?? null;
          artikel.kaufpreis_anteilig = artikel.konvolut_id && roh?.kaufpreis_anteilig ? 1 : 0;
          const alteKatalogId = roh?.katalog_id;
          artikel.katalog_id = katalogIds.get(alteKatalogId) ?? (katalogVorhanden.get(alteKatalogId ?? -1, req.benutzer.id)?.id ?? null);
          if (artikel.cover_url?.startsWith('/')) artikel.cover_url = null; // Fotos werden nicht mit exportiert
          const plattform = plattformen.zuordnen(artikel.plattform);
          einfuegen.run({ ...artikel, benutzer_id: req.benutzer.id, plattform_id: plattform?.id ?? null, plattform: plattform?.name ?? artikel.plattform });
          importiert++;
        } catch (fehler) {
          if (!(fehler instanceof ValidierungsFehler)) throw fehler;
          fehlerhaft.push({ zeile: index + 1, titel: roh?.titel ?? null, fehler: fehler.fehler });
        }
      });
    })();
    res.json({ importiert, fehlerhaft });
  });

  return router;
}
