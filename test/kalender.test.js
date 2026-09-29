// Releasekalender im Kern: ohne Zusatzmodul und ohne zockerdb.de gibt es keine Termine (verständliche Antwort).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { zeitraum } from '../server/routes/kalender.js';

test('Kalender: Zeitraum wird begrenzt', () => {
  const heute = new Date().toISOString().slice(0, 10);
  const z = zeitraum({});
  assert.equal(z.von, heute);
  assert.ok(z.bis > z.von);
  const lang = zeitraum({ von: heute, bis: '2999-01-01' });
  assert.ok(Date.parse(lang.bis) - Date.parse(lang.von) <= 366 * 86400000);
  assert.equal(zeitraum({ von: 'Unsinn' }).von, heute);
});

test('Kalender: nur angemeldet, ohne Quelle leer mit Hinweis-Kennung', async () => {
  const server = await starteTestServer();
  try {
    assert.equal((await server.client().api('/api/kalender')).status, 401);
    const nutzer = await server.registriere('kalender');
    const r = (await nutzer.api('/api/kalender')).json;
    assert.ok(Array.isArray(r.termine));
    if (r.quelle === null) assert.equal(r.termine.length, 0);
  } finally {
    await server.stoppe();
  }
});
