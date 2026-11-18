// CSV-Import rückgängig machen: „Letzte Importe“ auf der Importseite, nur unveränderte oder alle Exemplare entfernen.
import { test, expect } from '@playwright/test';
import { anmelden, fehlerSammeln } from './hilfen.js';

test('Import rückgängig machen', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'import_rueckgaengig');
  await page.goto('/?app=1#/import');
  const csv = 'Titel;Plattform\nRückweg Eins (E2E);PC\nRückweg Zwei (E2E);PC\n';
  await page.locator('input[type=file]').first().setInputFiles({ name: 'alte-app.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
  await page.getByRole('button', { name: /Importieren|importieren/ }).first().click();
  await expect(page.getByText('Import abgeschlossen')).toBeVisible();

  const eintrag = page.getByTestId('letzte-importe').getByTestId('import-eintrag').first();
  await expect(eintrag).toContainText('alte-app.csv');
  await expect(eintrag).toContainText('2 importiert');
  await eintrag.getByRole('button', { name: 'Rückgängig machen' }).click();
  await eintrag.getByRole('alertdialog').getByRole('button', { name: 'Alle 2 entfernen' }).click();
  await expect(page.getByText('2 Exemplare entfernt.')).toBeVisible();
  await expect(eintrag).toContainText('rückgängig gemacht');
  const sammlung = await (await page.request.get('/api/artikel?q=R%C3%BCckweg')).json();
  expect((sammlung.artikel ?? sammlung).filter?.((a) => /Rückweg/.test(a.titel)).length ?? 0).toBe(0);
  expect(fehler).toEqual([]);
});
