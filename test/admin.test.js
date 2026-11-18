import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

// Falsche IGDB-API
function falscheApis() {
  return async (url) => {
    const u = String(url);
    if (u.startsWith('https://id.twitch.tv')) return Response.json({ access_token: 't', expires_in: 3600 });
    if (u.endsWith('/games')) return Response.json([{ id: 7, name: 'IGDB Spiel', summary: 'Original', platforms: [{ name: 'Nintendo 64' }] }]);
    return new Response('', { status: 404 });
  };
}

let server;
let admin;
let moni;
let nina;
before(async () => {
  server = await starteTestServer({
    env: { TWITCH_CLIENT_ID: 'x', TWITCH_CLIENT_SECRET: 'y' },
    fetchFn: falscheApis(),
  });
  admin = await server.registriere('admin');
  moni = await server.registriere('moni');
  nina = await server.registriere('nina');
  const liste = (await admin.api('/api/admin/benutzer')).json;
  await admin.api(`/api/admin/benutzer/${liste.find((b) => b.benutzername === 'moni').id}`, { methode: 'PUT', daten: { rolle: 'moderator' } });
});
after(async () => { await server.stoppe(); });
const post = (c, pfad, daten = {}) => c.api(pfad, { methode: 'POST', daten });

test('Registrierung verlangt die Zustimmung zu den Nutzungsbedingungen', async () => {
  const r = await server.client().api('/api/auth/registrieren', { methode: 'POST', daten: { benutzername: 'ohne', passwort: 'sehr-geheimes-passwort' } });
  assert.equal(r.status, 400);
  assert.match(r.json.felder.bedingungen, /Nutzungsbedingungen/);
});

test('Rechtliche Seiten: öffentlich lesbar, nur vom Admin änderbar', async () => {
  const gast = server.client();
  const liste = (await gast.api('/api/seiten')).json;
  // Zusatzmodule können weitere Seiten mitbringen (z. B. Widerrufsbelehrung)
  for (const slug of ['impressum', 'datenschutz', 'nutzungsbedingungen', 'sicherheit']) assert.ok(liste.some((s) => s.slug === slug), slug);
  assert.match((await gast.api('/api/seiten/datenschutz')).json.inhalt, /DSGVO/);
  assert.equal((await moni.api('/api/admin/seiten/impressum', { methode: 'PUT', daten: { titel: 'X', inhalt: 'Y' } })).status, 403);
  const neu = (await admin.api('/api/admin/seiten/impressum', { methode: 'PUT', daten: { titel: 'Impressum', inhalt: '# Impressum\n\nMax Muster' } })).json;
  assert.equal(neu.inhalt, '# Impressum\n\nMax Muster');
  assert.equal((await gast.api('/api/seiten/impressum')).json.inhalt, '# Impressum\n\nMax Muster');
});

test('Moderatoren bearbeiten auch IGDB-Einträge – Importe überschreiben das nicht', async () => {
  const treffer = (await nina.api('/api/katalog/suche?q=IGDB Spiel')).json.online[0];
  assert.equal((await nina.api(`/api/katalog/${treffer.id}`, { methode: 'PUT', daten: { beschreibung: 'Hack' } })).status, 403);
  const geaendert = (await moni.api(`/api/katalog/${treffer.id}`, { methode: 'PUT', daten: { beschreibung: 'Deutsche Beschreibung' } })).json;
  assert.equal(geaendert.beschreibung, 'Deutsche Beschreibung');
  assert.equal(geaendert.manuell_bearbeitet, 1);
  server.kontext.cache.raeumeAuf();
  server.db.prepare('DELETE FROM api_cache').run();
  await nina.api('/api/katalog/suche?q=IGDB Spiel'); // erneuter Import
  assert.equal((await nina.api(`/api/katalog/${treffer.id}`)).json.beschreibung, 'Deutsche Beschreibung');
});

test('Eingriff in ein anderes Administrator-Konto nur mit eigenem Passwort', async () => {
  const liste = (await admin.api('/api/admin/benutzer')).json;
  const ninaId = liste.find((b) => b.benutzername === 'nina').id;
  // Normale Benutzer: wie bisher ohne Bestätigung
  assert.equal((await post(admin, `/api/admin/benutzer/${ninaId}/passwort`, { neuesPasswort: 'ganz-neues-passwort-1' })).status, 200);
  // Nina wird Administratorin – ab jetzt braucht ein Eingriff die Bestätigung
  await admin.api(`/api/admin/benutzer/${ninaId}`, { methode: 'PUT', daten: { rolle: 'admin' } });
  let r = await post(admin, `/api/admin/benutzer/${ninaId}/passwort`, { neuesPasswort: 'noch-ein-passwort-2' });
  assert.equal(r.status, 403);
  assert.equal(r.json.code, 'bestaetigung_noetig');
  r = await post(admin, `/api/admin/benutzer/${ninaId}/passwort`, { neuesPasswort: 'noch-ein-passwort-2', passwort: 'falsch' });
  assert.equal(r.status, 403);
  assert.equal((await post(admin, `/api/admin/benutzer/${ninaId}/2fa-zuruecksetzen`, {})).status, 403);
  r = await post(admin, `/api/admin/benutzer/${ninaId}/passwort`, { neuesPasswort: 'noch-ein-passwort-2', passwort: 'sehr-geheimes-passwort' });
  assert.equal(r.status, 200, r.text);
  assert.equal((await post(admin, `/api/admin/benutzer/${ninaId}/2fa-zuruecksetzen`, { passwort: 'sehr-geheimes-passwort' })).status, 200);
  await admin.api(`/api/admin/benutzer/${ninaId}`, { methode: 'PUT', daten: { rolle: 'nutzer' } });
});

test('Rolle entziehen, sperren und löschen eines Administrators nur mit eigenem Passwort', async () => {
  const liste = (await admin.api('/api/admin/benutzer')).json;
  const ninaId = liste.find((b) => b.benutzername === 'nina').id;
  await admin.api(`/api/admin/benutzer/${ninaId}`, { methode: 'PUT', daten: { rolle: 'admin' } });
  // Ohne Passwort: abgelehnt, nichts geändert
  let r = await admin.api(`/api/admin/benutzer/${ninaId}`, { methode: 'PUT', daten: { rolle: 'nutzer' } });
  assert.equal(r.status, 403);
  assert.equal(r.json.code, 'bestaetigung_noetig');
  assert.equal((await admin.api(`/api/admin/benutzer/${ninaId}`, { methode: 'PUT', daten: { gesperrt: true } })).status, 403);
  assert.equal((await admin.api(`/api/admin/benutzer/${ninaId}`, { methode: 'DELETE' })).status, 403);
  assert.equal((await admin.api('/api/admin/benutzer')).json.find((b) => b.id === ninaId).rolle, 'admin');
  // Speicherlimit oder Beförderung brauchen keine Bestätigung
  assert.equal((await admin.api(`/api/admin/benutzer/${ninaId}`, { methode: 'PUT', daten: { speicher_limit_mb: 10 } })).status, 200);
  // Mit Passwort geht es
  r = await admin.api(`/api/admin/benutzer/${ninaId}`, { methode: 'PUT', daten: { rolle: 'nutzer', passwort: 'sehr-geheimes-passwort' } });
  assert.equal(r.status, 200, r.text);
  assert.equal((await admin.api('/api/admin/benutzer')).json.find((b) => b.id === ninaId).rolle, 'nutzer');
});
