// Spieleseite mit mehreren Plattformen: Leiste unter dem Titel, Auswahl in der Adresse, Daten je Plattform.
import { test, expect } from '@playwright/test';
import { anmelden, fehlerSammeln, keinQuerScrollen } from './hilfen.js';

test('Plattform-Leiste: Standard, wechseln, Adresse, eigene Exemplare je Plattform', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'plattform_e2e');
  const antwort = await page.request.post('/api/katalog', { data: { typ: 'spiel', titel: 'Mehrplattformspiel (E2E)', plattformen: ['PC', 'PlayStation 4', 'Xbox One'] } });
  expect(antwort.ok()).toBeTruthy();
  const k = await antwort.json();
  for (const [plattform, edition] of [['PC', 'PC-Fassung'], ['PlayStation 4', 'PS4-Fassung']]) {
    const a = await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Mehrplattformspiel (E2E)', katalog_id: k.id, plattform, edition } });
    expect(a.ok()).toBeTruthy();
  }
  const plattformen = await (await page.request.get('/api/plattformen')).json();
  const ps4 = (plattformen.plattformen ?? plattformen).find((p) => p.name === 'PlayStation 4');

  await page.goto(`/?app=1#/katalog/${k.id}`);
  const leiste = page.getByTestId('plattform-leiste');
  await expect(leiste.getByRole('button')).toHaveText(['PC', 'PS4', 'XOne'].map((t) => new RegExp(t)));
  // Standard: Plattform des (ersten) eigenen Exemplars
  await expect(leiste.getByRole('button', { name: 'PC' })).toHaveAttribute('aria-pressed', 'true');
  const sammlung = page.getByRole('heading', { name: /In deiner Sammlung/ }).locator('..');
  await expect(sammlung).toContainText('PC-Fassung');
  await expect(sammlung).not.toContainText('PS4-Fassung');
  await keinQuerScrollen(page);

  await leiste.getByRole('button', { name: 'PS4' }).click();
  await expect(page).toHaveURL(new RegExp(`#/katalog/${k.id}\\?plattform=${ps4.id}$`));
  await expect(leiste.getByRole('button', { name: 'PS4' })).toHaveAttribute('aria-pressed', 'true');
  await expect(sammlung).toContainText('PS4-Fassung');
  await expect(sammlung).not.toContainText('PC-Fassung');

  await leiste.getByRole('button', { name: 'XOne' }).click();
  await expect(leiste.getByRole('button', { name: 'XOne' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: /In deiner Sammlung/ })).toHaveCount(0);

  // Direkt aufgerufene Adresse mit Plattform
  await page.goto(`/?app=1#/katalog/${k.id}?plattform=${ps4.id}`);
  await expect(page.getByTestId('plattform-leiste').getByRole('button', { name: 'PS4' })).toHaveAttribute('aria-pressed', 'true');
  expect(fehler).toEqual([]);
});
