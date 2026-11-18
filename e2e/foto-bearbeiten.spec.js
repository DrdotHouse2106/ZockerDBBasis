// Falsche Fotoart nachträglich ändern: z. B. „Detail“ gewählt, gemeint war „Figur“.
import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { anmelden } from './hilfen.js';

test('Fotoart eines eigenen Fotos lässt sich am Foto ändern', async ({ page }) => {
  await anmelden(page, 'foto_bearbeiten_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'merch', titel: 'Fotoart-Figur (E2E)' } })).json();
  const bild = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#33aa66' } }).jpeg().toBuffer();
  const r = await page.request.post(`/api/artikel/${a.id}/medien`, { multipart: { art: 'foto_detail', datei: { name: 'figur.jpg', mimeType: 'image/jpeg', buffer: bild } } });
  expect(r.ok()).toBeTruthy();

  await page.goto('/?app=1#/lagerorte');
  await page.evaluate((id) => { window.location.hash = `#/artikel/${id}`; }, a.id);
  const fotos = page.locator('[data-tour="fotos"]');
  await fotos.getByRole('button', { name: 'Foto bearbeiten' }).first().click();
  const formular = fotos.getByTestId('foto-bearbeiten-formular');
  await formular.getByLabel('Fotoart').selectOption('foto_figur');
  await formular.getByLabel('Bezeichnung').fill('Grüne Figur');
  await formular.getByRole('button', { name: 'Speichern' }).click();
  await expect(fotos.getByTestId('foto-bearbeiten-formular')).toHaveCount(0);
  await expect(fotos.getByText('Grüne Figur')).toBeVisible();

  const katalogId = (await (await page.request.get(`/api/artikel/${a.id}`)).json()).katalog_id;
  const medien = await (await page.request.get(`/api/katalog/${katalogId}/medien`)).json();
  expect(medien.map((m) => [m.art, m.titel])).toEqual([['foto_figur', 'Grüne Figur']]);
});

test('Plattform am Foto: wird vom Exemplar übernommen, angezeigt und lässt sich ändern', async ({ page }) => {
  await anmelden(page, 'foto_plattform_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Plattformfoto (E2E)', plattform: 'PlayStation 4' } })).json();
  const bild = await sharp({ create: { width: 600, height: 800, channels: 3, background: '#aa3366' } }).jpeg().toBuffer();
  expect((await page.request.post(`/api/artikel/${a.id}/medien`, { multipart: { art: 'foto_vorne', datei: { name: 'huelle.jpg', mimeType: 'image/jpeg', buffer: bild } } })).ok()).toBeTruthy();

  await page.goto('/?app=1#/lagerorte');
  await page.evaluate((id) => { window.location.hash = `#/artikel/${id}`; }, a.id);
  const fotos = page.locator('[data-tour="fotos"]');
  await expect(fotos.getByTestId('foto-plattform')).toHaveText('Plattform: PS4');
  await fotos.getByRole('button', { name: 'Foto bearbeiten' }).first().click();
  const formular = fotos.getByTestId('foto-bearbeiten-formular');
  await formular.getByLabel('Plattform').selectOption({ label: 'PlayStation 5' });
  await formular.getByRole('button', { name: 'Speichern' }).click();
  // Andere Plattform als das Exemplar: Das Foto gehört nicht mehr dazu und steht unter den weiteren Fotos des Spiels
  await expect(page.getByText(/passt nicht mehr zu diesem Exemplar/)).toBeVisible();
  await expect(fotos.getByTestId('foto-plattform')).toHaveCount(0);
  await fotos.getByTestId('fotos-andere-exemplare').click();
  await expect(fotos.getByTestId('foto-plattform')).toHaveText('Plattform: PS5');
});

test('Fassung am Foto: Hinweis beim Hochladen, Anzeige am Foto und Korrektur', async ({ page }) => {
  await anmelden(page, 'foto_fassung_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Fassungsfoto (E2E)', plattform: 'PlayStation 2', edition: 'Platinum' } })).json();
  const bild = await sharp({ create: { width: 600, height: 800, channels: 3, background: '#888888' } }).jpeg().toBuffer();
  expect((await page.request.post(`/api/artikel/${a.id}/medien`, { multipart: { art: 'foto_vorne', datei: { name: 'platin.jpg', mimeType: 'image/jpeg', buffer: bild } } })).ok()).toBeTruthy();

  await page.goto('/?app=1#/lagerorte');
  await page.evaluate((id) => { window.location.hash = `#/artikel/${id}`; }, a.id);
  const fotos = page.locator('[data-tour="fotos"]');
  await expect(fotos.getByTestId('foto-fassung')).toHaveText('Fassung: Platinum');
  await fotos.getByRole('button', { name: 'Foto bearbeiten' }).first().click();
  const formular = fotos.getByTestId('foto-bearbeiten-formular');
  await expect(formular.getByLabel('Fassung')).toHaveValue('Platinum');
  await formular.getByLabel('Fassung').fill('');
  await formular.getByRole('button', { name: 'Speichern' }).click();
  await expect(fotos.getByTestId('foto-fassung')).toHaveCount(0);
});

test('Leere Verpackung (Nur OVP): Fotos lassen sich beitragen, keine Disc gesucht', async ({ page }) => {
  await anmelden(page, 'foto_huelle_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Hüllenfoto (E2E)', plattform: 'Nintendo GameCube', vollstaendigkeit: 'nur_ovp' } })).json();
  expect(a.bestand).toBe('verpackung');
  await page.goto('/?app=1#/lagerorte');
  await page.evaluate((id) => { window.location.hash = `#/artikel/${id}`; }, a.id);
  const fotos = page.locator('[data-tour="fotos"]');
  const checkliste = fotos.getByRole('list', { name: 'Gesuchte Fotos' });
  await expect(checkliste).toContainText('Verpackung vorne');
  await expect(checkliste).not.toContainText('Disc');
  await expect(fotos.getByTestId('fotos-weg')).toHaveCount(0);
  await checkliste.getByRole('button', { name: /Verpackung vorne/ }).click();
  await expect(fotos.locator('input[type="file"]').first()).toBeAttached();
});
