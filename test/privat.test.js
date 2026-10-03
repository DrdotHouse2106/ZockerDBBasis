// Private Exemplare (Kern): Schalter am Exemplar, im geteilten Link nicht enthalten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { pruefeArtikel } from '../server/services/validierung.js';

test('Privat-Schalter: aus Formularwerten gelesen, Standard aus', () => {
  const basis = { typ: 'spiel', titel: 'X' };
  assert.equal(pruefeArtikel(basis).privat, 0);
  for (const wert of [true, 1, '1', 'true', 'on']) assert.equal(pruefeArtikel({ ...basis, privat: wert }).privat, 1);
  assert.equal(pruefeArtikel({ ...basis, privat: 'false' }).privat, 0);
  assert.equal(pruefeArtikel({ titel: 'Y' }, true).privat, undefined, 'teilweise Änderung lässt das Feld unberührt');
});

test('Private Exemplare fehlen im geteilten Link, Wert und Stückzahl zählen sie nicht', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Offenes Spiel', marktwert: 10 } });
    const geheim = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Geheimes Spiel', marktwert: 90, privat: true } })).json;
    assert.equal(geheim.privat, 1);
    const freigabe = (await anna.api('/api/konto/freigabe', { methode: 'POST', daten: { wert_zeigen: true } })).json;
    const html = (await server.client().api(freigabe.pfad, { headers: { accept: 'text/html' } })).text;
    assert.match(html, /Offenes Spiel/);
    assert.doesNotMatch(html, /Geheimes Spiel/);
    assert.doesNotMatch(html, /100,00/, 'der Wert des privaten Spiels fließt nicht ein');
    // Bearbeiten: wieder öffentlich
    assert.equal((await anna.api(`/api/artikel/${geheim.id}`, { methode: 'PUT', daten: { privat: false } })).json.privat, 0);
    assert.match((await server.client().api(freigabe.pfad, { headers: { accept: 'text/html' } })).text, /Geheimes Spiel/);
  } finally {
    await server.stoppe();
  }
});
