// Fotos antippen: Ansicht über der Seite statt der nackten Bilddatei (aus der man in der installierten App nicht zurückkäme).
import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { anmelden } from './hilfen.js';

test('Foto öffnet die Bildansicht; ✕ und Zurück-Geste schließen sie, die Seite bleibt', async ({ page }) => {
  await anmelden(page, 'bildansicht_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Bildansicht (E2E)', plattform: 'PlayStation 4' } })).json();
  for (const [art, farbe] of [['foto_vorne', '#aa3333'], ['foto_hinten', '#3333aa']]) {
    const bild = await sharp({ create: { width: 600, height: 800, channels: 3, background: farbe } }).jpeg().toBuffer();
    const r = await page.request.post(`/api/artikel/${a.id}/medien`, { multipart: { art, datei: { name: `${art}.jpg`, mimeType: 'image/jpeg', buffer: bild } } });
    expect(r.ok()).toBeTruthy();
  }
  await page.goto('/?app=1#/lagerorte');
  await page.evaluate((id) => { window.location.hash = `#/artikel/${id}`; }, a.id);
  const vorschau = page.locator('[data-tour="fotos"] ul a img').first();
  await expect(vorschau).toBeVisible();
  const adresse = page.url();

  await vorschau.click();
  const ansicht = page.getByRole('dialog', { name: 'Bildansicht' });
  await expect(ansicht).toBeVisible();
  await expect(ansicht).toContainText('1 / 2');
  expect(page.url()).toBe(adresse);
  await ansicht.getByRole('button', { name: 'Nächstes Bild' }).click();
  await expect(ansicht).toContainText('2 / 2');
  await ansicht.getByRole('button', { name: 'Schließen' }).click();
  await expect(ansicht).toHaveCount(0);
  expect(page.url()).toBe(adresse);

  // Zurück-Geste (Browser-Zurück) schließt nur die Ansicht – die Artikelseite bleibt
  await vorschau.click();
  await expect(ansicht).toBeVisible();
  await page.goBack();
  await expect(ansicht).toHaveCount(0);
  expect(page.url()).toBe(adresse);
  await expect(page.getByText('Bildansicht (E2E)').first()).toBeVisible();
  // … und der Zurück-Pfeil führt danach wie gewohnt zur vorherigen Seite
  await page.getByRole('button', { name: 'Zurück' }).first().click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/lagerorte');
});
