// Katalog-Seiten, die – wenn PUBLIC_CATALOG aktiv ist – auch ohne Anmeldung erreichbar sind.
// Enthält nur freigegebene, nicht personenbezogene Daten (plus eigene Daten, wenn angemeldet).
import { Router } from 'express';
import { meineSysteme } from '../services/plattformen.js';
import { HERSTELLER_REIHENFOLGE, KATALOG_REGIONEN, normalisiereLieferumfang } from '../../shared/konstanten.js';
import { sprachBedingung } from '../../shared/sprachen.js';
import { standardPlattform } from '../../shared/plattformwahl.js';
import { suchWoerter, wortVarianten, woerterBedingung, unscharfePassung } from '../services/suchwoerter.js';
import { katalogZeileZuObjekt, SICHTBAR_SQL, VERSTECKT_SQL, sichtbarParameter, fuerBenutzer } from '../services/katalog.js';
import { erstelleDrossel } from '../services/drossel.js';
import { erstelleCoverAuswahl } from '../services/cover.js';

const SEITENGROESSE = 48;

export function oeffentlichRouter({ db, plattformen, konfiguration, erweiterungen, serien, katalog }) {
  // Cover je Region und passendes Cover (z. B. das Foto einer Figur ohne Katalog-Bild)
  const coverAuswahl = katalog ? erstelleCoverAuswahl(db, katalog) : null;
  const router = Router();
  const listenDrossel = erstelleDrossel({ maxVersuche: 60, fensterMs: 60 * 1000 });

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
    // Die fehlertolerante Suche vergleicht bis zu 3.000 Titel je Anfrage – auch ohne Anmeldung erreichbar, deshalb gedrosselt
    const schluessel = req.benutzer ? `b:${req.benutzer.id}` : `ip:${req.ip}`;
    if (listenDrossel.gesperrt(schluessel)) return res.status(429).json({ fehler: 'Zu viele Suchanfragen. Bitte einen Moment warten.' });
    listenDrossel.fehlschlag(schluessel);
    // Alle freigegebenen Einträge der Datenbank (gepflegte und aus IGDB übernommene)
    // Kleine DLCs und Pakete erscheinen nur am Hauptspiel („DLCs & Erweiterungen“), nicht in der Katalogliste
    const bedingungen = ["k.status = 'freigegeben'", VERSTECKT_SQL];
    const parameter = {};
    if (['spiel', 'konsole', 'zubehoer', 'merch'].includes(req.query.typ)) {
      bedingungen.push('k.typ = @typ');
      parameter.typ = req.query.typ;
    }
    const plattformId = Number(req.query.plattform);
    if (Number.isInteger(plattformId) && plattformId > 0) {
      bedingungen.push('EXISTS (SELECT 1 FROM katalog_plattformen kp WHERE kp.katalog_id = k.id AND kp.plattform_id = @plattform)');
      parameter.plattform = plattformId;
    }
    // Titelsuche fehlertolerant wie bei „Hinzufügen“: Wörter in beliebiger Reihenfolge, Apostrophe egal, Mehrzahl-„s“ egal,
    // römische Zahlen wie Ziffern (suchwoerter.js); findet das nichts, mit Tippfehlern (siehe unten)
    const woerter = typeof req.query.q === 'string' ? suchWoerter(req.query.q) : [];
    const suchIndex = bedingungen.length;
    if (woerter.length) {
      const { sql, parameter: p } = woerterBedingung(woerter, ['k.suchtext'], 'q', { normalisiert: true });
      bedingungen.push(sql);
      Object.assign(parameter, p);
      parameter.anfang = `${String(req.query.q).trim().replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
    }
    // Veröffentlichungsregion (z. B. nur PAL): Einträge ohne bekannte Regionen bleiben sichtbar
    const region = KATALOG_REGIONEN.find((r) => r.value === req.query.region);
    if (region?.codes) {
      bedingungen.push(`(k.regionen IS NULL OR EXISTS (SELECT 1 FROM json_each(k.regionen) WHERE value IN (${region.codes.map((c) => `'${c}'`).join(', ')})))`);
    }
    // Jugendschutz: indiziert, beschlagnahmt, vom Index gestrichen oder „alle“ = irgendeiner davon
    if (['indiziert', 'beschlagnahmt', 'gestrichen'].includes(req.query.jugendschutz)) {
      bedingungen.push('k.jugendschutz = @jugendschutz');
      parameter.jugendschutz = req.query.jugendschutz;
    } else if (req.query.jugendschutz === 'alle') bedingungen.push('k.jugendschutz IS NOT NULL');
    // Sprache laut IGDB, z. B. „de_audio“ = deutsche Sprachausgabe
    const sprache = sprachBedingung(req.query.sprache, 'k.sprachen');
    if (sprache) bedingungen.push(sprache);
    const seite = Math.min(10_000, Math.max(1, Number.parseInt(req.query.seite, 10) || 1));
    const where = bedingungen.join(' AND ');
    const gesamt = db.prepare(`SELECT COUNT(*) AS n FROM katalog k WHERE ${where}`).get(parameter).n;
    // Nichts gefunden: Tippfehler zulassen. Vorauswahl über die ersten zwei Buchstaben jedes Worts an einem Wortanfang,
    // dann je Titel der Editierabstand (bis 7 Zeichen ein Fehler, darüber zwei); nur die erste Seite, beste Treffer zuerst
    if (!gesamt && woerter.some((w) => w.length >= 5)) {
      // Zahlen und römische Zahlen („7“ ↔ „VII“) prüft erst der Abstandsvergleich – nicht in der Vorauswahl
      const vorWoerter = woerter.filter((w) => w.length >= 3 && !wortVarianten(w).grenze);
      const vorauswahl = vorWoerter.map((w, i) => `k.suchtext LIKE @u${i} ESCAPE '\\'`);
      const rest = bedingungen.filter((_, i) => i !== suchIndex);
      const p = Object.fromEntries(vorWoerter.map((w, i) => [`u${i}`, `% ${w.slice(0, 2).replace(/[\\%_]/g, (z) => `\\${z}`)}%`]));
      const kandidaten = db.prepare(`SELECT k.*, (SELECT COUNT(DISTINCT a.benutzer_id) FROM artikel a WHERE a.katalog_id = k.id AND a.bestand = 'besitz' AND a.privat = 0) AS besitzer
        FROM katalog k WHERE ${[...rest, ...vorauswahl].join(' AND ') || '1'} LIMIT 3000`).all({ ...parameter, ...p });
      const treffer = kandidaten.map((z) => {
        const d = [unscharfePassung(z.titel, woerter), z.titel_original ? unscharfePassung(z.titel_original, woerter) : null].filter((x) => x !== null);
        return d.length ? { z, d: Math.min(...d) } : null;
      }).filter(Boolean).sort((a, b) => a.d - b.d || b.z.besitzer - a.z.besitzer || a.z.titel.localeCompare(b.z.titel, 'de')).slice(0, SEITENGROESSE);
      return res.json({
        gesamt: treffer.length, seite: 1, seiten: 1, unscharf: treffer.length > 0,
        eintraege: treffer.map(({ z }) => fuerBenutzer(katalogZeileZuObjekt(z), req.benutzer)),
      });
    }
    const zeilen = db.prepare(`
      SELECT k.*, (SELECT COUNT(DISTINCT a.benutzer_id) FROM artikel a WHERE a.katalog_id = k.id AND a.bestand = 'besitz' AND a.privat = 0) AS besitzer
      FROM katalog k WHERE ${where}
      ORDER BY ${woerter.length ? "(k.titel LIKE @anfang ESCAPE '\\') DESC, " : ''}besitzer DESC, k.titel COLLATE NOCASE LIMIT ${SEITENGROESSE} OFFSET ${(seite - 1) * SEITENGROESSE}`).all(parameter);
    res.json({
      gesamt, seite, seiten: Math.max(1, Math.ceil(gesamt / SEITENGROESSE)), unscharf: false,
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
    // Plattform-Auswahl (nur bei mehreren Plattformen): ?plattform=<id> bzw. ?plattform=auto (Standard). Ohne Parameter
    // wird nichts gefiltert – Verhalten wie früher (ältere App-Versionen).
    const eigenePlattform = b ? db.prepare(`SELECT a.plattform_id FROM artikel a WHERE a.katalog_id = ? AND a.benutzer_id = ? AND a.plattform_id IS NOT NULL
      ORDER BY a.bestand <> 'besitz', a.id LIMIT 1`).pluck().get(eintrag.id, b.id) : null;
    const standard = standardPlattform(plattformListe, { eigene: eigenePlattform ?? null, systeme: meineSysteme(b) });
    const wunsch = req.query.plattform === 'auto' ? standard : Number(req.query.plattform);
    const gewaehlt = plattformListe.length > 1 && plattformListe.some((p) => p.id === wunsch) ? wunsch : null;
    const plattform = plattformListe.find((p) => p.id === gewaehlt) ?? null;
    // Andockpunkt „katalog.variantenPlattformen“ (katalogId): { varianteId: [plattformIds] } – Varianten ohne Angabe gelten für alle
    const variantenPlattformen = gewaehlt
      ? Object.assign({}, ...erweiterungen.alle('katalog.variantenPlattformen').map((fn) => fn(eintrag.id) ?? {}))
      : {};
    const passtZurPlattform = (v) => !variantenPlattformen[v.id] || variantenPlattformen[v.id].includes(gewaehlt);
    const varianten = db.prepare(`
      SELECT v.*, (SELECT COUNT(*) FROM artikel a WHERE a.variante_id = v.id AND a.benutzer_id = @benutzer AND a.bestand = 'besitz') AS meine
      FROM katalog_varianten v WHERE v.katalog_id = @katalog
        AND (v.status = 'freigegeben' OR v.erstellt_von = @benutzer OR @moderator = 1)
      ORDER BY v.erscheinungsjahr IS NULL, v.erscheinungsjahr, v.bezeichnung COLLATE NOCASE`)
      .all({ katalog: eintrag.id, ...sichtbarParameter(b) })
      .filter(passtZurPlattform)
      .map((v) => ({ ...fuerBenutzer(v, b), lieferumfang: normalisiereLieferumfang(v.lieferumfang), eigene: v.erstellt_von === b?.id, erstellt_von: undefined, geprueft_von: undefined }));

    // Erfahrungsberichte anderer Sammler (nur angemeldet sichtbar) und der eigene
    const berichte = b
      ? db.prepare(`SELECT r.id, r.text, r.wertung, r.erstellt_am, r.aktualisiert_am, COALESCE(u.anzeigename, u.benutzername) AS name,
          r.benutzer_id = @b AS eigener
          FROM erfahrungsberichte r JOIN benutzer u ON u.id = r.benutzer_id AND u.gesperrt = 0
          WHERE r.katalog_id = @k AND (r.status = 'sichtbar' OR r.benutzer_id = @b) ORDER BY r.benutzer_id = @b DESC, r.aktualisiert_am DESC LIMIT 100`)
        .all({ b: b.id, k: eintrag.id }).map((r) => ({ ...r, eigener: Boolean(r.eigener) }))
      : [];
    const meineExemplare = b
      ? db.prepare(`SELECT a.id, a.titel, a.plattform, a.region, a.zustand, a.vollstaendigkeit, a.farbe, a.edition, a.modellnummer, a.variante_id, a.anzahl, a.bestand, a.beilagen,
          CASE WHEN a.bild_datei IS NOT NULL THEN '/api/dateien/' || a.bild_datei ELSE a.cover_url END AS bild_url
          FROM artikel a WHERE a.katalog_id = @k AND a.benutzer_id = @b AND (@p IS NULL OR a.plattform_id IS NULL OR a.plattform_id = @p)
          ORDER BY a.bestand <> 'besitz', a.id`).all({ k: eintrag.id, b: b.id, p: gewaehlt })
        .map((a) => { try { return { ...a, beilagen: a.beilagen ? JSON.parse(a.beilagen) : null }; } catch { return { ...a, beilagen: null }; } })
      : [];
    // Nur Anzahl und Art der Dateien – die Dateien selbst sind erst nach Anmeldung sichtbar
    // (öffentlich gezeigte Fotos liefert ein Zusatzmodul direkt mit)
    const medienUebersicht = db.prepare(`SELECT art, COUNT(*) AS anzahl FROM medien WHERE katalog_id = ? AND sichtbarkeit = 'freigegeben'
      AND oeffentlich = 0 GROUP BY art`).all(eintrag.id);
    const medienAnzahl = medienUebersicht.reduce((s, m) => s + m.anzahl, 0);

    // Figur einer Figurenserie: Serie (und Hauptserie) für den Kopf der Seite
    const serie = eintrag.serie_id ? db.prepare(`SELECT s.id, s.name, s.nummer_praefix, u.name AS ueber_name FROM serien s
      LEFT JOIN serien u ON u.id = s.ueber_id WHERE s.id = ? AND (s.status = 'freigegeben' OR s.erstellt_von = ?)`).get(eintrag.serie_id, b?.id ?? -1) ?? null : null;
    res.json({
      eintrag: {
        ...fuerBenutzer(eintrag, b),
        ...(coverAuswahl?.(eintrag, b) ?? {}),
        serie,
        // Spiel mit Figurenserie (z. B. Monster in My Pocket): die Serien mit Figurenzahl und eigenem Besitz
        figurenserien: eintrag.typ === 'spiel' && serien ? serien.zuSpiel(eintrag.id, b) : [],
        eigener: Boolean(b && eintrag.erstellt_von === b.id),
        erstellt_von: undefined,
        geprueft_von: undefined,
      },
      plattformen: plattformListe,
      // Gewählte Plattform (null = alle) und Standard für die Plattform-Leiste
      plattformWahl: { gewaehlt, standard: plattformListe.length > 1 ? standard : null },
      varianten,
      meineExemplare,
      berichte,
      medienAnzahl,
      medienUebersicht,
      angemeldet: Boolean(b),
      // Ergänzungen von Zusatzmodulen
      ...erweiterungen.sammle('katalog.seite', { eintrag, plattformen: plattformListe, benutzer: b, plattform }),
    });
  });

  return router;
}
