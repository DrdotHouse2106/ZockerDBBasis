// Selbst eingetragene Edition direkt als Variante anlegen; Datum auch ohne Punkte (Handy-Zahlentastatur).
import { test, expect } from '@playwright/test';
import { anmelden, fehlerSammeln } from './hilfen.js';

test('Edition als Variante anlegen, Exemplar verknüpft; Datum „29122012“ wird verstanden', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'admin');
  const eintrag = await (await page.request.post('/api/katalog', {
    data: { typ: 'spiel', titel: 'Editionsspiel (E2E)', plattformen: ['PlayStation 3'], veroeffentlichen: true },
  })).json();
  const artikel = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: eintrag.titel, katalog_id: eintrag.id } })).json();

  await page.goto(`/?app=1#/artikel/${artikel.id}/bearbeiten`);
  await page.getByLabel('Edition / Variante').fill('Special Edition');
  const angebot = page.getByTestId('edition-als-variante');
  await expect(angebot).toContainText('„Special Edition“ als Variante dieses Spiels anlegen');
  await angebot.getByRole('checkbox').check();
  await angebot.getByLabel('Sichtbarkeit der neuen Variante').selectOption('privat');

  await page.getByText('Erstkauf laut Beleg').click();
  const datum = page.getByLabel('Datum', { exact: true });
  await datum.fill('29122012');
  await datum.blur();
  await expect(datum).toHaveValue('29.12.2012');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Änderungen gespeichert.')).toBeVisible();

  const gespeichert = await (await page.request.get(`/api/artikel/${artikel.id}`)).json();
  expect(gespeichert.erstkauf_datum).toBe('2012-12-29');
  const varianten = await (await page.request.get(`/api/katalog/${eintrag.id}/varianten`)).json();
  const neu = varianten.find((v) => v.bezeichnung === 'Special Edition');
  expect(neu?.status).toBe('privat');
  expect(gespeichert.variante_id).toBe(neu.id);

  // Gibt es die Variante schon, wird sie zum Auswählen angeboten statt doppelt angelegt
  const zweites = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: eintrag.titel, katalog_id: eintrag.id } })).json();
  await page.goto(`/?app=1#/artikel/${zweites.id}/bearbeiten`);
  await page.getByLabel('Edition / Variante').fill('special edition');
  await expect(page.getByTestId('edition-vorhanden')).toContainText('gibt es im Katalog als Variante');
  await page.getByTestId('edition-vorhanden').getByRole('button', { name: 'Diese Variante wählen' }).click();
  await expect(page.getByLabel('Variante / Revision')).toHaveValue(String(neu.id));
  expect(fehler).toEqual([]);
});
