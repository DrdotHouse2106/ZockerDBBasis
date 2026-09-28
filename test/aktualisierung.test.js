// Update per Knopf: Die App bittet Watchtower (HTTP-API) um ein Update – hier gegen einen nachgebauten Watchtower.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { leseBuild } from '../server/services/aktualisierung.js';
import { erstelleZentrale } from '../server/services/zentrale.js';
import { oeffneDatenbank } from '../server/db.js';

const WATCHTOWER = 'http://watchtower:8080/v1/update';
const fehlerMit = (code) => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(code), { code }) });

/** Wartet, bis der Versuch nicht mehr läuft, und liefert den Status. */
async function ergebnis(c) {
  for (let i = 0; i < 50; i += 1) {
    const s = (await c.api('/api/admin/aktualisierung')).json;
    if (s.lauf?.zustand !== 'laeuft') return s;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('Update-Versuch endet nicht');
}

test('Update per Knopf: nicht eingerichtet → Hinweis, nur für Administratoren', async () => {
  const server = await starteTestServer();
  try {
    const admin = await server.registriere('chefin');
    const s = (await admin.api('/api/admin/aktualisierung')).json;
    assert.equal(s.eingerichtet, false);
    assert.deepEqual(Object.keys(s.build).sort(), ['commit', 'datum']);
    const r = await admin.api('/api/admin/aktualisierung', { methode: 'POST' });
    assert.equal(r.status, 400);
    assert.match(r.text, /nicht eingerichtet/);

    const normal = await server.registriere('sammler');
    assert.equal((await normal.api('/api/admin/aktualisierung', { methode: 'POST' })).status, 403);
  } finally {
    await server.stoppe();
  }
});

test('Update per Knopf: Watchtower wird mit Token gerufen, Antworten werden verständlich gemeldet', async () => {
  const anfragen = [];
  let antwort = () => new Response(null, { status: 200 });
  const fetchFn = async (url, optionen = {}) => {
    if (String(url) !== WATCHTOWER) throw new Error(`unerwartete Anfrage an ${url}`);
    anfragen.push(optionen);
    return antwort();
  };
  const server = await starteTestServer({ env: { UPDATE_URL: WATCHTOWER, UPDATE_TOKEN: 'geheim-123' }, fetchFn });
  try {
    const admin = await server.registriere('chefin');
    assert.equal((await admin.api('/api/admin/aktualisierung')).json.eingerichtet, true);

    // Antwort 200, während die App noch läuft = kein neues Image
    let s = (await admin.api('/api/admin/aktualisierung', { methode: 'POST' })).json;
    assert.equal(s.lauf.zustand, 'laeuft');
    s = await ergebnis(admin);
    assert.equal(s.lauf.zustand, 'aktuell');
    assert.equal(anfragen[0].method, 'POST');
    assert.equal(anfragen[0].headers.Authorization, 'Bearer geheim-123');

    antwort = () => new Response('Unauthorized', { status: 401 });
    await admin.api('/api/admin/aktualisierung', { methode: 'POST' });
    s = await ergebnis(admin);
    assert.equal(s.lauf.zustand, 'fehler');
    assert.match(s.lauf.fehler, /Token/);

    antwort = () => { throw fehlerMit('ECONNREFUSED'); };
    await admin.api('/api/admin/aktualisierung', { methode: 'POST' });
    s = await ergebnis(admin);
    assert.match(s.lauf.fehler, /nicht erreichbar/);

    // Verbindung reißt ab: Watchtower beendet gerade den Container für das Update
    antwort = () => { throw fehlerMit('ECONNRESET'); };
    await admin.api('/api/admin/aktualisierung', { methode: 'POST' });
    s = await ergebnis(admin);
    assert.equal(s.lauf.zustand, 'neustart');

    // Token nie im Klartext in den Einstellungen
    const e = (await admin.api('/api/admin/einstellungen')).json.einstellungen.find((x) => x.schluessel === 'UPDATE_TOKEN');
    assert.ok(e, 'UPDATE_TOKEN ist in der Oberfläche einstellbar');
    assert.ok(!JSON.stringify(e).includes('geheim-123'));
  } finally {
    await server.stoppe();
  }
});

test('Stand des Images: nur gültige Werte aus den Build-Argumenten', () => {
  assert.deepEqual(leseBuild({ ZOCKERDB_BUILD: 'ABCdef1234567890', ZOCKERDB_BUILD_DATE: '2026-09-28T10:00:00Z' }),
    { commit: 'ABCdef1', datum: '2026-09-28T10:00:00.000Z' });
  assert.deepEqual(leseBuild({ ZOCKERDB_BUILD: '<script>', ZOCKERDB_BUILD_DATE: 'gestern' }), { commit: null, datum: null });
  assert.deepEqual(leseBuild({}), { commit: null, datum: null });
});

test('Update-Hinweis: neuerer Stand bei zockerdb.de, auch bei gleicher Versionsnummer', async () => {
  const db = oeffneDatenbank(':memory:');
  try {
    let gebaut = '2026-09-28T12:00:00Z';
    const fetchFn = async () => Response.json({ version: '1.0.0', gebaut, hinweise: 'https://example.org/hinweise' });
    const konfiguration = { zentrale: { url: 'https://zockerdb.example' } };
    const z = erstelleZentrale(db, { konfiguration, fetchFn, version: '1.0.0', build: { commit: 'abc1234', datum: '2026-09-28T10:00:00.000Z' } });
    await z.pruefeVersion();
    assert.equal(z.status().neueVersion?.gebaut, '2026-09-28T12:00:00.000Z');

    // Nur leicht später gebaut (derselbe Stand, Basis und Zentrale versetzt) → kein Hinweis
    db.prepare("DELETE FROM einstellungen WHERE schluessel = 'zentrale_version'").run();
    gebaut = '2026-09-28T10:20:00Z';
    await z.pruefeVersion();
    assert.equal(z.status().neueVersion, null);
  } finally {
    db.close();
  }
});
