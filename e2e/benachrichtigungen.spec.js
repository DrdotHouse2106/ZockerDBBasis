// Benachrichtigungen je Kategorie abschalten (Kontoseite).
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Benachrichtigungsarten lassen sich im Konto abschalten', async ({ page }) => {
  await anmelden(page, 'benachr_e2e');
  await page.goto('/?app=1#/konto');
  const verleih = page.getByRole('checkbox', { name: 'Verleih: In der App' });
  await expect(verleih).toBeChecked();
  await verleih.uncheck();
  await expect(page.getByRole('checkbox', { name: 'Konto & Sicherheit: In der App' })).toBeDisabled();

  const auswahl = await (await page.request.get('/api/benachrichtigungen/auswahl')).json();
  expect(auswahl.kategorien.find((k) => k.id === 'leihe').app).toBe(false);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Verleih: In der App' })).not.toBeChecked();
});
