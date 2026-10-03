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

test('Update-Prüfung bei GitHub: neuer Stand, aktuell, privates Repository ohne Token', async () => {
  let lauf = { head_sha: 'abcdef1234567', updated_at: '2026-09-29T09:00:00Z', display_title: 'Widerruf per Knopf' };
  let status = 200;
  const anfragen = [];
  const INSTALLIERT = '## 28.09.2026 – Update per Knopf\n- Knopf\n';
  const NEU = `# Neuerungen\n\n## 29.09.2026 – Neuerungen sehen\n- Liste der **Neuerungen**\n* zweiter Punkt\n\n${INSTALLIERT}`;
  const fetchFn = async (url, optionen = {}) => {
    const u = String(url);
    anfragen.push({ url: u, auth: optionen.headers?.Authorization, accept: optionen.headers?.Accept });
    if (status !== 200) return new Response('{}', { status });
    if (u.includes('/contents/NEUERUNGEN.md')) return new Response(NEU);
    if (u.includes('/contents/')) return new Response('nicht gefunden', { status: 404 });
    if (u.includes('/compare/')) return Response.json({ ahead_by: 7 });
    return Response.json({ workflow_runs: [lauf] });
  };
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const datei = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'neu-')), 'NEUERUNGEN.md');
  fs.writeFileSync(datei, INSTALLIERT);
  const quellen = [{ pfad: 'NEUERUNGEN.md', datei }, { pfad: 'modul/NEUERUNGEN.md', datei: '/gibt/es/nicht.md' }];
  const { erstelleAktualisierung } = await import('../server/services/aktualisierung.js');
  const konfiguration = { aktualisierung: { repo: 'beispiel/zockerdb', githubToken: '' } };
  const a = erstelleAktualisierung({ konfiguration, sicherung: { lauf: async () => {} }, build: { commit: '1111111', datum: '2026-09-28T10:00:00.000Z' }, fetchFn, quellen });
  assert.deepEqual(a.status().neuerungen.map((e) => e.titel), ['Update per Knopf'], 'installierte Hinweise aus dem Image');

  let p = await a.pruefe();
  assert.equal(p.neu, true);
  assert.equal(p.verfuegbar.commit, 'abcdef1');
  assert.match(anfragen[0].url, /repos\/beispiel\/zockerdb\/actions\/workflows\/ci\.yml\/runs\?branch=main&status=success/);
  // Was ist neu? Nur Einträge, die der installierte Stand noch nicht kennt – vom neuen Stand (ref = Commit des Builds)
  assert.deepEqual(p.neuerungen, [{ id: '29.09.2026 – Neuerungen sehen', datum: '2026-09-29', titel: 'Neuerungen sehen', punkte: ['Liste der Neuerungen', 'zweiter Punkt'], fuer: null }]);
  assert.ok(anfragen.some((x) => x.url.endsWith('/contents/NEUERUNGEN.md?ref=abcdef1234567') && x.accept === 'application/vnd.github.raw+json'));
  assert.ok(anfragen.some((x) => x.url.endsWith('/compare/1111111...abcdef1234567')));
  assert.equal(p.aenderungen, 7);
  // Innerhalb einer Stunde aus dem Zwischenspeicher, „jetzt prüfen“ fragt neu
  const bisher = anfragen.length;
  await a.pruefe();
  assert.equal(anfragen.length, bisher);
  lauf = { ...lauf, head_sha: '1111111aaaa' };
  p = await a.pruefe({ erzwingen: true });
  assert.equal(p.neu, false, 'derselbe Stand = aktuell');

  status = 404;
  p = await a.pruefe({ erzwingen: true });
  assert.match(p.fehler, /GitHub-Token/);
  konfiguration.aktualisierung.githubToken = 'ghp_geheim';
  status = 200;
  await a.pruefe({ erzwingen: true });
  assert.equal(anfragen.at(-1).auth, 'Bearer ghp_geheim');
});
