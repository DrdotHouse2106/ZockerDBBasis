// Katalogeintrag am Exemplar wählen, Filter „Nur ohne Katalogeintrag“ und Link nach dem CSV-Import.
import { test, expect } from '@playwright/test';
import { anmelden, fehlerSammeln, keinQuerScrollen } from './hilfen.js';

test('Ohne Katalogeintrag: Link nach dem CSV-Import, Filter, anderen Eintrag wählen', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'admin');
  const eintrag = await (await page.request.post('/api/katalog', {
    data: { typ: 'spiel', titel: 'Zuordnung Richtig (E2E)', plattformen: ['Super Nintendo'], veroeffentlichen: true },
  })).json();

  // CSV-Import: ein Spiel findet keinen Katalogtreffer
  await page.goto('/?app=1#/import');
  const csv = 'Titel;Plattform\nZuordnung Falsch Ohne Treffer (E2E);Super Nintendo\n';
  await page.locator('input[type=file]').first().setInputFiles({ name: 'sammlung.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
  await page.getByRole('button', { name: /Importieren|importieren/ }).first().click();
  const link = page.getByTestId('ohne-katalog-link');
  await expect(link).toHaveText(/1 Spiel ohne Katalogtreffer zuordnen/);
  await link.click();

  // „Spiele zuordnen“: das Exemplar mit Vorschlag aus dem Katalog
  await expect(page).toHaveURL(/#\/zuordnen/);
  const karte = page.getByTestId('zuordnen-eintrag').filter({ hasText: 'Zuordnung Falsch Ohne Treffer (E2E)' });
  await expect(karte).toContainText('Zuordnung Richtig (E2E)');
  await keinQuerScrollen(page);

  // Sammlung mit Filter zeigt nur dieses Exemplar und den Weg zur Liste
  await page.goto('/?app=1#/sammlung?ohne_katalog=1');
  await expect(page.getByRole('heading', { name: 'Zuordnung Falsch Ohne Treffer (E2E)' })).toBeVisible();
  await expect(page.getByTestId('zuordnen-link')).toBeVisible();
  const liste = await (await page.request.get('/api/artikel?ohne_katalog=1')).json();
  const artikel = liste.find((a) => a.titel === 'Zuordnung Falsch Ohne Treffer (E2E)');
  expect(artikel.katalog_id).toBeNull();

  // Am Exemplar den passenden Eintrag wählen
  await page.goto(`/?app=1#/artikel/${artikel.id}`);
  await page.getByRole('button', { name: /Weitere Aktionen/ }).click();
  await page.getByRole('button', { name: 'Anderen Katalogeintrag wählen …' }).click();
  const box = page.getByTestId('katalog-wechsel');
  await box.getByLabel('Katalog durchsuchen').fill('Zuordnung Richtig');
  await box.getByRole('option', { name: /Zuordnung Richtig \(E2E\)/ }).click();
  await expect.poll(async () => (await (await page.request.get(`/api/artikel/${artikel.id}`)).json()).katalog_id).toBe(eintrag.id);
  const danach = await (await page.request.get('/api/artikel?ohne_katalog=1')).json();
  expect(danach.some((a) => a.id === artikel.id)).toBe(false);

  // Zweites Exemplar über „Das ist es“ zuordnen
  const csv2 = 'Titel;Plattform\nZuordnung Zweiter Versuch (E2E);Super Nintendo\n';
  const analyse = await (await page.request.post('/api/import/csv/analyse', { data: { text: csv2 } })).json();
  await page.request.post('/api/import/csv', { data: { text: csv2, zuordnung: analyse.zuordnung, standardTyp: 'spiel' } });
  await page.goto('/?app=1#/zuordnen');
  const zweite = page.getByTestId('zuordnen-eintrag').filter({ hasText: 'Zuordnung Zweiter Versuch (E2E)' });
  await zweite.getByTestId('zuordnen-waehlen').first().click();
  await expect(zweite).toHaveCount(0);
  const nachher = await (await page.request.get('/api/artikel?ohne_katalog=1')).json();
  expect(nachher.some((a) => a.titel === 'Zuordnung Zweiter Versuch (E2E)')).toBe(false);
  expect(fehler).toEqual([]);
});
