// Detailseite eines Exemplars: aufgeräumt – Spielstatus als Auswahl, seltene Aktionen im Menü, Kommentare/Links/Scans eingeklappt.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Detailseite: Spielstatus, Aktionsmenü, eingeklappte Zusatzbereiche', async ({ page }) => {
  await anmelden(page, 'detail_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Ordnungsspiel' } })).json();
  await page.goto(`/?app=1#/artikel/${a.id}`);

  await page.getByLabel('Spielstatus').selectOption('angefangen');
  await expect.poll(async () => (await (await page.request.get(`/api/artikel/${a.id}`)).json()).spielstatus).toBe('angefangen');

  // Seltene Aktionen erst im Menü
  await expect(page.getByRole('button', { name: 'Verleihen …' })).toHaveCount(0);
  await page.getByRole('button', { name: /Weitere Aktionen/ }).click();
  await expect(page.getByRole('button', { name: 'Verleihen …' })).toBeVisible();
  await page.getByRole('button', { name: 'Verleihen …' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Kommentare & Scans eingeklappt, auf Wunsch sichtbar
  await page.reload();
  await expect(page.getByText('Meine Kommentare')).toBeHidden();
  await page.getByText('Kommentare, Cover & Handbücher, Scans').click();
  await expect(page.getByText('Meine Kommentare')).toBeVisible();
});
