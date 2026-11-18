// Fotos freistellen: Warteschlange für Helfer-Geräte, Ergebnis des eigenen Handys, Entscheidung des Fotografen.
import express, { Router } from 'express';

const MASKE_LIMIT = '8mb';

export function freistellenRouter({ freistellen, konten }) {
  const router = Router();
  const maske = express.raw({ type: 'image/*', limit: MASKE_LIMIT });
  const ohneMaske = (res) => res.status(400).json({ fehler: 'Bitte die Maske als Bild (PNG oder WebP, Graustufen, weiß = Motiv) im Anfragekörper senden.' });

  // Stand für die App: Funktion an? Darf dieses Konto helfen? Häkchen gesetzt?
  router.get('/freistellen/status', (req, res) => res.json(freistellen.stand(req.benutzer)));

  // Freistellen im Hintergrund (iPhone am Ladegerät, auch gesperrt): Die App holt sich ein eigenes Helfer-Token, das nur die
  // Freistellen-Endpunkte darf (siehe helferDarf in middleware/auth.js) – das normale Sitzungstoken bleibt „nur entsperrt“ lesbar.
  router.post('/freistellen/hintergrund', (req, res) => {
    if (req.sitzungArt !== 'app') return res.status(400).json({ fehler: 'Freistellen im Hintergrund lässt sich nur in der App einschalten.' });
    if (!freistellen.darfHelfen(req.benutzer)) {
      return res.status(403).json({ fehler: 'Dein Konto ist nicht als Helfer-Gerät freigeschaltet – oder das Häkchen im Konto fehlt.' });
    }
    const { token } = konten.erstelleSitzung(req.benutzer.id, { art: 'freistellen', geraet: req.headers['user-agent'] });
    res.status(201).json({ token });
  });
  // Ausschalten: das Helfer-Token meldet sich selbst ab
  router.delete('/freistellen/hintergrund', (req, res) => {
    if (req.sitzungArt !== 'freistellen') return res.status(400).json({ fehler: 'Nur mit dem Helfer-Token.' });
    konten.beendeSitzung(req.sitzungsToken);
    res.status(204).end();
  });

  // Helfer: Aufträge in Päckchen reservieren
  // Antwort: { auftraege, limit, heute, rest } – rest = heute noch erlaubte Aufträge (null = unbegrenzt)
  router.get('/freistellen/naechste', (req, res) => res.json(freistellen.naechste(req.benutzer, req.query.anzahl)));

  // Helfer: Foto zum reservierten Auftrag – verkleinert (höchstens 1.200 px), die App zeigt es nicht an
  router.get('/freistellen/:id/bild', async (req, res) => {
    const pfad = await freistellen.helferBild(req.benutzer, req.params.id);
    res.set('Cache-Control', 'private, no-store');
    res.sendFile(pfad, (fehler) => { if (fehler && !res.headersSent) res.status(404).json({ fehler: 'Datei nicht gefunden.' }); });
  });

  // Helfer: Maske zum reservierten Auftrag
  router.put('/freistellen/:id', maske, async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return ohneMaske(res);
    res.json(await freistellen.ergebnis(req.benutzer, req.params.id, req.body));
  });

  // Helfer: Foto konnte nicht freigestellt werden
  router.post('/freistellen/:id/fehler', (req, res) => res.json(freistellen.fehler(req.benutzer, req.params.id)));

  // Fotograf mit starkem Handy: Maske zum eigenen Foto direkt nach dem Upload; ?angenommen=1 = Ergebnis schon geprüft
  router.put('/medien/:id/freistellen', maske, async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return ohneMaske(res);
    res.json(await freistellen.eigenesErgebnis(req.benutzer, req.params.id, req.body, { angenommen: req.query.angenommen === '1' }));
  });

  // Seite „Freistellungen prüfen“: Original und freigestellte Version nebeneinander – eigene Fotos, für Moderatoren alle
  router.get('/freistellen/pruefen', (req, res) => {
    const url = (datei) => `/api/dateien/${datei}`;
    const { gesamt, fotos } = freistellen.zuPruefenListe(req.benutzer, { grenze: req.query.grenze, alle: req.query.alle === '1', uebernommen: req.query.uebernommen === '1' });
    res.json({
      gesamt,
      fotos: fotos.map((m) => ({
        id: m.id, katalog_id: m.katalog_id, katalog_titel: m.katalog_titel, katalog_typ: m.katalog_typ, art: m.art, titel: m.titel,
        farbe: m.variante_farbe ?? null, variante: m.variante ?? null, eigenes: m.benutzer_id === req.benutzer.id,
        // Warum ein fremdes Foto hier steht: kein Fotograf mehr (Konto gelöscht) bzw. seit 30 Tagen ungeprüft
        ohne_fotograf: m.benutzer_id == null, liegt_lange: m.benutzer_id !== req.benutzer.id && Boolean(m.lange),
        url: url(m.anzeige_datei ?? m.datei), frei_url: url(m.frei_datei),
      })),
    });
  });

  // Fotograf oder Moderation: Freistellen ausdrücklich anfordern (z. B. für Discs und Disc-Hüllen, die nicht automatisch drankommen)
  router.post('/medien/:id/freistellen/anfordern', (req, res) => res.json(freistellen.anfordern(req.benutzer, req.params.id)));

  // Fotograf oder Moderation: freigestellte Version zeigen (annehmen) oder verwerfen
  router.post('/medien/:id/freistellen/entscheiden', async (req, res) => {
    res.json(await freistellen.entscheide(req.benutzer, req.params.id, req.body?.annehmen === true));
  });

  return router;
}
