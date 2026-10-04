// Fotos zu „Titel vorschlagen“ und „Plattform vorschlagen“ – siehe services/vorschlaege.js.
import os from 'node:os';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { istModerator } from '../../shared/konstanten.js';

const BILDTYPEN = ['image/jpeg', 'image/png', 'image/webp'];

export function vorschlaegeRouter({ katalog, vorschlaege, konfiguration }) {
  const router = Router();
  // Zwischenablage im Temp-Ordner; gespeichert wird nur das verkleinerte WebP
  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: (konfiguration.maxUploadMb ?? 8) * 1024 * 1024, files: 1 },
    fileFilter: (_req, datei, cb) => cb(null, BILDTYPEN.includes(datei.mimetype)),
  });

  // ── Fotos zum Titelvorschlag ────────────────────────────────
  router.get('/katalog/:id/belegfotos', (req, res) => {
    const e = katalog.holeEintrag(Number(req.params.id));
    if (!e || !(e.erstellt_von === req.benutzer.id || istModerator(req.benutzer))) return res.json([]);
    res.json(vorschlaege.fotos(e.id));
  });

  router.post('/katalog/:id/belegfotos', upload.single('foto'), async (req, res) => {
    if (!req.file) return res.status(400).json({ fehler: 'Bitte ein Foto (JPG, PNG oder WebP) auswählen.' });
    try {
      res.status(201).json(await vorschlaege.fotoHinzu(req.benutzer, req.params.id, req.file.path));
    } finally {
      fs.rm(req.file.path, { force: true }, () => {});
    }
  });

  router.delete('/belegfotos/:id', (req, res) => res.json(vorschlaege.fotoEntfernen(req.benutzer, req.params.id)));

  // ── Plattform vorschlagen ───────────────────────────────────
  router.get('/plattformen/vorschlaege', (req, res) => res.json(vorschlaege.eigenePlattformVorschlaege(req.benutzer)));
  router.put('/plattformen/vorschlaege/:id', async (req, res) => res.json(await vorschlaege.plattformVorschlagAendern(req.benutzer, req.params.id, req.body ?? {})));
  router.post('/plattformen/vorschlaege', async (req, res) => res.status(201).json(await vorschlaege.plattformVorschlagen(req.benutzer, req.body)));

  // Moderation (nur mit eigener Moderation, z. B. zockerdb.de)
  const nurModeration = (req, res, next) => (istModerator(req.benutzer) ? next() : res.status(403).json({ fehler: 'Nur für das Moderationsteam.' }));
  router.get('/moderation/plattform-vorschlaege', nurModeration, (_req, res) => res.json(vorschlaege.offenePlattformVorschlaege()));
  router.post('/moderation/plattform-vorschlaege/:id', nurModeration, (req, res) => {
    res.json(vorschlaege.entscheidePlattform(req.params.id, {
      annehmen: Boolean(req.body?.annehmen), daten: req.body?.daten ?? {}, antwort: req.body?.antwort,
    }, req.benutzer));
  });

  return router;
}
