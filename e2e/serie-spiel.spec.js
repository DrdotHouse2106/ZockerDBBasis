// Figurenserie mit dem Spiel verknüpfen: auf der Serienseite „Zum Spiel“, auf der Spieleseite „Figurenserie zum Spiel“.
import { test, expect } from '@playwright/test';
import { anmelden, fehlerSammeln } from './hilfen.js';

test('Serie ↔ Spiel verknüpfen und auf beiden Seiten sehen', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'admin');
  const spiel = await (await page.request.post('/api/katalog', {
    data: { typ: 'spiel', titel: 'Taschenmonster-Abenteuer (E2E)', plattformen: ['NES'], erscheinungsjahr: 1992, veroeffentlichen: true },
  })).json();
  const serie = await (await page.request.post('/api/serien', { data: { name: 'Taschenmonster (E2E)', status: 'freigegeben' } })).json();

  await page.goto(`/?app=1#/serien/${serie.id}`);
  const bereich = page.getByTestId('serie-spiele');
  await bereich.getByRole('button', { name: 'Mit einem Spiel verknüpfen' }).click();
  await bereich.getByRole('searchbox').fill('Taschenmonster-Abenteuer');
  await bereich.getByRole('option', { name: /Taschenmonster-Abenteuer \(E2E\)/ }).click();
  await expect(bereich.getByRole('link', { name: 'Taschenmonster-Abenteuer (E2E)' })).toBeVisible();

  await bereich.getByRole('link', { name: 'Taschenmonster-Abenteuer (E2E)' }).click();
  const box = page.getByTestId('katalog-figurenserien');
  await expect(box).toContainText('Figurenserie zum Spiel');
  await box.getByRole('link', { name: 'Taschenmonster (E2E)' }).click();
  await expect(page.getByTestId('serie-kopf')).toBeVisible();

  // Verknüpfung wieder lösen
  await page.getByRole('button', { name: 'Verknüpfung mit Taschenmonster-Abenteuer (E2E) entfernen' }).click();
  await expect(page.getByTestId('serie-spiele').getByRole('link')).toHaveCount(0);
  // Aufräumen: eine eigene Serie würde sonst unter „Meine Serien“ stehen und andere Tests stören
  expect((await page.request.delete(`/api/serien/${serie.id}`)).ok()).toBeTruthy();
  expect(fehler).toEqual([]);
});
