// CIB bei Disc-Spielen: Das Inlay wird mit angekreuzt – auch wenn CIB vor der Plattform gewählt wurde.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('CIB vor der Plattform gewählt: bei PS3 wird das Inlay vorausgewählt', async ({ page }) => {
  await anmelden(page, 'cib_inlay_e2e');
  await page.goto('/?app=1#/konto');
  await page.getByRole('checkbox', { name: /Beilagen & Seriennummern/ }).check();
  await expect(page.getByText('Gespeichert.')).toBeVisible();

  await page.goto('/?app=1#/neu/formular?typ=spiel');
  await page.getByLabel('Vollständigkeit').selectOption('cib');
  await expect(page.getByRole('button', { name: /^✓ OVP/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Plattform / System').selectOption({ label: 'PlayStation 3 (PS3)' });
  await expect(page.getByRole('button', { name: /^✓ Inlay/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Vollständigkeit')).toHaveValue('cib');

  // Plattform aus dem Barcode-Scan (nur als ID bekannt): CIB kreuzt das Inlay ebenfalls an
  const e = await (await page.request.post('/api/katalog', { data: { typ: 'spiel', titel: 'Inlay-Test Black Flag', plattformen: ['PlayStation 3', 'Xbox 360'] } })).json();
  const ps3 = (await (await page.request.get('/api/plattformen')).json()).find((p) => p.name === 'PlayStation 3');
  await page.goto(`/?app=1#/neu/formular?katalog=${e.id}&typ=spiel&plattform_id=${ps3.id}`);
  await expect(page.getByLabel('Plattform / System')).toHaveValue(String(ps3.id));
  await page.getByLabel('Vollständigkeit').selectOption('cib');
  await expect(page.getByRole('button', { name: /^✓ Inlay/ })).toHaveAttribute('aria-pressed', 'true');
});

test('„Nur OVP“ bleibt, wenn alle Beilagen angehakt werden (leere Hülle ohne Disc)', async ({ page }) => {
  await anmelden(page, 'nur_ovp_e2e');
  await page.goto('/?app=1#/konto');
  await page.getByRole('checkbox', { name: /Beilagen & Seriennummern/ }).check();
  await expect(page.getByText('Gespeichert.')).toBeVisible();
  await page.goto('/?app=1#/neu/formular?typ=spiel');
  await page.getByLabel('Plattform / System').selectOption({ label: 'PlayStation 3 (PS3)' });
  await page.getByLabel('Vollständigkeit').selectOption('nur_ovp');
  await page.getByRole('button', { name: 'Anleitung', exact: true }).click();
  await page.getByRole('button', { name: /^Inlay/ }).click();
  await expect(page.getByLabel('Vollständigkeit')).toHaveValue('nur_ovp');
  await expect(page.getByTestId('hinweis-leere-huelle')).toBeVisible();
});
