// Merch (vierter Artikeltyp): Funko Pop ohne Plattform anlegen, Angaben auf der Detailseite, Filter in der Sammlung.
import { test, expect } from '@playwright/test';
import { anmelden, fehlerSammeln } from './hilfen.js';

test('Funko Pop anlegen', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'merch_e2e');

  await page.goto('/?app=1#/neu');
  await expect(page.getByRole('radio', { name: /Merch/ })).toBeVisible();

  await page.goto('/?app=1#/neu/formular?typ=merch');
  await page.getByLabel('Titel').first().fill('Funko Pop Link (E2E)');
  await page.getByLabel('Kategorie').selectOption('figur');
  await expect(page.getByLabel('Plattform')).toHaveCount(0); // Merch braucht keine Plattform
  await expect(page.getByLabel(/Zustand Disc/)).toHaveCount(0);
  // Zustand: Figur und – bei geöffneter Verpackung – die Verpackung getrennt, mit Bewertungshilfe für Figuren
  await expect(page.getByLabel('Zustand Figur / Artikel')).toBeVisible();
  await page.getByLabel('Verpackung', { exact: true }).selectOption('geoeffnet');
  await expect(page.getByLabel('Zustand Verpackung (Box, Blister)')).toBeVisible();
  await page.getByRole('button', { name: /Wie bewerte ich den Zustand/ }).click();
  await expect(page.getByText(/Minimaler Farbabrieb an Kanten/)).toBeVisible();
  await page.getByLabel('Verpackung', { exact: true }).selectOption('ungeoeffnet');
  await expect(page.getByLabel('Zustand Verpackung (Box, Blister)')).toHaveCount(0);
  await page.getByLabel(/^Nummer/).fill('#335');
  await page.getByLabel(/^Edition/).fill('Exclusive');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();

  await expect(page).toHaveURL(/#\/artikel\/\d+/);
  await expect(page.getByRole('heading', { name: 'Funko Pop Link (E2E)' }).first()).toBeVisible();
  await expect(page.getByText('Figuren & Statuen').first()).toBeVisible();
  await expect(page.getByText('OVP ungeöffnet').first()).toBeVisible();
  await expect(page.getByText('#335')).toBeVisible();

  // Sammlung: Filter „Merch“ mit Kategorie-Chips
  await page.goto('/?app=1#/sammlung?typ=merch');
  await expect(page.getByRole('heading', { name: 'Funko Pop Link (E2E)' })).toBeVisible();
  await page.getByRole('button', { name: 'Figuren & Statuen' }).click();
  await expect(page.getByRole('heading', { name: 'Funko Pop Link (E2E)' })).toBeVisible();
  expect(fehler).toEqual([]);
});
