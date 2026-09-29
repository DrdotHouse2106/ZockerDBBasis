// Steam-Import: Profiladresse auflösen, Spiele als „digital“ anlegen (Katalog oder eigener Eintrag), erneut importieren, trennen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { leseSteamProfil } from '../server/services/steam.js';

test('Steam-Profil: ID, Profiladresse und benutzerdefinierter Name', () => {
  assert.deepEqual(leseSteamProfil('76561197960287930'), { steamId: '76561197960287930' });
  assert.deepEqual(leseSteamProfil('https://steamcommunity.com/profiles/76561197960287930/'), { steamId: '76561197960287930' });
  assert.deepEqual(leseSteamProfil('https://steamcommunity.com/id/gabelogannewell'), { name: 'gabelogannewell' });
  assert.throws(() => leseSteamProfil('https://example.com/<script>'));
});

test('Steam-Import: digitale Spiele, deutlich getrennt von der Sammlung', async () => {
  let privat = false;
  const aufrufe = [];
  const fetchFn = async (url) => {
    const u = new URL(String(url));
    aufrufe.push(u);
    if (u.pathname.includes('ResolveVanityURL')) return Response.json({ response: { success: 1, steamid: '76561197960287930' } });
    if (u.pathname.includes('GetOwnedGames')) {
      return Response.json(privat ? { response: {} } : { response: { game_count: 2, games: [
        { appid: 220, name: 'Half-Life 2', playtime_forever: 125 },
        { appid: 999999, name: 'Unbekanntes Indie™', playtime_forever: 0 },
      ] } });
    }
    return new Response('nicht gefunden', { status: 404 });
  };
  const server = await starteTestServer({ env: { STEAM_API_KEY: 'schluessel' }, fetchFn });
  try {
    const admin = await server.registriere('admin');
    const hl2 = (await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel: 'Half-Life 2', plattformen: ['PC'], veroeffentlichen: true } })).json;
    const b = await server.registriere('steamfan');
    assert.equal((await b.api('/api/steam')).json.aktiv, true);

    let r = await b.api('/api/steam/import', { methode: 'POST', daten: { profil: 'https://steamcommunity.com/id/gabe' } });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual({ gesamt: r.json.gesamt, neu: r.json.neu, katalog: r.json.katalog, eigene: r.json.eigene }, { gesamt: 2, neu: 2, katalog: 1, eigene: 1 });
    assert.equal(r.json.steam_id, '76561197960287930');
    assert.ok(aufrufe.every((u) => u.hostname === 'api.steampowered.com' && u.searchParams.get('key') === 'schluessel'));

    // Nicht in der Sammlung, aber unter „digital“
    assert.equal((await b.api('/api/artikel')).json.length, 0);
    const digital = (await b.api('/api/artikel?bestand=digital')).json;
    assert.equal(digital.length, 2);
    const hl = digital.find((a) => a.titel === 'Half-Life 2');
    assert.equal(hl.katalog_id, hl2.id);
    assert.equal(hl.spielzeit_minuten, 125);
    assert.equal(hl.digital_quelle, 'steam');
    const indie = digital.find((a) => a.titel === 'Unbekanntes Indie');
    assert.match(indie.bild_url, /steamstatic\.com\/steam\/apps\/999999\//);
    assert.equal((await b.api('/api/statistik')).json.gesamt.stueck, 0, 'nicht im Sammlungswert/Statistik');
    // Nicht verkaufbar, nicht „zurück in die Sammlung“
    assert.equal((await b.api(`/api/artikel/${hl.id}/abgang`, { methode: 'POST', daten: { bestand: 'verkauft' } })).status, 400);
    assert.equal((await b.api(`/api/artikel/${hl.id}/zurueck`, { methode: 'POST' })).status, 400);

    // Erneut: keine Doppelten, Spielzeit aktualisiert
    r = (await b.api('/api/steam/import', { methode: 'POST', daten: { profil: '76561197960287930' } })).json;
    assert.equal(r.neu, 0);
    assert.equal(r.aktualisiert, 2);
    assert.equal((await b.api('/api/artikel?bestand=digital')).json.length, 2);

    // Privates Profil: verständliche Meldung
    privat = true;
    r = await b.api('/api/steam/import', { methode: 'POST', daten: { profil: '76561197960287930' } });
    assert.equal(r.status, 409);
    assert.match(r.json.fehler, /Spieldetails/);

    // Trennen entfernt die Steam-Spiele
    assert.equal((await b.api('/api/steam', { methode: 'DELETE' })).json.entfernt, 2);
    assert.equal((await b.api('/api/artikel?bestand=digital')).json.length, 0);
  } finally {
    await server.stoppe();
  }
});

test('Steam-Import ohne Schlüssel: ausgeblendet', async () => {
  const server = await starteTestServer();
  try {
    const b = await server.registriere('ohne');
    assert.equal((await b.api('/api/steam')).json.aktiv, false);
    assert.equal((await b.api('/api/steam/import', { methode: 'POST', daten: { profil: '76561197960287930' } })).status, 409);
  } finally {
    await server.stoppe();
  }
});

test('Digitale Spiele von Hand (z. B. PlayStation Store) und Zähler je Bestand', async () => {
  const server = await starteTestServer();
  try {
    const b = await server.registriere('psfan');
    const r = await b.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Astro Bot', plattform: 'PlayStation 5', bestand: 'digital', digital_quelle: 'playstation' } });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.bestand, 'digital');
    assert.equal(r.json.digital_quelle, 'playstation');
    await b.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Physisch', digital_quelle: 'playstation' } });
    const physisch = (await b.api('/api/artikel')).json;
    assert.equal(physisch.length, 1);
    assert.equal(physisch[0].digital_quelle, null, 'Store nur bei digitalen Spielen');
    assert.equal((await b.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'X', bestand: 'digital', digital_quelle: 'unsinn' } })).status, 400);
    assert.deepEqual((await b.api('/api/artikel/anzahl')).json, { besitz: 1, digital: 1 });
    // Bearbeiten: wieder physisch → Store entfällt
    const g = (await b.api(`/api/artikel/${r.json.id}`, { methode: 'PUT', daten: { bestand: 'besitz' } })).json;
    assert.equal(g.bestand, 'besitz');
    assert.equal(g.digital_quelle, null);
  } finally {
    await server.stoppe();
  }
});
