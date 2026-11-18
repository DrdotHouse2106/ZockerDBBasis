// Figurenserien (Merch): Liste, Serienseite mit Farbtabelle, Serien/Unterserien pflegen, Figuren und ihre Farben erfassen.
import os from 'node:os';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';

const BILDTYPEN = ['image/jpeg', 'image/png', 'image/webp'];

export function serienRouter({ serien, katalog, konfiguration }) {
  const router = Router();
  // Belegfoto: Zwischenablage im Temp-Ordner, gespeichert wird nur das verkleinerte WebP ohne Metadaten
  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: (konfiguration?.maxUploadMb ?? 8) * 1024 * 1024, files: 1 },
    fileFilter: (_req, datei, cb) => cb(null, BILDTYPEN.includes(datei.mimetype)),
  });
  const oder404 = (res, wert, text = 'Serie nicht gefunden.') => (wert ? res.json(wert) : res.status(404).json({ fehler: text }));

  router.get('/serien', (req, res) => res.json(serien.liste(req.benutzer)));
  router.put('/serien/:id/folgen', (req, res) => oder404(res, serien.folgen(req.benutzer, req.params.id, req.body?.folgen !== false)));
  router.get('/serien/:id', (req, res) => oder404(res, serien.hole(req.params.id, req.benutzer)));
  router.put('/serien/:id/spiele', (req, res) => oder404(res, serien.spieleSetzen(req.benutzer, req.params.id, req.body?.spiele)));
  router.post('/serien', (req, res) => res.status(201).json(serien.anlegen(req.benutzer, req.body ?? {})));
  router.put('/serien/:id', (req, res) => oder404(res, serien.aendern(req.benutzer, req.params.id, req.body ?? {})));
  router.delete('/serien/:id', (req, res) => (serien.loeschen(req.benutzer, req.params.id) ? res.status(204).end() : res.status(404).json({ fehler: 'Serie nicht gefunden.' })));

  router.post('/serien/:id/figuren', (req, res) => {
    const figur = serien.figurAnlegen(req.benutzer, req.params.id, req.body ?? {}, katalog);
    return figur ? res.status(201).json(figur) : res.status(404).json({ fehler: 'Serie nicht gefunden.' });
  });
  router.post('/serien/:id/liste', (req, res) => oder404(res, serien.listeEinfuegen(req.benutzer, req.params.id, req.body?.text)));
  router.put('/serien/figur/:katalogId', (req, res) => oder404(res, serien.figurAendern(req.benutzer, req.params.katalogId, req.body ?? {}), 'Figur nicht gefunden.'));
  router.put('/serien/figur/:katalogId/farbe', (req, res) => oder404(res, serien.farbeSetzen(req.benutzer, req.params.katalogId, req.body ?? {}), 'Figur nicht gefunden.'));
  // Foto als Beleg zu einem eigenen Vorschlag (Figur oder – mit variante_id – Farbe); damit geht er an die Moderation
  router.post('/serien/figur/:katalogId/beleg', upload.single('foto'), async (req, res) => {
    if (!req.file) return res.status(400).json({ fehler: 'Bitte ein Foto (JPG, PNG oder WebP) auswählen.' });
    try {
      oder404(res, await serien.belegHinzu(req.benutzer, req.params.katalogId, req.body?.variante_id || null, req.file.path), 'Vorschlag nicht gefunden.');
    } finally {
      fs.rm(req.file.path, { force: true }, () => {});
    }
  });
  return router;
}
