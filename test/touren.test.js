// Geführte Touren: Stand je Konto („fertig“/„abgelehnt“), Unbekanntes wird verworfen, null setzt zurück.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Tour-Stand am Konto speichern', async () => {
  const server = await starteTestServer();
  try {
    const c = await server.registriere('tourist');
    const stand = async () => (await c.api('/api/auth/status')).json.benutzer.touren;
    assert.deepEqual(await stand(), {});
    const setze = (touren) => c.api('/api/konto', { methode: 'PUT', daten: { touren } });
    assert.equal((await setze({ 'erste-schritte': 'fertig', moderation: 'abgelehnt', 'BÖSE<script>': 'fertig', boerse: 'irgendwas' })).status, 200);
    assert.deepEqual(await stand(), { 'erste-schritte': 'fertig', moderation: 'abgelehnt' });
    await setze({ moderation: null });
    assert.deepEqual(await stand(), { 'erste-schritte': 'fertig' });
    await setze(['kein', 'objekt']);
    assert.deepEqual(await stand(), { 'erste-schritte': 'fertig' });
    // Datenauskunft enthält den Stand
    assert.deepEqual((await c.api('/api/export/datenauskunft.json')).json.konto.touren, { 'erste-schritte': 'fertig' });
  } finally {
    await server.stoppe();
  }
});
