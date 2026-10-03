// Drucknummer des Covers (z. B. „8826161“ unter der CUSA-Nummer): speichern, prüfen, suchen, exportieren.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { pruefeArtikel } from '../server/services/validierung.js';
import { AUSBLENDBARE_FELDER } from '../shared/konstanten.js';

test('Drucknummer: höchstens 40 Zeichen, im Konto ausblendbar', () => {
  assert.equal(pruefeArtikel({ typ: 'spiel', titel: 'X', drucknummer: ' 8826161 ' }).drucknummer, '8826161');
  assert.throws(() => pruefeArtikel({ typ: 'spiel', titel: 'X', drucknummer: '1'.repeat(41) }));
  assert.ok(AUSBLENDBARE_FELDER.some((f) => f.value === 'drucknummer'));
});

test('Drucknummer am Exemplar: gespeichert, durchsuchbar, im Export', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const a = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Agents of Mayhem', modellnummer: 'CUSA-03067', drucknummer: '8826161' } })).json;
    assert.equal(a.drucknummer, '8826161');
    assert.deepEqual((await anna.api('/api/artikel?q=8826161')).json.map((x) => x.id), [a.id]);
    assert.equal((await anna.api(`/api/artikel/${a.id}`, { methode: 'PUT', daten: { drucknummer: '' } })).json.drucknummer, null);
    await anna.api(`/api/artikel/${a.id}`, { methode: 'PUT', daten: { drucknummer: '8826162' } });
    const csv = (await anna.api('/api/export.csv')).text;
    assert.match(csv, /Drucknummer \(Cover\)/);
    assert.match(csv, /8826162/);
  } finally {
    await server.stoppe();
  }
});
