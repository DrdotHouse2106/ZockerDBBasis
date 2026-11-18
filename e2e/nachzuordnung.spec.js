// Sammlung → Filter „Nur ohne Katalogeintrag“: „Automatisch zuordnen“ startet die Zuordnung im Hintergrund und zeigt das Ergebnis.
import { test, expect } from '@playwright/test';
import { fehlerSammeln, keinQuerScrollen, anmelden } from './hilfen.js';

test('Automatisch zuordnen für Exemplare ohne Katalogeintrag', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, `zuordnung_${Date.now() % 100000}`);
  const text = 'Platform;Title\nGame Boy;Ein Spiel ohne Katalogtreffer XY\n';
  const analyse = await (await page.request.post('/api/import/csv/analyse', { data: { text } })).json();
  await page.request.post('/api/import/csv', { data: { text, zuordnung: analyse.zuordnung, standardTyp: 'spiel' } });
  await page.goto('/?app=1#/sammlung?ohne_katalog=1');
  const box = page.getByTestId('nachzuordnung');
  await expect(box).toBeVisible();
  await box.getByTestId('nachzuordnung-starten').click();
  await expect(box.getByRole('status')).toContainText(/0 von 1 zugeordnet/, { timeout: 15000 });
  await keinQuerScrollen(page);
  expect(fehler).toEqual([]);
});
