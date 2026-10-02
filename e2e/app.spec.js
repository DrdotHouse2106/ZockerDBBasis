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
  ['/konvolute', 'Konvolute'],
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

test('Konvolut: Gesamtpreis anlegen, Artikel erfassen, Anteil wird angezeigt', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'konvolut_e2e');
  await page.goto('/?app=1#/konvolute');
  await page.getByRole('button', { name: 'Neues Konvolut' }).click();
  await page.getByLabel('Name').fill('Flohmarkt-Kiste');
  await page.getByLabel('Gesamtpreis').fill('20');
  await page.getByLabel('Kaufdatum').fill('1998');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Flohmarkt-Kiste' })).toBeVisible();

  // Artikel aus dem Konvolut erfassen (eigener Eintrag) – nach dem Speichern geht es direkt mit dem nächsten weiter
  await page.getByRole('button', { name: 'Artikel erfassen' }).click();
  for (const titel of ['Kistenspiel Eins', 'Kistenspiel Zwei']) {
    await expect(page.getByText('Du erfasst Artikel für das Konvolut')).toBeVisible();
    await page.getByRole('searchbox').first().fill(titel);
    await page.getByRole('button', { name: 'Eigenen Eintrag anlegen' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Neuer Artikel' })).toBeVisible();
    await page.getByRole('button', { name: /Speichern|Hinzufügen/ }).last().click();
  }
  await page.getByRole('link', { name: 'Fertig – zum Konvolut' }).click();
  await expect(page.getByText('2 Artikel · verteilt 20,00 € von 20,00 €')).toBeVisible();
  await expect(page.getByText('10,00 €').first()).toBeVisible();
  await keinQuerScrollen(page);
  expect(fehler).toEqual([]);
});

test('Unbekannter Barcode: Suchfeld direkt in der Barcode-Karte, Treffer wählen ordnet zu', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'admin');
  // Ein Spiel im eigenen Katalog, zu dem der Barcode noch nicht bekannt ist
  expect((await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Barcodespiel Alpha' } })).ok()).toBeTruthy();
  await page.goto('/?app=1#/neu?barcode=4006381333931');
  await expect(page.getByText('Diesen Barcode kennen wir noch nicht.')).toBeVisible();
  // Kein zweites Suchfeld oben – gesucht wird direkt in der Karte
  await expect(page.getByRole('searchbox')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Spiel suchen und zuordnen' }).fill('Barcodespiel');
  await keinQuerScrollen(page);
  await page.getByRole('button', { name: /Barcodespiel Alpha/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Neuer Artikel' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Barcode (EAN/UPC)' })).toHaveValue('4006381333931');
  // Die übrigen Wege bleiben als Links erreichbar
  await page.goto('/?app=1#/neu?barcode=4006381333948');
  await expect(page.getByRole('button', { name: 'Eigenen Eintrag anlegen' })).toBeVisible();
  expect(fehler).toEqual([]);
});
