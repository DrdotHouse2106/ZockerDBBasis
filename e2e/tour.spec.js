// Geführte Tour „Erste Schritte“: Angebot für Neue, Hervorhebung mit „Hier tippen“, Beispieleintrag wird angelegt und am Ende gelöscht.
import { test, expect } from '@playwright/test';
import { anmelden, fehlerSammeln, keinQuerScrollen } from './hilfen.js';

test('Tour „Erste Schritte“ mit Beispieleintrag', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'tour_e2e');
  await page.goto('/?app=1#/');
  await expect(page.getByText('Neu hier? Wir zeigen dir alles.')).toBeVisible();
  await page.getByRole('button', { name: 'Tour starten' }).click();

  const blase = page.getByRole('dialog');
  await expect(blase).toContainText('Willkommen');
  let beispielGesehen = false;
  for (let i = 0; i < 60; i++) {
    await expect(blase).toBeVisible();
    const titel = await blase.locator('#tour-titel').textContent();
    if (titel.startsWith('Etwas hinzufügen')) {
      // „Hier tippen“: der markierte Navigationspunkt ist bedienbar und führt weiter
      await expect(blase).toContainText('Tippe auf die markierte Stelle');
      await page.locator('[data-tour="nav-plus"]:visible').click();
      await expect(page).toHaveURL(/#\/neu/);
      await expect(blase.locator('#tour-titel')).toHaveText('Was möchtest du erfassen?');
      continue;
    }
    if (titel.startsWith('So sieht ein Eintrag aus')) {
      beispielGesehen = true;
      expect((await (await page.request.get('/api/artikel')).json()).length).toBe(1);
      await expect(page.getByRole('heading', { level: 2, name: 'Super Mario World (Beispiel)' })).toBeVisible();
      await keinQuerScrollen(page);
    }
    const loeschen = blase.getByRole('button', { name: 'Fertig – Beispiel löschen' });
    if (await loeschen.isVisible()) { await loeschen.click(); break; }
    await blase.getByRole('button', { name: 'Weiter' }).click();
    await expect(blase.locator('#tour-titel')).not.toHaveText(titel);
  }
  expect(beispielGesehen).toBe(true);
  await expect(blase).toHaveCount(0);

  // Beispiel gelöscht, Tour am Konto als erledigt gemerkt, Angebot verschwunden
  await expect.poll(async () => (await (await page.request.get('/api/artikel')).json()).length ?? 0).toBe(0);
  await expect.poll(async () => (await (await page.request.get('/api/auth/status')).json()).benutzer.touren['erste-schritte']).toBe('fertig');
  await page.goto('/?app=1#/einstellungen');
  await expect(page.getByText('✓ erledigt')).toBeVisible();
  await page.goto('/?app=1#/');
  await expect(page.getByText('Neu hier? Wir zeigen dir alles.')).toHaveCount(0);
  expect(fehler).toEqual([]);
});

test('Tour abbrechen: Esc beendet, Beispiel verschwindet, Angebot kommt nicht wieder', async ({ page }) => {
  await anmelden(page, 'tour_abbruch_e2e');
  await page.goto('/?app=1#/');
  await page.getByRole('button', { name: 'Nein danke' }).click();
  await expect(page.getByText('Neu hier? Wir zeigen dir alles.')).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get('/api/auth/status')).json()).benutzer.touren['erste-schritte']).toBe('abgelehnt');

  // Später über „Mehr → Hilfe & Touren“ starten und mitten drin abbrechen
  await page.goto('/?app=1#/einstellungen');
  await page.locator('[data-tour="mehr-touren"]').getByRole('button', { name: 'Starten' }).first().click();
  const blase = page.getByRole('dialog');
  for (let i = 0; i < 30 && !(await page.getByRole('heading', { level: 2, name: 'Super Mario World (Beispiel)' }).isVisible()); i++) {
    const titel = await blase.locator('#tour-titel').textContent();
    await blase.getByRole('button', { name: 'Weiter' }).click();
    await expect(blase.locator('#tour-titel')).not.toHaveText(titel);
  }
  await page.keyboard.press('Escape');
  await expect(blase).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get('/api/artikel')).json()).length ?? 0).toBe(0);
});
