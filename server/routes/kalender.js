// Releasekalender „Erscheint demnächst“.
// Quelle der Termine:
//  1. ein Zusatzmodul (Andockpunkt „kalender.termine“ → Liste oder null; auf zockerdb.de der IGDB-Datenabzug),
//  2. sonst zockerdb.de (Verbindung zur Zentrale) – die Einträge werden in den eigenen Katalog übernommen,
//  3. sonst gibt es keinen Kalender (eigene Katalogeinträge kennen nur das Erscheinungsjahr).
import { Router } from 'express';
import { meineSysteme } from '../services/plattformen.js';

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const REGION_TERMINE = {
  pal: ['Europa', 'Weltweit', 'Australien', 'Neuseeland'],
  ntsc_u: ['Nordamerika', 'Weltweit'],
  ntsc_j: ['Japan', 'Weltweit'],
};
const heute = () => new Date().toISOString().slice(0, 10);
const plusTage = (datum, tage) => new Date(Date.parse(`${datum}T00:00:00Z`) + tage * 86400000).toISOString().slice(0, 10);

/** Zeitraum aus der Anfrage: Standard heute bis +90 Tage, höchstens 366 Tage, frühestens ein Jahr zurück. */
export function zeitraum(query) {
  const jetzt = heute();
  let von = TAG.test(query.von ?? '') ? query.von : jetzt;
  if (von < plusTage(jetzt, -366)) von = plusTage(jetzt, -366);
  let bis = TAG.test(query.bis ?? '') ? query.bis : plusTage(von, 90);
  if (bis < von) bis = von;
  if (bis > plusTage(von, 366)) bis = plusTage(von, 366);
  return { von, bis };
}

export function kalenderRouter({ db, plattformen, zentrale, katalog, erweiterungen }) {
  const router = Router();
  const standardSysteme = db.prepare('SELECT id FROM plattformen WHERE standard = 1').pluck();
  const zentralCache = new Map(); // "von|bis" → { zeit, liste }

  async function vonZentrale(von, bis) {
    const schluessel = `${von}|${bis}`;
    const alt = zentralCache.get(schluessel);
    if (alt && Date.now() - alt.zeit < 6 * 3600_000) return alt.liste;
    const roh = await zentrale.kalender({ von, bis });
    // Einträge in den eigenen Katalog übernehmen (wie bei der Suche), damit Katalogseite und Sammlung funktionieren
    const liste = db.transaction(() => roh.map((t) => {
      const eintrag = katalog.speichere(t.eintrag);
      if (!eintrag) return null;
      const p = plattformen.zuordnen(t.plattform);
      return {
        katalog: { id: eintrag.id, typ: eintrag.typ, titel: eintrag.titel, cover_url: eintrag.cover_url, erscheinungsjahr: eintrag.erscheinungsjahr },
        plattform_id: p?.id ?? null, plattform: p?.name ?? t.plattform ?? null, plattform_kurz: p?.kurz ?? null,
        datum: t.datum, region: t.region ?? null, text: t.text ?? null,
      };
    }).filter(Boolean))();
    zentralCache.set(schluessel, { zeit: Date.now(), liste });
    if (zentralCache.size > 50) zentralCache.delete(zentralCache.keys().next().value);
    return liste;
  }

  /** Alle Termine im Zeitraum (ungefiltert) und woher sie stammen. */
  async function termine(von, bis) {
    for (const quelle of erweiterungen.alle('kalender.termine')) {
      const liste = await quelle({ von, bis });
      if (liste) return { liste, quelle: 'modul' };
    }
    if (zentrale?.aktiv) return { liste: await vonZentrale(von, bis), quelle: 'zentrale' };
    return { liste: [], quelle: null };
  }

  router.get('/kalender', async (req, res) => {
    const { von, bis } = zeitraum(req.query);
    let ergebnis;
    try {
      ergebnis = await termine(von, bis);
    } catch (e) {
      return res.json({ von, bis, termine: [], quelle: null, fehler: e.status ? e.message : 'zockerdb.de ist gerade nicht erreichbar – bitte später erneut versuchen.' });
    }
    // Plattformfilter: gewählte Plattform, sonst „Meine Systeme“ bzw. die Standardsysteme; „alle=1“ zeigt alles
    let erlaubt = null;
    const plattformId = Number(req.query.plattform);
    if (Number.isInteger(plattformId) && plattformId > 0) erlaubt = new Set([plattformId]);
    else if (req.query.alle !== '1') erlaubt = meineSysteme(req.benutzer) ?? new Set(standardSysteme.all());
    let liste = erlaubt ? ergebnis.liste.filter((t) => t.plattform_id && erlaubt.has(t.plattform_id)) : ergebnis.liste;
    // Region: standardmäßig PAL (Europa, Australien/Neuseeland, weltweit); Termine ohne Region bleiben
    const region = REGION_TERMINE[req.query.region ?? 'pal'];
    if (region) liste = liste.filter((t) => !t.region || region.includes(t.region));

    // Markierungen von Zusatzmodulen (z. B. Wunschliste) und eigener Besitz
    const ids = [...new Set(liste.map((t) => t.katalog.id))];
    const markierungen = Object.assign({}, ...erweiterungen.alle('kalender.markieren').map((fn) => fn({ ids, benutzer: req.benutzer }) ?? {}));
    const wunsch = new Set(markierungen.wunschliste ?? []);
    if (req.query.wunschliste === '1') liste = liste.filter((t) => wunsch.has(t.katalog.id));
    const besitz = ids.length
      ? new Set(db.prepare(`SELECT DISTINCT katalog_id FROM artikel WHERE benutzer_id = ? AND bestand = 'besitz' AND katalog_id IN (SELECT value FROM json_each(?))`)
        .pluck().all(req.benutzer.id, JSON.stringify(ids)))
      : new Set();
    const grenze = Math.min(Math.max(Number(req.query.grenze) || 500, 1), 1000);
    res.json({
      von, bis, quelle: ergebnis.quelle, gefiltert: Boolean(erlaubt), wunschlisteVerfuegbar: 'wunschliste' in markierungen,
      termine: liste.slice(0, grenze).map((t) => ({ ...t, auf_wunschliste: wunsch.has(t.katalog.id), im_besitz: besitz.has(t.katalog.id) })),
      mehr: liste.length > grenze,
    });
  });

  return router;
}
