// Fehlertolerante Suche: Wörter in beliebiger Reihenfolge, ohne Apostroph, Mehrzahl-„s“, römische Zahlen;
// bei IGDB wortweiser Rückfall, wenn die Volltextsuche nichts findet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { suchWoerter, wortVarianten } from '../server/services/suchwoerter.js';

test('Suchwörter: Apostrophe, Satzzeichen, Mehrzahl, römische Zahlen', () => {
  assert.deepEqual(suchWoerter("Assassin's Creed: IV – Black Flag!"), ['assassins', 'creed', 'iv', 'black', 'flag']);
  assert.deepEqual(wortVarianten('assassins'), { grenze: false, varianten: ['assassin'] });
  assert.deepEqual(wortVarianten('iv'), { grenze: true, varianten: ['iv', '4'] });
  assert.deepEqual(wortVarianten('7'), { grenze: true, varianten: ['7', 'vii'] });
  assert.deepEqual(wortVarianten('mass'), { grenze: false, varianten: ['mass'] });
});

test('Lokale Suche findet trotz fehlendem Apostroph, anderer Reihenfolge und Ziffer statt römischer Zahl', async () => {
  const server = await starteTestServer();
  try {
    const { db } = server;
    const c = await server.registriere('sucher');
    for (const titel of ["Assassin's Creed IV: Black Flag", 'Final Fantasy VII', 'Mega Man X', 'Black & White']) {
      db.prepare("INSERT INTO katalog (quelle, externe_id, typ, titel, status) VALUES ('eigen', ?, 'spiel', ?, 'freigegeben')").run(titel, titel);
    }
    const titel = async (q) => (await c.api(`/api/katalog/suche?q=${encodeURIComponent(q)}`)).json.lokal.map((e) => e.titel);
    assert.deepEqual(await titel('assassins black flag'), ["Assassin's Creed IV: Black Flag"]);
    assert.deepEqual(await titel('black flag assassin 4'), ["Assassin's Creed IV: Black Flag"]);
    assert.deepEqual(await titel('final fantasy 7'), ['Final Fantasy VII']);
    assert.deepEqual(await titel('Mega Man X'), ['Mega Man X'], 'X bleibt X');
    assert.deepEqual(await titel('black'), ['Black & White', "Assassin's Creed IV: Black Flag"], 'Titel, die so beginnen, zuerst');
    assert.deepEqual(await titel('100%_'), [], 'Platzhalter werden nicht als Muster verstanden');
  } finally {
    await server.stoppe();
  }
});

test('IGDB: wortweiser Rückfall, wenn die Volltextsuche nichts findet', async () => {
  const anfragen = [];
  const fetchFn = async (url, optionen = {}) => {
    const u = String(url);
    if (u.startsWith('https://id.twitch.tv')) return Response.json({ access_token: 't', expires_in: 3600 });
    if (u.endsWith('/games')) {
      anfragen.push(optionen.body);
      if (optionen.body.includes('search "')) return Response.json([]);
      return Response.json([{ id: 7, name: "Assassin's Creed IV: Black Flag", total_rating_count: 900 }]);
    }
    return new Response('nicht gefunden', { status: 404 });
  };
  const server = await starteTestServer({ env: { TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'geheim' }, fetchFn });
  try {
    const c = await server.registriere('sucher');
    const r = (await c.api('/api/katalog/suche?q=assassins%20black%20flag')).json;
    assert.deepEqual(r.online.map((e) => e.titel), ["Assassin's Creed IV: Black Flag"]);
    const rueckfall = anfragen.find((b) => b.includes('where'));
    assert.match(rueckfall, /name ~ \*"assassin"\* & \(name ~ \*"black"\*\) & \(name ~ \*"flag"\*\)|\(name ~ \*"assassin"\*\) & \(name ~ \*"black"\*\) & \(name ~ \*"flag"\*\)/);
  } finally {
    await server.stoppe();
  }
});
