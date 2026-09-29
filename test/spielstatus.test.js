// Spielstatus („Pile of Shame“) und Erfahrungsberichte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Spielstatus: setzen, filtern, Statistik, Export', async () => {
  const server = await starteTestServer();
  try {
    const b = await server.registriere('spieler');
    const neu = (titel) => b.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel } }).then((r) => r.json);
    const a = await neu('Chrono Trigger');
    await neu('EarthBound');
    let r = await b.api(`/api/artikel/${a.id}`, { methode: 'PUT', daten: { spielstatus: 'durchgespielt', durchgespielt_am: '2026-09-01', spielzeit_minuten: 1500 } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.spielstatus, 'durchgespielt');
    assert.equal(r.json.durchgespielt_am, '2026-09-01');
    assert.equal((await b.api(`/api/artikel/${a.id}`, { methode: 'PUT', daten: { spielstatus: 'unsinn' } })).status, 400);
    const e = (await b.api('/api/artikel')).json.find((x) => x.titel === 'EarthBound');
    await b.api(`/api/artikel/${e.id}`, { methode: 'PUT', daten: { spielstatus: 'nicht_gespielt' } });
    assert.deepEqual((await b.api('/api/artikel?spielstatus=nicht_gespielt')).json.map((x) => x.titel), ['EarthBound']);
    const s = (await b.api('/api/statistik')).json.spielstatus;
    assert.equal(s.find((z) => z.wert === 'nicht_gespielt').anzahl, 1);
    assert.equal(s.find((z) => z.wert === 'durchgespielt').anzahl, 1);
    assert.match((await b.api('/api/export.csv')).text, /Durchgespielt/);
  } finally {
    await server.stoppe();
  }
});

test('Erfahrungsberichte: nur mit dem Spiel in der Sammlung, sichtbar für andere, Moderation, zurückziehen, Datenauskunft', async () => {
  const server = await starteTestServer();
  try {
    const admin = await server.registriere('admin');
    const spiel = (await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel: 'Secret of Mana', plattformen: ['Super Nintendo'], veroeffentlichen: true } })).json;
    const anna = await server.registriere('anna');
    const ben = await server.registriere('ben');
    const text = 'Ein Klassiker – am besten zu zweit spielen, die PAL-Version läuft etwas langsamer.';
    assert.equal((await anna.api(`/api/katalog/${spiel.id}/bericht`, { methode: 'PUT', daten: { text } })).status, 403, 'ohne Spiel in der Sammlung');
    await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Secret of Mana', katalog_id: spiel.id } });
    assert.equal((await anna.api(`/api/katalog/${spiel.id}/bericht`, { methode: 'PUT', daten: { text: 'kurz' } })).status, 400);
    assert.equal((await anna.api(`/api/katalog/${spiel.id}/bericht`, { methode: 'PUT', daten: { text, wertung: 6 } })).status, 400);
    const r = await anna.api(`/api/katalog/${spiel.id}/bericht`, { methode: 'PUT', daten: { text, wertung: 5 } });
    assert.equal(r.status, 200, r.text);

    let seite = (await ben.api(`/api/katalog-seite/${spiel.id}`)).json;
    assert.equal(seite.berichte.length, 1);
    assert.equal(seite.berichte[0].name, 'anna');
    assert.equal(seite.berichte[0].wertung, 5);
    assert.equal(seite.berichte[0].eigener, false);

    // Melden (mit Geschäftsmodul) landet in der Moderation
    const meldung = await ben.api('/api/melden', { methode: 'POST', daten: { bereich: 'bericht', ziel_id: r.json.id, grund: 'falsch', text: 'Stimmt so nicht' } });
    if (meldung.status !== 404) assert.ok([200, 201].includes(meldung.status), meldung.text);

    // Moderation blendet aus – für andere unsichtbar, für die Autorin mit Hinweis
    assert.equal((await ben.api(`/api/berichte/${r.json.id}/sichtbarkeit`, { methode: 'POST', daten: { ausblenden: true } })).status, 403);
    assert.equal((await admin.api(`/api/berichte/${r.json.id}/sichtbarkeit`, { methode: 'POST', daten: { ausblenden: true } })).json.status, 'ausgeblendet');
    assert.equal((await ben.api(`/api/katalog-seite/${spiel.id}`)).json.berichte.length, 0);
    seite = (await anna.api(`/api/katalog-seite/${spiel.id}`)).json;
    assert.equal(seite.berichte[0].eigener, true);

    const auskunft = (await anna.api('/api/export/datenauskunft.json')).json;
    assert.equal(findeBericht(auskunft), 5);

    // Zurückziehen löscht den Bericht
    assert.equal((await anna.api(`/api/katalog/${spiel.id}/bericht`, { methode: 'DELETE' })).status, 204);
    assert.equal((await anna.api(`/api/katalog-seite/${spiel.id}`)).json.berichte.length, 0);
  } finally {
    await server.stoppe();
  }
});

function findeBericht(objekt) {
  if (Array.isArray(objekt?.erfahrungsberichte)) return objekt.erfahrungsberichte[0]?.wertung;
  for (const w of Object.values(objekt ?? {})) {
    if (w && typeof w === 'object') {
      if (Array.isArray(w.erfahrungsberichte)) return w.erfahrungsberichte[0]?.wertung;
      const t = findeBericht(w);
      if (t !== undefined) return t;
    }
  }
  return undefined;
}
