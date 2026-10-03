// Exemplar als privat markieren: Schalter im Formular, Schloss in Detailansicht und Sammlung.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Exemplar als privat markieren', async ({ page }) => {
  await anmelden(page, 'privat_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Geheimtipp', plattform: 'Nintendo 64' } })).json();
  await page.goto(`/?app=1#/artikel/${a.id}/bearbeiten`);
  await page.getByRole('checkbox', { name: /Privat – nur für mich sichtbar/ }).check();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Privat – nur für dich sichtbar')).toBeVisible();
  expect((await (await page.request.get(`/api/artikel/${a.id}`)).json()).privat).toBe(1);
  await page.goto('/?app=1#/');
  await expect(page.getByRole('img', { name: 'Privat – nur für dich sichtbar' })).toBeVisible();
});
