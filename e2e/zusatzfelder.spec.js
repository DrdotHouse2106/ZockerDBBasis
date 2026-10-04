// Zusätzliche Felder: im Konto einschalten, Lagerort beim Bearbeiten, Übersicht „Lagerorte“, Wartung am Exemplar.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Zusatzfelder einschalten, Lagerort vergeben und Wartung eintragen', async ({ page }) => {
  await anmelden(page, 'zusatz_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'konsole', titel: 'Sega Saturn', plattform: 'Sega Saturn' } })).json();

  // Standardmäßig aus: kein Lagerort im Formular
  await page.goto(`/?app=1#/artikel/${a.id}/bearbeiten`);
  await expect(page.getByText('Seriennummer', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('z. B. Wohnzimmer')).toHaveCount(0);

  await page.goto('/?app=1#/konto');
  await page.getByRole('checkbox', { name: /Lagerort/ }).check();
  await expect(page.getByText('Gespeichert.')).toBeVisible();
  await page.getByRole('checkbox', { name: /Zustand & Wartung/ }).check();
  await page.getByRole('checkbox', { name: /Beilagen & Seriennummern/ }).check();

  await page.goto(`/?app=1#/artikel/${a.id}/bearbeiten`);
  // Vollständigkeit und Beilagen füllen sich gegenseitig vor
  await page.getByLabel('Vollständigkeit').selectOption('cib');
  await expect(page.getByRole('button', { name: '✓ OVP', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '✓ Anleitung', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '✓ Anleitung', exact: true }).click(); // → fehlt
  await expect(page.getByLabel('Vollständigkeit')).toHaveValue('fehlt_anleitung');
  await page.getByRole('button', { name: '✗ Anleitung', exact: true }).click(); // → gab es nicht (z. B. PS4) – trotzdem CIB
  await expect(page.getByLabel('Vollständigkeit')).toHaveValue('cib');
  await page.getByRole('button', { name: '– Anleitung (gab es nicht)', exact: true }).click(); // → keine Angabe
  await page.getByRole('button', { name: 'Anleitung', exact: true }).click(); // → vorhanden
  await expect(page.getByLabel('Vollständigkeit')).toHaveValue('cib');
  await page.getByPlaceholder('z. B. Wohnzimmer').fill('Keller');
  await page.getByPlaceholder('z. B. Kallax links').fill('Regal A');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Keller › Regal A')).toBeVisible();
  await expect(page.getByText('✓ OVP')).toBeVisible();

  // Wartung: Laufwerk wird bei der Saturn angeboten, Batterie-Hinweis erscheint nach dem Eintrag
  await page.getByRole('button', { name: '+ Eintrag' }).click();
  await page.getByLabel('Wartungsart').selectOption('batterie');
  await page.getByLabel('Datum').fill('2001');
  await page.locator('form').filter({ has: page.getByLabel('Wartungsart') }).getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText(/Batterie vor \d+ Jahren getauscht/)).toBeVisible();

  // Übersicht der Lagerorte
  await page.goto('/?app=1#/lagerorte');
  await expect(page.getByRole('link', { name: /Keller/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Regal A/ })).toBeVisible();
});
