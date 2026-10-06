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
