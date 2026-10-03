// Katalog-Seiten, die – wenn PUBLIC_CATALOG aktiv ist – auch ohne Anmeldung erreichbar sind.
// Enthält nur freigegebene, nicht personenbezogene Daten (plus eigene Daten, wenn angemeldet).
import { Router } from 'express';
import { meineSysteme } from '../services/plattformen.js';
import { HERSTELLER_REIHENFOLGE, KATALOG_REGIONEN } from '../../shared/konstanten.js';
import { sprachBedingung } from '../../shared/sprachen.js';
import { katalogZeileZuObjekt, SICHTBAR_SQL, sichtbarParameter, fuerBenutzer } from '../services/katalog.js';

const SEITENGROESSE = 48;

export function oeffentlichRouter({ db, plattformen, konfiguration, erweiterungen }) {
  const router = Router();

  // Ohne Anmeldung nur, wenn der öffentliche Katalog eingeschaltet ist.
  router.use((req, res, next) => {
    if (req.benutzer || konfiguration.oeffentlicherKatalog) return next();
    res.status(401).json({ fehler: 'Bitte melde dich an.', code: 'nicht_angemeldet' });
  });

  router.get('/plattformen', (req, res) => {
    const zaehler = db.prepare(`
      SELECT kp.plattform_id AS id, COUNT(DISTINCT k.id) AS eintraege
      FROM katalog_plattformen kp JOIN katalog k ON k.id = kp.katalog_id
      WHERE k.status = 'freigegeben'
      GROUP BY kp.plattform_id`).all();
    const meine = req.benutzer
      ? db.prepare("SELECT plattform_id AS id, COALESCE(SUM(anzahl), 0) AS stueck FROM artikel WHERE benutzer_id = ? AND bestand = 'besitz' AND plattform_id IS NOT NULL GROUP BY plattform_id")
        .all(req.benutzer.id)
      : [];
    const katalogZahl = new Map(zaehler.map((z) => [z.id, z.eintraege]));
    const meineZahl = new Map(meine.map((z) => [z.id, z.stueck]));
    // „Meine Systeme“: eigene Auswahl oder Standardsysteme – Systeme, von denen man etwas besitzt, sind immer dabei
    const auswahl = meineSysteme(req.benutzer);
    const liste = plattformen.alle().map((p) => {
      const meineStueck = meineZahl.get(p.id) ?? 0;
      return { ...p, katalog: katalogZahl.get(p.id) ?? 0, meine: meineStueck, sichtbar: auswahl ? auswahl.has(p.id) || meineStueck > 0 : p.standard || meineStueck > 0 };
    });
    liste.sort((a, b) => (HERSTELLER_REIHENFOLGE.indexOf(a.hersteller) + 1 || 99) - (HERSTELLER_REIHENFOLGE.indexOf(b.hersteller) + 1 || 99)
      || (a.erscheinungsjahr ?? 9999) - (b.erscheinungsjahr ?? 9999));
    res.json(liste);
  });

  // Durchsuchbarer globaler Katalog (freigegebene Einträge, die gepflegt oder in Sammlungen sind)
  router.get('/katalog-liste', (req, res) => {
    // Alle freigegebenen Einträge der Datenbank (gepflegte und aus IGDB übernommene)
    const bedingungen = ["k.status = 'freigegeben'"];
    const parameter = {};
    if (['spiel', 'konsole', 'zubehoer'].includes(req.query.typ)) {
      bedingungen.push('k.typ = @typ');
      parameter.typ = req.query.typ;
    }
    const plattformId = Number(req.query.plattform);
    if (Number.isInteger(plattformId) && plattformId > 0) {
      bedingungen.push('EXISTS (SELECT 1 FROM katalog_plattformen kp WHERE kp.katalog_id = k.id AND kp.plattform_id = @plattform)');
      parameter.plattform = plattformId;
    }
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      bedingungen.push("(k.titel LIKE @q ESCAPE '\\' OR k.titel_original LIKE @q ESCAPE '\\')");
      parameter.q = `%${req.query.q.trim().replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
    }
    // Veröffentlichungsregion (z. B. nur PAL): Einträge ohne bekannte Regionen bleiben sichtbar
    const region = KATALOG_REGIONEN.find((r) => r.value === req.query.region);
    if (region?.codes) {
      bedingungen.push(`(k.regionen IS NULL OR EXISTS (SELECT 1 FROM json_each(k.regionen) WHERE value IN (${region.codes.map((c) => `'${c}'`).join(', ')})))`);
    }
    // Sprache laut IGDB, z. B. „de_audio“ = deutsche Sprachausgabe
    const sprache = sprachBedingung(req.query.sprache, 'k.sprachen');
    if (sprache) bedingungen.push(sprache);
    const seite = Math.min(10_000, Math.max(1, Number.parseInt(req.query.seite, 10) || 1));
    const where = bedingungen.join(' AND ');
    const gesamt = db.prepare(`SELECT COUNT(*) AS n FROM katalog k WHERE ${where}`).get(parameter).n;
    const zeilen = db.prepare(`
      SELECT k.*, (SELECT COUNT(DISTINCT a.benutzer_id) FROM artikel a WHERE a.katalog_id = k.id AND a.bestand = 'besitz' AND a.privat = 0) AS besitzer
      FROM katalog k WHERE ${where}
      ORDER BY besitzer DESC, k.titel COLLATE NOCASE LIMIT ${SEITENGROESSE} OFFSET ${(seite - 1) * SEITENGROESSE}`).all(parameter);
    res.json({
      gesamt, seite, seiten: Math.max(1, Math.ceil(gesamt / SEITENGROESSE)),
      eintraege: zeilen.map((z) => fuerBenutzer(katalogZeileZuObjekt(z), req.benutzer)),
    });
  });

  // Alles für die Seite eines Spiels/Geräts
  router.get('/katalog-seite/:id', async (req, res) => {
    const b = req.benutzer;
    const lies = () => katalogZeileZuObjekt(db.prepare(`SELECT k.* FROM katalog k WHERE k.id = @id AND ${SICHTBAR_SQL}`)
      .get({ id: Number(req.params.id), ...sichtbarParameter(b) }));
    let eintrag = lies();
    if (!eintrag) return res.status(404).json({ fehler: 'Katalogeintrag nicht gefunden.' });
    // Andockpunkt „katalog.seite.vorbereiten“ (eintrag, benutzer): Zusatzmodule können den Eintrag vorher noch ergänzen
    // (z. B. eine fehlende Übersetzung erstellen) – danach wird er neu gelesen
    if (erweiterungen.alle('katalog.seite.vorbereiten').length) {
      await erweiterungen.fuehreAus('katalog.seite.vorbereiten', eintrag, b);
      eintrag = lies() ?? eintrag;
    }

    const plattformListe = db.prepare(`SELECT p.id, p.name, p.kurz, p.hersteller FROM katalog_plattformen kp
      JOIN plattformen p ON p.id = kp.plattform_id WHERE kp.katalog_id = ? ORDER BY p.erscheinungsjahr`).all(eintrag.id);
    const varianten = db.prepare(`
      SELECT v.*, (SELECT COUNT(*) FROM artikel a WHERE a.variante_id = v.id AND a.benutzer_id = @benutzer AND a.bestand = 'besitz') AS meine
      FROM katalog_varianten v WHERE v.katalog_id = @katalog
        AND (v.status = 'freigegeben' OR v.erstellt_von = @benutzer OR @moderator = 1)
      ORDER BY v.erscheinungsjahr IS NULL, v.erscheinungsjahr, v.bezeichnung COLLATE NOCASE`)
      .all({ katalog: eintrag.id, ...sichtbarParameter(b) })
      .map((v) => ({ ...fuerBenutzer(v, b), eigene: v.erstellt_von === b?.id, erstellt_von: undefined, geprueft_von: undefined }));

    // Erfahrungsberichte anderer Sammler (nur angemeldet sichtbar) und der eigene
    const berichte = b
      ? db.prepare(`SELECT r.id, r.text, r.wertung, r.erstellt_am, r.aktualisiert_am, COALESCE(u.anzeigename, u.benutzername) AS name,
          r.benutzer_id = @b AS eigener
          FROM erfahrungsberichte r JOIN benutzer u ON u.id = r.benutzer_id AND u.gesperrt = 0
          WHERE r.katalog_id = @k AND (r.status = 'sichtbar' OR r.benutzer_id = @b) ORDER BY r.benutzer_id = @b DESC, r.aktualisiert_am DESC LIMIT 100`)
        .all({ b: b.id, k: eintrag.id }).map((r) => ({ ...r, eigener: Boolean(r.eigener) }))
      : [];
    const meineExemplare = b
      ? db.prepare(`SELECT a.id, a.titel, a.plattform, a.region, a.zustand, a.vollstaendigkeit, a.farbe, a.edition, a.modellnummer, a.variante_id, a.anzahl, a.bestand, a.beilagen
          FROM artikel a WHERE a.katalog_id = ? AND a.benutzer_id = ? ORDER BY a.bestand <> 'besitz', a.id`).all(eintrag.id, b.id)
        .map((a) => { try { return { ...a, beilagen: a.beilagen ? JSON.parse(a.beilagen) : null }; } catch { return { ...a, beilagen: null }; } })
      : [];
    // Nur Anzahl und Art der Dateien – die Dateien selbst sind erst nach Anmeldung sichtbar
    // (öffentlich gezeigte Fotos liefert ein Zusatzmodul direkt mit)
    const medienUebersicht = db.prepare(`SELECT art, COUNT(*) AS anzahl FROM medien WHERE katalog_id = ? AND sichtbarkeit = 'freigegeben'
      AND oeffentlich = 0 GROUP BY art`).all(eintrag.id);
    const medienAnzahl = medienUebersicht.reduce((s, m) => s + m.anzahl, 0);

    res.json({
      eintrag: {
        ...fuerBenutzer(eintrag, b),
        eigener: Boolean(b && eintrag.erstellt_von === b.id),
        erstellt_von: undefined,
        geprueft_von: undefined,
      },
      plattformen: plattformListe,
      varianten,
      meineExemplare,
      berichte,
      medienAnzahl,
      medienUebersicht,
      angemeldet: Boolean(b),
      // Ergänzungen von Zusatzmodulen
      ...erweiterungen.sammle('katalog.seite', { eintrag, plattformen: plattformListe, benutzer: b }),
    });
  });

  return router;
}
