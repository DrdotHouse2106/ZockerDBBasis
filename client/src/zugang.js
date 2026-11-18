// Zugang zur API. Im Browser: relative Pfade und Sitzungs-Cookie. In der App (Capacitor, gebündelte Oberfläche):
// feste Server-Adresse (VITE_API_BASIS beim Bauen) und Sitzungstoken im Authorization-Kopf – Cookies von der Server-
// Adresse wären in der App fremd. Das Token speichert ein vom Zusatzmodul gesetzter Speicher (Schlüsselbund/Keystore).

export const istApp = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
/** 'ios' oder 'android' in der App, sonst null. */
export const appPlattform = istApp ? window.Capacitor?.getPlatform?.() ?? null : null;
/** Systeme mit eingebauter Freistellung – in der App nur das eigene nennen (Store-Richtlinien). */
export const FREISTELL_SYSTEME = appPlattform === 'ios' ? 'ab iOS 17' : appPlattform === 'android' ? null : 'iOS ab 17 oder Android';
/** Text, der in der iOS-App nicht erscheinen soll, weil er eine andere Plattform nennt (Apple-Richtlinie 2.3.10). */
export const nenntFremdePlattform = (text) => appPlattform === 'ios' && /android|google play/i.test(String(text));

/** Woher etwas gemeldet wird – „App (iOS) · iPhone“, „Homescreen-App · Android“, „Browser · Windows“ (für Fehlermeldungen). */
export function umgebung() {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent ?? '';
  const geraet = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : null;
  const plattform = window.Capacitor?.getPlatform?.();
  const art = istApp ? `App (${plattform === 'ios' ? 'iOS' : plattform === 'android' ? 'Android' : plattform ?? 'nativ'})`
    : window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone ? 'Homescreen-App' : 'Browser';
  // Systemversion aus der Kennung des Browsers (Safari meldet ab iOS 26 teils eine eingefrorene Version)
  const ios = ua.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))? like Mac OS X/);
  const system = ios && /iPhone|iPad|iPod/.test(geraet ?? ua) ? `${geraet === 'iPad' ? 'iPadOS' : 'iOS'} ${ios[1]}.${ios[2]}${ios[3] ? `.${ios[3]}` : ''}`
    : ua.match(/Android (\d+(?:\.\d+)?)/) ? `Android ${ua.match(/Android (\d+(?:\.\d+)?)/)[1]}`
      : /Windows NT 10/.test(ua) ? 'Windows 10/11' : /Mac OS X (\d+)[_.](\d+)/.test(ua) ? 'macOS' : null;
  const browser = istApp ? null : /Edg\//.test(ua) ? 'Edge' : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /Chrome\/|CriOS/.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : null;
  // Genaue Werte aus der App, falls sie sie setzt: window.ZOCKERDB_APP_INFO = { version, build, osVersion }
  const info = istApp ? window.ZOCKERDB_APP_INFO : null;
  const genau = info?.osVersion ? `${plattform === 'android' ? 'Android' : 'iOS'} ${info.osVersion}` : system;
  const appVersion = info?.version ? `Version ${info.version}${info.build ? ` (${info.build})` : ''}` : null;
  const doppelt = genau && geraet && (genau.startsWith(geraet) || (geraet === 'Mac' && genau === 'macOS'));
  return [art, appVersion, doppelt ? null : geraet, genau, browser].filter(Boolean).join(' · ');
}
const basis = istApp ? String(import.meta.env.VITE_API_BASIS ?? '').replace(/\/$/, '') : '';

let token = null;
let dateiSchluessel = null;
let speicher = null;
let bewusstAbgemeldet = false;
const wartet = [];

/** Vor der ersten Anfrage der App abwarten (gespeichertes Token, Offline-Bilder). */
export function wartenAuf(versprechen) {
  wartet.push(Promise.resolve(versprechen).catch(() => {}));
}

/** Speicher für das Token setzen: `{ laden(): Promise<string|null>, speichern(token), loeschen() }`. */
export function setzeTokenSpeicher(neu) {
  if (!istApp) return;
  speicher = neu;
  wartenAuf(Promise.resolve(neu.laden()).then((t) => { token = t || null; }).catch(() => { token = null; }));
  // Startet iOS die App im Hintergrund bei gesperrtem Gerät (z. B. nachts zum Freistellen), liefert der Schlüsselbund
  // nichts – nicht zu unterscheiden von „nie angemeldet“. Deshalb beim Zurückholen in den Vordergrund erneut lesen und
  // mit dem gefundenen Token neu starten, statt abgemeldet zu bleiben.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || token || bewusstAbgemeldet) return;
    const gefunden = await Promise.resolve(speicher.laden()).catch(() => null);
    if (gefunden && !token && !bewusstAbgemeldet) window.location.reload();
  });
}

/** Wartet, bis ein gespeichertes Token gelesen ist (vor der ersten Anfrage der App). */
export const zugangBereit = () => Promise.all(wartet);

// Die App startet mit der gemerkten Anmeldung, bevor /api/auth/status geantwortet hat. Lesende Anfragen warten auf diese
// erste Antwort (sie bringt den Dateischlüssel für Bilder) – höchstens kurz, damit ein hängender Server nichts blockiert.
let sitzungGeklaert = null;
let sitzungMelden = null;
export function wartenAufSitzung() {
  if (!istApp) return Promise.resolve();
  sitzungGeklaert ??= new Promise((ok) => { sitzungMelden = ok; setTimeout(ok, 5000); });
  return sitzungGeklaert;
}
export function sitzungGeklaertMelden() {
  wartenAufSitzung();
  sitzungMelden?.();
}

/** Offline gespeicherte Bilder der App: ursprüngliche Adresse → Objekt-URL (siehe appoffline.js). */
export const lokaleBilder = new Map();

/**
 * Liegt die Adresse auf dem eigenen Server? Im Browser die Seite selbst, in der App zusätzlich die feste Server-Adresse –
 * dort werden Datei-Pfade zu vollen Adressen (https://zockerdb.de/api/dateien/…) und hätten sonst einen fremden Ursprung.
 */
export function istEigeneAdresse(url) {
  if (url.origin === window.location.origin) return true;
  try {
    return Boolean(basis) && url.origin === new URL(basis).origin;
  } catch {
    return false;
  }
}

/** Volle Adresse eines API-Pfads (im Browser unverändert). */
export const apiUrl = (pfad) => (basis && pfad.startsWith('/') ? `${basis}${pfad}` : pfad);

/** Zusätzliche Köpfe für Anfragen: in der App Kennung und Token. */
export const zugangsKoepfe = () => (istApp ? { 'X-ZockerDB-Client': 'app', ...(token ? { Authorization: `Bearer ${token}` } : {}) } : {});

/** Cookies nur im Browser mitsenden. */
export const zugangsCredentials = istApp ? 'omit' : 'same-origin';

export async function merkeToken(neu) {
  token = neu || null;
  bewusstAbgemeldet = !token;
  if (!token) dateiSchluessel = null;
  try {
    if (token) await speicher?.speichern(token);
    else await speicher?.loeschen();
  } catch (fehler) {
    console.warn('Anmeldung konnte nicht gespeichert werden:', fehler);
  }
}

/**
 * Antworten der API für die App aufbereiten: Sitzungstoken nach der Anmeldung übernehmen, Dateischlüssel merken und
 * Datei-Pfade (/api/dateien/…) zu vollen Adressen mit Schlüssel machen – <img> kann keinen Authorization-Kopf senden.
 */
export async function verarbeiteAntwort(pfad, json) {
  if (!istApp || !json || typeof json !== 'object') return json;
  if (/^\/api\/auth\/(anmelden|2fa|registrieren)$/.test(pfad) && json.angemeldet && json.token) {
    await merkeToken(json.token);
    delete json.token;
  }
  if (pfad === '/api/auth/status') {
    if (json.dateiSchluessel) dateiSchluessel = json.dateiSchluessel;
    else if (!json.angemeldet && token) await merkeToken(null);
    // Der Schlüssel bleibt nur im Arbeitsspeicher – die Antwort landet sonst für den Offline-Start im localStorage
    delete json.dateiSchluessel;
  }
  return dateiUrlsUmschreiben(json);
}

/** Abrufbare Adresse einer Datei: in der App volle Adresse mit Dateischlüssel. */
export function dateiAdresse(wert) {
  if (!wert.startsWith('/api/dateien/')) return wert;
  const url = apiUrl(wert);
  return dateiSchluessel ? `${url}${url.includes('?') ? '&' : '?'}schluessel=${encodeURIComponent(dateiSchluessel)}` : url;
}

function dateiUrlsUmschreiben(wert) {
  if (typeof wert === 'string') {
    if (lokaleBilder.has(wert)) return lokaleBilder.get(wert);
    return dateiAdresse(wert);
  }
  if (Array.isArray(wert)) {
    for (let i = 0; i < wert.length; i++) wert[i] = dateiUrlsUmschreiben(wert[i]);
  } else if (wert && typeof wert === 'object') {
    for (const k of Object.keys(wert)) wert[k] = dateiUrlsUmschreiben(wert[k]);
  }
  return wert;
}
