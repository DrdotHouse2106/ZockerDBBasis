// Katalogsuche: Das Suchfeld behält beim Tippen den Fokus, obwohl der Suchbegriff in die Adresse geschrieben wird.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Katalogsuche: Fokus bleibt im Suchfeld', async ({ page }) => {
  await anmelden(page, 'katalogsuche_e2e');
  await page.goto('/?app=1#/katalog');
  const feld = page.getByPlaceholder('Spiele, Konsolen, Zubehör suchen …');
  await feld.click();
  await feld.pressSequentially('Mar', { delay: 50 });
  await expect(page).toHaveURL(/q=Mar/);
  await feld.pressSequentially('io', { delay: 50 });
  await expect(page).toHaveURL(/q=Mario/);
  await expect(feld).toBeFocused();
  await expect(feld).toHaveValue('Mario');
});

test('Hinzufügen: Suche nach Produktnummer vom Rücken – Treffer über eigene Modellnummer, sonst Hinweis', async ({ page }) => {
  await anmelden(page, 'nummernsuche_e2e');
  await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Nummernspiel (E2E)', plattform: 'PlayStation 3', modellnummer: 'BLES-04711' } });
  await page.goto('/?app=1#/neu');
  const feld = page.getByPlaceholder('Titel, EAN oder Produktnummer suchen …');
  await feld.fill('bles 04711');
  await expect(page.getByText('Nummernspiel (E2E)').first()).toBeVisible();
  await feld.fill('BLES-99999');
  await expect(page.getByTestId('nummer-hinweis')).toContainText('Modellnummer');
});
