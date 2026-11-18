// Nummern-Hilfe: passende Beispiele und Erklärungen je Plattform, allgemeiner Rückfall ohne Plattform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nummernHilfe } from '../shared/nummernhilfe.js';

test('Beispiele je Plattform – GameCube nicht mit PlayStation-Nummern', () => {
  assert.match(nummernHilfe('Nintendo GameCube').beispiel, /DOL-P-GNDD/);
  assert.ok(nummernHilfe('Nintendo GameCube').punkte.some((p) => p.includes('NOE')), 'Endung NOE erklärt');
  assert.match(nummernHilfe('PlayStation 3').beispiel, /BLES/);
  assert.match(nummernHilfe('PlayStation').beispiel, /SLES/, 'PS1 nicht mit PS3 verwechselt');
  assert.match(nummernHilfe('Xbox 360').beispiel, /X12-34567/);
  assert.match(nummernHilfe('Wii U').beispiel, /WUP/, 'Wii U vor Wii');
  assert.match(nummernHilfe({ name: 'Nintendo 3DS' }).beispiel, /CTR/);
  assert.match(nummernHilfe('Super Nintendo').beispiel, /SNSP/);
  assert.match(nummernHilfe('').beispiel, /CUSA/, 'ohne Plattform: allgemeine Beispiele');
  assert.match(nummernHilfe('PlayStation 4').druck.beispiel, /8826161/);
  assert.doesNotMatch(nummernHilfe('Nintendo GameCube').druck.beispiel, /8826161/);
});

test('Region aus der Produktnummer: Nintendo-Endung und Spielkennung, PlayStation nur Markt, sonst nichts', async () => {
  const { regionAusProduktnummer: r } = await import('../shared/nummernhilfe.js');
  assert.equal(r('SNSP-MW-NOE').region, 'pal_de');
  assert.equal(r('NUS-NSMP-UKV').region, 'pal_uk');
  assert.equal(r('DOL-P-GNDD').region, 'pal_de');
  assert.equal(r('nus nsmp').region, 'pal_eu');
  // Endung (Verpackung) geht vor dem Sprachbuchstaben
  assert.equal(r('DOL-P-GNDD, DOL-GNDD-FAH').region, 'pal_fr');
  assert.equal(r('BLUS-30001').region, 'ntsc_u');
  assert.equal(r('SLPS-01234').region, 'ntsc_j');
  const eu = r('BLES-01234');
  assert.equal(eu.region, null);
  assert.ok(eu.europa && /USK/.test(eu.hinweis));
  for (const t of ['X12-34567', 'CUSA-03067', 'HAC-P-AAAAA', '', null, '5030936104041']) assert.equal(r(t), null, String(t));
});
