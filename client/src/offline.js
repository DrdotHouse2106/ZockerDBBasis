// Offlinemodus: Änderungen an der Sammlung ohne Verbindung in einer Warteschlange (IndexedDB) sammeln und automatisch
// übertragen, sobald wieder eine Verbindung besteht. Beruht eine Änderung auf einem Stand, der auf dem Server inzwischen
// geändert oder gelöscht wurde, landet sie in der Konfliktliste – der Benutzer entscheidet (trotzdem speichern oder verwerfen).
//
// Gelesen wird offline über den Service-Worker (zuletzt geladene Antworten) – siehe public/sw.js.

import { apiUrl, zugangsKoepfe, zugangsCredentials, zugangBereit } from './zugang.js';

const DB_NAME = 'zockerdb-offline';
const EREIGNIS = 'vss:warteschlange';

function oeffne() {
  return new Promise((erfuellt, abgelehnt) => {
    const anfrage = indexedDB.open(DB_NAME, 1);
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      if (!db.objectStoreNames.contains('warteschlange')) db.createObjectStore('warteschlange', { keyPath: 'nr', autoIncrement: true });
      if (!db.objectStoreNames.contains('konflikte')) db.createObjectStore('konflikte', { keyPath: 'nr' });
    };
    anfrage.onsuccess = () => erfuellt(anfrage.result);
    anfrage.onerror = () => abgelehnt(anfrage.error);
  });
}

async function mitSpeicher(name, modus, fn) {
  const db = await oeffne();
  return new Promise((erfuellt, abgelehnt) => {
    const tx = db.transaction(name, modus);
    const ergebnis = fn(tx.objectStore(name));
    tx.oncomplete = () => { db.close(); erfuellt(ergebnis?.result ?? ergebnis); };
    tx.onerror = () => { db.close(); abgelehnt(tx.error); };
  });
}

const alle = (name) => mitSpeicher(name, 'readonly', (s) => s.getAll()).catch(() => []);
const melde = async () => {
  const [warten, konflikte] = await Promise.all([alle('warteschlange'), alle('konflikte')]);
  window.dispatchEvent(new CustomEvent(EREIGNIS, { detail: { warten: warten.length, konflikte } }));
};

/** Welche Änderungen offline möglich sind: Sammlungseinträge anlegen, ändern (auch Status/Notiz/Lagerort) und löschen. */
export function offlineFaehig(pfad, methode) {
  if (!('indexedDB' in window)) return false;
  if (methode === 'POST' && pfad === '/api/artikel') return true;
  if ((methode === 'PUT' || methode === 'DELETE') && /^\/api\/artikel\/\d+$/.test(pfad)) return true;
  return false;
}

/** Änderung für später merken. `basis` = aktualisiert_am des Eintrags, auf dem die Änderung beruht (Konflikterkennung). */
export async function merke({ pfad, methode, daten, basis, beschreibung }) {
  await mitSpeicher('warteschlange', 'readwrite', (s) => s.add({ pfad, methode, daten, basis: basis ?? null, beschreibung, zeit: new Date().toISOString() }));
  await melde();
}

let laeuft = false;

/** Warteschlange der Reihe nach übertragen. Bricht bei fehlender Verbindung ab, Konflikte werden beiseitegelegt. */
export async function uebertrage() {
  if (laeuft || !navigator.onLine || !('indexedDB' in window)) return { uebertragen: 0 };
  laeuft = true;
  let uebertragen = 0;
  try {
    const liste = await alle('warteschlange');
    for (const e of liste) {
      let antwort;
      try {
        await zugangBereit();
        antwort = await fetch(apiUrl(e.pfad), {
          method: e.methode,
          headers: { ...(e.daten !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(e.basis ? { 'X-Basis-Stand': e.basis } : {}), ...zugangsKoepfe() },
          body: e.daten !== undefined ? JSON.stringify(e.daten) : undefined,
          credentials: zugangsCredentials,
        });
      } catch {
        break; // noch keine Verbindung – später erneut
      }
      if (antwort.status === 401) break; // abgemeldet – nach der Anmeldung erneut
      const json = await antwort.json().catch(() => null);
      if (!antwort.ok) {
        // Geändert (409) oder gelöscht (404) bzw. abgelehnt: dem Benutzer zur Entscheidung vorlegen
        const art = antwort.status === 409 ? 'geaendert' : antwort.status === 404 ? 'geloescht' : 'fehler';
        await mitSpeicher('konflikte', 'readwrite', (s) => s.put({ ...e, art, meldung: json?.fehler ?? `HTTP ${antwort.status}`, server: json?.artikel ?? null }));
      }
      await mitSpeicher('warteschlange', 'readwrite', (s) => s.delete(e.nr));
      if (antwort.ok) uebertragen++;
    }
  } finally {
    laeuft = false;
    await melde();
  }
  if (uebertragen) window.dispatchEvent(new Event('vss:uebertragen'));
  return { uebertragen };
}

/** Konflikt lösen: „behalten“ = meine Änderung trotzdem speichern, sonst verwerfen (Server-Stand gilt). */
export async function loeseKonflikt(nr, behalten) {
  const liste = await alle('konflikte');
  const k = liste.find((x) => x.nr === nr);
  if (!k) return;
  await mitSpeicher('konflikte', 'readwrite', (s) => s.delete(nr));
  if (behalten && k.art !== 'fehler') {
    // Gelöscht und dann geändert: als neuen Eintrag anlegen; sonst ohne Stand erneut senden (überschreibt)
    if (k.art === 'geloescht' && k.methode === 'PUT') await merke({ pfad: '/api/artikel', methode: 'POST', daten: k.daten, beschreibung: k.beschreibung });
    else if (!(k.art === 'geloescht' && k.methode === 'DELETE')) await merke({ ...k, basis: null });
    await uebertrage();
  }
  await melde();
}

export const zustand = melde;
export { EREIGNIS as WARTESCHLANGE_EREIGNIS };

/** Automatisch übertragen: beim Start, wenn die Verbindung zurückkommt und alle 30 Sekunden, solange etwas wartet. */
export function starteAbgleich() {
  if (!('indexedDB' in window)) return () => {};
  const los = () => uebertrage().catch(() => {});
  window.addEventListener('online', los);
  const t = setInterval(async () => { if ((await alle('warteschlange')).length) los(); }, 30_000);
  los();
  melde();
  return () => { window.removeEventListener('online', los); clearInterval(t); };
}
