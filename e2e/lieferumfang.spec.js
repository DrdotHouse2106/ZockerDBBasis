// Lieferumfang je Ausgabe: Anzeige bei der Variante, Beilagen-Checkliste mit genau diesen Punkten, „Vollständig (CIB)“ bzw. „Unvollständig – Artbook fehlt“.
import { test, expect } from '@playwright/test';
import { anmelden, fehlerSammeln } from './hilfen.js';

test('Ausgabe mit Lieferumfang: Checkliste zeigt die Punkte sofort, CIB nur mit allem', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'admin');
  const eintrag = await (await page.request.post('/api/katalog', {
    data: { typ: 'spiel', titel: 'Lieferumfang-Spiel (E2E)', plattformen: ['PlayStation 5'], veroeffentlichen: true },
  })).json();
  const variante = await (await page.request.post(`/api/katalog/${eintrag.id}/varianten`, {
    data: { bezeichnung: 'Special Edition', lieferumfang: { zweite_disc: 1, artbook: 1, schuber: 1, steelbook: 1, code: 1 }, veroeffentlichen: true },
  })).json();

  // Anzeige bei der Variante auf der Spieleseite
  await page.goto(`/?app=1#/katalog/${eintrag.id}`);
  await expect(page.getByTestId('lieferumfang-text')).toHaveText('Lieferumfang: Steelbook, Artbook, Schuber, 2 Discs, DLC-Code');

  // Checkliste einschalten (Konto → Zusatzfelder)
  await page.goto('/?app=1#/konto');
  const beilagenAn = page.getByRole('checkbox', { name: /Beilagen & Seriennummern/ });
  await expect(beilagenAn).toBeVisible();
  if (!(await beilagenAn.isChecked())) {
    await beilagenAn.check();
    await expect(page.getByText('Gespeichert.')).toBeVisible();
  }

  // Neues Exemplar dieser Ausgabe: alle Punkte stehen sofort da, ohne die Sonderausgabe aufzuklappen
  await page.goto(`/?app=1#/neu/formular?katalog=${eintrag.id}&typ=spiel&variante=${variante.id}`);
  const hinweis = page.getByTestId('lieferumfang-hinweis');
  await expect(hinweis).toContainText('Lieferumfang dieser Ausgabe: Steelbook, Artbook, Schuber, 2 Discs, DLC-Code');
  for (const name of ['Steelbook', 'Artbook', 'Schuber / Sammlerbox', 'Zweite Disc / Data Disc', 'Download-/DLC-Code (unbenutzt)']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Soundtrack', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('lieferumfang-stand')).toHaveCount(0); // noch nichts eingetragen: keine Aussage

  // Ein Tipp: alles vorhanden → Vollständig (CIB)
  await page.getByTestId('lieferumfang-alles').click();
  await expect(page.getByTestId('lieferumfang-stand')).toHaveText('Vollständig (CIB)');
  await expect(page.getByLabel('Vollständigkeit')).toHaveValue('cib');

  // Artbook fehlt: einmal antippen = fehlt
  await page.getByRole('button', { name: '✓ Artbook', exact: true }).click();
  await expect(page.getByTestId('lieferumfang-stand')).toHaveText('Unvollständig – Artbook fehlt');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();

  // Das Exemplar nennt den Stand
  await expect(page.getByText(/Unvollständig – Artbook fehlt – /)).toBeVisible();
  expect(fehler).toEqual([]);
});

test('Ohne Lieferumfang bleibt die Checkliste wie bisher', async ({ page }) => {
  await anmelden(page, 'admin');
  const eintrag = await (await page.request.post('/api/katalog', {
    data: { typ: 'spiel', titel: 'Normales Spiel (E2E)', plattformen: ['PlayStation 5'], veroeffentlichen: true },
  })).json();
  const variante = await (await page.request.post(`/api/katalog/${eintrag.id}/varianten`, { data: { bezeichnung: 'Standard', veroeffentlichen: true } })).json();
  await page.goto(`/?app=1#/neu/formular?katalog=${eintrag.id}&typ=spiel&variante=${variante.id}`);
  await expect(page.getByRole('button', { name: 'OVP / Hülle', exact: true })).toBeVisible();
  await expect(page.getByTestId('lieferumfang-hinweis')).toHaveCount(0);
  await expect(page.getByTestId('beilagen-sonder')).toBeVisible();
});

test('Lieferumfang vorschlagen: Formular an der Variante', async ({ page }) => {
  await anmelden(page, 'admin');
  const eintrag = await (await page.request.post('/api/katalog', {
    data: { typ: 'spiel', titel: 'Vorschlag-Spiel (E2E)', plattformen: ['PlayStation 5'], veroeffentlichen: true },
  })).json();
  await page.request.post(`/api/katalog/${eintrag.id}/varianten`, { data: { bezeichnung: 'Collector\'s Edition', veroeffentlichen: true } });
  await page.request.post('/api/auth/abmelden');
  await anmelden(page, 'sammler_lu_e2e');
  await page.goto(`/?app=1#/katalog/${eintrag.id}`);
  await page.getByRole('button', { name: 'Lieferumfang vorschlagen' }).click();
  const form = page.getByTestId('lieferumfang-vorschlag');
  await expect(form.getByRole('button', { name: 'Vorschlag senden' })).toBeDisabled();
  // Auf dem Handy-Bildschirm liegen Chips und Knopf knapp unter der festen Navigation, und solange die Seite nachlädt,
  // verschiebt sich das Formular – deshalb direkt auslösen und das Ergebnis prüfen
  await form.getByRole('button', { name: 'Artbook', exact: true }).evaluate((knopf) => knopf.click());
  await expect(form.getByRole('button', { name: '✓ Artbook', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await form.getByRole('button', { name: 'Steelbook', exact: true }).evaluate((knopf) => knopf.click());
  await expect(form.getByRole('button', { name: '✓ Steelbook', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await form.getByRole('button', { name: 'Vorschlag senden' }).evaluate((knopf) => knopf.click());
  await expect(page.getByText('Die Moderation prüft deinen Vorschlag.')).toBeVisible();
  // noch nicht übernommen
  await expect(page.getByTestId('lieferumfang-text')).toHaveCount(0);
});
