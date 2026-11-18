// Konto → „Sammlung leeren“: mit Passwort alle Einträge löschen, das Konto bleibt.
import { test, expect } from '@playwright/test';
import { PASSWORT, fehlerSammeln, anmelden } from './hilfen.js';

test('Sammlung leeren: Passwort, Rückfrage, danach keine Einträge mehr', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, `leeren_${Date.now() % 100000}`);
  for (const titel of ['Tetris (Leeren-Test)', 'Doom (Leeren-Test)']) {
    expect((await page.request.post('/api/artikel', { data: { typ: 'spiel', titel, plattform: 'PC' } })).ok()).toBeTruthy();
  }
  await page.goto('/?app=1#/konto');
  const bereich = page.getByTestId('sammlung-leeren');
  await bereich.getByRole('button', { name: 'Alle Einträge löschen …' }).click();
  await bereich.getByLabel('Passwort zur Bestätigung').fill(PASSWORT);
  page.once('dialog', (d) => d.accept());
  await bereich.getByRole('button', { name: 'Alle Einträge löschen', exact: true }).click();
  await expect(page.getByText('2 Einträge gelöscht – deine Sammlung ist leer.')).toBeVisible();
  expect(await (await page.request.get('/api/artikel?bestand=alle')).json()).toEqual([]);
  expect(fehler).toEqual([]);
});
