// Avatar: Symbol und Farbe im Konto wählen, eigenes Bild hochladen – erscheint oben in der Kopfleiste.
import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { anmelden } from './hilfen.js';

test('Avatar: Symbol und Farbe wählen, Bild hochladen und entfernen', async ({ page }) => {
  await anmelden(page, 'avatar_e2e');
  // Kein Admin mit 2FA-Pflicht: zweites Konto anlegen, damit das Konto vollständig angezeigt wird
  const konto = await (await page.request.get('/api/konto')).json();
  test.skip(konto.rolle === 'admin' && !konto.totp_aktiv && (await page.request.get('/api/auth/status').then((r) => r.json())).zweiFaktorPflicht, 'Admin muss erst 2FA einrichten');
  await page.goto('/?app=1#/konto');
  const auswahl = page.getByTestId('avatar-auswahl');
  await auswahl.getByRole('button', { name: 'Symbol 🍄' }).click();
  await expect(auswahl.getByRole('button', { name: 'Symbol 🍄' })).toHaveAttribute('aria-pressed', 'true');
  await auswahl.getByRole('button', { name: 'Farbe Grün' }).click();
  await expect(auswahl.getByRole('button', { name: 'Farbe Grün' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('kopf-avatar')).toContainText('🍄');

  const foto = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#3366cc' } }).jpeg().toBuffer();
  await page.getByTestId('avatar-datei').setInputFiles({ name: 'ich.jpg', mimeType: 'image/jpeg', buffer: foto });
  await expect(page.getByText('Profilbild gespeichert.')).toBeVisible();
  await expect(page.getByTestId('kopf-avatar').locator('img')).toHaveAttribute('src', /avatar-.+\.webp/);
  await auswahl.getByRole('button', { name: 'Bild entfernen' }).click();
  await expect(page.getByTestId('kopf-avatar')).toContainText('🍄');
});
