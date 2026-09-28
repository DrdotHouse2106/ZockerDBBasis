import { Router } from 'express';

export function statistikRouter({ db }) {
  const router = Router();

  router.get('/', (req, res) => {
    const gesamt = db.prepare(
      `SELECT COUNT(*) AS eintraege, COALESCE(SUM(anzahl), 0) AS stueck,
              COALESCE(SUM(kaufpreis * anzahl), 0) AS kaufwert
       FROM artikel WHERE benutzer_id = @b`,
    ).get({ b: req.benutzer.id });
    const gruppiert = (feld) => db.prepare(
      `SELECT ${feld} AS wert, COALESCE(SUM(anzahl), 0) AS stueck, COALESCE(SUM(kaufpreis * anzahl), 0) AS kaufwert
       FROM artikel WHERE benutzer_id = @b GROUP BY ${feld} ORDER BY stueck DESC`,
    ).all({ b: req.benutzer.id });
    // Ohne Kaufpreis (lange her, Geschenk, Konvolut ohne Gesamtpreis) – zählt nicht in den Kaufwert
    const ohnePreis = db.prepare('SELECT COUNT(*) AS eintraege, COALESCE(SUM(anzahl), 0) AS stueck FROM artikel WHERE benutzer_id = ? AND kaufpreis IS NULL')
      .get(req.benutzer.id);
    const konvolute = db.prepare(`SELECT COUNT(*) AS anzahl, COALESCE(SUM(preis), 0) AS summe FROM konvolute WHERE benutzer_id = ?`).get(req.benutzer.id);
    const zuletzt = db.prepare(
      'SELECT id, titel, typ, plattform, erstellt_am FROM artikel WHERE benutzer_id = ? ORDER BY erstellt_am DESC, id DESC LIMIT 5',
    ).all(req.benutzer.id);
    res.json({
      gesamt,
      nachTyp: gruppiert('typ'),
      nachPlattform: gruppiert('plattform').slice(0, 15),
      nachRegion: gruppiert('region'),
      nachZustand: gruppiert('zustand'),
      nachVollstaendigkeit: gruppiert('vollstaendigkeit'),
      nachHerkunft: gruppiert('herkunft'),
      ohnePreis,
      konvolute,
      zuletzt,
    });
  });

  return router;
}
