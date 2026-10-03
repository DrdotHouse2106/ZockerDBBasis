// „Neu seit deinem letzten Besuch“ – Liste und „gelesen“.
import { Router } from 'express';

export function neuigkeitenRouter({ neuigkeiten }) {
  const router = Router();
  router.get('/neuigkeiten', (req, res) => res.json({ eintraege: neuigkeiten.offen(req.benutzer) }));
  router.post('/neuigkeiten/gelesen', (req, res) => {
    neuigkeiten.gelesen(req.benutzer.id);
    res.json({ ok: true });
  });
  return router;
}
