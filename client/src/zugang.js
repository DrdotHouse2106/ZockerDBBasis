// Zugang zur API. Im Browser: relative Pfade und Sitzungs-Cookie. In der App (Capacitor, gebündelte Oberfläche):
// feste Server-Adresse (VITE_API_BASIS beim Bauen) und Sitzungstoken im Authorization-Kopf – Cookies von der Server-
// Adresse wären in der App fremd. Das Token speichert ein vom Zusatzmodul gesetzter Speicher (Schlüsselbund/Keystore).

export const istApp = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
const basis = istApp ? String(import.meta.env.VITE_API_BASIS ?? '').replace(/\/$/, '') : '';

let token = null;
let dateiSchluessel = null;
let speicher = null;
let geladen = Promise.resolve();

/** Speicher für das Token setzen: `{ laden(): Promise<string|null>, speichern(token), loeschen() }`. */
export function setzeTokenSpeicher(neu) {
  if (!istApp) return;
  speicher = neu;
  geladen = Promise.resolve(neu.laden()).then((t) => { token = t || null; }).catch(() => { token = null; });
}

/** Wartet, bis ein gespeichertes Token gelesen ist (vor der ersten Anfrage der App). */
export const zugangBereit = () => geladen;

/** Volle Adresse eines API-Pfads (im Browser unverändert). */
export const apiUrl = (pfad) => (basis && pfad.startsWith('/') ? `${basis}${pfad}` : pfad);

/** Zusätzliche Köpfe für Anfragen: in der App Kennung und Token. */
export const zugangsKoepfe = () => (istApp ? { 'X-ZockerDB-Client': 'app', ...(token ? { Authorization: `Bearer ${token}` } : {}) } : {});

/** Cookies nur im Browser mitsenden. */
export const zugangsCredentials = istApp ? 'omit' : 'same-origin';

export async function merkeToken(neu) {
  token = neu || null;
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
  }
  return dateiUrlsUmschreiben(json);
}

function dateiUrlsUmschreiben(wert) {
  if (typeof wert === 'string') {
    if (!wert.startsWith('/api/dateien/')) return wert;
    const url = apiUrl(wert);
    return dateiSchluessel ? `${url}${url.includes('?') ? '&' : '?'}schluessel=${encodeURIComponent(dateiSchluessel)}` : url;
  }
  if (Array.isArray(wert)) {
    for (let i = 0; i < wert.length; i++) wert[i] = dateiUrlsUmschreiben(wert[i]);
  } else if (wert && typeof wert === 'object') {
    for (const k of Object.keys(wert)) wert[k] = dateiUrlsUmschreiben(wert[k]);
  }
  return wert;
}
