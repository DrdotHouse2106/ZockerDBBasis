import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { pruefeArtikel, ValidierungsFehler } from '../services/validierung.js';

const SORTIERUNGEN = {
  neueste: 'a.erstellt_am DESC, a.id DESC',
  titel: 'a.titel COLLATE NOCASE ASC',
  plattform: 'p.hersteller, p.erscheinungsjahr, a.plattform COLLATE NOCASE ASC, a.titel COLLATE NOCASE ASC',
  preis: 'a.kaufpreis IS NULL, a.kaufpreis DESC',
  kaufdatum: 'a.kaufdatum IS NULL, a.kaufdatum DESC',
  marktwert: 'a.marktwert IS NULL, a.marktwert DESC',
};

const ERLAUBTE_BILDTYPEN = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const FELDER = [
  'typ', 'titel', 'plattform', 'katalog_id', 'barcode', 'cover_url', 'zustand', 'vollstaendigkeit', 'region',
  'farbe', 'edition', 'modellnummer', 'seriennummer', 'notizen', 'kaufpreis', 'kaufdatum', 'anzahl', 'marktwert',
  'plattform_id', 'variante_id', 'herkunft', 'konvolut_id', 'bestand', 'abgang_am', 'verkaufspreis', 'digital_quelle', 'spielstatus', 'durchgespielt_am', 'spielzeit_minuten',
];

export function artikelZuObjekt(zeile) {
  if (!zeile) return null;
  return {
    ...zeile,
    bild_url: zeile.bild_datei ? `/api/dateien/${zeile.bild_datei}` : zeile.cover_url || zeile.katalog_cover_url || null,
  };
}

export function artikelRouter({ db, katalog, konfiguration, dateien, plattformen, speicher, erweiterungen, zentrale, konvolute, verleih }) {
  const router = Router();

  const upload = () => multer({
    storage: multer.diskStorage({
      destination: dateien.verzeichnis,
      filename: (_req, datei, cb) => cb(null, `${crypto.randomUUID()}${ERLAUBTE_BILDTYPEN[datei.mimetype]}`),
    }),
    limits: { fileSize: konfiguration.maxUploadMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, datei, cb) => cb(null, Boolean(ERLAUBTE_BILDTYPEN[datei.mimetype])),
  });
  const einzeldatei = (feld) => (req, res, next) => upload().single(feld)(req, res, next);

  const basisAbfrage = `
    SELECT a.*, k.cover_url AS katalog_cover_url, k.erscheinungsjahr, k.quelle AS katalog_quelle, k.status AS katalog_status,
           p.kurz AS plattform_kurz, p.hersteller AS plattform_hersteller, v.bezeichnung AS variante_bezeichnung, kv.name AS konvolut_name,
           vl.id AS verleih_id, vl.an_name AS verliehen_an, vl.seit AS verliehen_seit, vl.rueckgabe_geplant, vl.bestaetigung AS verleih_bestaetigung
    FROM artikel a LEFT JOIN katalog k ON k.id = a.katalog_id LEFT JOIN plattformen p ON p.id = a.plattform_id
    LEFT JOIN katalog_varianten v ON v.id = a.variante_id LEFT JOIN konvolute kv ON kv.id = a.konvolut_id
    LEFT JOIN verleihungen vl ON vl.artikel_id = a.id AND vl.zurueck_am IS NULL`;
  const perId = db.prepare(`${basisAbfrage} WHERE a.id = ? AND a.benutzer_id = ?`);
  const einfuegen = db.prepare(
    `INSERT INTO artikel (benutzer_id, ${FELDER.join(', ')}) VALUES (@benutzer_id, ${FELDER.map((f) => `@${f}`).join(', ')}) RETURNING id`,
  );
  const loeschen = db.prepare('DELETE FROM artikel WHERE id = ?');
  const bildEntfernen = (datei) => dateien.loesche(datei);

  function holeOder404(req, res) {
    const artikel = perId.get(Number(req.params.id), req.benutzer.id);
    if (!artikel) res.status(404).json({ fehler: 'Artikel nicht gefunden.' });
    return artikel;
  }

  // Katalogeintrag muss für den Benutzer sichtbar sein (freigegeben oder eigener).
  function pruefeKatalog(katalogId, req) {
    if (katalogId && !katalog.holeSichtbar(katalogId, req.benutzer)) {
      throw new ValidierungsFehler({ katalog_id: 'Der verknüpfte Katalogeintrag existiert nicht.' });
    }
  }

  // Plattform: feste Auswahl (plattform_id) oder Freitext, der den Stammdaten zugeordnet wird.
  function loesePlattform(daten) {
    if (daten.plattform_id) {
      const p = plattformen.hole(daten.plattform_id);
      if (!p) throw new ValidierungsFehler({ plattform_id: 'Unbekannte Plattform.' });
      daten.plattform = p.name;
    } else if (daten.plattform) {
      const p = plattformen.zuordnen(daten.plattform);
      if (p) Object.assign(daten, { plattform_id: p.id, plattform: p.name });
      else daten.plattform_id = null;
    } else if ('plattform_id' in daten || 'plattform' in daten) {
      Object.assign(daten, { plattform_id: null, plattform: null });
    }
  }

  // Variante muss zum Katalogeintrag gehören und sichtbar sein.
  function pruefeVariante(varianteId, katalogId, req) {
    if (!varianteId) return;
    const v = db.prepare('SELECT * FROM katalog_varianten WHERE id = ?').get(varianteId);
    const sichtbar = v && (v.status === 'freigegeben' || v.erstellt_von === req.benutzer.id);
    if (!sichtbar || v.katalog_id !== katalogId) throw new ValidierungsFehler({ variante_id: 'Diese Variante passt nicht zum Katalogeintrag.' });
  }

  router.get('/', (req, res) => {
    const bedingungen = ['a.benutzer_id = @benutzer_id'];
    const parameter = { benutzer_id: req.benutzer.id };
    // Standard: nur, was man besitzt; „bestand=verkauft|abgegeben|weg|alle“ zeigt die übrigen
    const bestand = String(req.query.bestand ?? 'besitz');
    if (bestand === 'weg') bedingungen.push("a.bestand IN ('verkauft', 'abgegeben')");
    else if (bestand !== 'alle') {
      bedingungen.push('a.bestand = @bestand');
      parameter.bestand = ['besitz', 'verkauft', 'abgegeben', 'digital'].includes(bestand) ? bestand : 'besitz';
    }
    const { typ, q, plattform, region, zustand, vollstaendigkeit, herkunft } = req.query;
    if (req.query.ohne_preis === '1') bedingungen.push('a.kaufpreis IS NULL');
    if (req.query.verliehen === '1') bedingungen.push('vl.id IS NOT NULL');
    const konvolutId = Number(req.query.konvolut_id);
    if (Number.isInteger(konvolutId) && konvolutId > 0) {
      bedingungen.push('a.konvolut_id = @konvolut_id');
      parameter.konvolut_id = konvolutId;
    }
    const plattformId = Number(req.query.plattform_id);
    if (Number.isInteger(plattformId) && plattformId > 0) {
      bedingungen.push('a.plattform_id = @plattform_id');
      parameter.plattform_id = plattformId;
    }
    const { spielstatus } = req.query;
    for (const [feld, wert] of Object.entries({ typ, plattform, region, zustand, vollstaendigkeit, herkunft, spielstatus })) {
      if (typeof wert === 'string' && wert) {
        bedingungen.push(`a.${feld} = @${feld}`);
        parameter[feld] = wert;
      }
    }
    if (typeof q === 'string' && q.trim()) {
      parameter.q = `%${q.trim().replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
      bedingungen.push(`(${['titel', 'plattform', 'edition', 'farbe', 'modellnummer', 'seriennummer', 'notizen', 'barcode']
        .map((f) => `a.${f} LIKE @q ESCAPE '\\'`).join(' OR ')})`);
    }
    const sortierung = SORTIERUNGEN[req.query.sortierung] ?? SORTIERUNGEN.neueste;
    const where = `WHERE ${bedingungen.join(' AND ')}`;
    const zeilen = db.prepare(`${basisAbfrage} ${where} ORDER BY ${sortierung}`).all(parameter);
    res.json(zeilen.map(artikelZuObjekt));
  });

  // Anzahl je Bestand (für Hinweise wie „23 digitale Spiele“)
  router.get('/anzahl', (req, res) => {
    const zeilen = db.prepare('SELECT bestand, COUNT(*) AS n FROM artikel WHERE benutzer_id = ? GROUP BY bestand').all(req.benutzer.id);
    res.json(Object.fromEntries(zeilen.map((z) => [z.bestand, z.n])));
  });

  // Plattformen in der eigenen Sammlung (für Filter-Chips)
  router.get('/plattformen', (req, res) => {
    const zeilen = db.prepare(`
      SELECT a.plattform_id AS id, COALESCE(p.name, a.plattform) AS plattform, p.kurz, p.hersteller, COUNT(*) AS anzahl
      FROM artikel a LEFT JOIN plattformen p ON p.id = a.plattform_id
      WHERE a.benutzer_id = ? AND a.bestand = 'besitz' AND (a.plattform IS NOT NULL OR a.plattform_id IS NOT NULL)
      GROUP BY COALESCE(a.plattform_id, a.plattform) ORDER BY p.hersteller, p.erscheinungsjahr, plattform COLLATE NOCASE`).all(req.benutzer.id);
    res.json(zeilen);
  });

  router.get('/:id', (req, res) => {
    const artikel = holeOder404(req, res);
    if (artikel) res.json(artikelZuObjekt(artikel));
  });

  /** Konvolut muss dem Benutzer gehören; Artikel darin haben die Herkunft „Konvolut“. */
  function pruefeKonvolut(daten, req) {
    if (!daten.konvolut_id) return;
    if (!db.prepare('SELECT 1 FROM konvolute WHERE id = ? AND benutzer_id = ?').get(daten.konvolut_id, req.benutzer.id)) {
      throw new ValidierungsFehler({ konvolut_id: 'Unbekanntes Konvolut.' });
    }
    daten.herkunft ??= 'konvolut';
  }

  router.post('/', (req, res) => {
    const daten = pruefeArtikel(req.body);
    pruefeKatalog(daten.katalog_id, req);
    pruefeKonvolut(daten, req);
    loesePlattform(daten);
    pruefeVariante(daten.variante_id, daten.katalog_id, req);
    const id = db.transaction(() => {
      // Ohne Katalogeintrag: eigenen (privaten) anlegen – optional gleich zur Prüfung einreichen
      if (!daten.katalog_id) {
        daten.katalog_id = katalog.legeEigenenAn({
          typ: daten.typ, titel: daten.titel, plattformen: daten.plattform ? [daten.plattform] : [],
          cover_url: daten.cover_url?.startsWith('http') ? daten.cover_url : null,
        }, req.benutzer, { einreichen: Boolean(req.body?.katalog_einreichen), veroeffentlichen: Boolean(req.body?.katalog_veroeffentlichen) }).id;
      }
      const { id: neueId } = einfuegen.get({ ...daten, benutzer_id: req.benutzer.id });
      if (daten.barcode) katalog.verknuepfeBarcode(daten.barcode, daten.katalog_id, req.benutzer.id);
      return neueId;
    })();
    // Im Konvolut ohne eigenen Preis: Anteil am Gesamtpreis
    if (daten.konvolut_id) {
      if (daten.kaufpreis == null) db.prepare('UPDATE artikel SET kaufpreis_anteilig = 1 WHERE id = ?').run(id);
      konvolute.aufteilen(daten.konvolut_id);
    }
    if (req.body?.katalog_einreichen) {
      erweiterungen.melde('katalog.eingereicht');
      // Selbst gehostet ohne eigene Moderation: Eintrag bei zockerdb.de einreichen (im Hintergrund)
      const eintrag = katalog.holeEintrag(daten.katalog_id);
      if (!katalog.moderiert() && zentrale?.aktiv && eintrag?.quelle === 'eigen' && !eintrag.zentral_status) {
        zentrale.einreichen(eintrag).catch((e) => console.warn('[zockerdb.de]', e.message));
      }
    }
    erweiterungen.melde('benutzer.geaendert', req.benutzer.id);
    res.status(201).json(artikelZuObjekt(perId.get(id, req.benutzer.id)));
  });

  router.put('/:id', (req, res) => {
    const vorhanden = holeOder404(req, res);
    if (!vorhanden) return;
    const daten = pruefeArtikel(req.body, true);
    if (daten.katalog_id) pruefeKatalog(daten.katalog_id, req);
    pruefeKonvolut(daten, req);
    // Selbst eingetragener Preis ist fest; leerer Preis im Konvolut = wieder Anteil am Gesamtpreis
    if (Object.hasOwn(daten, 'kaufpreis')) daten.kaufpreis_anteilig = daten.kaufpreis == null && (daten.konvolut_id ?? vorhanden.konvolut_id) ? 1 : 0;
    loesePlattform(daten);
    if (daten.variante_id) pruefeVariante(daten.variante_id, daten.katalog_id ?? vorhanden.katalog_id, req);
    const felder = Object.keys(daten);
    if (felder.length) {
      db.transaction(() => {
        db.prepare(
          `UPDATE artikel SET ${felder.map((f) => `${f} = @${f}`).join(', ')}, aktualisiert_am = datetime('now') WHERE id = @id`,
        ).run({ ...daten, id: vorhanden.id });
        const barcode = daten.barcode ?? vorhanden.barcode;
        const katalogId = daten.katalog_id ?? vorhanden.katalog_id;
        if (barcode && katalogId) katalog.verknuepfeBarcode(barcode, katalogId, req.benutzer.id);
      })();
    }
    for (const k of new Set([vorhanden.konvolut_id, daten.konvolut_id].filter(Boolean))) konvolute.aufteilen(k);
    res.json(artikelZuObjekt(perId.get(vorhanden.id, req.benutzer.id)));
  });

  /**
   * Exemplar(e) als verkauft bzw. abgegeben markieren. Bei Anzahl > 1 und `anzahl` kleiner als der Bestand wird aufgeteilt:
   * die abgegebenen Stücke bekommen einen eigenen Eintrag (z. B. 2 von 3 verkauft). `preis` ist der Gesamterlös.
   */
  router.post('/:id/abgang', (req, res) => {
    const vorhanden = holeOder404(req, res);
    if (!vorhanden) return;
    const neu = abgang(vorhanden, req.body ?? {});
    erweiterungen.melde('benutzer.geaendert', req.benutzer.id);
    res.json({ artikel: artikelZuObjekt(perId.get(neu, req.benutzer.id)), rest: vorhanden.id !== neu ? artikelZuObjekt(perId.get(vorhanden.id, req.benutzer.id)) : null });
  });

  function abgang(vorhanden, eingabe) {
    const bestand = ['verkauft', 'abgegeben'].includes(eingabe.bestand) ? eingabe.bestand : null;
    if (!bestand) throw new ValidierungsFehler({ bestand: 'Bitte „verkauft“ oder „verschenkt/getauscht“ wählen.' });
    if (vorhanden.bestand !== 'besitz') throw new ValidierungsFehler({ bestand: 'Dieses Exemplar ist nicht mehr im Besitz.' });
    if (vorhanden.verleih_id) throw new ValidierungsFehler({ bestand: 'Dieses Exemplar ist gerade verliehen – bitte zuerst als zurückbekommen markieren.' });
    const anzahl = eingabe.anzahl == null || eingabe.anzahl === '' ? vorhanden.anzahl : Number(eingabe.anzahl);
    if (!Number.isInteger(anzahl) || anzahl < 1 || anzahl > vorhanden.anzahl) throw new ValidierungsFehler({ anzahl: `Bitte 1 bis ${vorhanden.anzahl} angeben.` });
    const d = pruefeArtikel({ bestand, abgang_am: eingabe.datum || new Date().toISOString().slice(0, 10), verkaufspreis: eingabe.preis }, true);
    const jeStueck = bestand === 'verkauft' && d.verkaufspreis != null ? Math.round((d.verkaufspreis / anzahl) * 100) / 100 : null;
    return db.transaction(() => {
      let id = vorhanden.id;
      if (anzahl < vorhanden.anzahl) {
        // Aufteilen: Kopie mit den abgegebenen Stücken (Foto wird nicht doppelt gespeichert – bleibt beim Rest)
        db.prepare("UPDATE artikel SET anzahl = anzahl - ?, aktualisiert_am = datetime('now') WHERE id = ?").run(anzahl, vorhanden.id);
        const felder = FELDER.filter((f) => !['anzahl', 'bestand', 'abgang_am', 'verkaufspreis'].includes(f));
        id = db.prepare(`INSERT INTO artikel (benutzer_id, ${felder.join(', ')}, kaufpreis_anteilig, anzahl, bestand, abgang_am, verkaufspreis)
          SELECT benutzer_id, ${felder.join(', ')}, kaufpreis_anteilig, ?, ?, ?, ? FROM artikel WHERE id = ? RETURNING id`)
          .get(anzahl, bestand, d.abgang_am, jeStueck, vorhanden.id).id;
      } else {
        db.prepare("UPDATE artikel SET bestand = ?, abgang_am = ?, verkaufspreis = ?, aktualisiert_am = datetime('now') WHERE id = ?")
          .run(bestand, d.abgang_am, jeStueck, vorhanden.id);
      }
      return id;
    })();
  }

  // Leihliste: Exemplar verleihen und Verlauf
  router.post('/:id/verleihen', (req, res) => {
    const vorhanden = holeOder404(req, res);
    if (!vorhanden) return;
    verleih.verleihe(req.benutzer, vorhanden, req.body ?? {});
    res.status(201).json(artikelZuObjekt(perId.get(vorhanden.id, req.benutzer.id)));
  });
  router.get('/:id/verleihungen', (req, res) => {
    const vorhanden = holeOder404(req, res);
    if (vorhanden) res.json(verleih.verlauf(vorhanden.id));
  });

  // Wieder in die Sammlung zurückholen (versehentlich markiert, zurückgekauft)
  router.post('/:id/zurueck', (req, res) => {
    const vorhanden = holeOder404(req, res);
    if (!vorhanden) return;
    if (vorhanden.bestand === 'digital') throw new ValidierungsFehler({ bestand: 'Digitale Spiele gehören nicht zur Sammlung physischer Exemplare.' });
    db.prepare("UPDATE artikel SET bestand = 'besitz', abgang_am = NULL, verkaufspreis = NULL, aktualisiert_am = datetime('now') WHERE id = ?").run(vorhanden.id);
    erweiterungen.melde('benutzer.geaendert', req.benutzer.id);
    res.json(artikelZuObjekt(perId.get(vorhanden.id, req.benutzer.id)));
  });

  router.delete('/:id', (req, res) => {
    const vorhanden = holeOder404(req, res);
    if (!vorhanden) return;
    loeschen.run(vorhanden.id);
    if (vorhanden.konvolut_id) konvolute.aufteilen(vorhanden.konvolut_id);
    bildEntfernen(vorhanden.bild_datei);
    res.status(204).end();
  });

  router.post('/:id/bild', einzeldatei('bild'), (req, res) => {
    const vorhanden = holeOder404(req, res);
    if (!vorhanden) {
      if (req.file) bildEntfernen(req.file.filename);
      return;
    }
    if (!req.file) {
      return res.status(400).json({ fehler: 'Bitte ein Bild im Format JPG, PNG, WebP oder GIF hochladen.' });
    }
    try {
      // Das bisherige Foto wird ersetzt und zählt daher nicht mit
      speicher.pruefe(req.benutzer.id, req.file.size, { abzueglich: vorhanden.bild_datei ? vorhanden.bild_groesse ?? 0 : 0 });
    } catch (fehler) {
      bildEntfernen(req.file.filename);
      throw fehler;
    }
    db.prepare("UPDATE artikel SET bild_datei = ?, bild_groesse = ?, sync_bild_hash = NULL, aktualisiert_am = datetime('now') WHERE id = ?")
      .run(req.file.filename, req.file.size, vorhanden.id);
    bildEntfernen(vorhanden.bild_datei);
    res.json(artikelZuObjekt(perId.get(vorhanden.id, req.benutzer.id)));
  });

  router.delete('/:id/bild', (req, res) => {
    const vorhanden = holeOder404(req, res);
    if (!vorhanden) return;
    // „geloescht“ merkt sich der Sync: das Foto wird auch auf der Gegenseite entfernt
    db.prepare("UPDATE artikel SET bild_datei = NULL, bild_groesse = NULL, sync_bild_hash = 'geloescht', aktualisiert_am = datetime('now') WHERE id = ?").run(vorhanden.id);
    bildEntfernen(vorhanden.bild_datei);
    res.json(artikelZuObjekt(perId.get(vorhanden.id, req.benutzer.id)));
  });

  return router;
}
