// Bewertungshilfe für den Zustand: aufklappbar, gewählte Stufe hervorgehoben, Disc/Modul und Hülle getrennt.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Zustandshilfe zeigt die Stufen für Disc/Modul und Hülle', async ({ page }) => {
  await anmelden(page, 'zustand_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Battlefield 4', plattform: 'PlayStation 4', vollstaendigkeit: 'cib' } })).json();
  await page.goto(`/?app=1#/artikel/${a.id}/bearbeiten`);
  const knopf = page.getByRole('button', { name: /Wie bewerte ich den Zustand/ });
  await expect(knopf).toHaveAttribute('aria-expanded', 'false');
  await knopf.click();
  await expect(knopf).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Einzelne feine Kratzer, nur im Gegenlicht sichtbar; Etikett vollständig.')).toBeVisible();
  await expect(page.getByText('Original eingeschweißt (Folie intakt), keine Druckstellen.')).toBeVisible();
  await knopf.click();
  await expect(page.getByText('Original eingeschweißt (Folie intakt), keine Druckstellen.')).toHaveCount(0);
});
