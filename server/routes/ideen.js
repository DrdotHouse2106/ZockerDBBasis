// Ideen & Wünsche – siehe services/ideen.js.
import os from 'node:os';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { IDEEN_BEREICHE, IDEEN_STATUS } from '../services/ideen.js';

export function ideenRouter({ ideen, erweiterungen, konfiguration }) {
  const router = Router();
  // Anhänge: Zwischenablage im Temp-Ordner; gespeichert werden nur geprüfte Bilder (als WebP) bzw. kurze Textdateien
  const upload = multer({ dest: os.tmpdir(), limits: { fileSize: (konfiguration?.maxUploadMb ?? 8) * 1024 * 1024, files: 4 } });
  router.get('/ideen', (req, res) => res.json({
    modus: ideen.modus(), bereiche: IDEEN_BEREICHE, status: IDEEN_STATUS, ideen: ideen.modus() ? ideen.alle(req.benutzer) : [],
    // Zusatzmodule: z. B. { github: true }, wenn Ideen als GitHub-Issue veröffentlicht werden
    ...(ideen.modus() === 'brett' ? erweiterungen?.sammle('ideen.info') ?? {} : {}),
  }));
  router.get('/ideen/aehnliche', (req, res) => res.json(ideen.aehnliche(req.query.q, req.benutzer)));
  router.post('/ideen', async (req, res) => res.status(201).json(await ideen.einreichen(req.benutzer, req.body)));
  router.post('/ideen/:id/stimme', (req, res) => res.json(ideen.stimme(req.benutzer, req.params.id)));
  router.put('/ideen/:id', (req, res) => {
    if (req.benutzer.rolle !== 'admin') return res.status(403).json({ fehler: 'Nur Administratoren legen den Stand fest.' });
    res.json(ideen.entscheide(req.benutzer, req.params.id, req.body ?? {}));
  });
  router.patch('/ideen/:id', async (req, res) => res.json(await ideen.bearbeite(req.benutzer, req.params.id, req.body ?? {})));
  router.post('/ideen/:id/anhaenge', upload.array('dateien', 4), async (req, res) => {
    try {
      res.status(201).json(await ideen.anhaengeHinzu(req.benutzer, req.params.id, req.files ?? []));
    } finally {
      for (const d of req.files ?? []) fs.rm(d.path, { force: true }, () => {});
    }
  });
  router.delete('/ideen/:id', (req, res) => {
    ideen.loesche(req.benutzer, req.params.id);
    res.status(204).end();
  });
  return router;
}
