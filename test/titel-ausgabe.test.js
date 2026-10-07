import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titelUndAusgabe } from '../shared/konstanten.js';

test('Ausgaben-Zusatz wird für die Anzeige vom Spieltitel getrennt', () => {
  assert.deepEqual(titelUndAusgabe('Horizon Zero Dawn: Complete Edition'), { titel: 'Horizon Zero Dawn', ausgabe: 'Complete Edition' });
  assert.deepEqual(titelUndAusgabe('Fallout 3 – Game of the Year Edition'), { titel: 'Fallout 3', ausgabe: 'Game of the Year Edition' });
  // Spielnamen und Untertitel bleiben unverändert
  for (const t of ['God of War', 'Mario Kart 8 Deluxe', 'Final Fantasy XII: The Zodiac Age', 'Pokémon Gold']) {
    assert.deepEqual(titelUndAusgabe(t), { titel: t, ausgabe: null });
  }
});
