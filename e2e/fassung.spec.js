// Fassung: übliche Neuauflagen (z. B. Essentials bei PS3) stehen zur Wahl, auch wenn für das Spiel keine Varianten gepflegt sind.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Fassung „Essentials“ bei einem PS3-Spiel ohne Varianten wählen', async ({ page }) => {
  await anmelden(page, 'fassung_e2e');
  await page.goto('/?app=1#/neu/formular?typ=spiel');
  await page.getByLabel('Titel').fill('F1 2014 (E2E)');
  await expect(page.getByLabel('Fassung', { exact: true })).toHaveCount(0);
  await page.getByLabel('Plattform / System').selectOption({ label: 'PlayStation 3 (PS3)' });
  const fassung = page.getByLabel('Fassung', { exact: true });
  await expect(fassung.locator('option')).toHaveText(['Erstauflage / Standard', 'Platinum', 'Essentials']);
  await fassung.selectOption('Essentials');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect.poll(async () => {
    const liste = await (await page.request.get(`/api/artikel?q=${encodeURIComponent('F1 2014')}`)).json();
    return (liste.eintraege ?? liste).find((a) => a.titel === 'F1 2014 (E2E)')?.edition ?? null;
  }).toBe('Essentials');
});

test('Modellnummer: Beispiel und „ⓘ“-Erklärung passen zur Plattform', async ({ page }) => {
  await anmelden(page, 'nummern_e2e');
  await page.goto('/?app=1#/konto');
  await page.getByRole('checkbox', { name: /Beilagen & Seriennummern/ }).check();
  await expect(page.getByText('Gespeichert.')).toBeVisible();
  await page.goto('/?app=1#/neu/formular?typ=spiel');
  await page.getByLabel('Plattform / System').selectOption({ label: 'Nintendo GameCube (GC)' });
  await expect(page.getByLabel('Modellnummer')).toHaveAttribute('placeholder', /DOL-P-GNDD/);
  // Auf dem Handy-Bildschirm liegt der Knopf beim Hineinscrollen unter der festen Knopfleiste – direkt auslösen
  await page.getByTestId('nummern-info').evaluate((knopf) => knopf.click());
  await expect(page.getByTestId('nummern-hilfe')).toContainText('NOE = Deutschland/Österreich');
  // Region aus der Produktnummer vorschlagen und übernehmen; Hilfe am Regionsfeld
  await page.getByLabel('Modellnummer').fill('DOL-GNDD-UKV');
  await expect(page.getByTestId('region-aus-nummer')).toContainText('PAL – UK');
  await page.getByTestId('region-aus-nummer').getByRole('button', { name: 'übernehmen' }).evaluate((knopf) => knopf.click());
  await expect(page.getByLabel('Region', { exact: true })).toHaveValue('pal_uk');
  await expect(page.getByTestId('region-aus-nummer')).toHaveCount(0);
  await page.getByTestId('region-info').evaluate((knopf) => knopf.click());
  await expect(page.getByTestId('region-hilfe')).toContainText('USK');
});

test('Sammlung: Exemplar im Steelbook ist auf der Karte erkennbar', async ({ page }) => {
  await anmelden(page, 'steelbook_e2e');
  await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Far Cry Steel (E2E)', plattform: 'PlayStation 3', modellnummer: 'BLES-01137', beilagen: { steelbook: true } } });
  await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Far Cry Steel (E2E)', plattform: 'PlayStation 3', modellnummer: 'BLES-01137' } });
  await page.goto('/?app=1#/sammlung');
  await expect(page.getByText('Steelbook · BLES-01137')).toHaveCount(1);
  await expect(page.getByText('BLES-01137', { exact: true })).toHaveCount(1);
});

test('Fassung auch bei gewählter Variante (z. B. PAL-DE) – nur bei einer Sonderausgabe nicht', async ({ page }) => {
  await anmelden(page, 'fassung_variante_e2e');
  const eintrag = await (await page.request.post('/api/katalog', { data: { typ: 'spiel', titel: 'Fassungsspiel (E2E)', plattformen: ['PlayStation 3'] } })).json();
  const pal = await (await page.request.post(`/api/katalog/${eintrag.id}/varianten`, { data: { bezeichnung: 'PAL-DE', region: 'pal_de' } })).json();
  const sonder = await (await page.request.post(`/api/katalog/${eintrag.id}/varianten`, { data: { bezeichnung: "Collector's Edition", edition: "Collector's Edition" } })).json();
  const artikel = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: eintrag.titel, katalog_id: eintrag.id, plattform: 'PlayStation 3' } })).json();

  await page.goto(`/?app=1#/artikel/${artikel.id}/bearbeiten`);
  const variante = page.getByLabel('Variante / Revision');
  const fassung = page.getByLabel('Fassung', { exact: true });
  await variante.selectOption(String(sonder.id));
  await expect(fassung).toHaveCount(0);
  await variante.selectOption(String(pal.id));
  await expect(fassung).toBeVisible();
  await fassung.selectOption('Platinum');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(`/api/artikel/${artikel.id}`)).json())).toMatchObject({ variante_id: pal.id, edition: 'Platinum' });
});
