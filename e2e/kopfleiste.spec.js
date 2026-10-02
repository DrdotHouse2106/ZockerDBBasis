// Kopfleiste am Desktop: Logo, Symbole und Hauptnavigation dürfen sich in keiner Fensterbreite überlappen.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

for (const breite of [800, 1024, 1180, 1280, 1440]) {
  test(`Kopfleiste ohne Überlappung bei ${breite} px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: breite, height: 700 }, isMobile: false, hasTouch: false, locale: 'de-DE' });
    const page = await ctx.newPage();
    await anmelden(page, 'kopfleiste_e2e');
    await page.goto('/?app=1#/einstellungen');
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).first();
    await expect(nav).toBeVisible();
    const masse = await page.evaluate(() => {
      const zeile = document.querySelector('header > div');
      const kinder = [...zeile.children].filter((k) => k.getBoundingClientRect().width > 0);
      // Inhalt, der aus einem zusammengedrückten Element herausragt (z. B. der Schriftzug), zählt mit
      const rechts = (k) => Math.max(k.getBoundingClientRect().right, ...[...k.querySelectorAll('*')].map((e) => e.getBoundingClientRect().right));
      return { kinder: kinder.map((k) => [k.getBoundingClientRect().left, rechts(k)]), fenster: window.innerWidth };
    });
    for (let i = 1; i < masse.kinder.length; i++) {
      expect(masse.kinder[i][0], `Element ${i} überlappt seinen Vorgänger`).toBeGreaterThanOrEqual(masse.kinder[i - 1][1] - 0.5);
    }
    expect(masse.kinder.at(-1)[1]).toBeLessThanOrEqual(masse.fenster);
    await ctx.close();
  });
}
