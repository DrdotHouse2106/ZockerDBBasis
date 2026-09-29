// Beim Anlegen aus dem Katalog stehen nur die Plattformen des Titels zur Wahl; die Plattform aus dem Barcode ist vorausgewählt.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Plattformwahl: nur Plattformen des Titels, Vorauswahl aus dem Barcode', async ({ page }) => {
  await anmelden(page, 'plattform_e2e');
  const e = await (await page.request.post('/api/katalog', { data: { typ: 'spiel', titel: 'Assassin\'s Creed IV Black Flag', plattformen: ['PlayStation 3', 'Xbox 360'] } })).json();
  const ps3 = (await (await page.request.get('/api/plattformen')).json()).find((p) => p.name === 'PlayStation 3');

  await page.goto(`/?app=1#/neu/formular?katalog=${e.id}&typ=spiel`);
  const auswahl = page.getByLabel('Plattform / System');
  await expect(auswahl).toBeVisible();
  const optionen = await auswahl.locator('option').allTextContents();
  expect(optionen).toEqual(['– Plattform wählen –', 'PlayStation 3 (PS3)', 'Xbox 360 (X360)', 'Andere Plattform …']);
  // „Andere Plattform …“ öffnet die komplette Liste
  await auswahl.selectOption('__andere');
  expect(await auswahl.locator('option').count()).toBeGreaterThan(20);

  // Mit Plattform aus dem Barcode: vorausgewählt
  await page.goto(`/?app=1#/neu/formular?katalog=${e.id}&typ=spiel&plattform_id=${ps3.id}`);
  await expect(page.getByLabel('Plattform / System')).toHaveValue(String(ps3.id));
});
