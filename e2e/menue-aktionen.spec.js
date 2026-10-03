// „Weitere Aktionen“ auf der Detailseite: das Menü bleibt auf dem Handy vollständig im Bild.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

// Schmales Handy: „Weitere Aktionen“ rutscht in die zweite Zeile und steht dann links
test.use({ viewport: { width: 340, height: 740 } });

test('Menü „Weitere Aktionen“ ragt nicht aus dem Bildschirm', async ({ page }) => {
  await anmelden(page, 'menue_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Assassin\'s Creed IV Black Flag', plattform: 'PlayStation 4' } })).json();
  await page.goto(`/?app=1#/artikel/${a.id}`);
  await page.getByRole('button', { name: /Weitere Aktionen/ }).click();
  const menue = page.getByRole('menu');
  await expect(menue).toBeVisible();
  const box = await menue.boundingBox();
  const breite = page.viewportSize().width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(breite);
});
