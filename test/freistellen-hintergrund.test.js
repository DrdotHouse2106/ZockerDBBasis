// Freistellen im Hintergrund: Die App holt sich ein Helfer-Token, das nur die Freistellen-Endpunkte darf.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { starteTestServer } from './hilfen.js';

let server;
let admin;
let app;

/** App-Sitzung (Token im Authorization-Kopf) für ein bestehendes Konto. */
async function appSitzung(name) {
  const anmeldung = await server.client().api('/api/auth/anmelden', {
    methode: 'POST', daten: { benutzername: name, passwort: 'sehr-geheimes-passwort' }, headers: { 'X-ZockerDB-Client': 'app' },
  });
  return mitToken(anmeldung.json.token);
}
function mitToken(token) {
  const c = server.client();
  return (pfad, o = {}) => c.api(pfad, { ...o, headers: { ...(o.headers ?? {}), Authorization: `Bearer ${token}` } });
}

before(async () => {
  server = await starteTestServer({ env: { PHOTO_SHARING: 'true', MEDIA_SHARING: 'true' } });
  admin = await server.registriere('admin');
  app = await appSitzung('admin');
});
after(async () => { await server.stoppe(); });

test('Helfer-Token nur aus der App und nur mit Häkchen', async () => {
  assert.equal((await admin.api('/api/freistellen/hintergrund', { methode: 'POST', daten: {} })).status, 400, 'Browser-Sitzung');
  assert.equal((await app('/api/freistellen/hintergrund', { methode: 'POST', daten: {} })).status, 403, 'ohne Häkchen');
  await admin.api('/api/konto', { methode: 'PUT', daten: { freistellen_hilft: true } });
  const r = await app('/api/freistellen/hintergrund', { methode: 'POST', daten: {} });
  assert.equal(r.status, 201, r.text);
  assert.match(r.json.token, /^\S{20,}$/);
});

test('Helfer-Token darf nur Freistellen – sonst gilt es als nicht angemeldet', async () => {
  const helferToken = (await app('/api/freistellen/hintergrund', { methode: 'POST', daten: {} })).json.token;
  const helfer = mitToken(helferToken);
  // Ein Auftrag für den Helfer
  const artikel = (await admin.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Super Mario 64', plattform: 'Nintendo 64' } })).json;
  const formular = new FormData();
  formular.append('art', 'foto_modul');
  formular.append('datei', new Blob([await sharp({ create: { width: 300, height: 200, channels: 3, background: '#cc2244' } }).png().toBuffer()], { type: 'image/png' }), 'foto.png');
  assert.equal((await admin.api(`/api/artikel/${artikel.id}/medien`, { methode: 'POST', formular })).status, 201);

  assert.equal((await helfer('/api/freistellen/status')).json.darfHelfen, true);
  const paeckchen = await helfer('/api/freistellen/naechste?anzahl=5');
  assert.equal(paeckchen.status, 200, paeckchen.text);
  const [auftrag] = paeckchen.json.auftraege;
  assert.ok(auftrag);
  assert.equal((await helfer(auftrag.bild_url)).status, 200);
  const motiv = await sharp({ create: { width: 95, height: 63, channels: 3, background: '#fff' } }).png().toBuffer();
  const maske = await sharp({ create: { width: 150, height: 100, channels: 3, background: '#000' } }).composite([{ input: motiv, left: 0, top: 0 }]).greyscale().png().toBuffer();
  const fertig = await helfer(`/api/freistellen/${auftrag.id}`, { methode: 'PUT', formular: maske, headers: { 'Content-Type': 'image/png' } });
  assert.equal(fertig.status, 200, fertig.text);

  // Alles andere: nicht angemeldet
  for (const [pfad, methode] of [['/api/artikel', 'GET'], ['/api/konto', 'GET'], ['/api/freistellen/pruefen', 'GET'], ['/api/konto/sitzungen', 'GET'],
    ['/api/freistellen/hintergrund', 'POST'], [`/api/artikel/${artikel.id}`, 'DELETE']]) {
    const r = await helfer(pfad, { methode, ...(methode === 'POST' ? { daten: {} } : {}) });
    assert.equal(r.status, 401, `${methode} ${pfad}`);
  }
  assert.equal((await helfer('/api/auth/status')).json.angemeldet, false);
  // Als Cookie (Browser) zählt es gar nicht
  assert.equal((await server.client().api('/api/freistellen/status', { headers: { Cookie: `vss_sitzung=${helferToken}` } })).status, 401);

  // In der Geräteliste sichtbar, selbst abmelden beendet es
  const geraete = (await app('/api/konto/sitzungen')).json;
  assert.ok(geraete.some((s) => s.art === 'freistellen'));
  assert.equal((await helfer('/api/freistellen/hintergrund', { methode: 'DELETE' })).status, 204);
  assert.equal((await helfer('/api/freistellen/status')).status, 401);
});

test('Abmelden in der App beendet das Helfer-Token', async () => {
  const helfer = mitToken((await app('/api/freistellen/hintergrund', { methode: 'POST', daten: {} })).json.token);
  assert.equal((await helfer('/api/freistellen/status')).status, 200);
  await app('/api/auth/abmelden', { methode: 'POST', daten: {} });
  assert.equal((await helfer('/api/freistellen/status')).status, 401);
  assert.equal(server.db.prepare("SELECT COUNT(*) AS n FROM sitzungen WHERE art = 'freistellen'").get().n, 0);
});
