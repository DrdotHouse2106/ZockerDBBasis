import { Router } from 'express';

export function statistikRouter({ db }) {
  const router = Router();

  router.get('/', (req, res) => {
    const gesamt = db.prepare(
      `SELECT COUNT(*) AS eintraege, COALESCE(SUM(anzahl), 0) AS stueck,
              COALESCE(SUM(kaufpreis * anzahl), 0) AS kaufwert
       FROM artikel WHERE benutzer_id = @b AND bestand = 'besitz'`,
    ).get({ b: req.benutzer.id });
    const gruppiert = (feld) => db.prepare(
      `SELECT ${feld} AS wert, COALESCE(SUM(anzahl), 0) AS stueck, COALESCE(SUM(kaufpreis * anzahl), 0) AS kaufwert
       FROM artikel WHERE benutzer_id = @b AND bestand = 'besitz' GROUP BY ${feld} ORDER BY stueck DESC`,
    ).all({ b: req.benutzer.id });
    // Ohne Kaufpreis (lange her, Geschenk, Konvolut ohne Gesamtpreis) – zählt nicht in den Kaufwert
    const ohnePreis = db.prepare("SELECT COUNT(*) AS eintraege, COALESCE(SUM(anzahl), 0) AS stueck FROM artikel WHERE benutzer_id = ? AND bestand = 'besitz' AND kaufpreis IS NULL")
      .get(req.benutzer.id);
    const konvolute = db.prepare(`SELECT COUNT(*) AS anzahl, COALESCE(SUM(preis), 0) AS summe FROM konvolute WHERE benutzer_id = ?`).get(req.benutzer.id);
    const zuletzt = db.prepare(
      "SELECT id, titel, typ, plattform, erstellt_am FROM artikel WHERE benutzer_id = ? AND bestand = 'besitz' ORDER BY erstellt_am DESC, id DESC LIMIT 5",
    ).all(req.benutzer.id);
    // Verkäufe: Erlös und Gewinn/Verlust gegenüber dem Kaufpreis (bei Konvoluten der anteilige Preis) – je Jahr
    const verkauf = db.prepare(`SELECT COUNT(*) AS eintraege, COALESCE(SUM(anzahl), 0) AS stueck,
        COALESCE(SUM(verkaufspreis * anzahl), 0) AS erloes,
        COALESCE(SUM(CASE WHEN verkaufspreis IS NOT NULL AND kaufpreis IS NOT NULL THEN (verkaufspreis - kaufpreis) * anzahl END), 0) AS gewinn,
        COALESCE(SUM(CASE WHEN verkaufspreis IS NOT NULL AND kaufpreis IS NULL THEN anzahl END), 0) AS ohne_kaufpreis
      FROM artikel WHERE benutzer_id = ? AND bestand = 'verkauft'`).get(req.benutzer.id);
    const verkaufJahre = db.prepare(`SELECT substr(abgang_am, 1, 4) AS jahr, COALESCE(SUM(anzahl), 0) AS stueck,
        COALESCE(SUM(verkaufspreis * anzahl), 0) AS erloes,
        COALESCE(SUM(CASE WHEN verkaufspreis IS NOT NULL AND kaufpreis IS NOT NULL THEN (verkaufspreis - kaufpreis) * anzahl END), 0) AS gewinn
      FROM artikel WHERE benutzer_id = ? AND bestand = 'verkauft' GROUP BY jahr ORDER BY jahr DESC`).all(req.benutzer.id);
    const abgegeben = db.prepare("SELECT COALESCE(SUM(anzahl), 0) AS stueck FROM artikel WHERE benutzer_id = ? AND bestand = 'abgegeben'").get(req.benutzer.id).stueck;
    res.json({
      verkauf: { ...verkauf, jahre: verkaufJahre, abgegeben },
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
