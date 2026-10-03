// Preisgeschichte am Exemplar: Erstkauf laut Beleg und eigener Kauf als Zeitstrahl.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Preisgeschichte aus Kassenbon und eigenem Kauf', async ({ page }) => {
  await anmelden(page, 'preisgeschichte_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Black Flag', plattform: 'PlayStation 4' } })).json();
  await page.goto(`/?app=1#/artikel/${a.id}/bearbeiten`);
  await page.getByLabel('Kaufpreis (€, je Stück)').fill('10');
  await page.getByLabel('Kaufdatum').fill('14.06.2026');
  await page.getByLabel('Gekauft bei/auf').selectOption('flohmarkt');
  await page.getByText('Erstkauf laut Beleg').click();
  await page.getByLabel('Neupreis (€)').fill('59,99');
  await page.getByLabel('Datum', { exact: true }).fill('12.06.2026');
  await page.getByLabel('Händler').fill('Media Markt');
  await page.getByRole('button', { name: 'Speichern' }).click();

  const geschichte = page.locator('section', { has: page.getByRole('heading', { name: 'Preisgeschichte' }) });
  await expect(geschichte).toContainText('12.06.2026 · Neu gekauft bei Media Markt für 59,99 €');
  await expect(geschichte).toContainText('14.06.2026 · Von dir gekauft – Flohmarkt / Trödelmarkt für 10,00 €');
  await expect(geschichte).toContainText('-83 %');
});
