// Gemeinsame Hilfen der Browser-Tests (Kern und Zusatzmodule).
import { expect } from '@playwright/test';

export const PASSWORT = 'e2e-sicheres-passwort';

/** Sammelt JavaScript-Fehler der Seite; am Ende jedes Tests darf keiner aufgetreten sein. */
export function fehlerSammeln(page) {
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fehler.push(m.text()); });
  return fehler;
}

/** Nichts darf seitlich über den Bildschirm hinausragen. */
export async function keinQuerScrollen(page) {
  const breiten = await page.evaluate(() => ({ inhalt: document.documentElement.scrollWidth, fenster: window.innerWidth }));
  expect(breiten.inhalt, 'Seite scrollt horizontal').toBeLessThanOrEqual(breiten.fenster + 1);
}

/** Meldet an – gibt es das Konto noch nicht (z. B. bei einzeln gestarteten Tests), wird es angelegt. */
export async function anmelden(page, benutzername) {
  let antwort = await page.request.post('/api/auth/anmelden', { data: { benutzername, passwort: PASSWORT } });
  if (!antwort.ok()) {
    antwort = await page.request.post('/api/auth/registrieren', { data: { benutzername, passwort: PASSWORT, bedingungen_akzeptiert: true } });
  }
  expect(antwort.ok()).toBeTruthy();
}
