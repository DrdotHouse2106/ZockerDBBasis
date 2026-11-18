// Basis-Version (ohne Zusatzmodul): „/“ bleibt die Sammlung, „Scannen“ bleibt ein eigener Tab, es gibt kein Entdecken.
// Läuft nur mit ZOCKERDB_MODULE=aus (npm run test:e2e:basis); mit einem Zusatzmodul prüft dessen eigener Browser-Test die Startseite.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

const nurBasis = ['aus', 'false', '0', 'nein'].includes(String(process.env.ZOCKERDB_MODULE ?? '').toLowerCase());
test.skip(!nurBasis, 'Nur in der Basis-Version ohne Zusatzmodul');

test('Basis: „/“ ist die Sammlung, Tab „Scannen“ bleibt, kein Entdecken', async ({ page }) => {
  await anmelden(page, 'basis_start_e2e');
  await page.goto('/?app=1#/');
  const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await expect(navigation.getByRole('link')).toHaveText(['Sammlung', 'Statistik', 'Hinzufügen', 'Scannen', 'Mehr']);
  await expect(navigation.getByRole('link', { name: 'Sammlung' })).toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => window.location.hash)).toBe('#/');
  await expect(page.getByRole('heading', { name: 'Entdecken' })).toHaveCount(0);
  // /sammlung zeigt dieselbe Seite
  await page.goto('/?app=1#/sammlung');
  await expect(navigation.getByRole('link', { name: 'Sammlung' })).toHaveAttribute('aria-current', 'page');
  // Scannen: eigener Tab, auf „Hinzufügen“ kein großer Knopf
  await expect(navigation.getByRole('link', { name: 'Scannen' })).toHaveAttribute('href', '#/neu?scan=1');
  await page.goto('/?app=1#/neu');
  await expect(page.getByRole('button', { name: 'Barcode scannen' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Barcode scannen' })).not.toContainText('Barcode scannen');
});
