// Eigenes Foto am Exemplar: vor dem Speichern zuschneiden (z. B. nur das deutsche Cover aus einem Foto der Hülle).
import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { anmelden } from './hilfen.js';

test('Eigenes Foto: freier Zuschnitt vor dem Speichern, Abbrechen lädt nichts hoch', async ({ page }) => {
  await anmelden(page, 'eigenes_foto_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'FIFA 12 (E2E)' } })).json();
  const foto = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#2a6f3a' } }).jpeg().toBuffer();
  await page.goto(`/?app=1#/artikel/${a.id}`);

  // Abbrechen: nichts wird gespeichert
  await page.getByRole('button', { name: /Weitere Aktionen/ }).click();
  await page.locator('input[type="file"][accept^="image/jpeg"]').first().setInputFiles({ name: 'huelle.jpg', mimeType: 'image/jpeg', buffer: foto });
  const dialog = page.getByTestId('zuschnitt-dialog');
  await expect(dialog.getByRole('button', { name: 'Original', pressed: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog).toHaveCount(0);
  expect((await (await page.request.get(`/api/artikel/${a.id}`)).json()).bild_datei).toBeFalsy();

  // Frei: schmaler Ausschnitt (Breite 50 %, Höhe 90 %) → hochformatiges Bild (das Menü ist noch offen)
  await page.locator('input[type="file"][accept^="image/jpeg"]').first().setInputFiles({ name: 'huelle.jpg', mimeType: 'image/jpeg', buffer: foto });
  await dialog.getByRole('button', { name: 'Frei' }).click();
  await dialog.getByRole('slider').first().fill('0.5');
  await dialog.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(page.getByText('Foto gespeichert.')).toBeVisible();
  const artikel = await (await page.request.get(`/api/artikel/${a.id}`)).json();
  const bild = await sharp(await (await page.request.get(artikel.bild_url)).body()).metadata();
  expect(bild.width).toBeLessThan(bild.height * 1.1);
});
