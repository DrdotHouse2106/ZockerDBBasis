// Ideen & Wünsche: Benutzer schlagen Funktionen vor, andere stimmen mit „Daumen hoch“ dafür, Administratoren setzen den
// Stand (geplant, in Arbeit, umgesetzt …). Das Ideenbrett gibt es dort, wo ZockerDB weiterentwickelt wird (zockerdb.de,
// erkennbar an der eigenen Moderation). Selbst gehostet gehen Ideen an zockerdb.de; der Stand kommt beim Abgleich zurück.
import { MODULE } from '../module.js';
import { KontoFehler } from './konten.js';
import { ValidierungsFehler } from './validierung.js';

// Zusatzmodule ergänzen eigene Bereiche (ideenBereiche), „Sonstiges“ bleibt am Ende
export const IDEEN_BEREICHE = [
  ['sammlung', 'Sammlung'], ['katalog', 'Katalog & Suche'], ['statistik', 'Statistik & Wert'],
  ...MODULE.flatMap((m) => m.ideenBereiche ?? []), ['app', 'App & Bedienung'], ['sonstiges', 'Sonstiges'],
];
export const IDEEN_STATUS = [
  ['neu', 'Neu'], ['geplant', 'Geplant'], ['in_arbeit', 'In Arbeit'], ['umgesetzt', 'Umgesetzt'], ['abgelehnt', 'Nicht geplant'],
];
const BEREICHE = IDEEN_BEREICHE.map(([w]) => w);
const STATUS = IDEEN_STATUS.map(([w]) => w);
const PRO_TAG = 10;

export function pruefeIdee(eingabe = {}) {
  const fehler = {};
  const titel = String(eingabe.titel ?? '').replace(/\s+/g, ' ').trim();
  if (titel.length < 5 || titel.length > 120) fehler.titel = 'Bitte die Idee in 5 bis 120 Zeichen zusammenfassen.';
  const beschreibung = String(eingabe.beschreibung ?? '').trim().slice(0, 3000) || null;
  if (Object.keys(fehler).length) throw new ValidierungsFehler(fehler);
  return { titel, beschreibung, bereich: BEREICHE.includes(eingabe.bereich) ? eingabe.bereich : 'sonstiges' };
}

export function erstelleIdeenDienst(db, { katalog, zentrale, benachrichtigungen, erweiterungen }) {
  const stimmenVon = (id) => db.prepare('SELECT COUNT(*) FROM ideen_stimmen WHERE idee_id = ?').pluck().get(id) + 1;

  /**
   * Neue Idee auf dem Brett: Administratoren benachrichtigen (App, Push bzw. E-Mail je nach ihren Einstellungen) und
   * Andockpunkt „idee.neu“ melden (z. B. GitHub-Issue anlegen).
   */
  function neueIdee(id) {
    const i = db.prepare('SELECT * FROM ideen WHERE id = ?').get(id);
    if (!i) return;
    for (const admin of db.prepare("SELECT id FROM benutzer WHERE rolle = 'admin' AND gesperrt = 0").pluck().all()) {
      if (admin === i.benutzer_id) continue;
      benachrichtigungen?.sende(admin, { art: 'system', titel: `Neue Idee: „${i.titel}“`, text: i.beschreibung?.slice(0, 200) ?? null, link: '#/ideen' });
    }
    erweiterungen?.melde('idee.neu', { ...i, stimmen: 1 });
  }
  /** 'brett' = hier wird entschieden und abgestimmt; 'zentrale' = weiter an zockerdb.de; null = nicht verfügbar. */
  const modus = () => (katalog.moderiert() ? 'brett' : zentrale?.aktiv ? 'zentrale' : null);

  const liste = db.prepare(`SELECT i.*, COALESCE(b.anzeigename, b.benutzername) AS von,
      (SELECT COUNT(*) FROM ideen_stimmen s WHERE s.idee_id = i.id) + 1 AS stimmen,
      EXISTS (SELECT 1 FROM ideen_stimmen s WHERE s.idee_id = i.id AND s.benutzer_id = @b) AS gestimmt
    FROM ideen i LEFT JOIN benutzer b ON b.id = i.benutzer_id`);
  const objekt = (i, benutzer) => ({
    id: i.id, titel: i.titel, beschreibung: i.beschreibung, bereich: i.bereich, status: i.status, antwort: i.antwort,
    stimmen: i.stimmen, gestimmt: Boolean(i.gestimmt), eigene: Boolean(benutzer && i.benutzer_id === benutzer.id),
    von: i.von ?? (i.instanz_id ? 'eigener Server' : null), erstellt_am: i.erstellt_am, geaendert_am: i.geaendert_am,
  });

  /** Brett: alle Ideen (beliebteste zuerst); selbst gehostet: nur die eigenen. */
  function alle(benutzer) {
    const bedingung = modus() === 'brett' ? '' : 'WHERE i.benutzer_id = @b';
    const liste2 = db.prepare(`${liste.source} ${bedingung} ORDER BY CASE i.status WHEN 'umgesetzt' THEN 1 WHEN 'abgelehnt' THEN 2 ELSE 0 END, stimmen DESC, i.id DESC LIMIT 500`)
      .all({ b: benutzer.id }).map((i) => objekt(i, benutzer));
    // Andockpunkt „ideen.zusatz“: { [id]: { … } } – z. B. Link zum GitHub-Issue
    const zusatz = erweiterungen?.sammle('ideen.zusatz', liste2.map((i) => i.id), benutzer) ?? {};
    return liste2.map((i) => ({ ...i, ...(zusatz[i.id] ?? {}) }));
  }

  /** Ähnliche offene Ideen zum eingegebenen Titel – lieber dafür stimmen als doppelt einreichen. */
  function aehnliche(text, benutzer) {
    const woerter = String(text ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4).slice(0, 6);
    if (!woerter.length || modus() !== 'brett') return [];
    const bedingung = woerter.map((_, n) => `LOWER(i.titel || ' ' || COALESCE(i.beschreibung, '')) LIKE @w${n}`).join(' OR ');
    const werte = Object.fromEntries(woerter.map((w, n) => [`w${n}`, `%${w.replace(/[\\%_]/g, '')}%`]));
    return db.prepare(`${liste.source} WHERE i.status NOT IN ('umgesetzt', 'abgelehnt') AND (${bedingung}) ORDER BY stimmen DESC LIMIT 5`)
      .all({ b: benutzer.id, ...werte }).map((i) => objekt(i, benutzer));
  }

  async function einreichen(benutzer, eingabe) {
    const m = modus();
    if (!m) throw new KontoFehler('Ideen lassen sich hier nicht einreichen (keine Verbindung zu zockerdb.de).', 409);
    const d = pruefeIdee(eingabe);
    const heute = db.prepare("SELECT COUNT(*) AS n FROM ideen WHERE benutzer_id = ? AND erstellt_am >= datetime('now', '-1 day')").get(benutzer.id).n;
    if (heute >= PRO_TAG) throw new KontoFehler('Du hast heute schon viele Ideen eingereicht – danke! Bitte morgen weiter.', 429);
    let zentralId = null;
    if (m === 'zentrale') {
      try {
        zentralId = Number((await zentrale.anfrage('/api/zentral/idee', { methode: 'POST', daten: d })).id) || null;
      } catch (e) {
        throw new KontoFehler(e.message, 502);
      }
    }
    const i = db.prepare(`INSERT INTO ideen (benutzer_id, titel, beschreibung, bereich, zentral_id) VALUES (?, ?, ?, ?, ?) RETURNING id`)
      .get(benutzer.id, d.titel, d.beschreibung, d.bereich, zentralId);
    if (m === 'brett') neueIdee(i.id);
    return { ...hole(i.id, benutzer), ziel: m === 'brett' ? 'hier' : 'zockerdb.de' };
  }

  function hole(id, benutzer) {
    const i = db.prepare(`${liste.source} WHERE i.id = @id`).get({ id: Number(id), b: benutzer.id });
    return i ? objekt(i, benutzer) : null;
  }

  /** Daumen hoch – nochmal tippen nimmt die Stimme zurück. Die eigene Idee zählt automatisch. */
  function stimme(benutzer, id) {
    if (modus() !== 'brett') throw new KontoFehler('Abstimmen ist nur auf zockerdb.de möglich.', 409);
    const i = hole(id, benutzer);
    if (!i) throw new KontoFehler('Idee nicht gefunden.', 404);
    if (i.eigene) throw new KontoFehler('Deine eigene Idee zählt schon mit.', 409);
    if (i.gestimmt) db.prepare('DELETE FROM ideen_stimmen WHERE idee_id = ? AND benutzer_id = ?').run(i.id, benutzer.id);
    else db.prepare('INSERT OR IGNORE INTO ideen_stimmen (idee_id, benutzer_id) VALUES (?, ?)').run(i.id, benutzer.id);
    erweiterungen?.melde('idee.stimme', { id: i.id, stimmen: stimmenVon(i.id) });
    return hole(i.id, benutzer);
  }

  /** Administration: Stand und Antwort setzen. Einreicher und Unterstützer erfahren es. */
  function entscheide(admin, id, { status, antwort }) {
    const i = db.prepare('SELECT * FROM ideen WHERE id = ?').get(Number(id));
    if (!i) throw new KontoFehler('Idee nicht gefunden.', 404);
    if (!STATUS.includes(status)) throw new ValidierungsFehler({ status: 'Unbekannter Stand.' });
    const text = String(antwort ?? '').trim().slice(0, 2000) || null;
    db.prepare("UPDATE ideen SET status = ?, antwort = ?, geaendert_am = datetime('now') WHERE id = ?").run(status, text, i.id);
    if (status !== i.status && admin.id) erweiterungen?.melde('idee.entschieden', { id: i.id, status, antwort: text });
    if (status !== i.status && status !== 'neu') {
      const empfaenger = new Set([i.benutzer_id, ...db.prepare('SELECT benutzer_id FROM ideen_stimmen WHERE idee_id = ?').all(i.id).map((s) => s.benutzer_id)]);
      empfaenger.delete(null);
      empfaenger.delete(admin.id);
      const stand = Object.fromEntries(IDEEN_STATUS)[status];
      for (const b of empfaenger) {
        benachrichtigungen?.sende(b, { art: 'system', titel: `Idee „${i.titel}“: ${stand}`, text: text ?? 'Danke für deine Unterstützung!', link: '#/ideen' });
      }
    }
    return hole(i.id, admin);
  }

  /**
   * Titel, Beschreibung und Bereich nachträglich ändern: Einreicher, solange die Idee noch nicht entschieden ist
   * (umgesetzt/nicht geplant), Administratoren immer. Selbst gehostet geht die Änderung auch an zockerdb.de.
   */
  async function bearbeite(benutzer, id, eingabe) {
    const i = db.prepare('SELECT * FROM ideen WHERE id = ?').get(Number(id));
    const admin = benutzer.rolle === 'admin' && modus() === 'brett';
    const eigene = i && i.benutzer_id === benutzer.id;
    if (!i || (!admin && !eigene)) throw new KontoFehler('Idee nicht gefunden.', 404);
    if (!admin && ['umgesetzt', 'abgelehnt'].includes(i.status)) throw new KontoFehler('Entschiedene Ideen lassen sich nicht mehr ändern.', 409);
    const d = pruefeIdee(eingabe);
    if (i.zentral_id) {
      try {
        await zentrale.anfrage(`/api/zentral/idee/${i.zentral_id}`, { methode: 'PUT', daten: d });
      } catch (e) {
        throw new KontoFehler(e.message, 502);
      }
    }
    db.prepare("UPDATE ideen SET titel = ?, beschreibung = ?, bereich = ?, geaendert_am = datetime('now') WHERE id = ?")
      .run(d.titel, d.beschreibung, d.bereich, i.id);
    erweiterungen?.melde('idee.geaendert', { id: i.id });
    return hole(i.id, benutzer);
  }

  /** zockerdb.de: Änderung einer Idee übernehmen, die eine Installation eingereicht hat. */
  function vonInstanzAendern(instanzId, id, eingabe) {
    const i = db.prepare('SELECT * FROM ideen WHERE id = ? AND instanz_id = ?').get(Number(id), instanzId);
    if (!i) throw new KontoFehler('Idee nicht gefunden.', 404);
    if (['umgesetzt', 'abgelehnt'].includes(i.status)) throw new KontoFehler('Entschiedene Ideen lassen sich nicht mehr ändern.', 409);
    const d = pruefeIdee(eingabe);
    db.prepare("UPDATE ideen SET titel = ?, beschreibung = ?, bereich = ?, geaendert_am = datetime('now') WHERE id = ?")
      .run(d.titel, d.beschreibung, d.bereich, i.id);
    erweiterungen?.melde('idee.geaendert', { id: i.id });
    return { id: i.id };
  }

  function loesche(benutzer, id) {
    const i = db.prepare('SELECT * FROM ideen WHERE id = ?').get(Number(id));
    const darf = i && (benutzer.rolle === 'admin' || (i.benutzer_id === benutzer.id && i.status === 'neu'));
    if (!darf) throw new KontoFehler('Idee nicht gefunden.', 404);
    db.prepare('DELETE FROM ideen WHERE id = ?').run(i.id);
  }

  /** zockerdb.de: Idee einer Installation übernehmen. */
  function vonInstanz(instanzId, eingabe) {
    const d = pruefeIdee(eingabe);
    const heute = db.prepare("SELECT COUNT(*) AS n FROM ideen WHERE instanz_id = ? AND erstellt_am >= datetime('now', '-1 day')").get(instanzId).n;
    if (heute >= 50) throw new KontoFehler('Heute wurden schon genug Ideen eingereicht.', 429);
    const neu = db.prepare('INSERT INTO ideen (instanz_id, titel, beschreibung, bereich) VALUES (?, ?, ?, ?) RETURNING id').get(instanzId, d.titel, d.beschreibung, d.bereich);
    neueIdee(neu.id);
    return neu;
  }

  /** Selbst gehostet: Stand der eigenen Ideen bei zockerdb.de abfragen und Einreicher benachrichtigen. */
  async function pruefeZentrale() {
    const offen = db.prepare("SELECT * FROM ideen WHERE zentral_id IS NOT NULL AND status NOT IN ('umgesetzt', 'abgelehnt')").all();
    if (!offen.length || !zentrale?.aktiv) return 0;
    const r = await zentrale.anfrage(`/api/zentral/ideen?ids=${offen.map((i) => i.zentral_id).join(',')}`);
    let geaendert = 0;
    for (const z of r.ideen ?? []) {
      const i = offen.find((x) => x.zentral_id === Number(z.id));
      if (!i || !STATUS.includes(z.status) || (z.status === i.status && (z.antwort ?? null) === i.antwort)) continue;
      const antwort = String(z.antwort ?? '').slice(0, 2000) || null;
      db.prepare("UPDATE ideen SET status = ?, antwort = ?, geaendert_am = datetime('now') WHERE id = ?").run(z.status, antwort, i.id);
      if (z.status !== i.status && i.benutzer_id) {
        benachrichtigungen?.sende(i.benutzer_id, {
          art: 'system', titel: `Idee „${i.titel}“: ${Object.fromEntries(IDEEN_STATUS)[z.status]}`, text: antwort ?? 'Neuigkeiten von zockerdb.de.', link: '#/ideen',
        });
      }
      geaendert += 1;
    }
    return geaendert;
  }

  return { modus, alle, aehnliche, einreichen, stimme, entscheide, bearbeite, loesche, vonInstanz, vonInstanzAendern, pruefeZentrale };
}
