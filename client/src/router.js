// Minimaler Hash-Router: #/pfad?parameter=wert
import { useEffect, useState } from 'react';

function lesen() {
  const roh = window.location.hash.replace(/^#/, '') || '/';
  const [pfad, suche = ''] = roh.split('?');
  return { pfad: pfad || '/', parameter: Object.fromEntries(new URLSearchParams(suche)) };
}

export function useRoute() {
  const [route, setRoute] = useState(lesen);
  useEffect(() => {
    const aktualisieren = () => {
      // iOS (installierte App): Verschwindet ein Eingabefeld mit offener Tastatur, bleibt die Ansicht verkleinert –
      // feste Leisten landen dann mitten im Bild. Vorher das Feld verlassen, damit die Tastatur sauber zugeht.
      const fokus = document.activeElement;
      if (fokus && fokus !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(fokus.tagName)) fokus.blur();
      setRoute(lesen());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', aktualisieren);
    return () => window.removeEventListener('hashchange', aktualisieren);
  }, []);
  return route;
}

// Verlauf innerhalb der App (nur dieser Tab): damit „Zurück“ zur vorherigen Seite führt statt an eine feste Stelle
const hashJetzt = () => window.location.hash.replace(/^#/, '') || '/';
const pfadVon = (hash) => hash.split('?')[0] || '/';
const verlauf = typeof window !== 'undefined' ? [hashJetzt()] : [];
let ersetzen = false;
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const h = hashJetzt();
    if (ersetzen) verlauf[verlauf.length - 1] = h;
    else if (verlauf.length > 1 && verlauf[verlauf.length - 2] === h) verlauf.pop(); // Zurück (Knopf, Wischgeste)
    else verlauf.push(h);
    ersetzen = false;
  });
}

export function navigiere(pfad, parameter, { ersetzen: ersetzeEintrag = false } = {}) {
  const suche = parameter ? new URLSearchParams(
    Object.fromEntries(Object.entries(parameter).filter(([, w]) => w !== undefined && w !== null && w !== '')),
  ).toString() : '';
  const ziel = `#${suche ? `${pfad}?${suche}` : pfad}`;
  if (ersetzeEintrag) {
    ersetzen = true;
    window.location.replace(ziel);
  } else window.location.hash = ziel;
}

/**
 * Zurück zur vorherigen Seite der App – Einträge derselben Seite (z. B. nur andere Parameter wie ?foto=…) werden übersprungen.
 * Ohne passende Vorgeschichte (Link direkt geöffnet) oder wenn das Ziel dieselbe Seite ist (z. B. Katalog-Liste → Übersicht)
 * geht es zu `ersatz`.
 */
export function zurueck(ersatz = '/') {
  const aktuell = pfadVon(verlauf[verlauf.length - 1] ?? hashJetzt());
  let schritte = 1;
  while (schritte < verlauf.length && pfadVon(verlauf[verlauf.length - 1 - schritte]) === aktuell) schritte++;
  if (pfadVon(ersatz) === aktuell || schritte >= verlauf.length) return navigiere(ersatz);
  window.history.go(-schritte);
}

/** Pfad der Seite vor der aktuellen (ohne Einträge derselben Seite) oder null. */
export function vorherigeSeite() {
  const aktuell = pfadVon(verlauf[verlauf.length - 1] ?? hashJetzt());
  for (let i = verlauf.length - 2; i >= 0; i--) if (pfadVon(verlauf[i]) !== aktuell) return pfadVon(verlauf[i]);
  return null;
}

/** Vergleicht einen Pfad mit einem Muster wie "/artikel/:id" und liefert die Platzhalter. */
export function passt(muster, pfad) {
  const a = muster.split('/');
  const b = pfad.split('/');
  if (a.length !== b.length) return null;
  const werte = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) werte[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return werte;
}
