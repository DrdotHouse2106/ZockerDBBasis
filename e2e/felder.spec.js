// Formular: Felder im Konto ausblenden; Zustand von Disc und Hülle getrennt; Drucknummer bei Spielen.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Modellnummer ausblenden, Zustand Disc und Hülle getrennt', async ({ page }) => {
  await anmelden(page, 'felder_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Black Flag', plattform: 'PlayStation 4' } })).json();

  await page.request.put('/api/konto', { data: { ausgeblendete_felder: [] } }); // wiederholbar: Ausgangszustand
  await page.goto('/?app=1#/konto');
  await page.getByText('Felder beim Eintragen ausblenden').click();
  await page.getByRole('checkbox', { name: 'Modellnummer', exact: true }).uncheck();
  await expect(page.getByText('Gespeichert.')).toBeVisible();

  await page.goto(`/?app=1#/artikel/${a.id}/bearbeiten`);
  await expect(page.getByLabel('Drucknummer (Cover)')).toBeVisible();
  await expect(page.getByLabel('Modellnummer')).toHaveCount(0);
  await page.getByLabel('Zustand Disc / Modul').selectOption('sehr_gut');
  await page.getByLabel('Zustand Hülle / OVP').selectOption('akzeptabel');
  await page.getByRole('button', { name: 'Speichern' }).click();
  // Erst warten, bis die Artikelseite da ist – sonst findet die Suche noch die Auswahllisten des Formulars
  await expect(page).toHaveURL(new RegExp(`#/artikel/${a.id}$`));
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByText('Zustand Hülle / OVP')).toBeVisible();
  await expect(page.getByText('Akzeptabel', { exact: true })).toBeVisible();
});

test('Spiele: Drucknummer (Cover) statt Seriennummern', async ({ page }) => {
  await anmelden(page, 'drucknummer_e2e');
  await page.request.put('/api/konto', { data: { ausgeblendete_felder: [] } });
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Agents of Mayhem', plattform: 'PlayStation 4' } })).json();

  await page.goto(`/?app=1#/artikel/${a.id}/bearbeiten`);
  await expect(page.getByLabel('Modellnummer')).toHaveAttribute('placeholder', /CUSA-03067/);
  // Spiele haben keine Seriennummern – die Felder erscheinen nur, wenn schon etwas drinsteht
  await expect(page.getByLabel('Seriennummer', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Seriennummer der OVP')).toHaveCount(0);
  await page.getByLabel('Modellnummer').fill('CUSA-03067');
  await page.getByLabel('Drucknummer (Cover)').fill('8826161');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page).toHaveURL(new RegExp(`#/artikel/${a.id}$`));
  await expect(page.getByText('Drucknummer (Cover)')).toBeVisible();
  await expect(page.getByText('8826161', { exact: true })).toBeVisible();
});
