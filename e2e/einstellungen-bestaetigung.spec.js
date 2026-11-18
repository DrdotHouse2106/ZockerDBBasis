// Bestätigen sicherheitsrelevanter Einstellungen: Der Passwortmanager (z. B. Autofill auf dem iPhone) braucht ein
// Benutzernamenfeld im Bestätigungsfenster – sonst landet der Name in einem Textfeld der Einstellungen.
import { test, expect } from '@playwright/test';
import { PASSWORT, anmelden, fehlerSammeln } from './hilfen.js';

test('Einstellungen bestätigen: Benutzername für den Passwortmanager, Einstellungsfelder ohne Autofill', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'admin'); // erstes Konto = Administrator
  await page.goto('/#/admin?reiter=einstellungen');
  await page.getByRole('button', { name: 'Alle aufklappen' }).click();
  const textfelder = page.locator('input[id^="einstellung-"]:not([type="password"])');
  await expect(textfelder.first()).toBeVisible();
  // Kein Einstellungsfeld nimmt Anmeldedaten an
  for (const feld of await textfelder.all()) await expect(feld).toHaveAttribute('autocomplete', 'off');

  // Sicherheitsrelevante Einstellung ändern → Bestätigung
  const registrierung = page.locator('#einstellung-REGISTRATION_OPEN');
  const vorher = await registrierung.inputValue();
  await registrierung.selectOption(vorher === 'true' ? 'false' : 'true');
  await page.getByRole('button', { name: 'Speichern' }).click();
  const dialog = page.getByRole('dialog', { name: 'Änderung bestätigen' });
  await expect(dialog).toBeVisible();
  // Benutzername steht im Formular vor dem Passwortfeld
  await expect(dialog.locator('input[autocomplete="username"]')).toHaveValue('admin');
  expect(await dialog.locator('form').evaluate((f) => {
    const name = f.querySelector('input[autocomplete="username"]');
    const passwort = f.querySelector('input[type="password"]');
    return Boolean(name.compareDocumentPosition(passwort) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await dialog.locator('input[type="password"]').fill(PASSWORT);
  await dialog.getByRole('button', { name: 'Bestätigen & speichern' }).click();
  await expect(page.getByText(/Einstellung\(en\) gespeichert/)).toBeVisible();

  // Zurückstellen
  await registrierung.selectOption(vorher || 'true');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await dialog.locator('input[type="password"]').fill(PASSWORT);
  await dialog.getByRole('button', { name: 'Bestätigen & speichern' }).click();
  await expect(dialog).toBeHidden();
  expect(fehler).toEqual([]);
});
