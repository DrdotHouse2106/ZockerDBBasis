// Releasekalender: gleiche Spiele am selben Tag werden zu einer Kachel mit mehreren Plattformen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zusammenfassen } from '../shared/kalender.js';

test('Termine je Spiel und Tag zusammenfassen', () => {
  const k = { id: 1, titel: 'Ace Combat 8' };
  const erg = zusammenfassen([
    { katalog: k, datum: '2026-09-29', plattform_kurz: 'PS5', region: 'Weltweit' },
    { katalog: k, datum: '2026-09-29', plattform_kurz: 'PC', region: 'Weltweit' },
    { katalog: k, datum: '2026-09-29', plattform_kurz: 'XSX', region: 'Weltweit' },
    { katalog: k, datum: '2026-10-15', plattform_kurz: 'Switch', region: 'Europa' },
    { katalog: { id: 2 }, datum: '2026-09-29', plattform: 'PlayStation 5', region: 'Europa' },
  ]);
  assert.equal(erg.length, 3);
  assert.deepEqual(erg[0].plattformen, ['PS5', 'PC', 'XSX']);
  assert.equal(erg[0].region, 'Weltweit');
  assert.deepEqual(erg[1].plattformen, ['Switch']);
  assert.deepEqual(erg[2].plattformen, ['PlayStation 5']);
});
