// Offlinemodus: Sammlung ohne Verbindung lesbar, Änderungen landen in der Warteschlange und werden danach übertragen.
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

test('Offline: Sammlung lesbar, Spielstatus offline setzen, danach automatisch übertragen', async ({ page, context }) => {
  await anmelden(page, 'offline_e2e');
  const a = await (await page.request.post('/api/artikel', { data: { typ: 'spiel', titel: 'Offline-Abenteuer' } })).json();

  // Online: App laden, bis der Service-Worker die Seite steuert, dann Sammlung und Exemplar einmal ansehen (füllt den Zwischenspeicher)
  await page.goto('/?app=1#/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByText('Offline-Abenteuer')).toBeVisible();
  await page.goto(`/?app=1#/artikel/${a.id}`);
  await expect(page.getByLabel('Spielstatus')).toBeVisible();
  await page.goto('/?app=1#/');
  await expect(page.getByText('Offline-Abenteuer')).toBeVisible();

  // Verbindung weg: App startet trotzdem, zeigt die zuletzt geladenen Daten und den Hinweis
  // (setOffline wirkt in Chromium nicht auf den Service-Worker – daher zusätzlich alle Anfragen ins Netz abbrechen)
  await context.setOffline(true);
  const kappen = (route) => route.abort('internetdisconnected');
  await context.route('**/*', kappen);
  await page.reload();
  await expect(page.getByText(/Offline – du siehst die zuletzt geladenen Daten/)).toBeVisible();
  await expect(page.getByText('Offline-Abenteuer')).toBeVisible();

  // Offline-Suche nur in den geladenen Daten
  await page.getByRole('searchbox').first().fill('abenteuer');
  await expect(page.getByText('Offline – Suche und Filter nur in den zuletzt geladenen Daten.')).toBeVisible();

  // Änderung offline: landet in der Warteschlange
  await page.goto(`/?app=1#/artikel/${a.id}`);
  await page.getByLabel('Spielstatus').selectOption('durchgespielt');
  await expect(page.getByText(/1 Änderung wartet/)).toBeVisible();

  // Verbindung zurück: wird automatisch übertragen
  await context.unroute('**/*', kappen);
  await context.setOffline(false);
  await expect.poll(async () => (await (await page.request.get(`/api/artikel/${a.id}`)).json()).spielstatus, { timeout: 15_000 }).toBe('durchgespielt');
  await expect(page.getByText(/Änderung wartet|Änderungen warten/)).toHaveCount(0);
});
