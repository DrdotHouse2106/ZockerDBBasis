import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

const postfach = [];
let server;
let mod;
let nutzer;

before(async () => {
  server = await starteTestServer({ env: { PUBLIC_URL: 'https://zockerdb.example', SMTP_FROM: 'x@zockerdb.example' }, mailFn: async (m) => { postfach.push(m); } });
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

test('Gesammelte Meldungen: höchstens eine E-Mail je Tag – auch wenn die vorige Meldung schon gelesen wurde', async () => {
  const { db, kontext } = server;
  const id = db.prepare("SELECT id FROM benutzer WHERE benutzername = 'sammler'").get().id;
  db.prepare("UPDATE benutzer SET email = 'sammler@zockerdb.example', benachrichtigung_email = 1 WHERE id = ?").run(id);
  const vorher = postfach.length;
  const melden = () => kontext.benachrichtigungen.sendeGesammelt(id, {
    art: 'freigabe', schluessel: 'test-fotos', titel: (n) => (n === 1 ? 'Dein Foto wurde freigegeben' : `${n} deiner Fotos wurden freigegeben`),
  });
  melden();
  melden();
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(postfach.length - vorher, 1, 'zweites Foto zählt nur mit');
  await nutzer.api('/api/benachrichtigungen/gelesen', { methode: 'POST' });
  melden();
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(postfach.length - vorher, 1, 'nach dem Lesen: neue Meldung in der App, aber keine weitere E-Mail');
  const liste = (await nutzer.api('/api/benachrichtigungen')).json.eintraege.filter((e) => /Foto/.test(e.titel));
  assert.deepEqual(liste.map((e) => [e.titel, e.gelesen]), [['Dein Foto wurde freigegeben', false], ['2 deiner Fotos wurden freigegeben', true]]);
});
