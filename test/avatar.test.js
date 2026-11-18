// Avatar: Symbol und Farbe aus festen Listen, eigenes Bild (zugeschnitten, ohne Metadaten), Abruf für Listen, Entfernen durch Admins.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { starteTestServer } from './hilfen.js';
import { AVATAR_FARBEN } from '../shared/konstanten.js';

let server;
let admin;
let anna;
let bernd;
before(async () => {
  server = await starteTestServer();
  admin = await server.registriere('admin');
  anna = await server.registriere('anna');
  bernd = await server.registriere('bernd');
});
after(async () => { await server.stoppe(); });

const bild = (client, puffer, typ = 'image/jpeg') => client.api('/api/konto/avatar/bild', { methode: 'PUT', formular: puffer, headers: { 'Content-Type': typ } });

test('Standard: kein Symbol, kein Bild, Farbe aus der ID; Symbol und Farbe nur aus den Listen', async () => {
  const konto = (await anna.api('/api/konto')).json;
  assert.equal(konto.avatar.symbol, null);
  assert.equal(konto.avatar.url, null);
  assert.ok(AVATAR_FARBEN.some((f) => f.hex === konto.avatar.farbe));
  assert.equal((await anna.api('/api/konto', { methode: 'PUT', daten: { avatar_symbol: '🍄', avatar_farbe: '#22c55e' } })).status, 200);
  const neu = (await anna.api('/api/konto')).json.avatar;
  assert.deepEqual(neu, { symbol: '🍄', farbe: '#22c55e', url: null });
  assert.equal((await anna.api('/api/konto', { methode: 'PUT', daten: { avatar_symbol: '<script>' } })).status, 400);
  assert.equal((await anna.api('/api/konto', { methode: 'PUT', daten: { avatar_farbe: 'red' } })).status, 400);
  // Zurück auf Standard
  await anna.api('/api/konto', { methode: 'PUT', daten: { avatar_symbol: '' } });
  assert.equal((await anna.api('/api/konto')).json.avatar.symbol, null);
});

test('Eigenes Bild: 256 × 256 WebP ohne Metadaten, für Angemeldete abrufbar, ersetzt das alte, löschbar', async () => {
  const foto = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#3366cc' } })
    .jpeg().withMetadata({ exif: { IFD0: { Make: 'Testkamera', Model: 'X1' } } }).toBuffer();
  const r = await bild(anna, foto);
  assert.equal(r.status, 200, r.text);
  const url = r.json.avatar.url;
  assert.match(url, /^\/api\/dateien\/avatar-.+\.webp$/);
  const datei = url.replace('/api/dateien/', '');
  const meta = await sharp(server.kontext.dateien.pfadVon(datei)).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 256);
  assert.equal(meta.height, 256);
  assert.equal(meta.exif, undefined, 'keine Kameradaten');
  assert.equal((await bernd.api(url)).status, 200, 'andere Angemeldete sehen das Bild');
  // Abruf für Listen
  const ids = (await anna.api('/api/konto')).json.id;
  const liste = (await bernd.api(`/api/avatare?ids=${ids},999999,abc`)).json;
  assert.equal(liste[ids].url, url);
  assert.equal(liste[999999], undefined);
  // Neues Bild ersetzt das alte (Datei wird gelöscht)
  const zweites = await bild(anna, await sharp({ create: { width: 300, height: 300, channels: 3, background: '#cc3366' } }).png().toBuffer(), 'image/png');
  assert.equal(zweites.status, 200);
  await new Promise((weiter) => { setTimeout(weiter, 50); });
  assert.equal(fs.existsSync(server.kontext.dateien.pfadVon(datei)), false);
  // Kein Bild bzw. kein Rasterbild → 400
  assert.equal((await bild(anna, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml')).status, 400);
  // Entfernen
  const weg = await anna.api('/api/konto/avatar/bild', { methode: 'DELETE' });
  assert.equal(weg.json.avatar.url, null);
  assert.equal((await anna.api('/api/konto')).json.avatar.url, null);
});

test('Admin entfernt ein unpassendes Bild – Benutzer wird benachrichtigt; Kontolöschung räumt die Datei weg', async () => {
  const r = await bild(bernd, await sharp({ create: { width: 400, height: 400, channels: 3, background: '#ff0000' } }).jpeg().toBuffer());
  const datei = r.json.avatar.url.replace('/api/dateien/', '');
  const berndId = (await bernd.api('/api/konto')).json.id;
  assert.equal((await anna.api(`/api/admin/benutzer/${berndId}/avatar`, { methode: 'DELETE' })).status, 403, 'nur Admins');
  assert.equal((await admin.api(`/api/admin/benutzer/${berndId}/avatar`, { methode: 'DELETE' })).status, 200);
  assert.equal((await bernd.api('/api/konto')).json.avatar.url, null);
  const nachricht = (await bernd.api('/api/benachrichtigungen')).json.eintraege.find((b) => /Avatar-Bild/.test(b.titel));
  assert.ok(nachricht);
  await new Promise((weiter) => { setTimeout(weiter, 50); });
  assert.equal(fs.existsSync(server.kontext.dateien.pfadVon(datei)), false);

  const neu = await bild(bernd, await sharp({ create: { width: 400, height: 400, channels: 3, background: '#00ff00' } }).jpeg().toBuffer());
  const neuDatei = neu.json.avatar.url.replace('/api/dateien/', '');
  server.kontext.dateien.loescheBenutzerdaten(berndId);
  await new Promise((weiter) => { setTimeout(weiter, 50); });
  assert.equal(fs.existsSync(server.kontext.dateien.pfadVon(neuDatei)), false);
});
