// Barcode erneut gescannt: Die Ausgabe des eigenen Exemplars mit demselben Barcode (Variante, Region) ist vorausgewählt –
// nicht „Erstauflage / Standard“.
import { test, expect } from '@playwright/test';
import { anmelden, fehlerSammeln } from './hilfen.js';

test('Gleicher Barcode: Variante und Region vom vorhandenen Exemplar vorausgewählt', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'admin');
  const eintrag = await (await page.request.post('/api/katalog', {
    data: { typ: 'spiel', titel: 'Ausgabe-Spiel (E2E)', plattformen: ['PlayStation 3'], veroeffentlichen: true },
  })).json();
  const variante = await (await page.request.post(`/api/katalog/${eintrag.id}/varianten`, {
    data: { bezeichnung: 'Collector’s Edition', veroeffentlichen: true },
  })).json();
  const code = '4006381333955';
  const vorhanden = await page.request.post('/api/artikel', {
    data: { typ: 'spiel', titel: eintrag.titel, katalog_id: eintrag.id, variante_id: variante.id, region: 'pal_eu', barcode: code },
  });
  expect(vorhanden.ok(), await vorhanden.text()).toBeTruthy();

  await page.goto(`/?app=1#/neu?barcode=${code}`);
  await page.getByRole('button', { name: /Ausgabe-Spiel \(E2E\)/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Neuer Artikel' })).toBeVisible();
  await expect(page.getByLabel('Variante / Revision')).toHaveValue(String(variante.id));
  await expect(page.getByLabel('Region', { exact: true })).toHaveValue('pal_eu');
  await expect(page.getByLabel('Fassung')).toHaveCount(0); // mit Variante keine zusätzliche Fassungswahl
  expect(fehler).toEqual([]);
});
