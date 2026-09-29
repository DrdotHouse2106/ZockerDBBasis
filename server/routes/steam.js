// Steam-Bibliothek: Status, Import (auch erneut zum Aktualisieren der Spielzeiten) und Trennen.
import { Router } from 'express';
import { SteamFehler } from '../services/steam.js';
import { erstelleDrossel } from '../services/drossel.js';

export function steamRouter({ steam, erweiterungen }) {
  const router = Router();
  // Schutz des Steam-Schlüssels (Tageslimit bei Steam): je Benutzer höchstens 10 Importe pro Stunde
  const drossel = erstelleDrossel({ maxVersuche: 10, fensterMs: 60 * 60 * 1000 });

  router.get('/steam', (req, res) => res.json(steam.status(req.benutzer)));

  router.post('/steam/import', async (req, res) => {
    if (drossel.gesperrt(`s:${req.benutzer.id}`)) return res.status(429).json({ fehler: 'Bitte etwas warten, bevor du erneut importierst.' });
    drossel.fehlschlag(`s:${req.benutzer.id}`);
    try {
      const ergebnis = await steam.importiere(req.benutzer, req.body?.profil);
      erweiterungen.melde('benutzer.geaendert', req.benutzer.id);
      res.json({ ...ergebnis, ...steam.status(req.benutzer) });
    } catch (e) {
      if (e instanceof SteamFehler) return res.status(e.status).json({ fehler: e.message });
      throw e;
    }
  });

  router.delete('/steam', (req, res) => res.json(steam.entferne(req.benutzer)));

  return router;
}
