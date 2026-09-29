// Leihliste: an Namen oder Benutzer verleihen, Bestätigung, Überfällig-Erinnerung, Zurückbekommen mit Verlauf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Leihliste: verleihen, bestätigen, erinnern, zurückbekommen', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const ben = await server.registriere('ben');
    const neu = (titel, daten = {}) => anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel, kaufpreis: '40', ...daten } }).then((r) => r.json);
    const zelda = await neu('Zelda');
    const mario = await neu('Mario');

    // An einen Namen, Rückgabe in der Vergangenheit → überfällig
    let r = await anna.api(`/api/artikel/${mario.id}/verleihen`, { methode: 'POST', daten: { an_name: 'Max', seit: '2026-01-01', rueckgabe: '2026-02-01' } });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.verliehen_an, 'Max');
    assert.equal((await anna.api(`/api/artikel/${mario.id}/verleihen`, { methode: 'POST', daten: { an_name: 'Moritz' } })).status, 400, 'nicht doppelt');
    // An einen Benutzer
    assert.equal((await anna.api(`/api/artikel/${zelda.id}/verleihen`, { methode: 'POST', daten: { an_benutzername: 'gibtsnicht' } })).status, 400);
    assert.equal((await anna.api(`/api/artikel/${zelda.id}/verleihen`, { methode: 'POST', daten: { an_benutzername: 'anna' } })).status, 400);
    r = await anna.api(`/api/artikel/${zelda.id}/verleihen`, { methode: 'POST', daten: { an_benutzername: 'Ben' } });
    assert.equal(r.status, 201, r.text);
    assert.ok((await ben.api('/api/benachrichtigungen')).json.eintraege.some((n) => n.art === 'leihe' && n.titel.includes('Zelda')));

    // Ben sieht die Leihe ohne Preise und bestätigt
    const g = (await ben.api('/api/verleihungen')).json.geliehen;
    assert.equal(g.length, 1);
    assert.equal(g[0].titel, 'Zelda');
    assert.equal(g[0].verleiher, 'anna');
    assert.equal(g[0].kaufpreis, undefined);
    assert.equal((await ben.api(`/api/verleihungen/${g[0].id}/antwort`, { methode: 'POST', daten: { bestaetigen: true } })).json.bestaetigung, 'bestaetigt');
    assert.equal((await anna.api(`/api/verleihungen/${g[0].id}/antwort`, { methode: 'POST', daten: { bestaetigen: true } })).status, 400, 'nur der Ausleihende');

    // Filter, Wert bleibt, Verkaufen während der Leihe gesperrt
    assert.deepEqual((await anna.api('/api/artikel?verliehen=1')).json.map((a) => a.titel).sort(), ['Mario', 'Zelda']);
    assert.equal((await anna.api('/api/statistik')).json.gesamt.kaufwert, 80);
    assert.equal((await anna.api(`/api/artikel/${mario.id}/abgang`, { methode: 'POST', daten: { bestand: 'verkauft' } })).status, 400);

    // Erinnerung: einmal, dann erst nach einer Woche wieder
    assert.equal(server.kontext.verleih.erinnere(), 1);
    assert.equal(server.kontext.verleih.erinnere(), 0);
    assert.ok((await anna.api('/api/benachrichtigungen')).json.eintraege.some((n) => n.titel.includes('Rückgabe überfällig')));

    // Zurückbekommen → Verlauf
    const v = (await anna.api('/api/verleihungen')).json.verliehen.find((x) => x.titel === 'Mario');
    assert.equal(v.ueberfaellig, true);
    assert.equal((await ben.api(`/api/verleihungen/${v.id}/zurueck`, { methode: 'POST' })).status, 400, 'nur der Verleiher');
    assert.ok((await anna.api(`/api/verleihungen/${v.id}/zurueck`, { methode: 'POST' })).json.zurueck_am);
    const verlauf = (await anna.api(`/api/artikel/${mario.id}/verleihungen`)).json;
    assert.equal(verlauf.length, 1);
    assert.ok(verlauf[0].zurueck_am);
    assert.equal((await anna.api(`/api/artikel/${mario.id}`)).json.verleih_id, null);
    const auskunft = (await anna.api('/api/export/datenauskunft.json')).text;
    assert.match(auskunft, /"verleihungen"/);
  } finally {
    await server.stoppe();
  }
});
