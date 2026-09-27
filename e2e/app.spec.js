// Durchgang durch die wichtigsten Seiten des Kerns auf Handy-Größe: Registrierung, Sammlung, nachgeladene Seiten.
import { test, expect } from '@playwright/test';
import { PASSWORT, fehlerSammeln, keinQuerScrollen, anmelden } from './hilfen.js';

test('Registrierung über die Oberfläche', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await page.goto('/?app=1');
  // Bei der Ersteinrichtung zeigt die Seite direkt die Registrierung (erstes Konto wird Administrator)
  await expect(page.getByText('Das erste Konto wird automatisch Administrator.')).toBeVisible();
  await page.getByLabel('Benutzername').fill('admin');
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORT);
  await page.getByLabel('Passwort wiederholen').fill(PASSWORT);
  await page.getByRole('checkbox', { name: /Nutzungsbedingungen/ }).check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page.getByRole('navigation').getByText('Sammlung')).toBeVisible();
  await keinQuerScrollen(page);
  expect(fehler).toEqual([]);
});

const SEITEN = [
  ['/statistik', 'Statistik'],
  ['/konto', 'Konto'],
  ['/einstellungen', 'Mehr'],
  ['/import', 'Sammlung importieren'],
  ['/katalog', 'Katalog'],
  ['/benachrichtigungen', 'Benachrichtigungen'],
  ['/admin', 'Administration'],
  ['/admin?reiter=sicherungen', 'Administration'],
  ['/seite/datenschutz', 'Datenschutz'],
];

for (const [pfad, titel] of SEITEN) {
  test(`Seite ${pfad} lädt nach und passt aufs Handy`, async ({ page }) => {
    const fehler = fehlerSammeln(page);
    await anmelden(page, 'admin');
    await page.goto(`/?app=1#${pfad}`);
    await expect(page.getByRole('heading', { level: 1, name: titel }).first()).toBeVisible();
    await expect(page.getByText('Wird geladen …')).toHaveCount(0);
    await keinQuerScrollen(page);
    expect(fehler).toEqual([]);
  });
}
