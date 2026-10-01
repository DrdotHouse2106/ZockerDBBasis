import { Router } from 'express';
import multer from 'multer';
import { MEDIENARTEN, istModerator, istFotoArt } from '../../shared/konstanten.js';
import { MEDIEN_TYPEN, verarbeiteMedium, neuerDateiname, medienDateien } from '../services/medien.js';
import { ValidierungsFehler } from '../services/validierung.js';
import { KontoFehler } from '../services/konten.js';

const ARTEN = MEDIENARTEN.map((a) => a.value);

export function medienZuObjekt(m, benutzer) {
  const url = (datei) => (datei ? `/api/dateien/${datei}` : null);
  return {
    id: m.id,
    katalog_id: m.katalog_id,
    art: m.art,
    titel: m.titel,
    sichtbarkeit: m.sichtbarkeit,
    mime: m.mime,
    groesse: m.groesse,
    breite: m.breite,
    hoehe: m.hoehe,
    dpi: m.dpi,
    seiten: m.seiten,
    originalname: m.originalname,
    erstellt_am: m.erstellt_am,
    hochgeladen_von: m.hochgeladen_von ?? null,
    ist_foto: istFotoArt(m.art),
    // Variante (z. B. PAL-Modul) – eigene, noch nicht freigegebene Varianten nur für den Ersteller
    variante_id: m.variante_id ?? null,
    variante: m.variante_bezeichnung ?? null,
    // Öffentlich (auch Suchmaschinen) nur mit Einwilligung des Fotografen und nach Prüfung durch die Moderation
    oeffentlich: Boolean(m.oeffentlich),
    oeffentlich_erlaubt: m.benutzer_id === benutzer.id || istModerator(benutzer) ? Boolean(m.oeffentlich_erlaubt) : undefined,
    name_nennen: m.benutzer_id === benutzer.id ? Boolean(m.name_nennen) : undefined,
    geprueft_am: m.geprueft_am ?? null,
    pruefung_notiz: m.benutzer_id === benutzer.id || istModerator(benutzer) ? m.pruefung_notiz ?? null : null,
    eigenes: m.benutzer_id === benutzer.id,
    darf_bearbeiten: m.benutzer_id === benutzer.id || istModerator(benutzer),
    url: url(m.anzeige_datei ?? m.datei),
    original_url: url(m.datei),
    vorschau_url: url(m.vorschau_datei),
  };
}

const ja = (w) => w === true || w === 1 || ['true', '1', 'on', 'ja'].includes(String(w ?? '').toLowerCase());
// Zeitpunkt im Format von datetime('now') in SQLite
const jetzt = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

/**
 * `vorher`: bisheriger Stand (beim Ändern). `eigenes`: Nur der Fotograf selbst kann die öffentliche Anzeige erlauben –
 * die Moderation entscheidet nur, ob ein erlaubtes Foto tatsächlich öffentlich erscheint.
 */
function pruefeMetadaten(eingabe, { teilweise = false, teilenErlaubt, moderator = false, vorher = null, eigenes = true }) {
  const fehler = {};
  const daten = {};
  const hat = (f) => Object.hasOwn(eingabe, f);
  const bisher = vorher?.sichtbarkeit ?? null;
  if (!teilweise || hat('art')) {
    if (!ARTEN.includes(eingabe.art)) fehler.art = 'Bitte die Art des Scans wählen.';
    else daten.art = eingabe.art;
  }
  if (!teilweise || hat('sichtbarkeit')) {
    // Nutzer: privat oder zur Freigabe einreichen · Moderatoren dürfen direkt freigeben
    let s = eingabe.sichtbarkeit || 'privat';
    if (s === 'geteilt') s = 'eingereicht';
    const erlaubt = moderator ? ['privat', 'eingereicht', 'freigegeben'] : ['privat', 'eingereicht'];
    if (bisher === 'freigegeben' && s === 'eingereicht') s = 'freigegeben'; // bleibt freigegeben
    else if (!erlaubt.includes(s)) fehler.sichtbarkeit = 'Ungültige Auswahl.';
    if (s !== 'privat' && !teilenErlaubt) {
      fehler.sichtbarkeit = `Das Teilen von ${istFotoArt(eingabe.art ?? vorher?.art) ? 'Fotos' : 'Scans'} ist auf diesem Server deaktiviert.`;
    }
    if (!fehler.sichtbarkeit) daten.sichtbarkeit = s;
  }
  if (hat('titel')) daten.titel = String(eingabe.titel ?? '').trim().slice(0, 200) || null;
  if (hat('dpi')) {
    const roh = String(eingabe.dpi ?? '').trim();
    if (!roh) daten.dpi = null;
    else {
      const dpi = Number(roh);
      if (!Number.isFinite(dpi) || dpi < 50 || dpi > 4800) fehler.dpi = 'Bitte eine Auflösung zwischen 50 und 4800 dpi angeben.';
      else daten.dpi = Math.round(dpi);
    }
  }
  // Fotos: Einwilligung zur öffentlichen Anzeige (Nutzungsrecht) und Namensnennung – nie für Scans von Cover oder Anleitung
  const art = daten.art ?? vorher?.art;
  if (eigenes && hat('oeffentlich_erlaubt')) {
    const erlaubt = ja(eingabe.oeffentlich_erlaubt);
    if (erlaubt && !istFotoArt(art)) fehler.oeffentlich_erlaubt = 'Öffentlich gezeigt werden nur Fotos des Gegenstands – keine Scans von Cover oder Anleitung.';
    else if (erlaubt && !teilenErlaubt) fehler.oeffentlich_erlaubt = 'Das Teilen ist auf diesem Server deaktiviert.';
    else daten.oeffentlich_erlaubt = erlaubt ? 1 : 0;
  }
  if (eigenes && hat('name_nennen')) daten.name_nennen = ja(eingabe.name_nennen) ? 1 : 0;
  if (daten.art && !istFotoArt(daten.art)) daten.oeffentlich_erlaubt = 0; // Scan statt Foto: keine öffentliche Anzeige
  // Wer die öffentliche Anzeige erlaubt, reicht das Foto damit zur Prüfung ein
  if (daten.oeffentlich_erlaubt === 1 && (daten.sichtbarkeit ?? bisher ?? 'privat') === 'privat') daten.sichtbarkeit = 'eingereicht';
  if (Object.keys(fehler).length) throw new ValidierungsFehler(fehler);
  return daten;
}

export function medienRouter({ db, konfiguration, dateien, katalog, speicher }) {
  const router = Router();
  // Fotos und Scans getrennt teilbar (Fotos des Gegenstands sind keine Kopien geschützter Werke)
  const teilen = (art) => (istFotoArt(art) ? konfiguration.fotosTeilenErlaubt : konfiguration.medienTeilenErlaubt);
  // Multer je Anfrage erzeugen, damit die Größengrenze live änderbar ist
  const upload = () => multer({
    storage: multer.diskStorage({
      destination: dateien.verzeichnis,
      filename: (_req, datei, cb) => cb(null, neuerDateiname(datei.mimetype)),
    }),
    limits: { fileSize: konfiguration.maxMedienMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, datei, cb) => cb(null, Boolean(MEDIEN_TYPEN[datei.mimetype])),
  });
  const einzeldatei = (feld) => (req, res, next) => upload().single(feld)(req, res, next);

  // Bezeichnung der Variante nur, wenn sie für diesen Benutzer sichtbar ist
  const VARIANTE = `LEFT JOIN katalog_varianten v ON v.id = m.variante_id AND (v.status = 'freigegeben' OR v.erstellt_von = @benutzer)`;
  const sichtbareMedien = db.prepare(`
    SELECT m.*, COALESCE(b.anzeigename, b.benutzername) AS hochgeladen_von, v.bezeichnung AS variante_bezeichnung
    FROM medien m LEFT JOIN benutzer b ON b.id = m.benutzer_id ${VARIANTE}
    WHERE m.katalog_id = @katalog
      AND (m.benutzer_id = @benutzer OR m.sichtbarkeit = 'freigegeben' OR (@moderator = 1 AND m.sichtbarkeit = 'eingereicht'))
    ORDER BY CASE m.art WHEN 'cover_vorne' THEN 0 WHEN 'cover_hinten' THEN 1 WHEN 'cover_komplett' THEN 2
             WHEN 'handbuch' THEN 3 WHEN 'label' THEN 4 ELSE 5 END, m.erstellt_am`);
  const perIdMit = db.prepare(`
    SELECT m.*, COALESCE(b.anzeigename, b.benutzername) AS hochgeladen_von, v.bezeichnung AS variante_bezeichnung
    FROM medien m LEFT JOIN benutzer b ON b.id = m.benutzer_id ${VARIANTE} WHERE m.id = @id`);
  const perId = (id, benutzer = null) => perIdMit.get({ id: Number(id), benutzer: benutzer?.id ?? -1 });
  // Variante muss zum Katalogeintrag gehören und für den Benutzer sichtbar sein
  function pruefeVariante(varianteId, katalogId, benutzer) {
    const v = db.prepare('SELECT katalog_id, status, erstellt_von FROM katalog_varianten WHERE id = ?').get(varianteId);
    if (!v || v.katalog_id !== katalogId || (v.status !== 'freigegeben' && v.erstellt_von !== benutzer.id)) {
      throw new ValidierungsFehler({ variante_id: 'Diese Variante passt nicht zum Spiel.' });
    }
    return varianteId;
  }
  const varianteAus = (eingabe) => {
    const roh = String(eingabe ?? '').trim();
    if (!roh) return null;
    const id = Number(roh);
    if (!Number.isInteger(id) || id <= 0) throw new ValidierungsFehler({ variante_id: 'Ungültige Variante.' });
    return id;
  };
  const eigenerArtikel = db.prepare('SELECT * FROM artikel WHERE id = ? AND benutzer_id = ?');

  function sichtbar(req, id) {
    const m = perId(id, req.benutzer);
    const darf = m && (m.benutzer_id === req.benutzer.id || m.sichtbarkeit === 'freigegeben'
      || (istModerator(req.benutzer) && m.sichtbarkeit === 'eingereicht'));
    return darf ? m : null;
  }

  router.get('/katalog/:id/medien', (req, res) => {
    if (!katalog.holeSichtbar(req.params.id, req.benutzer)) return res.status(404).json({ fehler: 'Katalogeintrag nicht gefunden.' });
    res.json(sichtbareMedien.all({ katalog: Number(req.params.id), benutzer: req.benutzer.id, moderator: istModerator(req.benutzer) ? 1 : 0 })
      .map((m) => medienZuObjekt(m, req.benutzer)));
  });

  router.post('/artikel/:id/medien', speicher.vorabPruefung, einzeldatei('datei'), async (req, res) => {
    const artikel = eigenerArtikel.get(Number(req.params.id), req.benutzer.id);
    if (!artikel || !req.file) {
      if (req.file) dateien.loesche(req.file.filename);
      return artikel
        ? res.status(400).json({ fehler: 'Bitte eine Datei im Format JPG, PNG, WebP, TIFF oder PDF hochladen.' })
        : res.status(404).json({ fehler: 'Artikel nicht gefunden.' });
    }
    let verarbeitet;
    try {
      const meta = pruefeMetadaten(req.body ?? {}, { teilenErlaubt: teilen(req.body?.art), moderator: istModerator(req.benutzer) });
      // Fotos des Gegenstands sind Bilder – PDFs nur als Scan (z. B. Anleitung)
      if (istFotoArt(meta.art) && !req.file.mimetype.startsWith('image/')) throw new ValidierungsFehler({ art: 'Fotos bitte als JPG, PNG oder WebP hochladen.' });
      meta.oeffentlich_erlaubt ??= 0;
      meta.name_nennen ??= 0;
      meta.oeffentlich_erlaubt_am = meta.oeffentlich_erlaubt ? jetzt() : null;
      // Moderatoren können eigene Fotos direkt freigeben – mit ihrer Einwilligung dann auch öffentlich
      meta.oeffentlich = meta.sichtbarkeit === 'freigegeben' && meta.oeffentlich_erlaubt ? 1 : 0;
      meta.oeffentlich_offen = meta.oeffentlich_erlaubt && !meta.oeffentlich ? 1 : 0;
      verarbeitet = await verarbeiteMedium({
        verzeichnis: dateien.verzeichnis, datei: req.file.filename, mime: req.file.mimetype, foto: istFotoArt(meta.art), maxPx: konfiguration.fotoMaxPx,
      });
      const groesseGesamt = speicher.summe(verarbeitet.datei, verarbeitet.anzeige_datei, verarbeitet.vorschau_datei);
      // Freigegebene Scans zählen nicht zum Kontingent – Moderatoren können direkt freigeben
      if (meta.sichtbarkeit !== 'freigegeben') speicher.pruefe(req.benutzer.id, groesseGesamt);
      const katalogId = katalog.stelleSicherFuerArtikel(artikel, req.benutzer);
      const varianteId = varianteAus(req.body?.variante_id);
      if (varianteId) pruefeVariante(varianteId, katalogId, req.benutzer);
      const { id } = db.prepare(`
        INSERT INTO medien (katalog_id, benutzer_id, art, titel, sichtbarkeit, datei, anzeige_datei, vorschau_datei,
                            originalname, mime, groesse, groesse_gesamt, breite, hoehe, dpi, seiten,
                            oeffentlich_erlaubt, oeffentlich_erlaubt_am, name_nennen, oeffentlich, oeffentlich_offen, variante_id)
        VALUES (@katalog_id, @benutzer_id, @art, @titel, @sichtbarkeit, @datei, @anzeige_datei, @vorschau_datei,
                @originalname, @mime, @groesse, @groesse_gesamt, @breite, @hoehe, @dpi, @seiten,
                @oeffentlich_erlaubt, @oeffentlich_erlaubt_am, @name_nennen, @oeffentlich, @oeffentlich_offen, @variante_id) RETURNING id`).get({
        variante_id: varianteId,
        ...verarbeitet,
        groesse_gesamt: groesseGesamt,
        ...meta,
        titel: meta.titel ?? null,
        dpi: meta.dpi ?? verarbeitet.dpi,
        katalog_id: katalogId,
        benutzer_id: req.benutzer.id,
        originalname: Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 200),
      });
      res.status(201).json(medienZuObjekt(perId(id, req.benutzer), req.benutzer));
    } catch (fehler) {
      // Beim Umwandeln kann die Datei eine neue Endung bekommen haben (.webp/.jpg)
      const basis = req.file.filename.replace(/\.[^.]+$/, '');
      dateien.loesche(req.file.filename, `${basis}.webp`, `${basis}.jpg`, verarbeitet?.anzeige_datei, verarbeitet?.vorschau_datei);
      if (fehler instanceof ValidierungsFehler || fehler instanceof KontoFehler) throw fehler;
      console.warn('[medien] Verarbeitung fehlgeschlagen:', fehler.message);
      res.status(400).json({ fehler: 'Die Datei konnte nicht verarbeitet werden. Ist sie beschädigt oder zu groß?' });
    }
  });

  router.get('/medien/:id', (req, res) => {
    const m = sichtbar(req, req.params.id);
    if (!m) return res.status(404).json({ fehler: 'Scan nicht gefunden.' });
    res.json(medienZuObjekt(m, req.benutzer));
  });

  router.put('/medien/:id', (req, res) => {
    const m = perId(req.params.id, req.benutzer);
    if (!m || (m.benutzer_id !== req.benutzer.id && !istModerator(req.benutzer))) {
      return res.status(404).json({ fehler: 'Scan nicht gefunden.' });
    }
    const moderator = istModerator(req.benutzer);
    const eigenes = m.benutzer_id === req.benutzer.id;
    const daten = pruefeMetadaten(req.body ?? {}, {
      teilweise: true, teilenErlaubt: teilen(req.body?.art ?? m.art), moderator, vorher: m, eigenes,
    });
    if (istFotoArt(daten.art) && !String(m.mime).startsWith('image/')) throw new ValidierungsFehler({ art: 'Eine PDF-Datei kann nicht als Foto eingeordnet werden.' });
    if (Object.hasOwn(req.body ?? {}, 'variante_id')) {
      const varianteId = varianteAus(req.body.variante_id);
      daten.variante_id = varianteId ? pruefeVariante(varianteId, m.katalog_id, req.benutzer) : null;
    }
    // Neu erlaubte öffentliche Anzeige: ein freigegebenes Foto bleibt für Mitglieder sichtbar – die Moderation entscheidet
    // nur noch über die öffentliche Anzeige (oeffentlich_offen, siehe Warteschlange)
    if (daten.oeffentlich_erlaubt === 1 && !m.oeffentlich_erlaubt) Object.assign(daten, { oeffentlich_erlaubt_am: jetzt(), oeffentlich_offen: 1 });
    if (daten.oeffentlich_erlaubt === 0) daten.oeffentlich_offen = 0;
    // Freigegebenes geändert (Art, Bezeichnung) → erneut prüfen lassen (außer durch die Moderation)
    const geaendert = (daten.art !== undefined && daten.art !== m.art) || (daten.titel !== undefined && daten.titel !== m.titel)
      || (daten.variante_id !== undefined && daten.variante_id !== m.variante_id);
    if (!moderator && m.sichtbarkeit === 'freigegeben' && geaendert) daten.sichtbarkeit = 'eingereicht';
    // Wechsel zwischen Foto und Scan: Ist das Teilen der neuen Art ausgeschaltet, wird die Datei privat
    if (daten.art && daten.art !== m.art && !teilen(daten.art) && (daten.sichtbarkeit ?? m.sichtbarkeit) !== 'privat') daten.sichtbarkeit = 'privat';
    // Öffentlich nur, solange freigegeben und erlaubt; Moderatoren machen erlaubte Fotos mit der Freigabe öffentlich
    const sichtbarkeit = daten.sichtbarkeit ?? m.sichtbarkeit;
    const erlaubt = daten.oeffentlich_erlaubt ?? m.oeffentlich_erlaubt;
    if (sichtbarkeit !== 'freigegeben' || !erlaubt || !istFotoArt(daten.art ?? m.art)) daten.oeffentlich = 0;
    else if (moderator && daten.sichtbarkeit === 'freigegeben' && m.sichtbarkeit !== 'freigegeben') Object.assign(daten, { oeffentlich: 1, oeffentlich_offen: 0 });
    const felder = Object.keys(daten);
    if (felder.length) db.prepare(`UPDATE medien SET ${felder.map((f) => `${f} = @${f}`).join(', ')} WHERE id = @id`).run({ ...daten, id: m.id });
    res.json(medienZuObjekt(perId(m.id, req.benutzer), req.benutzer));
  });

  router.delete('/medien/:id', (req, res) => {
    const m = perId(req.params.id, req.benutzer);
    if (!m || (m.benutzer_id !== req.benutzer.id && !istModerator(req.benutzer))) {
      return res.status(404).json({ fehler: 'Scan nicht gefunden.' });
    }
    db.prepare('DELETE FROM medien WHERE id = ?').run(m.id);
    dateien.loesche(medienDateien(m));
    res.status(204).end();
  });

  // Auslieferung aller hochgeladenen Dateien mit Berechtigungsprüfung.
  router.get('/dateien/:datei', (req, res) => {
    const zugriff = dateien.zugriff(req.benutzer, req.params.datei);
    if (!zugriff) return res.status(404).json({ fehler: 'Datei nicht gefunden.' });
    res.set('Cache-Control', 'private, max-age=2592000, immutable');
    if (req.query.download && zugriff.medium) {
      const endung = MEDIEN_TYPEN[zugriff.medium.mime] ?? '';
      // Endung passend zum gespeicherten Format (Fotos sind WebP, umgewandelte Scans JPEG)
      const name = zugriff.medium.originalname ? `${zugriff.medium.originalname.replace(/\.[^.]+$/, '')}${endung}` : `scan${endung}`;
      return res.download(zugriff.pfad, name);
    }
    res.sendFile(zugriff.pfad, (fehler) => {
      if (fehler && !res.headersSent) res.status(404).json({ fehler: 'Datei nicht gefunden.' });
    });
  });

  return router;
}
