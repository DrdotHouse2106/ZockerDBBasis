// Formular: Felder im Konto ausblenden; Zustand von Disc und Hülle getrennt.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Seriennummer ausblenden, Zustand Disc und Hülle getrennt', async ({ page }) => {
  await anmelden(page, 'felder_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Black Flag', plattform: 'PlayStation 4' } })).json();

  await page.goto('/?app=1#/konto');
  await page.getByText('Felder beim Eintragen ausblenden').click();
  await page.getByRole('checkbox', { name: 'Seriennummer', exact: true }).uncheck();
  await expect(page.getByText('Gespeichert.')).toBeVisible();

  await page.goto(`/?app=1#/artikel/${a.id}/bearbeiten`);
  await expect(page.getByLabel('Seriennummer', { exact: true })).toHaveCount(0);
  await page.getByLabel('Zustand Disc / Modul').selectOption('sehr_gut');
  await page.getByLabel('Zustand Hülle / OVP').selectOption('akzeptabel');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Zustand Hülle / OVP')).toBeVisible();
  await expect(page.getByText('Akzeptabel')).toBeVisible();
});
