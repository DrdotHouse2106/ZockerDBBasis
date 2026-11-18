// Gewählte Sortierung der Sammlung bleibt erhalten – auch wenn die Sammlung später ohne Parameter geöffnet wird (Menüleiste).
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Sortierung der Sammlung wird gemerkt', async ({ page }) => {
  await anmelden(page, 'sortierung_e2e');
  for (const titel of ['Banjo (E2E)', 'Aladdin (E2E)', 'Castlevania (E2E)']) {
    await page.request.post('/api/artikel', { data: { typ: 'spiel', titel, plattform: 'Nintendo 64' } });
  }
  await page.goto('/?app=1#/sammlung');
  await page.locator('[data-tour="sammlung-filter"]').click();
  await page.getByTestId('sammlung-sortierung').selectOption('titel');
  await expect(page.getByText('Aladdin (E2E)').first()).toBeVisible();
  // Woanders hin und ohne Parameter zurück: weiter nach Titel sortiert
  await page.evaluate(() => { window.location.hash = '#/lagerorte'; });
  await page.evaluate(() => { window.location.hash = '#/sammlung'; });
  await expect(page.locator('[data-tour="sammlung-filter"]')).toBeVisible();
  if (!(await page.getByTestId('sammlung-sortierung').isVisible())) await page.locator('[data-tour="sammlung-filter"]').click();
  await expect(page.getByTestId('sammlung-sortierung')).toHaveValue('titel');
  const titel = await page.locator('main').getByText(/\(E2E\)$/).allTextContents();
  expect(titel.filter((t) => t.endsWith('(E2E)')).slice(0, 3)).toEqual(['Aladdin (E2E)', 'Banjo (E2E)', 'Castlevania (E2E)']);
});

test('„Exemplare gruppieren“ und Filter werden gemerkt; Zurücksetzen vergisst die Filter', async ({ page }) => {
  await anmelden(page, 'gruppieren_e2e');
  await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Wave Race (E2E)', plattform: 'Nintendo 64' } });
  await page.goto('/?app=1#/sammlung');
  await expect(page.getByText('Wave Race (E2E)').first()).toBeVisible(); // erst klicken, wenn die Sammlung geladen ist
  await page.locator('[data-tour="sammlung-filter"]').click();
  const gruppieren = page.getByLabel('Exemplare gruppieren');
  await gruppieren.click();
  await expect(gruppieren).not.toBeChecked();
  await page.getByTestId('sammlung-sortierung').selectOption('titel');
  // Woanders hin und ohne Parameter zurück (wie über die Menüleiste)
  await page.evaluate(() => { window.location.hash = '#/lagerorte'; });
  await page.evaluate(() => { window.location.hash = '#/sammlung'; });
  await expect(page.locator('[data-tour="sammlung-filter"]')).toBeVisible();
  if (!(await page.getByLabel('Exemplare gruppieren').isVisible())) await page.locator('[data-tour="sammlung-filter"]').click();
  await expect(page.getByLabel('Exemplare gruppieren')).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('sammlung-einzeln'))).toBe('1');
  // Ein Link mit eigenen Filtern behält die gemerkte Ansicht
  await page.evaluate(() => { window.location.hash = '#/sammlung?typ=spiel'; });
  if (!(await page.getByLabel('Exemplare gruppieren').isVisible())) await page.locator('[data-tour="sammlung-filter"]').click();
  await expect(page.getByLabel('Exemplare gruppieren')).not.toBeChecked();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('sammlung-filter')) ?? '{}')).toEqual({});
});

test('Gemerkter Filter lässt sich über das Menü wieder abwählen (z. B. „Digital“)', async ({ page }) => {
  await anmelden(page, 'filter_abwaehlen_e2e');
  await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Abwahl (E2E)', plattform: 'Nintendo 64' } });
  await page.goto('/?app=1#/sammlung');
  const digital = page.getByRole('button', { name: 'Digital', exact: true });
  await digital.click();
  await expect(digital).toHaveClass(/chip-aktiv/);
  // Über das Menü geöffnet: Filter gilt weiter (Adresse ohne Parameter), Abwählen muss trotzdem wirken
  await page.evaluate(() => { window.location.hash = '#/einstellungen'; });
  await page.evaluate(() => { window.location.hash = '#/sammlung'; });
  await expect(digital).toHaveClass(/chip-aktiv/);
  await digital.click();
  await expect(digital).not.toHaveClass(/chip-aktiv/);
  await expect(page.getByText('Abwahl (E2E)')).toBeVisible();
});

test('IGDB-Quellenhinweis steht in der Fußzeile', async ({ page }) => {
  await anmelden(page, 'igdb_hinweis_e2e');
  await page.goto('/?app=1#/sammlung');
  const hinweis = page.getByTestId('igdb-hinweis');
  await expect(hinweis).toHaveText('Games metadata is powered by IGDB.com');
  await expect(hinweis).toHaveAttribute('href', 'https://www.igdb.com');
});
