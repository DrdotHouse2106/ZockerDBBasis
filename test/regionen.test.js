// Genauere PAL-Fassungen (UK, FR, Benelux …): Auswahl, Filter „PAL (EU)“ schließt sie ein, CSV-Import erkennt sie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { REGIONEN, regionUmfang, beschriftung } from '../shared/konstanten.js';
import { regionVon } from '../server/services/csvimport.js';
import { pruefeArtikel } from '../server/services/validierung.js';

test('Unterregionen: Umfang, Beschriftung, Prüfung, CSV-Erkennung', () => {
  assert.deepEqual(regionUmfang('pal_eu').sort(), ['pal_at', 'pal_benelux', 'pal_es', 'pal_eu', 'pal_fr', 'pal_it', 'pal_nordic', 'pal_uk']);
  assert.deepEqual(regionUmfang('pal_benelux'), ['pal_benelux']);
  assert.deepEqual(regionUmfang('pal_de'), ['pal_de'], 'PAL-DE bleibt eigenständig');
  assert.equal(beschriftung(REGIONEN, 'pal_benelux', 'kurz'), 'PAL-BNL');
  assert.equal(pruefeArtikel({ typ: 'spiel', titel: 'X', region: 'pal_benelux' }).region, 'pal_benelux');
  assert.equal(regionVon('UK'), 'pal_uk');
  assert.equal(regionVon('PAL Benelux'), 'pal_benelux');
  assert.equal(regionVon('Österreich'), 'pal_at');
  assert.equal(regionVon('PAL'), 'pal_eu');
  assert.equal(regionVon('Deutschland'), 'pal_de');
});

test('Sammlung: Filter „PAL (EU)“ findet auch Benelux und UK, „Benelux“ nur Benelux', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    for (const [titel, region] of [['Odyssey BNL', 'pal_benelux'], ['Odyssey UK', 'pal_uk'], ['Odyssey EU', 'pal_eu'], ['Odyssey DE', 'pal_de']]) {
      await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel, region } });
    }
    const titel = async (region) => (await anna.api(`/api/artikel?region=${region}`)).json.map((a) => a.titel).sort();
    assert.deepEqual(await titel('pal_eu'), ['Odyssey BNL', 'Odyssey EU', 'Odyssey UK']);
    assert.deepEqual(await titel('pal_benelux'), ['Odyssey BNL']);
    assert.deepEqual(await titel('pal_de'), ['Odyssey DE']);
  } finally {
    await server.stoppe();
  }
});
