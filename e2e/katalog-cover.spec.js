// Katalogeintrag ohne Cover: Die Katalogseite zeigt dem Sammler das Bild seines eigenen Exemplars (nur ihm, mit Hinweis).
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Ohne Katalog-Cover: Bild des eigenen Exemplars mit Hinweis', async ({ page }) => {
  await anmelden(page, 'cover_e2e');
  const bild = 'https://example.com/boese-nachbarn.jpg';
  // Bild lokal ausliefern: Lädt es nicht (kein Netz in der CI), ersetzt die Oberfläche es durch einen Platzhalter
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  await page.route(bild, (route) => route.fulfill({ contentType: 'image/png', body: png }));
  const eintrag = await (await page.request.post('/api/katalog', { data: { typ: 'spiel', titel: 'Coverlos (E2E)', plattformen: ['Nintendo GameCube'] } })).json();
  await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Coverlos (E2E)', katalog_id: eintrag.id, plattform: 'Nintendo GameCube', cover_url: bild } });
  await page.goto(`/?app=1#/katalog/${eintrag.id}`);
  await expect(page.getByTestId('cover-eigenes-exemplar')).toBeVisible();
  await expect(page.locator(`img[src="${bild}"]`).first()).toHaveCount(1);
});
