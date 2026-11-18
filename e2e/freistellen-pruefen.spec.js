// Freistellungen prüfen: Original und freigestellte Version nebeneinander, direkt übernehmen – danach „Alles erledigt“.
import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { anmelden } from './hilfen.js';

test('Freistellungen prüfen: vergleichen, übernehmen, dann nichts mehr zu tun', async ({ page }) => {
  await anmelden(page, 'freistellen_pruefen_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Freistell-Test (E2E)', plattform: 'Nintendo 64' } })).json();
  const foto = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#cc2244' } }).png().toBuffer();
  const medium = await (await page.request.post(`/api/artikel/${a.id}/medien`, {
    multipart: { art: 'foto_modul', sichtbarkeit: 'privat', datei: { name: 'modul.png', mimeType: 'image/png', buffer: foto } },
  })).json();
  const motiv = await sharp({ create: { width: 150, height: 100, channels: 3, background: '#fff' } }).png().toBuffer();
  const maske = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#000' } })
    .composite([{ input: motiv, left: 75, top: 50 }]).greyscale().png().toBuffer();
  const r = await page.request.put(`/api/medien/${medium.id}/freistellen`, { data: maske, headers: { 'Content-Type': 'image/png' } });
  expect(r.status()).toBe(200);

  // Fester Einstieg unter „Mehr“ – mit Anzahl der wartenden Fotos
  await page.goto('/?app=1#/einstellungen');
  const eintrag = page.getByRole('link', { name: /Freistellungen prüfen/ });
  await expect(eintrag).toContainText('1 Foto wartet');
  await eintrag.click();
  await expect(page.getByTestId('freistellen-pruefen-anzahl')).toHaveText('1');
  const karte = page.getByTestId('freistellen-pruefen-foto');
  await expect(karte.getByRole('img', { name: 'Original' })).toBeVisible();
  await expect(karte.getByRole('img', { name: 'Freigestellt' })).toBeVisible();
  // Antippen öffnet die Großansicht; dort lässt sich zwischen Original und freigestellter Version blättern
  await karte.getByRole('link', { name: 'Freigestellt groß ansehen' }).click();
  const ansicht = page.getByRole('dialog', { name: 'Bildansicht' });
  await expect(ansicht.getByRole('img', { name: 'Freigestellt' })).toBeVisible();
  await ansicht.getByRole('button', { name: 'Vorheriges Bild' }).click();
  await expect(ansicht.getByRole('img', { name: 'Original' })).toBeVisible();
  await ansicht.getByRole('button', { name: 'Schließen' }).click();
  await expect(ansicht).toHaveCount(0);
  await karte.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(page.getByText('Übernommen – die freigestellte Version wird gezeigt.')).toBeVisible();
  await expect(page.getByTestId('freistellen-pruefen-fertig')).toBeVisible();
  await expect(page.getByText('Alles erledigt')).toBeVisible();

  // Ansicht „Übernommen“: auswählen und wieder das Original zeigen
  await page.getByRole('tab', { name: 'Übernommen' }).click();
  const uebernommen = page.getByTestId('freistellen-uebernommen-foto');
  await expect(uebernommen).toHaveCount(1);
  await uebernommen.getByRole('checkbox', { name: 'Freistell-Test (E2E) auswählen' }).check();
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('freistellen-zuruecknehmen').click();
  await expect(page.getByText('1 Original wiederhergestellt.')).toBeVisible();
  await expect(page.getByTestId('freistellen-uebernommen-leer')).toBeVisible();
});
