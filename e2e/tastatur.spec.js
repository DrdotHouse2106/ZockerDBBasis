// iOS: hängengebliebene Tastatur-Ansicht (verkleinerte visualViewport ohne aktives Eingabefeld) wird erkannt und repariert.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Hängende Tastatur-Ansicht: unsichtbares Feld wird kurz fokussiert und wieder entfernt', async ({ page }) => {
  await page.addInitScript(() => {
    // visualViewport wie im Fehlerfall auf dem iPhone: 345 px kleiner als das Fenster, kein Feld aktiv
    const vv = { get height() { return window.innerHeight - 345; }, offsetTop: 330, scale: 1, addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
    window.__repariert = 0;
    document.addEventListener('focusin', (e) => { if (e.target.getAttribute?.('inputmode') === 'none') window.__repariert += 1; });
  });
  await anmelden(page, 'tastatur_e2e');
  await page.goto('/?app=1#/statistik');
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).first()).toBeVisible();
  await page.evaluate(() => document.activeElement?.blur());
  await expect.poll(() => page.evaluate(() => `${window.__repariert} ${document.activeElement?.tagName}`), { timeout: 5000 }).toMatch(/^[1-9]/);
  // Das Hilfsfeld verschwindet wieder
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('input[inputmode="none"]').length)).toBe(0);
});

test('Mit aktivem Eingabefeld (Tastatur wirklich offen) greift die Reparatur nicht ein', async ({ page }) => {
  await page.addInitScript(() => {
    const vv = { get height() { return window.innerHeight - 345; }, offsetTop: 0, scale: 1, addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
    window.__repariert = 0;
    document.addEventListener('focusin', (e) => { if (e.target.getAttribute?.('inputmode') === 'none') window.__repariert += 1; });
  });
  await page.goto('/?app=1');
  const feld = page.locator('input').first();
  await feld.focus();
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__repariert)).toBe(0);
  await expect(feld).toBeFocused();
});
