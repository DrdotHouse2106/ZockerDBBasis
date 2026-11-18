// Steam-Import: ohne wirksamen Schlüssel sieht nur der Admin einen Hinweis statt des Abschnitts, Sammler sehen nichts.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Import ohne Steam-Schlüssel: Hinweis nur für Admins', async ({ page }) => {
  await anmelden(page, 'admin');
  await page.goto('/?app=1#/import?quelle=steam');
  await expect(page.getByTestId('steam-import-aus')).toContainText('kein Steam-API-Schlüssel wirksam');
  await expect(page.getByTestId('steam-import')).toHaveCount(0);
  await page.goto('/?app=1#/einstellungen');
  await expect(page.getByRole('link', { name: 'CSV importieren (CLZ, Excel)' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Steam-Bibliothek importieren' })).toHaveCount(0);
});

test('Import: Umzugsanleitung für CLZ Games aufklappbar', async ({ page }) => {
  await anmelden(page, 'admin');
  await page.goto('/?app=1#/import');
  const anleitung = page.getByTestId('umzug-clz');
  await anleitung.getByText('Umzug von CLZ Games – Schritt für Schritt').click();
  await expect(anleitung).toContainText('Export to CSV / TXT');
  await expect(anleitung).toContainText('Collection Status');
});
