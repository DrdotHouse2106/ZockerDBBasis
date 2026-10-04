// Vollständigkeit ↔ Beilagen: aus dem einen wird das andere vorbelegt; Anzahlen bleiben erhalten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beilagenAusVollstaendigkeit, vollstaendigkeitAusBeilagen, beilageText } from '../shared/konstanten.js';

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
  // Game-Boy-Modul in der Schutzhülle, Karton fehlt
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: false, inlay: true }), 'mit_huelle');
  assert.deepEqual(beilagenAusVollstaendigkeit('mit_huelle', { anleitung: true }), { anleitung: true, ovp: false, inlay: true });
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: true }), null, 'ohne Angabe zur Anleitung nicht sicher');
  assert.equal(beilageText('Werbebeilagen', 3), '✓ 3× Werbebeilagen');
  assert.equal(beilageText('Poster', false), '✗ Poster');
});
