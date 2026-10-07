// Vollständigkeit ↔ Beilagen: aus dem einen wird das andere vorbelegt; Anzahlen bleiben erhalten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beilagenAusVollstaendigkeit, vollstaendigkeitAusBeilagen, beilageText } from '../shared/konstanten.js';
import { starteTestServer } from './hilfen.js';

test('Vollständigkeit → Beilagen (andere Beilagen bleiben, Anzahlen auch)', () => {
  assert.deepEqual(beilagenAusVollstaendigkeit('cib', null), { ovp: true, anleitung: true });
  assert.deepEqual(beilagenAusVollstaendigkeit('cib', { beilagen: 3, anleitung: 2 }), { beilagen: 3, anleitung: 2, ovp: true });
  assert.deepEqual(beilagenAusVollstaendigkeit('nur_geraet', { ovp: true, poster: true }), { ovp: false, anleitung: false, poster: true });
  assert.deepEqual(beilagenAusVollstaendigkeit('fehlt_anleitung', {}), { ovp: true, anleitung: false });
  assert.deepEqual(beilagenAusVollstaendigkeit('', { poster: true }), { poster: true }, 'keine Angabe ändert nichts');
});

test('Beilagen → Vollständigkeit', () => {
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: true, anleitung: 2 }), 'cib');
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: true, anleitung: false }), 'fehlt_anleitung');
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: false }), 'nur_geraet');
  // Keine Anleitung beigelegt (gab es nicht, z. B. PS4) → trotzdem komplett; „CIB“ überschreibt das nicht
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: true, anleitung: 'ohne' }), 'cib');
  assert.deepEqual(beilagenAusVollstaendigkeit('cib', { anleitung: 'ohne' }), { anleitung: 'ohne', ovp: true });
  assert.equal(beilageText('Anleitung', 'ohne'), '– Anleitung (nicht beigelegt)');
  // Game-Boy-Modul in der Schutzhülle, Karton fehlt
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: false, inlay: true }), 'mit_huelle');
  assert.deepEqual(beilagenAusVollstaendigkeit('mit_huelle', { anleitung: true }), { anleitung: true, ovp: false, inlay: true });
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: true }), null, 'ohne Angabe zur Anleitung nicht sicher');
  assert.equal(beilageText('Werbebeilagen', 3), '✓ 3× Werbebeilagen');
  assert.equal(beilageText('Poster', false), '✗ Poster');
});

test('Inlay (Cover) löst kein Foto „Beilagen“ aus, andere Beilagen schon', async () => {
  const { gesuchteFotos } = await import('../shared/konstanten.js');
  const ps4 = { kurz: 'PS4', name: 'PlayStation 4' };
  assert.ok(!gesuchteFotos('spiel', ps4, { beilagen: { ovp: true, inlay: true } }).includes('foto_beilagen'));
  assert.ok(gesuchteFotos('spiel', ps4, { beilagen: { ovp: true, inlay: true, poster: true } }).includes('foto_beilagen'));
});

test('Inlay: Beschriftung je Datenträger, eigener Zustand mit Mängeln, Steelbook als Beilage', async () => {
  const { beilagenFuer, hatInlayZustand } = await import('../shared/konstanten.js');
  const label = (p) => beilagenFuer('spiel', p).find((b) => b.value === 'inlay').label;
  assert.equal(label('PlayStation 4'), 'Inlay / Cover-Einleger');
  assert.equal(label('Nintendo 64'), 'Schutzhülle / Einsatz');
  assert.equal(label(null), 'Inlay / Schutzhülle');
  assert.ok(beilagenFuer('spiel').some((b) => b.value === 'steelbook'));
  assert.equal(hatInlayZustand({ typ: 'spiel', plattform: 'PlayStation 2', vollstaendigkeit: 'cib' }), true);
  assert.equal(hatInlayZustand({ typ: 'spiel', plattform: 'Game Boy', vollstaendigkeit: 'cib' }), false);
  assert.equal(hatInlayZustand({ typ: 'spiel', plattform: 'PlayStation 2', vollstaendigkeit: 'nur_geraet' }), false);

  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const r = await anna.api('/api/artikel', { methode: 'POST', daten: {
      typ: 'spiel', titel: 'Gran Turismo 4', plattform: 'PlayStation 2', zustand_inlay: 'gut',
      inlay_maengel: ['wasserschaden', 'quatsch', 'eingerissen'], beilagen: { steelbook: true },
    } });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.zustand_inlay, 'gut');
    assert.equal(r.json.inlay_maengel, 'eingerissen,wasserschaden', 'nur bekannte Mängel, feste Reihenfolge');
    assert.equal(r.json.beilagen.steelbook, true);
    const falsch = await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'X', zustand_inlay: 'kaputt' } });
    assert.equal(falsch.status, 400);
  } finally {
    await server.stoppe();
  }
});

test('„Nur OVP“ ist eine leere Verpackung: nicht in der Sammlung, eigener Filter, zurück bei anderer Vollständigkeit', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const huelle = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Leere Hülle', vollstaendigkeit: 'nur_ovp' } })).json;
    assert.equal(huelle.bestand, 'verpackung');
    await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Echtes Spiel', vollstaendigkeit: 'cib' } });
    assert.deepEqual((await anna.api('/api/artikel')).json.map((a) => a.titel), ['Echtes Spiel']);
    assert.deepEqual((await anna.api('/api/artikel?bestand=verpackung')).json.map((a) => a.titel), ['Leere Hülle']);
    assert.equal((await anna.api('/api/artikel/anzahl')).json.verpackung, 1);
    // Fotos gehen weiterhin (Upload hängt am eigenen Exemplar)
    // Nachträglich doch mit Spiel → wieder in der Sammlung
    const r = await anna.api(`/api/artikel/${huelle.id}`, { methode: 'PUT', daten: { vollstaendigkeit: 'cib' } });
    assert.equal(r.json.bestand, 'besitz');
    const zurueck = await anna.api(`/api/artikel/${huelle.id}`, { methode: 'PUT', daten: { vollstaendigkeit: 'nur_ovp' } });
    assert.equal(zurueck.json.bestand, 'verpackung');
  } finally {
    await server.stoppe();
  }
});
