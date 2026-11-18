// Figurenserien: Monster in my Pocket (Unterserien) vorhanden, Figur anlegen, Farben pflegen (– → x → R), per Antippen sammeln, Anzeige in der Sammlung.
import { test, expect } from '@playwright/test';
import { fehlerSammeln, keinQuerScrollen, anmelden } from './hilfen.js';

test('Figurenserie: Figur erfassen, Farben pflegen, sammeln', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, 'admin'); // erstes Konto = Administrator (darf freigegebene Serien pflegen)
  await page.goto('/?app=1#/serien');
  const mimp = page.getByTestId('serie').filter({ hasText: 'Monster in my Pocket' });
  await expect(mimp).toBeVisible();
  await mimp.getByRole('link', { name: /Serie 7 – Space Aliens/ }).click();
  await expect(page.getByTestId('serie-kopf')).toContainText('#169–#184');
  await expect(page.getByTestId('figur-leer')).toHaveCount(16);
  await keinQuerScrollen(page);

  // Farben der Unterserie hinterlegen
  await page.getByRole('button', { name: 'Angaben bearbeiten' }).click();
  await page.getByTestId('serie-formular').getByRole('textbox', { name: /Farben/ }).fill('Grün #33aa33\nRot');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('figuren-filter').getByRole('button', { name: 'Grün' })).toBeVisible();

  // Figur für #169 anlegen
  await page.getByTestId('figur-leer').first().getByRole('button', { name: '+ anlegen' }).click();
  await page.getByTestId('neue-figur').getByRole('textbox', { name: 'Name der Figur' }).fill(`Testalien ${Date.now() % 1000}`);
  await page.getByTestId('neue-figur').getByRole('button', { name: 'OK' }).click();
  const zeile = page.getByTestId('figur-karte').first();
  await expect(zeile).toContainText('Testalien');
  // Name führt zur Seite der Figur, dort steht die Serie
  await zeile.getByTestId('figur-name').click();
  await expect(page.getByTestId('katalog-serie')).toContainText('Monster in my Pocket · Serie 7 – Space Aliens · #169');
  await page.goBack();

  // Farben pflegen: Antippen markiert nur (nochmal tippen = zurück), erst „Speichern“ übernimmt
  await page.getByTestId('modus-pflegen').click();
  await zeile.getByRole('button', { name: /Grün: gab es nicht/ }).click();
  await expect(zeile.getByRole('button', { name: /Grün: gab es nicht – wird hinzugefügt/ })).toHaveText('+');
  await zeile.getByRole('button', { name: /Rot: gab es nicht/ }).click();
  await zeile.getByRole('button', { name: /Rot: gab es nicht – wird hinzugefügt/ }).click();
  await expect(zeile.getByRole('button', { name: /Rot: gab es nicht$/ })).toBeVisible();
  await expect(page.getByTestId('entwurf-leiste')).toContainText('1 Änderung');
  await zeile.getByRole('button', { name: /Rot: gab es nicht/ }).click();
  await page.getByTestId('entwurf-speichern').click();
  await expect(page.getByTestId('entwurf-leiste')).toHaveCount(0);
  await expect(zeile.getByRole('button', { name: /Grün: gibt es/ })).toBeVisible();
  await expect(zeile.getByRole('button', { name: /Rot: gibt es/ })).toBeVisible();
  // Entfernen fragt nach – Abbrechen ändert nichts
  await zeile.getByRole('button', { name: /Rot: gibt es/ }).click();
  await expect(zeile.getByRole('button', { name: /Rot: gibt es – wird entfernt/ })).toHaveText('−');
  page.once('dialog', (d) => d.dismiss());
  await page.getByTestId('entwurf-speichern').click();
  await expect(zeile.getByRole('button', { name: /Rot: gibt es – wird entfernt/ })).toBeVisible();
  await page.getByRole('button', { name: 'Verwerfen' }).click();
  await expect(zeile.getByRole('button', { name: /Rot: gibt es$/ })).toBeVisible();

  // Ansehen: Punkte sind nur Anzeige
  await page.getByTestId('serien-modus').getByRole('button', { name: 'Ansehen' }).click();
  await expect(zeile.getByRole('img', { name: /Grün: gibt es/ })).toBeVisible();
  await expect(zeile.getByRole('button', { name: /Grün/ })).toHaveCount(0);

  // Sammeln: Grün antippen → in der Sammlung, Fortschritt steigt
  await page.getByTestId('modus-sammeln').click();
  await zeile.getByRole('button', { name: /Grün: gibt es/ }).click();
  await expect(zeile.getByRole('button', { name: /Grün: in deiner Sammlung/ })).toHaveText('✓');
  await expect(page.getByTestId('serie-kopf')).toContainText('1 von 16 Figuren · 1 von 2 Farben');

  // Liste einfügen: weitere Figuren mit Farben in Spaltenreihenfolge
  await page.getByTestId('liste-einfuegen').getByText('Liste einfügen').click();
  await page.getByTestId('liste-einfuegen').getByRole('textbox', { name: 'Liste' }).fill('170; Listenalien; R x');
  await page.getByTestId('liste-einfuegen').getByRole('button', { name: 'Einfügen' }).click();
  await expect(page.getByTestId('liste-einfuegen').getByRole('status')).toContainText('1 neue Figuren, 0 ergänzt, 2 Farben gesetzt.');
  const zweite = page.getByTestId('figur-karte').nth(1);
  await expect(zweite).toContainText('Listenalien');
  await expect(zweite.getByRole('button', { name: /Grün: gibt es/ })).toBeVisible();

  // Filter: „Habe ich“ zeigt nur die gesammelte Figur, „Fehlt mir“ in Rot nur die mit fehlendem Rot
  await page.getByTestId('figuren-filter').getByRole('button', { name: 'Habe ich' }).click();
  await expect(page.getByTestId('figur-karte')).toHaveCount(1);
  await page.getByTestId('figuren-filter').getByRole('button', { name: 'Fehlt mir' }).click();
  await page.getByTestId('figuren-filter').getByRole('button', { name: 'Rot' }).click();
  await expect(page.getByTestId('figur-karte')).toHaveCount(2);
  await expect(page.getByTestId('figur-leer')).toHaveCount(0);
  await page.getByTestId('figuren-filter').getByRole('button', { name: 'Alle' }).click();

  // In der Sammlung: Filter nach Serie, Karte zeigt die Serie
  await page.getByRole('link', { name: 'In meiner Sammlung' }).click();
  await expect(page.getByTestId('serien-filter')).toBeVisible();
  await expect(page.getByTestId('karte-serie').first()).toHaveText('Monster in my Pocket · Serie 7 – Space Aliens · #169');
  expect(fehler).toEqual([]);
});

test('Serie ohne Farben (z. B. Funko Pop!): Figur mit einem Knopf in die Sammlung', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, `funko_${Date.now() % 100000}`);
  const serie = await (await page.request.post('/api/serien', { data: { name: 'Funko Pop! Test', nummer_praefix: '#' } })).json();
  await page.request.post(`/api/serien/${serie.id}/figuren`, { data: { nummer: '42', titel: 'Testfigur' } });
  await page.goto(`/?app=1#/serien/${serie.id}`);
  const karte = page.getByTestId('figur-karte').first();
  await expect(karte).toContainText('Testfigur');
  await expect(page.getByTestId('modus-pflegen')).toHaveCount(0);
  // Standard „Ansehen“: kein Knopf, der sich beim Scrollen aus Versehen antippen ließe
  await expect(karte.getByTestId('figur-sammeln')).toHaveCount(0);
  await page.getByTestId('modus-sammeln').click();
  // Versehentlich übernommen? „Rückgängig“ im Hinweis
  await karte.getByTestId('figur-sammeln').click();
  await expect(karte.getByTestId('figur-besitz')).toBeVisible();
  await page.getByTestId('hinweis-aktion').click();
  await expect(karte.getByTestId('figur-sammeln')).toBeVisible();
  await karte.getByTestId('figur-sammeln').click();
  await expect(karte.getByTestId('figur-besitz')).toBeVisible();
  await expect(page.getByTestId('serie-kopf')).toContainText('1 von 1 Figuren');
  expect(fehler).toEqual([]);
});


test('Tour „Figurenserien“: Angebot auf der Serienseite, alle Ziele vorhanden', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, `figurentour_${Date.now() % 100000}`);
  await page.goto('/?app=1#/serien');
  await page.locator('[data-tour-angebot="figurenserien"]').getByRole('button', { name: 'Tour starten' }).click();
  const blase = page.getByRole('dialog');
  const ziele = { 'Deine Figurenserien': 'serien-liste', Unterserien: 'serie-unterserien', 'Eine Unterserie': 'serie-kopf', 'Ansehen, Sammeln, Pflegen': 'serien-modus',
    'Farbpunkte und Filter': 'figuren-filter', 'Fehlt eine Figur?': 'figur-anlegen', 'Eigene Serie anlegen': 'serie-neu' };
  const gesehen = [];
  for (let i = 0; i < 15; i++) {
    const titel = (await blase.locator('#tour-titel').textContent()).trim();
    const ziel = Object.entries(ziele).find(([t]) => titel.startsWith(t))?.[1];
    if (ziel) { await expect(page.locator(`[data-tour="${ziel}"]`).first()).toBeVisible(); gesehen.push(ziel); }
    const weiter = blase.getByRole('button', { name: /^(Weiter|Fertig)$/ });
    const fertig = (await weiter.textContent()) === 'Fertig';
    await weiter.click();
    if (fertig) break;
    await expect(blase.locator('#tour-titel')).not.toHaveText(titel);
  }
  expect(gesehen).toEqual(Object.values(ziele));
  await expect(blase).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get('/api/auth/status')).json()).benutzer.touren.figurenserien).toBe('fertig');
  expect(fehler).toEqual([]);
});

test('Meine Serien: eigene oben, Weitere eingeklappt, mit ☆ folgen', async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await anmelden(page, `folger_${Date.now() % 100000}`);
  await page.request.post('/api/serien', { data: { name: 'Meine Testserie' } });
  await page.goto('/?app=1#/serien');
  await expect(page.getByRole('heading', { name: 'Meine Serien' })).toBeVisible();
  await expect(page.getByTestId('serie').first()).toContainText('Meine Testserie');
  const weitere = page.getByTestId('weitere-serien');
  const mimp = weitere.getByTestId('serie').filter({ hasText: 'Monster in my Pocket' });
  await expect(mimp).toBeHidden();
  await weitere.getByText(/^Weitere Serien/).click();
  await mimp.getByRole('button', { name: 'Monster in my Pocket: folgen' }).click();
  // Jetzt oben bei „Meine Serien“ mit ★
  const oben = page.getByTestId('serie').filter({ hasText: 'Monster in my Pocket' }).first();
  await expect(oben.getByRole('button', { name: 'Monster in my Pocket: nicht mehr folgen' })).toHaveText('★');
  await expect(weitere.getByTestId('serie').filter({ hasText: 'Monster in my Pocket' })).toHaveCount(0);
  await keinQuerScrollen(page);
  expect(fehler).toEqual([]);
});
