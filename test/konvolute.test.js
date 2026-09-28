import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { verteile } from '../server/services/konvolute.js';

test('Verteilung auf den Cent genau', () => {
  const cent = verteile(1000, [{ gewicht: 1, anzahl: 1 }, { gewicht: 1, anzahl: 1 }, { gewicht: 1, anzahl: 1 }]);
  assert.equal(cent.reduce((s, c) => s + c, 0), 1000);
  assert.deepEqual([...cent].sort(), [333, 333, 334]);
  assert.deepEqual(verteile(3000, [{ gewicht: 20, anzahl: 1 }, { gewicht: 10, anzahl: 1 }]), [2000, 1000]);
});

test('Konvolut: Gesamtpreis wird verteilt, feste Preise bleiben, ungefähres Kaufdatum, Herkunft', async () => {
  const server = await starteTestServer();
  try {
    const c = await server.registriere('sammler');
    const post = (pfad, daten) => c.api(pfad, { methode: 'POST', daten });
    const k = (await post('/api/konvolute', { name: 'Flohmarkt-Kiste', preis: '30,00', kaufdatum: '1998' })).json;
    assert.equal(k.kaufdatum, '1998');
    const a = (await post('/api/artikel', { typ: 'spiel', titel: 'Spiel A', konvolut_id: k.id })).json;
    const b = (await post('/api/artikel', { typ: 'spiel', titel: 'Spiel B', konvolut_id: k.id })).json;
    const d = (await post('/api/artikel', { typ: 'spiel', titel: 'Spiel C', konvolut_id: k.id, anzahl: 2 })).json;
    let voll = (await c.api(`/api/konvolute/${k.id}`)).json;
    const preis = (id) => voll.artikel.find((x) => x.id === id).kaufpreis;
    assert.equal(preis(a.id), 7.5);
    assert.equal(preis(d.id), 7.5, 'je Stück');
    const artikelA = (await c.api(`/api/artikel/${a.id}`)).json;
    assert.equal(artikelA.herkunft, 'konvolut');
    assert.equal(artikelA.kaufdatum, '1998');
    assert.equal(artikelA.konvolut_name, 'Flohmarkt-Kiste');

    // Ein Artikel bekommt einen festen Preis → der Rest wird verteilt
    await c.api(`/api/artikel/${b.id}`, { methode: 'PUT', daten: { kaufpreis: '15' } });
    voll = (await c.api(`/api/konvolute/${k.id}`)).json;
    assert.equal(preis(b.id), 15);
    assert.equal(preis(a.id), 5);
    // Nach Wert: eigene Schätzung als Gewicht
    await c.api(`/api/artikel/${a.id}`, { methode: 'PUT', daten: { marktwert: '40' } });
    await c.api(`/api/artikel/${d.id}`, { methode: 'PUT', daten: { marktwert: '10' } });
    voll = (await c.api(`/api/konvolute/${k.id}`, { methode: 'PUT', daten: { aufteilung: 'wert' } })).json;
    assert.equal(preis(a.id), 10);
    assert.equal(preis(d.id), 2.5);
    const summe = voll.artikel.reduce((s, x) => s + x.kaufpreis * x.anzahl, 0);
    assert.equal(Math.round(summe * 100), 3000);

    // Ohne Gesamtpreis: Anteile leer, Statistik zählt „ohne Kaufpreis“
    await c.api(`/api/konvolute/${k.id}`, { methode: 'PUT', daten: { preis: '' } });
    const stat = (await c.api('/api/statistik')).json;
    assert.equal(stat.ohnePreis.eintraege, 2);
    assert.ok(stat.nachHerkunft.some((h) => h.wert === 'konvolut'));

    // Ungefähres Datum und Herkunft ohne Preis
    const geschenk = await post('/api/artikel', { typ: 'konsole', titel: 'Game Boy', herkunft: 'schon_immer', kaufdatum: '1993-12' });
    assert.equal(geschenk.status, 201);
    assert.equal((await post('/api/artikel', { typ: 'spiel', titel: 'X', kaufdatum: '12.1993' })).status, 400);

    // Fremdes Konvolut
    const andere = await server.registriere('andere');
    assert.equal((await andere.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Y', konvolut_id: k.id } })).status, 400);
    assert.equal((await andere.api(`/api/konvolute/${k.id}`)).status, 404);

    // Export/Import behält das Konvolut
    const json = (await c.api('/api/export.json')).json;
    assert.equal(json.konvolute[0].name, 'Flohmarkt-Kiste');
    const csv = (await c.api('/api/export.csv')).text;
    assert.match(csv, /Flohmarkt-Kiste/);
    assert.match(csv, /Schon immer/);
  } finally {
    await server.stoppe();
  }
});
