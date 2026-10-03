// Zustand der Hülle/OVP getrennt vom Datenträger; ausblendbare Formularfelder am Konto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Zustand Hülle/OVP und ausgeblendete Felder', async () => {
  const server = await starteTestServer();
  try {
    const c = await server.registriere('sammler');
    const a = (await c.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Black Flag', zustand: 'sehr_gut', zustand_ovp: 'akzeptabel' } })).json;
    assert.deepEqual([a.zustand, a.zustand_ovp], ['sehr_gut', 'akzeptabel']);
    assert.equal((await c.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'X', zustand_ovp: 'kaputt' } })).status, 400);

    // Nur bekannte Felder, doppelte zählen einmal
    const r = await c.api('/api/konto', { methode: 'PUT', daten: { ausgeblendete_felder: ['seriennummer', 'seriennummer', 'passwort_hash', 'farbe'] } });
    assert.deepEqual(r.json.ausgeblendete_felder, ['seriennummer', 'farbe']);
    assert.deepEqual((await c.api('/api/auth/status')).json.benutzer.ausgeblendete_felder, ['seriennummer', 'farbe']);
    assert.deepEqual((await c.api('/api/konto', { methode: 'PUT', daten: { ausgeblendete_felder: [] } })).json.ausgeblendete_felder, []);
  } finally {
    await server.stoppe();
  }
});
