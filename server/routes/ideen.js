// Ideen & Wünsche – siehe services/ideen.js.
import { Router } from 'express';
import { IDEEN_BEREICHE, IDEEN_STATUS } from '../services/ideen.js';

export function ideenRouter({ ideen, erweiterungen }) {
  const router = Router();
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
  router.delete('/ideen/:id', (req, res) => {
    ideen.loesche(req.benutzer, req.params.id);
    res.status(204).end();
  });
  return router;
}
