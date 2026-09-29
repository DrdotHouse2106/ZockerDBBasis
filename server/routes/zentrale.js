// Verbindung zu zockerdb.de: „Zu ZockerDB freigeben“, Sammlerzahlen, Datenspende (Administration) und Sync im Konto.
import { Router } from 'express';
import { ValidierungsFehler } from '../services/validierung.js';

export function zentraleRouter({ db, zentrale, katalog, sync, vorschlaege }) {
  const router = Router();

  // ── Katalog ──────────────────────────────────────────────
  // Eigenen Eintrag bei zockerdb.de einreichen – nach der Freigabe dort wird er hier zum gemeinsamen Eintrag
  router.post('/katalog/:id/zentral-einreichen', async (req, res) => {
    const e = katalog.holeEintrag(Number(req.params.id));
    if (!e || e.quelle !== 'eigen' || e.erstellt_von !== req.benutzer.id) return res.status(404).json({ fehler: 'Katalogeintrag nicht gefunden.' });
    if (!zentrale.aktiv) return res.status(409).json({ fehler: 'Die Verbindung zu zockerdb.de ist ausgeschaltet.' });
    if (['eingereicht', 'freigegeben'].includes(e.zentral_status)) return res.status(409).json({ fehler: 'Der Eintrag wurde bereits eingereicht.' });
    const ergebnis = await zentrale.einreichen(e);
    // Fotos zum Vorschlag gleich mitschicken
    await vorschlaege.sendeAnZentrale(e.id).catch(() => null);
    res.json(ergebnis);
  });

  // Sammlerzahlen bei zockerdb.de und Link zur öffentlichen Seite
  router.get('/katalog/:id/zentral', async (req, res) => {
    const e = katalog.holeSichtbar(req.params.id, req.benutzer);
    if (!e || e.quelle !== 'zockerdb' || !zentrale.aktiv) return res.json(null);
    res.json(await zentrale.statistik(Number(e.externe_id)).catch(() => null));
  });

  // ── Sync der eigenen Sammlung mit dem Konto auf zockerdb.de ──
  router.get('/konto/sync', (req, res) => res.json(sync.status(req.benutzer.id)));
  router.post('/konto/sync/verbinden', async (req, res) => res.json(await sync.verbinden(req.benutzer, req.body?.token)));
  router.post('/konto/sync/jetzt', async (req, res) => res.json(await sync.lauf(req.benutzer.id)));
  router.delete('/konto/sync', (req, res) => {
    sync.trennen(req.benutzer.id);
    res.json(sync.status(req.benutzer.id));
  });
  // Eigenes Foto eines Artikels (verkleinert) mit zockerdb.de synchronisieren – zählt dort zum Speicherplatz
  router.put('/artikel/:id/sync-bild', (req, res) => {
    const r = db.prepare('UPDATE artikel SET sync_bild = ?, sync_bild_hash = NULL WHERE id = ? AND benutzer_id = ?')
      .run(req.body?.an ? 1 : 0, Number(req.params.id), req.benutzer.id);
    if (!r.changes) return res.status(404).json({ fehler: 'Artikel nicht gefunden.' });
    res.json({ sync_bild: Boolean(req.body?.an) });
  });

  return router;
}

export function zentraleAdminRouter({ zentrale, einstellungen }) {
  const router = Router();
  // Datenspende ein-/ausschalten (Frage bei der Einrichtung, Hinweis in der Übersicht) – immer freiwillig
  router.post('/zentrale/spende', (req, res) => {
    einstellungen.setze({ werte: { ZOCKERDB_DONATE: req.body?.an ? 'true' : 'false' } }, req.benutzer);
    zentrale.merkeHinweis('spendeGefragt');
    res.json({ ...zentrale.status(), vorschau: zentrale.spendeDaten() });
  });
  router.post('/zentrale/hinweis-aus', (req, res) => {
    zentrale.merkeHinweis(req.body?.frage ? 'spendeGefragt' : 'spendeHinweisAus');
    res.json(zentrale.status());
  });
  // Status und Vorschau der Datenspende – genau das, was gesendet würde
  router.get('/zentrale', (_req, res) => res.json({ ...zentrale.status(), vorschau: zentrale.spendeDaten() }));
  router.post('/zentrale/lauf', async (req, res) => {
    if (!zentrale.aktiv) throw new ValidierungsFehler({ zentrale: 'Die Verbindung zu zockerdb.de ist ausgeschaltet.' });
    const ergebnis = await zentrale.lauf({ spendeErzwingen: Boolean(req.body?.spende) });
    res.json({ ...zentrale.status(), ergebnis });
  });
  return router;
}
