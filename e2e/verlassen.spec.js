// Ungespeicherte Eingaben: Vor dem Verlassen des Formulars (Zurück, Abbrechen) fragt die App nach.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Formular mit Eingaben: Zurück fragt nach, Abbrechen der Rückfrage behält die Eingaben', async ({ page }) => {
  await anmelden(page, 'verlassen_e2e');
  await page.goto('/?app=1#/');
  await page.goto('/?app=1#/neu/formular?typ=spiel');
  const titel = page.getByLabel('Titel', { exact: false }).first();
  await titel.fill('Halb eingetippt');

  // Rückfrage ablehnen → bleibt im Formular
  page.once('dialog', (d) => { expect(d.message()).toContain('ungespeicherte'); d.dismiss(); });
  await page.goBack();
  await expect(page).toHaveURL(/#\/neu\/formular/);
  await expect(titel).toHaveValue('Halb eingetippt');

  // Rückfrage bestätigen → verlässt das Formular
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page).not.toHaveURL(/#\/neu\/formular/);
});

test('Formular ohne Eingaben: Zurück ohne Rückfrage', async ({ page }) => {
  await anmelden(page, 'verlassen2_e2e');
  await page.goto('/?app=1#/');
  await page.goto('/?app=1#/neu/formular?typ=spiel');
  let gefragt = false;
  page.on('dialog', (d) => { gefragt = true; d.accept(); });
  await page.goBack();
  await expect(page).not.toHaveURL(/#\/neu\/formular/);
  expect(gefragt).toBe(false);
});
