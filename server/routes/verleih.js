// Leihliste: Übersicht („Verliehen“ / „Ausgeliehen von anderen“), Zurückbekommen und Antwort des Ausleihenden.
import { Router } from 'express';

export function verleihRouter({ verleih }) {
  const router = Router();
  router.get('/verleihungen', (req, res) => res.json(verleih.uebersicht(req.benutzer.id)));
  router.post('/verleihungen/:id/zurueck', (req, res) => res.json(verleih.zurueck(req.benutzer.id, req.params.id)));
  router.post('/verleihungen/:id/antwort', (req, res) => res.json(verleih.antworte(req.benutzer, req.params.id, req.body?.bestaetigen !== false)));
  return router;
}
