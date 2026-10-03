// „Zurück“ in der Kopfleiste: zur vorherigen Seite der App (nicht fest zur Sammlung), nach dem Speichern nicht ins Formular.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Zurück führt zur vorherigen Seite – auch nach Foto-Auswahl und nach dem Speichern', async ({ page }) => {
  await anmelden(page, 'zurueck_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Zurück-Test (E2E)', plattform: 'PlayStation 4' } })).json();
  const hash = () => page.evaluate(() => window.location.hash);
  const zurueck = () => page.getByRole('button', { name: 'Zurück' }).first().click();

  // Von einer anderen Seite (hier: Lagerorte) zum Artikel – mit vorgewähltem Foto wie aus „Fotos gesucht“
  await page.goto('/?app=1#/lagerorte');
  await page.evaluate((id) => { window.location.hash = `#/artikel/${id}?foto=foto_disc`; }, a.id);
  await expect(page.getByText('Zurück-Test (E2E)').first()).toBeVisible();
  await zurueck();
  await expect.poll(hash).toBe('#/lagerorte');

  // Bearbeiten und speichern: danach führt Zurück nicht ins Formular, sondern weiter zur Seite davor
  await page.evaluate((id) => { window.location.hash = `#/artikel/${id}`; }, a.id);
  await expect(page.getByText('Zurück-Test (E2E)').first()).toBeVisible();
  await page.evaluate((id) => { window.location.hash = `#/artikel/${id}/bearbeiten`; }, a.id);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(hash).toBe(`#/artikel/${a.id}`);
  await zurueck();
  await expect.poll(hash).toBe('#/lagerorte');

  // Bild antippen → Katalogseite; Zurück → wieder zum Artikel
  await page.evaluate((id) => { window.location.hash = `#/artikel/${id}`; }, a.id);
  await page.getByRole('link', { name: 'Katalogseite: Zurück-Test (E2E)' }).click();
  await expect.poll(hash).toMatch(/^#\/katalog\/\d+$/);
  await zurueck();
  await expect.poll(hash).toBe(`#/artikel/${a.id}`);

  // Direkt geöffnet (keine Vorgeschichte): wie bisher zur Sammlung
  await page.goto(`/?app=1&neu=1#/artikel/${a.id}`); // anderer Pfad → echter Neustart der Seite
  await expect(page.getByText('Zurück-Test (E2E)').first()).toBeVisible();
  await zurueck();
  await expect.poll(hash).toMatch(/^(#\/?)?$/);
});
