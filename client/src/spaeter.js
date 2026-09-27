import { lazy } from 'react';

/**
 * Lädt eine Seite bei Bedarf (Code-Splitting). Schlägt das Laden fehl, weil nach einem Update die alten
 * Dateien nicht mehr existieren, wird die App einmalig neu geladen.
 */
export function spaeter(laden, exportName = 'default') {
  return lazy(() => laden().then((m) => {
    try { sessionStorage.removeItem('zockdb-neu-geladen'); } catch { /* egal */ }
    return { default: m[exportName] };
  }).catch((fehler) => {
    let schonVersucht = false;
    try { schonVersucht = sessionStorage.getItem('zockdb-neu-geladen') === '1'; sessionStorage.setItem('zockdb-neu-geladen', '1'); } catch { /* egal */ }
    if (navigator.onLine && !schonVersucht) window.location.reload();
    throw fehler;
  }));
}
