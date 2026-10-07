// Minimaler Hash-Router: #/pfad?parameter=wert
import { useCallback, useEffect, useRef, useState } from 'react';

function lesen() {
  const roh = window.location.hash.replace(/^#/, '') || '/';
  const [pfad, suche = ''] = roh.split('?');
  return { pfad: pfad || '/', parameter: Object.fromEntries(new URLSearchParams(suche)) };
}

export function useRoute() {
  const [route, setRoute] = useState(lesen);
  useEffect(() => {
    let bisher = lesen().pfad;
    const aktualisieren = () => {
      const neu = lesen();
      // Nur andere Parameter auf derselben Seite (z. B. der Suchbegriff im Katalog, der beim Tippen in die Adresse
      // geschrieben wird): Fokus und Scrollposition bleiben, sonst wäre das Suchfeld nach jedem Buchstaben verlassen.
      const seitenwechsel = neu.pfad !== bisher;
      bisher = neu.pfad;
      // iOS (installierte App): Verschwindet ein Eingabefeld mit offener Tastatur, bleibt die Ansicht verkleinert –
      // feste Leisten landen dann mitten im Bild. Beim Seitenwechsel vorher das Feld verlassen, damit die Tastatur sauber zugeht.
      const fokus = document.activeElement;
      const eingabe = fokus && fokus !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(fokus.tagName);
      if (seitenwechsel && eingabe) fokus.blur();
      setRoute(neu);
      // Nach oben – außer man tippt gerade auf derselben Seite (Blättern, Filter usw. springen weiter nach oben)
      if (seitenwechsel || !eingabe) window.scrollTo(0, 0);
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
// Schutz vor versehentlichem Verlassen (ungespeicherte Eingaben): { hash, frage } der geschützten Seite
let schutz = null;
let zuruecksetzen = false;
if (typeof window !== 'undefined') {
  // Wird vor dem Listener von useRoute registriert – so lässt sich ein Seitenwechsel abfangen, bevor er angezeigt wird
  window.addEventListener('hashchange', (ereignis) => {
    const h = hashJetzt();
    if (zuruecksetzen) { zuruecksetzen = false; return; }
    if (schutz && pfadVon(h) !== pfadVon(schutz.hash) && !window.confirm(schutz.frage)) {
      // Abgebrochen (Zurück-Knopf, Wischgeste, Link): auf der Seite bleiben, Eingaben behalten
      ereignis.stopImmediatePropagation();
      zuruecksetzen = true;
      window.location.replace(`#${schutz.hash}`);
      return;
    }
    if (schutz && pfadVon(h) !== pfadVon(schutz.hash)) schutz = null;
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

/**
 * Rückfrage beim Verlassen einer Seite mit ungespeicherten Eingaben – bei Zurück-Knopf, Wischgeste, Links, Neuladen
 * und Schließen des Tabs. Liefert `freigeben()`: vor dem gewollten Weiterleiten nach dem Speichern aufrufen.
 */
export function useVerlassenSchutz(aktiv, frage = 'Du hast ungespeicherte Eingaben. Seite wirklich verlassen? Die Eingaben gehen dann verloren.') {
  const frei = useRef(false);
  useEffect(() => {
    if (!aktiv || frei.current) return undefined;
    const eintrag = { hash: hashJetzt(), frage };
    schutz = eintrag;
    const vorEntladen = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', vorEntladen);
    return () => {
      if (schutz === eintrag) schutz = null;
      window.removeEventListener('beforeunload', vorEntladen);
    };
  }, [aktiv, frage]);
  return useCallback(() => { frei.current = true; schutz = null; }, []);
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
