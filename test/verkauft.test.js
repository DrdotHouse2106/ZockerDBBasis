// Verkaufte bzw. abgegebene Exemplare: raus aus Sammlung und Wert, aber sichtbar; Aufteilen, Statistik, Export, Zurückholen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Verkauft: Aufteilen, Filter, Statistik mit Gewinn/Verlust, Export, zurück in die Sammlung', async () => {
  const server = await starteTestServer();
  try {
    const b = await server.registriere('verkaeufer');
    const neu = (daten) => b.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', plattform: 'Game Boy', ...daten } }).then((r) => r.json);
    const tetris = await neu({ titel: 'Tetris', anzahl: 3, kaufpreis: '10,00' });
    const mario = await neu({ titel: 'Super Mario Land', kaufpreis: '20,00' });

    // 2 von 3 verkauft für zusammen 50 € → eigener Eintrag mit 25 € je Stück, Rest bleibt mit 1 Stück
    const r = await b.api(`/api/artikel/${tetris.id}/abgang`, { methode: 'POST', daten: { bestand: 'verkauft', anzahl: 2, preis: '50,00', datum: '2026-09-01' } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.artikel.anzahl, 2);
    assert.equal(r.json.artikel.bestand, 'verkauft');
    assert.equal(r.json.artikel.verkaufspreis, 25);
    assert.equal(r.json.artikel.abgang_am, '2026-09-01');
    assert.equal(r.json.rest.anzahl, 1);
    assert.equal(r.json.rest.bestand, 'besitz');
    // Mario verschenkt – ganz
    assert.equal((await b.api(`/api/artikel/${mario.id}/abgang`, { methode: 'POST', daten: { bestand: 'abgegeben', preis: '99' } })).json.artikel.verkaufspreis, null);
    // Doppelt geht nicht
    assert.equal((await b.api(`/api/artikel/${mario.id}/abgang`, { methode: 'POST', daten: { bestand: 'verkauft' } })).status, 400);

    // Sammlung zeigt nur, was man besitzt; Filter „weg“ die übrigen
    const sammlung = (await b.api('/api/artikel')).json;
    assert.deepEqual(sammlung.map((a) => [a.titel, a.anzahl]), [['Tetris', 1]]);
    const weg = (await b.api('/api/artikel?bestand=weg')).json;
    assert.equal(weg.length, 2);
    assert.equal((await b.api('/api/artikel?bestand=verkauft')).json.length, 1);
    assert.equal((await b.api('/api/artikel?bestand=alle')).json.length, 3);

    // Statistik: nur Besitz im Kaufwert; Verkäufe mit Erlös und Gewinn (2 × (25 − 10) = 30)
    const s = (await b.api('/api/statistik')).json;
    assert.equal(s.gesamt.stueck, 1);
    assert.equal(s.gesamt.kaufwert, 10);
    assert.equal(s.verkauf.stueck, 2);
    assert.equal(s.verkauf.erloes, 50);
    assert.equal(s.verkauf.gewinn, 30);
    assert.equal(s.verkauf.abgegeben, 1);
    assert.equal(s.verkauf.jahre[0].jahr, '2026');

    // Export enthält den Bestand
    const csv = (await b.api('/api/export.csv')).text;
    assert.match(csv, /Verkauft/);
    const json = (await b.api('/api/export.json')).json;
    assert.ok(json.artikel.some((a) => a.bestand === 'verkauft' && a.verkaufspreis === 25));

    // Import übernimmt den Bestand
    const c = await server.registriere('importeur');
    const imp = await c.api('/api/import', { methode: 'POST', daten: json });
    assert.equal(imp.status, 200, imp.text);
    assert.equal((await c.api('/api/artikel?bestand=verkauft')).json[0].verkaufspreis, 25);

    // Zurück in die Sammlung
    const zurueck = (await b.api(`/api/artikel/${mario.id}/zurueck`, { methode: 'POST' })).json;
    assert.equal(zurueck.bestand, 'besitz');
    assert.equal(zurueck.abgang_am, null);
    assert.equal((await b.api('/api/artikel')).json.length, 2);
  } finally {
    await server.stoppe();
  }
});
