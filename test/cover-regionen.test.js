// Cover je Region: regionale Fassungen von IGDB, Community-Foto der Fassung, Exemplar zeigt das passendste Cover.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { coverRegionen, spielZuEintrag } from '../server/services/igdb.js';
import { coverRegionKette, regionAusIgdb } from '../shared/konstanten.js';

const IGDB = (id) => `https://images.igdb.com/igdb/image/upload/t_cover_big/${id}.jpg`;

test('Regionen: IGDB-Fassungen werden zugeordnet, Reihenfolge für PAL-DE', () => {
  assert.deepEqual(coverRegionKette('pal_de'), ['pal_de', 'pal_eu']);
  assert.deepEqual(coverRegionKette('ntsc_u'), ['ntsc_u']);
  assert.deepEqual(coverRegionKette(null), ['pal_de', 'pal_eu'], 'ohne Region: deutscher Markt');
  assert.equal(regionAusIgdb('Europe', 'EU'), 'pal_eu');
  assert.equal(regionAusIgdb('Worldwide', 'WW'), null);
  assert.deepEqual(coverRegionen([
    { region: { name: 'Europe', identifier: 'EU' }, cover: { image_id: 'coeu' } },
    { region: { name: 'Europe', identifier: 'EU' }, cover: { image_id: 'zweites' } },
    { region: { name: 'Japan', identifier: 'JP' }, cover: { image_id: 'cojp' } },
    { region: { name: 'Worldwide' }, cover: { image_id: 'coww' } },
    { region: { name: 'North America' } },
  ]), [{ region: 'pal_eu', url: IGDB('coeu') }, { region: 'ntsc_j', url: IGDB('cojp') }]);
  assert.deepEqual(spielZuEintrag({ id: 1, name: 'X', game_localizations: [{ region: { name: 'Europe' }, cover: { image_id: 'abc' } }] }).cover_regionen,
    [{ region: 'pal_eu', url: IGDB('abc') }]);
});

test('Cover je Region: Katalog speichert nur IGDB-Bilder, Exemplar und Spieleseite zeigen das passendste', async () => {
  const server = await starteTestServer();
  try {
    const admin = await server.registriere('admin');
    const anna = await server.registriere('anna');
    const { db, kontext } = server;
    const eintrag = kontext.katalog.speichere({
      quelle: 'igdb', externe_id: 'game:4711', typ: 'spiel', titel: 'Regionen-Spiel', plattformen: ['PlayStation 2'], cover_url: IGDB('allgemein'),
      cover_regionen: [{ region: 'pal_eu', url: IGDB('europa') }, { region: 'ntsc_j', url: IGDB('japan') },
        { region: 'pal_eu', url: 'https://boese.example/x.jpg' }, { region: 'mars', url: IGDB('mars') }],
    });
    assert.deepEqual(db.prepare('SELECT region, url FROM katalog_cover WHERE katalog_id = ? ORDER BY region').all(eintrag.id),
      [{ region: 'ntsc_j', url: IGDB('japan') }, { region: 'pal_eu', url: IGDB('europa') }], 'fremde Adressen und Regionen werden ignoriert');

    const neu = async (daten) => (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Regionen-Spiel', katalog_id: eintrag.id, ...daten } })).json;
    const deutsch = await neu({ region: 'pal_de' });
    const japan = await neu({ region: 'ntsc_j' });
    const usa = await neu({ region: 'ntsc_u' });
    const ohne = await neu({});
    assert.equal(deutsch.bild_url, IGDB('europa'), 'PAL-DE ohne deutsches Cover → EU-Fassung');
    assert.equal(japan.bild_url, IGDB('japan'));
    assert.equal(usa.bild_url, IGDB('allgemein'), 'keine US-Fassung → allgemeines Cover');
    assert.equal(ohne.bild_url, IGDB('europa'), 'ohne Region gilt der deutsche Markt');

    // Community-Foto „Verpackung vorne“ einer deutschen Variante geht vor
    const variante = db.prepare("INSERT INTO katalog_varianten (katalog_id, bezeichnung, region, status) VALUES (?, 'PAL-DE', 'pal_de', 'freigegeben') RETURNING id").pluck().get(eintrag.id);
    db.prepare(`INSERT INTO medien (katalog_id, art, sichtbarkeit, datei, anzeige_datei, vorschau_datei, mime, groesse, variante_id)
      VALUES (?, 'foto_vorne', 'freigegeben', 'de.jpg', 'de-anzeige.webp', 'de-klein.webp', 'image/jpeg', 1, ?)`).run(eintrag.id, variante);
    // … nicht freigegebene Fotos zählen nicht
    db.prepare(`INSERT INTO medien (katalog_id, art, sichtbarkeit, datei, vorschau_datei, mime, groesse, variante_id)
      VALUES (?, 'foto_vorne', 'eingereicht', 'neu.jpg', 'neu-klein.webp', 'image/jpeg', 1, ?)`).run(eintrag.id, variante);
    const liste = (await anna.api('/api/artikel')).json;
    const je = Object.fromEntries(liste.map((a) => [a.id, a.bild_url]));
    assert.equal(je[deutsch.id], '/api/dateien/de-klein.webp');
    assert.equal(je[ohne.id], '/api/dateien/de-klein.webp');
    assert.equal(je[japan.id], IGDB('japan'), 'andere Regionen bleiben bei ihrem Cover');

    // Eigenes Cover am Exemplar geht immer vor
    await anna.api(`/api/artikel/${usa.id}`, { methode: 'PUT', daten: { ...usa, cover_url: 'https://example.org/mein-cover.jpg' } });
    assert.equal((await anna.api(`/api/artikel/${usa.id}`)).json.bild_url, 'https://example.org/mein-cover.jpg');

    // Spieleseite: passendes Cover für den deutschen Markt und alle Regionen zum Umschalten
    const seite = (await admin.api(`/api/katalog/${eintrag.id}`)).json;
    assert.equal(seite.cover_passend, '/api/dateien/de-anzeige.webp');
    assert.deepEqual(seite.cover_regionen.map((c) => [c.region, c.quelle]), [['pal_de', 'community'], ['pal_eu', 'igdb'], ['ntsc_j', 'igdb']]);

    // Neuer Abruf ohne regionale Fassungen entfernt die alten IGDB-Cover (das Community-Foto bleibt)
    kontext.katalog.speichere({ quelle: 'igdb', externe_id: 'game:4711', typ: 'spiel', titel: 'Regionen-Spiel', plattformen: ['PlayStation 2'], cover_url: IGDB('allgemein'), cover_regionen: [] });
    assert.equal(db.prepare('SELECT COUNT(*) FROM katalog_cover WHERE katalog_id = ?').pluck().get(eintrag.id), 0);
    assert.deepEqual((await admin.api(`/api/katalog/${eintrag.id}`)).json.cover_regionen.map((c) => c.region), ['pal_de']);
  } finally {
    await server.stoppe();
  }
});
