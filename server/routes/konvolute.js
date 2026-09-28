// Konvolute: mehrere Artikel zu einem Gesamtpreis (Flohmarkt-Kiste, Paket aus Kleinanzeigen …).
import { Router } from 'express';
import { pruefeKonvolut } from '../services/konvolute.js';
import { ValidierungsFehler } from '../services/validierung.js';

export function konvoluteRouter({ db, konvolute }) {
  const router = Router();
  const eigenes = (req, res) => {
    const k = konvolute.hole(req.params.id, req.benutzer.id);
    if (!k) res.status(404).json({ fehler: 'Konvolut nicht gefunden.' });
    return k;
  };

  router.get('/', (req, res) => res.json(konvolute.liste(req.benutzer.id)));

  router.post('/', (req, res) => {
    const d = pruefeKonvolut(req.body);
    const { id } = db.prepare(`INSERT INTO konvolute (benutzer_id, name, preis, kaufdatum, quelle, notizen, aufteilung)
      VALUES (@benutzer_id, @name, @preis, @kaufdatum, @quelle, @notizen, @aufteilung) RETURNING id`).get({ ...d, benutzer_id: req.benutzer.id });
    res.status(201).json(konvolute.hole(id, req.benutzer.id));
  });

  router.get('/:id', (req, res) => {
    const k = eigenes(req, res);
    if (k) res.json(k);
  });

  router.put('/:id', (req, res) => {
    const k = eigenes(req, res);
    if (!k) return;
    const d = pruefeKonvolut({ ...k, ...req.body });
    db.prepare(`UPDATE konvolute SET name = @name, preis = @preis, kaufdatum = @kaufdatum, quelle = @quelle, notizen = @notizen,
      aufteilung = @aufteilung WHERE id = @id`).run({ ...d, id: k.id });
    konvolute.aufteilen(k.id);
    res.json(konvolute.hole(k.id, req.benutzer.id));
  });

  // Auflösen: Artikel bleiben mit ihrem bisherigen Anteil als Kaufpreis erhalten
  router.delete('/:id', (req, res) => {
    const k = eigenes(req, res);
    if (!k) return;
    db.transaction(() => {
      db.prepare("UPDATE artikel SET konvolut_id = NULL, kaufpreis_anteilig = 0, aktualisiert_am = datetime('now') WHERE konvolut_id = ?").run(k.id);
      db.prepare('DELETE FROM konvolute WHERE id = ?').run(k.id);
    })();
    res.status(204).end();
  });

  // Vorhandene Artikel der eigenen Sammlung zuordnen
  router.post('/:id/artikel', (req, res) => {
    const k = eigenes(req, res);
    if (!k) return;
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger).slice(0, 500);
    if (!ids.length) throw new ValidierungsFehler({ ids: 'Bitte mindestens einen Artikel wählen.' });
    db.transaction(() => {
      const alt = new Set();
      for (const id of ids) {
        const a = db.prepare('SELECT id, konvolut_id FROM artikel WHERE id = ? AND benutzer_id = ?').get(id, req.benutzer.id);
        if (!a) continue;
        if (a.konvolut_id && a.konvolut_id !== k.id) alt.add(a.konvolut_id);
        // Ohne eigenen Preis wird der Artikel am Gesamtpreis beteiligt
        db.prepare(`UPDATE artikel SET konvolut_id = ?, herkunft = 'konvolut',
          kaufpreis_anteilig = CASE WHEN kaufpreis IS NULL OR kaufpreis_anteilig = 1 THEN 1 ELSE 0 END, aktualisiert_am = datetime('now') WHERE id = ?`).run(k.id, a.id);
      }
      for (const id of alt) konvolute.aufteilen(id);
      konvolute.aufteilen(k.id);
    })();
    res.json(konvolute.hole(k.id, req.benutzer.id));
  });

  router.delete('/:id/artikel/:artikelId', (req, res) => {
    const k = eigenes(req, res);
    if (!k) return;
    db.prepare(`UPDATE artikel SET konvolut_id = NULL, kaufpreis = CASE WHEN kaufpreis_anteilig = 1 THEN NULL ELSE kaufpreis END,
      kaufpreis_anteilig = 0, aktualisiert_am = datetime('now') WHERE id = ? AND konvolut_id = ?`).run(Number(req.params.artikelId), k.id);
    konvolute.aufteilen(k.id);
    res.json(konvolute.hole(k.id, req.benutzer.id));
  });

  return router;
}
