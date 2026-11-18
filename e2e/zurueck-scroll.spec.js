// „Zurück“ in die Sammlung landet wieder an der gemerkten Stelle – auch wenn die Liste erst verzögert neu geladen wird.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

// Ohne Service-Worker, damit die verzögerte Antwort der Sammlung (page.route) greift
test.use({ serviceWorkers: 'block' });

test('Zurück in die Sammlung stellt die Scrollposition wieder her, auch bei langsamer Liste', async ({ page }) => {
  await anmelden(page, 'zurueck_scroll_e2e');
  for (let i = 1; i <= 40; i++) {
    await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: `Scroll ${String(i).padStart(2, '0')} (E2E)`, plattform: 'Nintendo 64' } });
  }
  await page.goto('/?app=1#/sammlung');
  await expect(page.getByText('Scroll 40 (E2E)').first()).toBeVisible();
  const ziel = await page.evaluate(() => Math.round((document.documentElement.scrollHeight - window.innerHeight) * 0.7));
  expect(ziel).toBeGreaterThan(400);
  await page.evaluate((y) => window.scrollTo(0, y), ziel);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(ziel - 5);

  // Zum Eintrag und zurück – die Sammlung kommt diesmal erst nach 800 ms
  const eintrag = page.locator('main a[href^="#/artikel/"]').first();
  await page.evaluate((href) => { window.location.hash = href; }, await eintrag.getAttribute('href'));
  await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/^#\/artikel\//);
  await expect(page.locator('main a[href^="#/artikel/"]')).toHaveCount(0); // Artikelseite steht, Sammlung ist weg
  await page.route(/\/api\/artikel(\?|$)/, async (route) => {
    if (route.request().method() === 'GET') await new Promise((fertig) => setTimeout(fertig, 800));
    await route.continue();
  });
  await page.evaluate(() => window.history.back());
  await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/^#\/sammlung/);
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeGreaterThan(ziel - 20);
});
