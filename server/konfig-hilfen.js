// Hilfsfunktionen zum Lesen der Konfiguration aus Umgebungsvariablen – auch für Zusatzmodule.
import path from 'node:path';
import { PROJEKT_WURZEL } from './pfade.js';

export function zahl(wert, standard) {
  const n = Number.parseInt(wert ?? '', 10);
  return Number.isFinite(n) ? n : standard;
}

export function jaNein(wert, standard) {
  if (wert === undefined || wert === '') return standard;
  return ['1', 'true', 'ja', 'yes', 'on'].includes(String(wert).trim().toLowerCase());
}

export function pfad(wert, standard) {
  const p = wert && wert.trim() ? wert.trim() : standard;
  return path.isAbsolute(p) ? p : path.join(PROJEKT_WURZEL, p);
}

/** Preis in Euro aus „19,90“ oder „19.90“ (ungültig = null). */
export function preis(wert) {
  const n = Number(String(wert ?? '').trim().replace(/\s*€$/, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Pakete aus „500=9,90;1000=14,90“ (Menge=Preis) → [{ angebote, preis }], aufsteigend. */
export function lesePakete(wert) {
  return String(wert ?? '').split(/[;|]/).map((teil) => {
    const [anzahl, betrag] = teil.split('=');
    const angebote = Number.parseInt(String(anzahl ?? '').replace(/\D/g, ''), 10);
    return { angebote, preis: preis(betrag) };
  }).filter((p) => Number.isInteger(p.angebote) && p.angebote > 0 && p.preis !== null)
    .sort((a, b) => a.angebote - b.angebote);
}

/** Basis-URL der Seite (für Canonical-Links und Sitemap), ohne abschließenden Schrägstrich. */
export function basisUrl(wert) {
  const roh = String(wert ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+/i.test(roh) ? roh : '';
}
