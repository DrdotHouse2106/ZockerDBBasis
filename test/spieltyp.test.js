// Spieltyp aus IGDB: Hauptspiele vor Bundles und Zusatzinhalten – beim Barcode-Scan und in der Katalogsuche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangiereTreffer, suchbegriffe } from '../server/services/titel.js';
import { spielZuEintrag } from '../server/services/igdb.js';
import { NEBENTYPEN } from '../server/services/katalog.js';
import { starteTestServer } from './hilfen.js';

test('Spieltyp aus IGDB übernehmen', () => {
  assert.equal(spielZuEintrag({ id: 1, name: 'X', game_type: { type: 'Bundle' } }).spieltyp, 'bundle');
  assert.equal(spielZuEintrag({ id: 1, name: 'X', game_type: { type: 'Main Game' } }).spieltyp, 'main_game');
  assert.equal(spielZuEintrag({ id: 1, name: 'X' }).spieltyp, null);
});

test('Bundle mit gleich gut passendem Titel steht hinter dem Hauptspiel, ein genau passendes Bundle vor nur ähnlichen Titeln', () => {
  const begriffe = suchbegriffe("Assassin's Creed 4: Black Flag - Bonus Edition - Ps3 Boxed + Instructions B1393", 20);
  const liste = rangiereTreffer([
    { titel: "Assassin's Creed IV: Black Flag - Bonus Edition", spieltyp: 'bundle' },
    { titel: "Assassin's Creed IV: Black Flag", spieltyp: 'main_game' },
  ], begriffe, null, NEBENTYPEN);
  assert.equal(liste[0].spieltyp, 'main_game');
  const trilogie = rangiereTreffer([
    { titel: "Assassin's Creed", spieltyp: 'main_game' },
    { titel: 'Ezio Trilogy', spieltyp: 'bundle' },
  ], suchbegriffe('Ezio Trilogy PS3'), null, NEBENTYPEN);
  assert.equal(trilogie[0].titel, 'Ezio Trilogy');
});

test('Katalogsuche: bei gleichem Anfang Hauptspiel vor Bundle', async () => {
  const server = await starteTestServer();
  try {
    const c = await server.registriere('admin');
    for (const [titel, typ] of [['Black Flag Collection', 'bundle'], ['Black Flag Saga', 'main_game']]) {
      const e = (await c.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel, veroeffentlichen: true } })).json;
      server.db.prepare("UPDATE katalog SET quelle = 'igdb', externe_id = ?, spieltyp = ?, erstellt_von = NULL WHERE id = ?").run(`game:${e.id}`, typ, e.id);
    }
    const r = (await c.api('/api/katalog/suche?q=Black%20Flag')).json;
    assert.deepEqual(r.lokal.map((e) => e.titel), ['Black Flag Saga', 'Black Flag Collection']);
  } finally {
    await server.stoppe();
  }
});
