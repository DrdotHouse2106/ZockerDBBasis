import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { starteTestServer } from './hilfen.js';
import { totpCode } from '../server/services/sicherheit.js';

// Anmeldung der Apps (iOS/Android): Token im Authorization-Kopf statt Cookie
let server;
before(async () => {
  server = await starteTestServer();
  await server.registriere('admin'); // erstes Konto = Administrator
});
after(async () => { await server.stoppe(); });

const APP = { 'X-ZockerDB-Client': 'app' };
const mitToken = (token, weitere = {}) => ({ Authorization: `Bearer ${token}`, ...weitere });

async function appAnmelden(benutzername, passwort = 'sehr-geheimes-passwort') {
  const c = server.client();
  const antwort = await c.api('/api/auth/anmelden', { methode: 'POST', daten: { benutzername, passwort }, headers: APP });
  return { c, antwort };
}

test('App-Anmeldung liefert ein Token statt eines Cookies, das Token öffnet die Sammlung', async () => {
  await server.registriere('anna');
  const { c, antwort } = await appAnmelden('anna');
  assert.equal(antwort.status, 200);
  assert.equal(antwort.json.angemeldet, true);
  assert.ok(antwort.json.token?.length >= 40);
  assert.equal(antwort.headers.getSetCookie().length, 0);
  assert.equal(c.cookie(), '');
  assert.equal(antwort.headers.get('cache-control'), 'no-store');

  assert.equal((await c.api('/api/artikel')).status, 401);
  const status = await c.api('/api/auth/status', { headers: mitToken(antwort.json.token) });
  assert.equal(status.json.angemeldet, true);
  assert.equal(status.json.benutzer.benutzername, 'anna');
  assert.ok(status.json.dateiSchluessel);
  const neu = await c.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Aus der App' }, headers: mitToken(antwort.json.token) });
  assert.equal(neu.status, 201, neu.text);

  // Abmelden beendet genau diese Sitzung
  await c.api('/api/auth/abmelden', { methode: 'POST', daten: {}, headers: mitToken(antwort.json.token) });
  assert.equal((await c.api('/api/artikel', { headers: mitToken(antwort.json.token) })).status, 401);
});

test('Browser-Anmeldung bleibt beim Cookie und bekommt keinen Dateischlüssel', async () => {
  const bernd = await server.registriere('bernd');
  assert.ok(bernd.cookie());
  const status = await bernd.api('/api/auth/status');
  assert.equal(status.json.angemeldet, true);
  assert.equal(status.json.dateiSchluessel, undefined);
});

test('Bei App-Anfragen zählt nur das Token – ein Cookie wird ignoriert', async () => {
  const carla = await server.registriere('carla');
  assert.equal((await carla.api('/api/artikel')).status, 200);
  assert.equal((await carla.api('/api/artikel', { headers: mitToken('falsch') })).status, 401);
  assert.equal((await carla.api('/api/artikel', { headers: { Authorization: 'Basic eDp5' } })).status, 401);
  assert.equal((await carla.api('/api/artikel', { headers: APP })).status, 401);
  // Fremde Herkunft mit App-Kopf: Herkunftsprüfung entfällt, aber das Cookie wirkt nicht
  const fremd = await carla.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'X' }, headers: { ...APP, Origin: 'https://boese.example' } });
  assert.equal(fremd.status, 401);
});

test('Herkunftsprüfung: fremde Origin mit Token erlaubt, mit Cookie weiter abgelehnt', async () => {
  const dora = await server.registriere('dora');
  const fremd = { Origin: 'https://boese.example' };
  const perCookie = await dora.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'X' }, headers: fremd });
  assert.equal(perCookie.status, 403);
  // Mit (falschem) Token und Cookie: Cookie wird ignoriert → nicht angemeldet statt Zugriff
  const gemischt = await dora.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'X' }, headers: { ...fremd, ...mitToken('falsch') } });
  assert.equal(gemischt.status, 401);

  const { antwort } = await appAnmelden('dora');
  const app = server.client();
  const perToken = await app.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Y' }, headers: { Origin: 'capacitor://localhost', ...mitToken(antwort.json.token) } });
  assert.equal(perToken.status, 201, perToken.text);
});

test('2FA greift auch in der App; das Token kommt erst nach dem zweiten Faktor', async () => {
  const emil = await server.registriere('emil');
  const einrichtung = (await emil.api('/api/konto/2fa/einrichten', { methode: 'POST', daten: { passwort: 'sehr-geheimes-passwort' } })).json;
  const code = (versatz = 0) => totpCode(einrichtung.geheimnis, Math.floor(Date.now() / 30000) + versatz);
  await emil.api('/api/konto/2fa/bestaetigen', { methode: 'POST', daten: { code: code() } });

  const { c, antwort } = await appAnmelden('emil');
  assert.equal(antwort.json.angemeldet, false);
  assert.equal(antwort.json.zweiFaktor, true);
  // Das Zwischen-Token der 2FA-Stufe öffnet nichts
  assert.equal((await c.api('/api/artikel', { headers: mitToken(antwort.json.token) })).status, 401);
  const zweiter = await c.api('/api/auth/2fa', { methode: 'POST', daten: { token: antwort.json.token, code: code(1) }, headers: APP });
  assert.equal(zweiter.status, 200, zweiter.text);
  assert.equal(zweiter.headers.getSetCookie().length, 0);
  assert.equal((await c.api('/api/artikel', { headers: mitToken(zweiter.json.token) })).status, 200);
});

test('Dateischlüssel öffnet nur Dateien – nicht die übrige API', async () => {
  await server.registriere('frieda');
  const { c, antwort } = await appAnmelden('frieda');
  const kopf = mitToken(antwort.json.token);
  const artikel = (await c.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Mit Foto' }, headers: kopf })).json;
  const formular = new FormData();
  formular.append('art', 'cover_vorne');
  formular.append('sichtbarkeit', 'privat');
  const bild = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#2244cc' } }).jpeg().toBuffer();
  formular.append('datei', new Blob([bild], { type: 'image/jpeg' }), 'cover.jpg');
  const medium = await c.api(`/api/artikel/${artikel.id}/medien`, { methode: 'POST', formular, headers: kopf });
  assert.equal(medium.status, 201, medium.text);

  const schluessel = (await c.api('/api/auth/status', { headers: kopf })).json.dateiSchluessel;
  assert.equal((await c.api(medium.json.url)).status, 401);
  const mitSchluessel = await c.api(`${medium.json.url}?schluessel=${encodeURIComponent(schluessel)}`);
  assert.equal(mitSchluessel.status, 200);
  assert.ok(mitSchluessel.puffer.length > 100);
  assert.equal((await c.api(`/api/artikel?schluessel=${encodeURIComponent(schluessel)}`)).status, 401);
  assert.equal((await c.api(`${medium.json.url}?schluessel=falsch`)).status, 401);
  // Fremde Dateien bleiben trotz Schlüssel verborgen
  const { antwort: andere } = await appAnmelden('anna');
  const fremderSchluessel = (await c.api('/api/auth/status', { headers: mitToken(andere.json.token) })).json.dateiSchluessel;
  assert.equal((await c.api(`${medium.json.url}?schluessel=${encodeURIComponent(fremderSchluessel)}`)).status, 404);

  // Nach dem Abmelden gilt der Schlüssel nicht mehr
  await c.api('/api/auth/abmelden', { methode: 'POST', daten: {}, headers: kopf });
  assert.equal((await c.api(`${medium.json.url}?schluessel=${encodeURIComponent(schluessel)}`)).status, 401);
});

test('Geräteliste: Sitzungen sehen und einzeln abmelden', async () => {
  const gustav = await server.registriere('gustav');
  const { c, antwort } = await appAnmelden('gustav');
  const liste = (await gustav.api('/api/konto/sitzungen')).json;
  assert.equal(liste.length, 2);
  const app = liste.find((s) => s.art === 'app');
  const web = liste.find((s) => s.art === 'web');
  assert.ok(app && web);
  assert.equal(web.aktuell, true);
  assert.equal(app.aktuell, false);
  assert.equal(liste.some((s) => 'token_hash' in s), false);

  // Fremde Sitzungen lassen sich nicht beenden
  const anna = await appAnmelden('anna');
  assert.equal((await anna.c.api(`/api/konto/sitzungen/${app.id}`, { methode: 'DELETE', headers: mitToken(anna.antwort.json.token) })).status, 404);

  assert.equal((await gustav.api(`/api/konto/sitzungen/${app.id}`, { methode: 'DELETE' })).status, 204);
  assert.equal((await c.api('/api/artikel', { headers: mitToken(antwort.json.token) })).status, 401);
  assert.equal((await gustav.api('/api/konto/sitzungen')).json.length, 1);
});
