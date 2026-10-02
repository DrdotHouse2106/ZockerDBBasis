import { Router } from 'express';

export function benachrichtigungenRouter({ benachrichtigungen }) {
  const router = Router();

  router.get('/benachrichtigungen', (req, res) => {
    res.json({ ungelesen: benachrichtigungen.ungelesen(req.benutzer.id), eintraege: benachrichtigungen.liste(req.benutzer.id) });
  });

  // Leichtgewichtig für die Glocke (wird regelmäßig abgefragt)
  router.get('/benachrichtigungen/anzahl', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ ungelesen: benachrichtigungen.ungelesen(req.benutzer.id) });
  });

  router.post('/benachrichtigungen/gelesen', (req, res) => {
    const id = Number(req.body?.id) || null;
    benachrichtigungen.markiereGelesen(req.benutzer.id, id);
    res.json({ ungelesen: benachrichtigungen.ungelesen(req.benutzer.id) });
  });

  // Welche Benachrichtigungen der Benutzer bekommt – je Art und Kanal (App, E-Mail, Push)
  router.get('/benachrichtigungen/auswahl', (req, res) => res.json(benachrichtigungen.auswahl(req.benutzer.id)));
  router.put('/benachrichtigungen/auswahl', (req, res) => res.json(benachrichtigungen.setzeAuswahl(req.benutzer.id, req.body?.kategorien)));

  router.delete('/benachrichtigungen/:id', (req, res) => {
    benachrichtigungen.loesche(req.benutzer.id, Number(req.params.id));
    res.status(204).end();
  });

  return router;
}
