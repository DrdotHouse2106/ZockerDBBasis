// Vorab normalisierter Suchtext im Katalog: Trigger halten ihn bei neuen und geänderten Titeln aktuell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oeffneDatenbank } from '../server/db.js';
import { erstelleKatalogDienst } from '../server/services/katalog.js';

test('Suchtext: neu, umbenannt, Originaltitel und frühere Titel werden gefunden', () => {
  const db = oeffneDatenbank(':memory:');
  const katalog = erstelleKatalogDienst(db, {});
  const id = db.prepare("INSERT INTO katalog (quelle, typ, titel, titel_original, plattformen, status) VALUES ('eigen', 'spiel', ?, ?, '[]', 'freigegeben') RETURNING id")
    .pluck().get("Assassin's Creed IV: Black Flag", 'AC4');
  const finde = (text) => katalog.sucheLokal(text, 'spiel', { id: 1 }).map((k) => k.id);
  assert.deepEqual(finde('assassins black flag 4'), [id]);
  assert.deepEqual(finde('ac4'), [id]);
  db.prepare('UPDATE katalog SET titel = ?, weitere_titel = ? WHERE id = ?').run('FIFA 12', JSON.stringify(['FIFA Soccer 12']), id);
  assert.deepEqual(finde('black flag'), []);
  assert.deepEqual(finde('fifa 12'), [id]);
  assert.deepEqual(finde('soccer'), [id]);
  assert.deepEqual(finde('fiffa'), [id], 'Tippfehler über die Vorauswahl im Suchtext');
});
