// App-Modus (Capacitor) im Browser nachgestellt: Anmeldung per Token statt Cookie, Token im (nachgebildeten)
// Schlüsselbund, Bilder mit Dateischlüssel, Geräteliste im Konto.
import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { PASSWORT, fehlerSammeln } from './hilfen.js';

// Attrappe der nativen Brücke: isNativePlatform() und SecureStorage über nativePromise (Ablage in localStorage)
function brueckeAttrappe() {
  window.Capacitor = {
    isNativePlatform: () => true,
    nativePromise: async (plugin, methode, optionen) => {
      if (plugin !== 'SecureStorage') throw new Error(`Unbekanntes Plugin ${plugin}`);
      const schluessel = `attrappe:${optionen.prefixedKey}`;
      if (methode === 'internalGetItem') return { data: localStorage.getItem(schluessel) };
      if (methode === 'internalSetItem') return localStorage.setItem(schluessel, optionen.data);
      if (methode === 'internalRemoveItem') { localStorage.removeItem(schluessel); return { success: true }; }
      throw new Error(`Unbekannte Methode ${methode}`);
    },
  };
}

test('App-Modus: Anmeldung per Token, Bilder mit Schlüssel, Geräteliste', async ({ page, context }) => {
  const fehler = fehlerSammeln(page);
  // Konto und Exemplar mit Foto vorbereiten (per Cookie), danach Cookies löschen – die App kennt keine
  const benutzername = `app_e2e_${Date.now()}`;
  expect((await page.request.post('/api/auth/registrieren', { data: { benutzername, passwort: PASSWORT, bedingungen_akzeptiert: true } })).ok()).toBeTruthy();
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'App-Testspiel' } })).json();
  const bild = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#8b5cf6' } }).jpeg().toBuffer();
  const foto = await page.request.post(`/api/artikel/${a.id}/medien`, { multipart: { art: 'cover_vorne', datei: { name: 'cover.jpg', mimeType: 'image/jpeg', buffer: bild } } });
  expect(foto.ok()).toBeTruthy();
  await context.clearCookies();

  await context.addInitScript(brueckeAttrappe);
  await page.goto('/?app=1');
  await page.getByLabel('Benutzername').fill(benutzername);
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORT);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('navigation').getByText('Sammlung')).toBeVisible();
  // Kein Cookie, Token im Schlüsselbund
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('attrappe:zockerdb_sitzung'))).toBeTruthy();

  // Nach dem Neustart bleibt die Anmeldung erhalten
  await page.reload();
  await expect(page.getByRole('navigation').getByText('Sammlung')).toBeVisible();

  // Fotos laden mit Dateischlüssel
  await page.goto(`/?app=1#/artikel/${a.id}`);
  const img = page.locator('img[src*="/api/dateien/"]').first();
  await expect(img).toHaveAttribute('src', /schluessel=/);
  // Ohne Cookie und ohne Kopf – wie ein <img> in der App
  const status = await img.evaluate(async (el) => (await fetch(el.src, { credentials: 'omit' })).status);
  expect(status).toBe(200);

  // Geräteliste zeigt die App-Sitzung als dieses Gerät
  await page.goto('/?app=1#/konto');
  await expect(page.getByText('dieses Gerät')).toBeVisible();
  await expect(page.getByText(/^App · /)).toBeVisible();

  // Abmelden löscht das Token
  await page.getByRole('button', { name: 'Abmelden', exact: true }).last().click();
  await expect(page.getByLabel('Benutzername')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('attrappe:zockerdb_sitzung'))).toBeNull();
  expect(fehler).toEqual([]);
});
