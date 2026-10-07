import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

function falscheIgdb() {
  const aufrufe = [];
  const fetchFn = async (url, optionen = {}) => {
    aufrufe.push({ url: String(url), body: optionen.body });
    if (String(url).startsWith('https://id.twitch.tv')) {
      return Response.json({ access_token: 'token123', expires_in: 3600 });
    }
    if (String(url).endsWith('/games')) {
      return Response.json([{
        id: 1022, name: 'The Legend of Zelda', first_release_date: 509328000,
        cover: { image_id: 'co1uii' }, platforms: [{ name: 'NES' }],
        involved_companies: [{ publisher: true, company: { name: 'Nintendo' } }],
      }]);
    }
    return new Response('nicht gefunden', { status: 404 });
  };
  return { fetchFn, aufrufe };
}

test('IGDB-Suche wird zwischengespeichert und im Katalog abgelegt', async () => {
  const { fetchFn, aufrufe } = falscheIgdb();
  const server = await starteTestServer({ env: { TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'geheim' }, fetchFn });
  try {
    const c = await server.registriere('tester');
    const erste = await c.api('/api/katalog/suche?q=zelda');
    assert.equal(erste.json.online.length, 1);
    const spiel = erste.json.online[0];
    assert.equal(spiel.hersteller, 'Nintendo');
    assert.equal(spiel.erscheinungsjahr, 1986);
    assert.equal(spiel.cover_url, 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1uii.jpg');

    const zweite = await c.api('/api/katalog/suche?q=Zelda');
    assert.equal(zweite.json.lokal[0].id, spiel.id, 'Treffer steht jetzt im lokalen Katalog');
    assert.equal(aufrufe.filter((a) => a.url.endsWith('/games')).length, 1, 'zweite Suche kommt aus dem Cache');
    assert.equal(aufrufe.filter((a) => a.url.includes('twitch')).length, 1, 'Token wird wiederverwendet');
  } finally {
    await server.stoppe();
  }
});

test('Barcode → Produktname → IGDB-Suche', async () => {
  const { fetchFn } = falscheIgdb();
  const mitUpc = async (url, optionen) => (String(url).includes('upcitemdb')
    ? Response.json({ items: [{ title: 'The Legend of Zelda - [NES] PAL' }] })
    : fetchFn(url, optionen));
  const server = await starteTestServer({
    env: { TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'geheim', BARCODE_PROVIDERS: 'upcitemdb' },
    fetchFn: mitUpc,
  });
  try {
    const c = await server.registriere('tester');
    const { json } = await c.api('/api/katalog/barcode/045496630010');
    assert.equal(json.produktname, 'The Legend of Zelda - [NES] PAL');
    assert.equal(json.suchbegriff, 'The Legend of Zelda');
    assert.equal(json.treffer[0].titel, 'The Legend of Zelda');
  } finally {
    await server.stoppe();
  }
});

test('Gestufte Suche: IGDB nur bei wenigen eigenen Treffern, sonst auf Wunsch seitenweise', async () => {
  const anfragen = [];
  const fetchFn = async (url, optionen = {}) => {
    if (String(url).startsWith('https://id.twitch.tv')) return Response.json({ access_token: 't', expires_in: 3600 });
    if (String(url).endsWith('/games')) {
      const offset = Number(/offset (\d+);/.exec(optionen.body)?.[1] ?? 0);
      anfragen.push(offset);
      const anzahl = offset === 0 ? 20 : 3;
      return Response.json(Array.from({ length: anzahl }, (_, i) => ({ id: 5000 + offset + i, name: `Mario Party ${offset + i}` })));
    }
    return new Response('nicht gefunden', { status: 404 });
  };
  const server = await starteTestServer({ env: { TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'geheim' }, fetchFn });
  try {
    const c = await server.registriere('tester');
    // Wenige eigene Treffer → IGDB wird automatisch gefragt (Seite 0)
    const erste = (await c.api('/api/katalog/suche?q=mario party')).json;
    assert.equal(erste.online.length, 20);
    assert.equal(erste.seite, 0);
    assert.equal(erste.mehrOnline, true, 'volle Seite → es gibt vermutlich mehr');
    assert.deepEqual(anfragen, [0]);

    // Jetzt genug Treffer im eigenen Katalog → keine IGDB-Anfrage, aber „Weitere laden“ möglich
    const zweite = (await c.api('/api/katalog/suche?q=mario party')).json;
    assert.ok(zweite.lokal.length >= 5);
    assert.equal(zweite.online.length, 0);
    assert.equal(zweite.seite, null);
    assert.equal(zweite.mehrOnline, true);
    assert.deepEqual(anfragen, [0]);

    // Auf Wunsch die nächste Seite
    const mehr = (await c.api('/api/katalog/suche?q=mario party&online=1&seite=1')).json;
    assert.equal(mehr.seite, 1);
    assert.equal(mehr.online.length, 3);
    assert.equal(mehr.mehrOnline, false, 'letzte Seite nicht voll → Ende');
    assert.deepEqual(anfragen, [0, 20]);
  } finally {
    await server.stoppe();
  }
});

test('Echter deutscher Titel von IGDB, Originaltitel bleibt suchbar – Titel werden nie übersetzt', async () => {
  const fetchFn = async (url) => {
    if (String(url).startsWith('https://id.twitch.tv')) return Response.json({ access_token: 't', expires_in: 3600 });
    if (String(url).endsWith('/games')) {
      return Response.json([
        { id: 7, name: 'The Settlers II', alternative_names: [{ name: 'Die Siedler II', comment: 'German title' }, { name: 'Settlers 2', comment: 'Abbreviation' }] },
        { id: 8, name: 'The Legend of Zelda: Breath of the Wild', alternative_names: [{ name: 'Zeruda no Densetsu', comment: 'Japanese title - translated' }] },
      ]);
    }
    return new Response('nicht gefunden', { status: 404 });
  };
  const server = await starteTestServer({ env: { TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'geheim' }, fetchFn });
  try {
    const c = await server.registriere('tester');
    const { online } = (await c.api('/api/katalog/suche?q=settlers')).json;
    const siedler = online.find((e) => e.externe_id === 'game:7');
    assert.equal(siedler.titel, 'Die Siedler II');
    assert.equal(siedler.titel_original, 'The Settlers II');
    const zelda = online.find((e) => e.externe_id === 'game:8');
    assert.equal(zelda.titel, 'The Legend of Zelda: Breath of the Wild', 'ohne deutschen Titel bleibt der Originalname');
    assert.equal(zelda.titel_original, null);
    // Lokal über beide Titel auffindbar
    assert.equal((await c.api('/api/katalog/suche?q=Die Siedler')).json.lokal[0].id, siedler.id);
    assert.equal((await c.api('/api/katalog/suche?q=The Settlers')).json.lokal[0].id, siedler.id);
  } finally {
    await server.stoppe();
  }
});

test('EAN: nie als Titel bei IGDB suchen, bei passendem Katalogeintrag IGDB gar nicht fragen', async () => {
  const { fetchFn, aufrufe } = falscheIgdb();
  const mitUpc = async (url, optionen) => (String(url).includes('upcitemdb')
    ? Response.json({ items: [{ title: 'The Legend of Zelda - [NES] PAL' }] })
    : fetchFn(url, optionen));
  const server = await starteTestServer({
    env: { TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'geheim', BARCODE_PROVIDERS: 'upcitemdb' },
    fetchFn: mitUpc,
  });
  const igdbAufrufe = () => aufrufe.filter((a) => a.url.endsWith('/games')).length;
  try {
    const c = await server.registriere('tester');
    // Eine Nummer im Titelfeld löst keine IGDB-Anfrage aus
    const zahl = (await c.api('/api/katalog/suche?q=4006381333931')).json;
    assert.equal(zahl.online.length, 0);
    assert.equal(zahl.mehrOnline, false);
    assert.equal(igdbAufrufe(), 0);

    // Der Titel steht schon im Katalog → Barcode-Suche findet ihn ohne IGDB
    await c.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'The Legend of Zelda' } });
    const scan = (await c.api('/api/katalog/barcode/045496630010')).json;
    assert.equal(scan.treffer[0].titel, 'The Legend of Zelda');
    assert.equal(igdbAufrufe(), 0, 'lokaler Treffer reicht');
  } finally {
    await server.stoppe();
  }
});

test('Quellenangabe: Link zur Seite des Spiels auf IGDB.com', async () => {
  const fetchFn = async (url) => {
    if (String(url).startsWith('https://id.twitch.tv')) return Response.json({ access_token: 't', expires_in: 3600 });
    if (String(url).endsWith('/games')) return Response.json([{ id: 9, name: 'Chrono Trigger', url: 'https://www.igdb.com/games/chrono-trigger' }]);
    return new Response('x', { status: 404 });
  };
  const server = await starteTestServer({ env: { TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'g' }, fetchFn });
  try {
    const c = await server.registriere('tester');
    const [spiel] = (await c.api('/api/katalog/suche?q=chrono')).json.online;
    assert.equal(spiel.igdb_url, 'https://www.igdb.com/games/chrono-trigger');
  } finally {
    await server.stoppe();
  }
});

test('Barcode mit Händlertitel („… - Bonus Edition - Ps3 Boxed + Instructions B1393“) findet den Katalogeintrag', async () => {
  const { fetchFn } = falscheIgdb();
  const mitUpc = async (url, optionen) => (String(url).includes('upcitemdb')
    ? Response.json({ items: [{ title: "Assassin's Creed 4: Black Flag - Bonus Edition - Ps3 Boxed + Instructions B1393" }] })
    : fetchFn(url, optionen));
  const server = await starteTestServer({ env: { BARCODE_PROVIDERS: 'upcitemdb' }, fetchFn: mitUpc });
  try {
    const admin = await server.registriere('admin');
    for (const [titel, plattform] of [["Assassin's Creed IV Black Flag", 'Xbox 360'], ["Assassin's Creed IV Black Flag", 'PlayStation 3']]) {
      await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel, plattformen: [plattform], veroeffentlichen: true } });
    }
    const { json } = await admin.api('/api/katalog/barcode/3307215704943');
    // Die fehlertolerante Suche findet schon mit „4“ statt „IV“
    assert.equal(json.suchbegriff, "Assassin's Creed 4: Black Flag");
    assert.equal(json.treffer.length, 2);
    assert.deepEqual(json.treffer[0].plattformen, ['PlayStation 3'], 'Plattform aus dem Produktnamen zuerst');
  } finally {
    await server.stoppe();
  }
});

test('Barcode merkt sich die Plattform – beim nächsten Scan steht sie fest (auch für andere Sammler)', async () => {
  const server = await starteTestServer({ env: { BARCODE_PROVIDERS: '' } });
  try {
    const admin = await server.registriere('admin');
    const ben = await server.registriere('ben');
    const e = (await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel: 'Black Flag', plattformen: ['PlayStation 3', 'Xbox 360'], veroeffentlichen: true } })).json;
    const ps3 = server.db.prepare("SELECT id FROM plattformen WHERE name = 'PlayStation 3'").pluck().get();
    await admin.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Black Flag', katalog_id: e.id, plattform_id: ps3, barcode: '3307215704943' } });
    const r = (await ben.api('/api/katalog/barcode/3307215704943')).json;
    assert.equal(r.treffer[0].id, e.id);
    assert.equal(r.plattform_id, ps3);
    assert.equal(r.plattform, 'PlayStation 3');
  } finally {
    await server.stoppe();
  }
});

test('Barcode-Treffer: Hauptspiel vor Editionen und Zusatzinhalten, auch wenn diese zuerst angelegt wurden', async () => {
  const { fetchFn } = falscheIgdb();
  const mitUpc = async (url, optionen) => (String(url).includes('upcitemdb')
    ? Response.json({ items: [{ title: "Assassin's Creed 4: Black Flag - Bonus Edition - Ps3 Boxed + Instructions B1393" }] })
    : fetchFn(url, optionen));
  const server = await starteTestServer({ env: { BARCODE_PROVIDERS: 'upcitemdb' }, fetchFn: mitUpc });
  try {
    const admin = await server.registriere('admin');
    for (const titel of ["Assassin's Creed IV Black Flag: Freedom Cry", "Assassin's Creed IV: Black Flag - Jackdaw Edition", "Assassin's Creed IV: Black Flag"]) {
      await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel, plattformen: ['PlayStation 3'], veroeffentlichen: true } });
    }
    const { json } = await admin.api('/api/katalog/barcode/3307215704944');
    assert.equal(json.treffer[0].titel, "Assassin's Creed IV: Black Flag");
    assert.ok(json.treffer.length >= 2);
  } finally {
    await server.stoppe();
  }
});

test('Early Access: das Erscheinungsjahr richtet sich nach der Vollversion', async () => {
  const { erscheinungsDatum, spielZuEintrag } = await import('../server/services/igdb.js');
  const sek = (d) => Date.parse(`${d}T00:00:00Z`) / 1000;
  const enshrouded = {
    id: 1, name: 'Enshrouded', first_release_date: sek('2024-01-24'),
    release_dates: [{ date: sek('2024-01-24'), status: { name: 'Early Access' } }, { date: sek('2026-10-15'), status: { name: 'Full Release' } }],
  };
  assert.equal(erscheinungsDatum(enshrouded), sek('2026-10-15'));
  assert.equal(spielZuEintrag(enshrouded).erscheinungsjahr, 2026);
  // Nur Early Access bekannt → bleibt beim ersten Termin; ohne Vorabfassung zählt first_release_date
  assert.equal(erscheinungsDatum({ ...enshrouded, release_dates: enshrouded.release_dates.slice(0, 1) }), sek('2024-01-24'));
  assert.equal(erscheinungsDatum({ first_release_date: sek('1996-06-23'), release_dates: [{ date: sek('1996-06-23'), status: null }] }), sek('1996-06-23'));
});
