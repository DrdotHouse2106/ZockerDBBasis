// Konto-Einstellung „Neue Fotos standardmäßig öffentlich zeigen“: Standard aus, nur ausdrücklich (true) einschaltbar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Fotos standardmäßig öffentlich: aus, bis man es im Konto einschaltet', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    assert.equal((await anna.api('/api/konto')).json.fotos_oeffentlich, false, 'Standard: aus');
    assert.equal((await anna.api('/api/konto', { methode: 'PUT', daten: { fotos_oeffentlich: 'ja' } })).json.fotos_oeffentlich, false, 'nur ein echtes true schaltet ein');
    assert.equal((await anna.api('/api/konto', { methode: 'PUT', daten: { fotos_oeffentlich: true } })).json.fotos_oeffentlich, true);
    assert.equal((await anna.api('/api/konto', { methode: 'PUT', daten: { fotos_oeffentlich: false } })).json.fotos_oeffentlich, false);
  } finally {
    await server.stoppe();
  }
});
