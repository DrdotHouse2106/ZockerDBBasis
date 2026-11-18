// Vierter Artikeltyp „Merch“: Validierung, Migration, Verknüpfung mit einem Spiel, Filter, Statistik, Export/Import.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { oeffneDatenbank } from '../server/db.js';
import { merchVerpackung, merchVerpackungAnwenden, ARTIKELTYPEN, MERCH_KATEGORIEN } from '../shared/konstanten.js';

let server;
let nutzer;
let spielId;
before(async () => {
  server = await starteTestServer();
  nutzer = await server.registriere('merchsammler');
  // Der erste registrierte Benutzer ist Administrator und darf Katalogeinträge direkt freigeben
  const k = await nutzer.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel: 'Zelda Merch-Test', plattformen: ['Nintendo Switch'], veroeffentlichen: true } });
  spielId = k.json.id;
});
after(async () => { await server.stoppe(); });

test('Typ, Kategorien und Verpackung sind definiert', () => {
  assert.deepEqual(ARTIKELTYPEN.find((t) => t.value === 'merch'), { value: 'merch', label: 'Merch', mehrzahl: 'Merch', icon: '🧸', beschreibung: 'Merch & Sammlerstücke' });
  assert.deepEqual(MERCH_KATEGORIEN.map((k) => k.value), ['spielfigur', 'karte', 'figur', 'buch', 'musik', 'kleidung', 'promo']);
  assert.equal(merchVerpackung({ zustand: 'neu_ovp', vollstaendigkeit: 'cib' }), 'ungeoeffnet');
  assert.equal(merchVerpackung({ zustand: 'gut', vollstaendigkeit: 'cib' }), 'geoeffnet');
  assert.equal(merchVerpackung({ zustand: 'gut', vollstaendigkeit: 'nur_geraet' }), 'lose');
  assert.equal(merchVerpackungAnwenden('lose', {}).vollstaendigkeit, 'nur_geraet');
});

test('Migration: Spalten für Merch sind angelegt', () => {
  const db = oeffneDatenbank(':memory:');
  const spalten = db.prepare('PRAGMA table_info(artikel)').all().map((s) => s.name);
  assert.ok(spalten.includes('merch_kategorie'));
  assert.ok(spalten.includes('spiel_katalog_id'));
  db.close();
});

test('Funko Pop ohne Plattform anlegen, Validierung und Verknüpfung', async () => {
  const ok = await nutzer.api('/api/artikel', {
    methode: 'POST',
    daten: { typ: 'merch', titel: 'Funko Pop Link', merch_kategorie: 'figur', modellnummer: '#335', edition: 'Exclusive', zustand: 'neu_ovp', vollstaendigkeit: 'cib', spiel_katalog_id: spielId, kaufpreis: '14,99' },
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.plattform_id, null);
  assert.equal(ok.json.merch_kategorie, 'figur');
  assert.equal(ok.json.spiel_titel, 'Zelda Merch-Test');

  const falsch = await nutzer.api('/api/artikel', { methode: 'POST', daten: { typ: 'merch', titel: 'X', merch_kategorie: 'unsinn' } });
  assert.equal(falsch.status, 400);
  const keinSpiel = await nutzer.api('/api/artikel', { methode: 'POST', daten: { typ: 'merch', titel: 'Y', spiel_katalog_id: 999999 } });
  assert.equal(keinSpiel.status, 400);

  // Bei anderen Typen werden Kategorie und Verknüpfung verworfen
  const spiel = await nutzer.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Tetris', plattform: 'Game Boy', merch_kategorie: 'figur', spiel_katalog_id: spielId } });
  assert.equal(spiel.json.merch_kategorie, null);
  assert.equal(spiel.json.spiel_katalog_id, null);
});

test('Filter, Suche, Sortierung und Statistik laufen mit plattform_id = null', async () => {
  await nutzer.api('/api/artikel', { methode: 'POST', daten: { typ: 'merch', titel: 'Amiibo Mario', merch_kategorie: 'spielfigur', zustand: 'gut', vollstaendigkeit: 'nur_geraet' } });
  assert.equal((await nutzer.api('/api/artikel?typ=merch')).json.length, 2);
  assert.equal((await nutzer.api('/api/artikel?typ=merch&merch_kategorie=spielfigur')).json.length, 1);
  assert.equal((await nutzer.api('/api/artikel?q=Zelda')).json.length, 1); // über das verknüpfte Spiel
  for (const sortierung of ['neueste', 'titel', 'plattform', 'preis', 'kaufdatum']) {
    const r = await nutzer.api(`/api/artikel?typ=merch&sortierung=${sortierung}`);
    assert.equal(r.status, 200, sortierung);
  }
  const stat = (await nutzer.api('/api/statistik')).json;
  assert.equal(stat.nachTyp.find((z) => z.wert === 'merch').stueck, 2);
  assert.deepEqual(stat.nachMerchKategorie.map((z) => z.wert).sort(), ['figur', 'spielfigur']);
});

test('Export und Import (JSON, CSV) behalten Merch bei', async () => {
  const csv = (await nutzer.api('/api/export.csv')).text;
  assert.match(csv, /Merch-Kategorie/);
  assert.match(csv, /Funko Pop Link/);

  const daten = (await nutzer.api('/api/export.json')).json;
  const merch = daten.artikel.filter((a) => a.typ === 'merch');
  assert.equal(merch.length, 2);
  const andere = await server.registriere('merchimport');
  const r = await andere.api('/api/import', { methode: 'POST', daten });
  assert.ok(r.json.importiert >= 3);
  const funko = (await andere.api('/api/artikel?typ=merch&merch_kategorie=figur')).json;
  assert.equal(funko.length, 1);
  assert.equal(funko[0].spiel_titel, 'Zelda Merch-Test'); // Verknüpfung bleibt erhalten (ggf. auf die private Kopie des Eintrags)

  const text = 'Titel;Typ;Kategorie\nFunko Pop Mario;Funko;Figur\n';
  const analyse = (await andere.api('/api/import/csv/analyse', { methode: 'POST', daten: { text } })).json;
  const imp = await andere.api('/api/import/csv', { methode: 'POST', daten: { text, zuordnung: analyse.zuordnung, standardTyp: 'merch' } });
  assert.equal(imp.json.importiert, 1, JSON.stringify(imp.json));
  assert.equal((await andere.api('/api/artikel?q=Funko Pop Mario')).json[0].typ, 'merch');
});
