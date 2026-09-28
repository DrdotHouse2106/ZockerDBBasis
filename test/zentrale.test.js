// Selbst gehostete Installation mit Verbindung zu zockerdb.de – gegen eine nachgebaute Zentrale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { zentralZuEintrag } from '../server/services/zentrale.js';

function falscheZentrale() {
  const anfragen = [];
  const fetchFn = async (url, optionen = {}) => {
    const u = new URL(String(url));
    anfragen.push({ pfad: u.pathname + u.search, auth: optionen.headers?.Authorization, body: optionen.body });
    if (u.pathname === '/api/zentral/instanz') return Response.json({ id: 1, schluessel: 'zi_test' }, { status: 201 });
    if (optionen.headers?.Authorization !== 'Bearer zi_test') return Response.json({ fehler: 'Unbekannt' }, { status: 401 });
    if (u.pathname === '/api/zentral/suche') {
      return Response.json({ lokal: [{ id: 42, typ: 'spiel', titel: 'Die Siedler II', titel_original: 'The Settlers II', plattformen: ['PC (Microsoft Windows)'], cover_url: 'javascript:alert(1)' }],
        online: [], mehrOnline: true, seite: null });
    }
    if (u.pathname === '/api/zentral/einreichen') return Response.json({ id: 99, status: 'eingereicht' }, { status: 201 });
    return Response.json({ fehler: 'unbekannt' }, { status: 404 });
  };
  return { fetchFn, anfragen };
}

test('Suche über zockerdb.de: automatisch angemeldet, Treffer mit ZockerDB-ID, fremde Daten geprüft', async () => {
  const { fetchFn, anfragen } = falscheZentrale();
  const server = await starteTestServer({ env: { ZOCKERDB_CENTRAL: 'https://zockerdb.example' }, fetchFn });
  try {
    const c = await server.registriere('tester');
    const r = (await c.api('/api/katalog/suche?q=siedler')).json;
    assert.equal(r.online[0].titel, 'Die Siedler II');
    assert.equal(r.online[0].quelle, 'zockerdb');
    assert.equal(r.online[0].externe_id, '42');
    assert.equal(r.online[0].cover_url, null, 'nur https-Bilder');
    assert.equal(r.mehrOnline, true);
    assert.equal(anfragen[0].pfad, '/api/zentral/instanz');
    assert.equal((await c.api('/api/status')).json.zentrale, 'https://zockerdb.example');

    // Eigenen Eintrag einreichen
    const a = (await c.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Seltenes Homebrew' } })).json;
    const e = (await c.api(`/api/katalog/${a.katalog_id}/zentral-einreichen`, { methode: 'POST', daten: {} })).json;
    assert.deepEqual(e, { zentral_id: 99, zentral_status: 'eingereicht', zentral_hinweis: null });
    assert.equal(JSON.parse(anfragen.at(-1).body).titel, 'Seltenes Homebrew');
  } finally {
    await server.stoppe();
  }
});

test('Ohne Verbindung (ZOCKERDB_CENTRAL=aus) keine Anfragen an zockerdb.de', async () => {
  const { fetchFn, anfragen } = falscheZentrale();
  const server = await starteTestServer({ fetchFn });
  try {
    const c = await server.registriere('tester');
    await c.api('/api/katalog/suche?q=siedler');
    assert.equal(anfragen.length, 0);
    assert.equal((await c.api('/api/status')).json.zentrale, null);
  } finally {
    await server.stoppe();
  }
});

test('Einträge von zockerdb.de werden streng geprüft', () => {
  assert.equal(zentralZuEintrag({ id: 'x', typ: 'spiel', titel: 'A' }), null);
  assert.equal(zentralZuEintrag({ id: 1, typ: 'boese', titel: 'A' }), null);
  assert.equal(zentralZuEintrag({ id: 1, typ: 'spiel', titel: 'A'.repeat(500) }).titel.length, 200);
});

test('Titel vorschlagen ohne eigene Moderation: geht an zockerdb.de; ohne Verbindung bleibt er privat', async () => {
  const { fetchFn, anfragen } = falscheZentrale();
  const server = await starteTestServer({ env: { ZOCKERDB_CENTRAL: 'https://zockerdb.example' }, fetchFn });
  const ohne = await starteTestServer();
  try {
    const c = await server.registriere('tester');
    const r = (await c.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel: 'Mah-Jong (Versandhaus, ohne Barcode)', plattformen: ['C64'], einreichen: true } })).json;
    if (server.kontext.katalog.moderiert()) {
      // Mit eigener Moderation (zockerdb.de selbst) landet der Vorschlag in deren Warteschlange
      assert.equal(r.status, 'eingereicht');
    } else {
      assert.equal(r.status, 'privat', 'bis zur Freigabe auf zockerdb.de nur für mich');
      assert.equal(r.zentral_status, 'eingereicht');
      assert.ok(anfragen.some((a) => a.pfad === '/api/zentral/einreichen'));
    }

    const o = await ohne.registriere('tester');
    const r2 = (await o.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel: 'Exot', einreichen: true } })).json;
    assert.equal(r2.status, ohne.kontext.katalog.moderiert() ? 'eingereicht' : 'privat', 'ohne Moderation und ohne Zentrale nicht in einer toten Warteschlange');
  } finally {
    await server.stoppe();
    await ohne.stoppe();
  }
});

test('Datenspende-Frage für Admins und Update-Hinweis', async () => {
  const fetchFn = async (url, optionen) => (String(url).endsWith('/api/zentral/version')
    ? Response.json({ version: '99.0.0', hinweise: 'https://example.org/update' })
    : falscheZentrale().fetchFn(url, optionen));
  const server = await starteTestServer({ env: { ZOCKERDB_CENTRAL: 'https://zockerdb.example' }, fetchFn });
  try {
    const admin = await server.registriere('admin');
    let d = (await admin.api('/api/admin/zentrale')).json;
    assert.equal(d.spende, false);
    assert.equal(d.spendeGefragt, false);
    d = (await admin.api('/api/admin/zentrale/spende', { methode: 'POST', daten: { an: true } })).json;
    assert.equal(d.spende, true);
    assert.equal(d.spendeGefragt, true);
    assert.equal((await admin.api('/api/status')).json.zentraleSpende, true);
    d = (await admin.api('/api/admin/zentrale/spende', { methode: 'POST', daten: { an: false } })).json;
    assert.equal(d.spende, false);
    // Normale Benutzer dürfen das nicht
    const nutzer = await server.registriere('nutzer');
    assert.equal((await nutzer.api('/api/admin/zentrale/spende', { methode: 'POST', daten: { an: true } })).status, 403);

    await server.kontext.zentrale.lauf();
    d = (await admin.api('/api/admin/zentrale')).json;
    assert.equal(d.neueVersion.version, '99.0.0');
  } finally {
    await server.stoppe();
  }
});
