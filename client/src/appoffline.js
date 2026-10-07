// Offline-Speicher der App (iOS/Android). Im Browser übernimmt das der Service-Worker (public/sw.js), in der App läuft
// keiner (unter iOS nicht möglich). Deshalb hier in IndexedDB:
// - Antworten lesender API-Anfragen: Netzwerk zuerst, ohne Verbindung die zuletzt gesehene Antwort
// - die ganze Sammlung (eine Anfrage, alle Bestände) samt Titelbild je Exemplar – abgeglichen beim Start, nach Änderungen
//   und spätestens alle 15 Minuten. Bilder werden als Blob gespeichert und über Objekt-URLs angezeigt.
// Beim Abmelden bzw. Kontowechsel wird alles gelöscht.
import { istApp, apiUrl, zugangsKoepfe, wartenAuf, lokaleBilder, dateiAdresse } from './zugang.js';

const DB_NAME = 'zockerdb-app';
export const SAMMLUNG_PFAD = '/api/artikel?bestand=alle';
// Anmeldung, Konto, Verwaltung, Exporte und Online-Suchen nie speichern (wie im Service-Worker)
const NIE = ['/api/auth/', '/api/konto', '/api/admin', '/api/export', '/api/katalog/suche', '/api/katalog/barcode',
  '/api/boerse/meine.csv', '/api/boerse/nachrichten/anzahl', '/api/ueberwachung', '/api/health'];
const ABGLEICH_ABSTAND_MS = 15 * 60 * 1000;
const GLEICHZEITIG = 4;

let dbVersprechen = null;
function oeffne() {
  dbVersprechen ??= new Promise((resolve, reject) => {
    const anfrage = indexedDB.open(DB_NAME, 1);
    anfrage.onupgradeneeded = () => {
      anfrage.result.createObjectStore('antworten');
      anfrage.result.createObjectStore('bilder');
      anfrage.result.createObjectStore('info');
    };
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
  return dbVersprechen;
}

async function mitSpeicher(name, modus, aktion) {
  const db = await oeffne();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, modus);
    const ergebnis = aktion(tx.objectStore(name));
    tx.oncomplete = () => resolve(ergebnis?.result);
    tx.onerror = () => reject(tx.error);
  });
}
const lies = (name, schluessel) => mitSpeicher(name, 'readonly', (s) => s.get(schluessel));
const schreib = (name, schluessel, wert) => mitSpeicher(name, 'readwrite', (s) => s.put(wert, schluessel));

/** Soll diese Antwort offline verfügbar sein? */
export const speicherbar = (pfad, methode = 'GET') => istApp && methode === 'GET' && pfad.startsWith('/api/') && !NIE.some((p) => pfad.startsWith(p));

/** Antwort merken (unveränderte Server-Antwort; Bildadressen werden erst beim Lesen umgeschrieben). */
export async function merkeAntwort(pfad, json) {
  if (!speicherbar(pfad)) return;
  try { await schreib('antworten', pfad, { json, zeit: Date.now() }); } catch { /* Speicher voll o. Ä. – egal */ }
}

/** Zuletzt gesehene Antwort oder undefined. */
export async function leseAntwort(pfad) {
  if (!speicherbar(pfad)) return undefined;
  try { return structuredClone((await lies('antworten', pfad))?.json); } catch { return undefined; }
}

/** Die ganze Sammlung (alle Bestände) aus dem letzten Abgleich, sonst null. */
export async function sammlung() {
  if (!istApp) return null;
  try { return (await lies('antworten', SAMMLUNG_PFAD)) ?? null; } catch { return null; }
}

// ── Gespeicherte Bilder beim Start als Objekt-URLs bereitstellen ──
async function ladeBilder() {
  try {
    const db = await oeffne();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('bilder', 'readonly');
      const cursor = tx.objectStore('bilder').openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;
        if (!lokaleBilder.has(c.key)) lokaleBilder.set(c.key, URL.createObjectURL(c.value));
        c.continue();
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* ohne Bilder weiter */ }
}
if (istApp && typeof indexedDB !== 'undefined') wartenAuf(ladeBilder());

// ── Abgleich: ganze Sammlung und ihre Titelbilder ──
let laeuft = null;
let geplant = null;
let letzter = 0;

async function holeJson(pfad) {
  const antwort = await fetch(apiUrl(pfad), { headers: zugangsKoepfe(), credentials: 'omit' });
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
  return antwort.json();
}

async function holeBild(adresse) {
  const antwort = await fetch(dateiAdresse(adresse), { credentials: 'omit' });
  if (!antwort.ok) return;
  const blob = await antwort.blob();
  if (!blob.type.startsWith('image/')) return;
  await schreib('bilder', adresse, blob);
  if (!lokaleBilder.has(adresse)) lokaleBilder.set(adresse, URL.createObjectURL(blob));
}

async function abgleichen() {
  if (!navigator.onLine) return;
  const [liste] = await Promise.all([
    holeJson(SAMMLUNG_PFAD),
    holeJson('/api/artikel/anzahl').then((j) => merkeAntwort('/api/artikel/anzahl', j)),
    holeJson('/api/artikel/plattformen').then((j) => merkeAntwort('/api/artikel/plattformen', j)),
  ]);
  await merkeAntwort(SAMMLUNG_PFAD, liste);
  // Titelbilder: fehlende laden, nicht mehr benötigte entfernen
  const benoetigt = new Set(liste.map((a) => a.bild_url).filter((u) => typeof u === 'string' && (u.startsWith('/api/dateien/') || u.startsWith('https://'))));
  const vorhanden = new Set(await mitSpeicher('bilder', 'readonly', (s) => s.getAllKeys()));
  for (const alt of vorhanden) {
    if (benoetigt.has(alt)) continue;
    await mitSpeicher('bilder', 'readwrite', (s) => s.delete(alt));
    if (lokaleBilder.has(alt)) { URL.revokeObjectURL(lokaleBilder.get(alt)); lokaleBilder.delete(alt); }
  }
  const fehlend = [...benoetigt].filter((u) => !vorhanden.has(u));
  const arbeiter = Array.from({ length: GLEICHZEITIG }, async () => {
    while (fehlend.length && navigator.onLine) {
      await holeBild(fehlend.shift()).catch(() => {});
    }
  });
  await Promise.all(arbeiter);
  await schreib('info', 'stand', Date.now());
}

/** Abgleich bald starten (mehrere Anlässe kurz hintereinander werden zusammengefasst). */
export function planeAbgleich({ sofort = false } = {}) {
  if (!istApp) return;
  clearTimeout(geplant);
  geplant = setTimeout(() => {
    if (laeuft) return;
    letzter = Date.now();
    laeuft = abgleichen().catch((e) => console.warn('Offline-Abgleich fehlgeschlagen:', e.message)).finally(() => { laeuft = null; });
  }, sofort ? 0 : 3000);
}

/** Nach der Anmeldung bzw. beim Start: abgleichen, wenn der letzte Abgleich länger her ist. */
export function abgleichFaellig() {
  if (istApp && Date.now() - letzter > ABGLEICH_ABSTAND_MS) planeAbgleich({ sofort: true });
}

/** Konto des gespeicherten Stands; bei einem anderen Konto wird alles verworfen. */
export async function pruefeKonto(benutzerId) {
  if (!istApp || !benutzerId) return;
  try {
    const bisher = await lies('info', 'konto');
    if (bisher !== undefined && bisher !== benutzerId) await leeren();
    await schreib('info', 'konto', benutzerId);
  } catch { /* egal */ }
}

/** Alles löschen (Abmelden). */
export async function leeren() {
  if (!istApp) return;
  for (const url of lokaleBilder.values()) URL.revokeObjectURL(url);
  lokaleBilder.clear();
  letzter = 0;
  try {
    await Promise.all(['antworten', 'bilder', 'info'].map((name) => mitSpeicher(name, 'readwrite', (s) => s.clear())));
  } catch { /* egal */ }
}

if (istApp && typeof window !== 'undefined') {
  window.addEventListener('online', () => abgleichFaellig());
  window.addEventListener('vss:uebertragen', () => planeAbgleich());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') abgleichFaellig(); });
}
