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

test('Preisgeschichte: Erstkauf laut Beleg, eigener Kauf, Beilagen genau', async () => {
  const server = await starteTestServer();
  try {
    const c = await server.registriere('sammler');
    const r = await c.api('/api/artikel', { methode: 'POST', daten: {
      typ: 'spiel', titel: 'Black Flag', neupreis: '59,99', erstkauf_datum: '2026-06-12', erstkauf_quelle: 'Media Markt',
      kaufpreis: '10', kaufdatum: '2026-06', kauf_quelle: 'flohmarkt', beilagen_notiz: 'Uplay-Code-Karte, Werbeflyer',
    } });
    assert.equal(r.status, 201, r.text);
    assert.deepEqual([r.json.neupreis, r.json.erstkauf_datum, r.json.erstkauf_quelle, r.json.kauf_quelle, r.json.beilagen_notiz],
      [59.99, '2026-06-12', 'Media Markt', 'flohmarkt', 'Uplay-Code-Karte, Werbeflyer']);
    const falsch = await c.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'X', erstkauf_datum: '12.6.26', kauf_quelle: 'mond' } });
    assert.equal(falsch.status, 400);
    assert.ok(falsch.json.felder.erstkauf_datum && falsch.json.felder.kauf_quelle);
  } finally {
    await server.stoppe();
  }
});
