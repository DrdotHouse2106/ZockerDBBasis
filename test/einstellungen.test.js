import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { ladeKonfiguration } from '../server/config.js';
import { erstelleApp } from '../server/app.js';

const PASSWORT = 'sehr-geheimes-passwort';
let server;
let admin;
let nutzer;

before(async () => {
  server = await starteTestServer({ env: { STORAGE_QUOTA_MB: '1024' } });
  admin = await server.registriere('chefin');
  nutzer = await server.registriere('sammler');
});
after(async () => { await server.stoppe(); });

const speichern = (daten) => admin.api('/api/admin/einstellungen', { methode: 'PUT', daten });
const eintrag = async (schluessel) => (await admin.api('/api/admin/einstellungen')).json.einstellungen.find((e) => e.schluessel === schluessel);

test('Nur Administratoren sehen und ändern die Einstellungen', async () => {
  assert.equal((await nutzer.api('/api/admin/einstellungen')).status, 403);
  const antwort = await admin.api('/api/admin/einstellungen');
  assert.equal(antwort.status, 200);
  assert.ok(antwort.json.nurEnv.includes('APP_SECRET'));
  assert.ok(!antwort.json.einstellungen.some((e) => e.schluessel === 'APP_SECRET' || e.schluessel === 'DATABASE_PATH'));
  assert.equal((await eintrag('STORAGE_QUOTA_MB')).herkunft, 'env');
  assert.equal((await eintrag('PUBLIC_URL')).herkunft, 'standard');
});

test('Sicherheitsrelevante Änderungen nur mit Passwort', async () => {
  const ohne = await speichern({ werte: { REGISTRATION_OPEN: 'false' } });
  assert.equal(ohne.status, 403);
  assert.equal(ohne.json.code, 'bestaetigung_noetig');
  assert.equal((await speichern({ werte: { REGISTRATION_OPEN: 'false' }, passwort: 'falsch-falsch-falsch' })).status, 403);
  assert.equal((await speichern({ werte: { REGISTRATION_OPEN: 'false' }, passwort: PASSWORT })).status, 200);

  const gast = server.client();
  assert.equal((await gast.api('/api/auth/status')).json.registrierungOffen, false);
  const reg = await gast.api('/api/auth/registrieren', { methode: 'POST', daten: { benutzername: 'neuling', passwort: PASSWORT, bedingungen_akzeptiert: true } });
  assert.equal(reg.status, 403);

  assert.equal((await speichern({ zuruecksetzen: ['REGISTRATION_OPEN'], passwort: PASSWORT })).status, 200);
  assert.equal((await gast.api('/api/auth/status')).json.registrierungOffen, true);
});
