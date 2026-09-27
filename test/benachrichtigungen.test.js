import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

const postfach = [];
let server;
let mod;
let nutzer;

before(async () => {
  server = await starteTestServer({ env: { PUBLIC_URL: 'https://zockdb.example', SMTP_FROM: 'x@zockdb.example' }, mailFn: async (m) => { postfach.push(m); } });
  mod = await server.registriere('moderatorin');
  nutzer = await server.registriere('sammler');
});
after(async () => { await server.stoppe(); });

test('Rollenwechsel wird mitgeteilt', async () => {
  const id = server.db.prepare("SELECT id FROM benutzer WHERE benutzername = 'sammler'").get().id;
  await mod.api(`/api/admin/benutzer/${id}`, { methode: 'PUT', daten: { rolle: 'moderator' } });
  const liste = (await nutzer.api('/api/benachrichtigungen')).json;
  assert.equal(liste.eintraege[0].titel, 'Deine Rolle: Moderator');
});
