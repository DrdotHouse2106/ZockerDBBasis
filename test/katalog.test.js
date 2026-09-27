import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

let server;
let admin;
let moni; // Moderator
let nina; // normaler Nutzer
let otto; // normaler Nutzer
before(async () => {
  server = await starteTestServer();
  admin = await server.registriere('admin');
  moni = await server.registriere('moni');
  nina = await server.registriere('nina');
  otto = await server.registriere('otto');
  const liste = (await admin.api('/api/admin/benutzer')).json;
  await admin.api(`/api/admin/benutzer/${liste.find((b) => b.benutzername === 'moni').id}`, { methode: 'PUT', daten: { rolle: 'moderator' } });
});
after(async () => { await server.stoppe(); });

const post = (c, pfad, daten = {}) => c.api(pfad, { methode: 'POST', daten });

test('Eigene Artikel erzeugen private Katalogeinträge, die andere nicht sehen', async () => {
  const artikel = (await post(nina, '/api/artikel', { typ: 'zubehoer', titel: 'Hori Mini Pad Sonderfarbe', plattform: 'N64', barcode: '4961818000001' })).json;
  assert.ok(artikel.katalog_id);
  assert.equal(artikel.katalog_status, 'privat');
  assert.equal(artikel.plattform, 'Nintendo 64', 'Freitext „N64“ wird der Plattform zugeordnet');
  assert.equal(artikel.plattform_kurz, 'N64');

  assert.equal((await nina.api('/api/katalog/suche?q=Hori Mini')).json.lokal.length, 1);
  assert.equal((await otto.api('/api/katalog/suche?q=Hori Mini')).json.lokal.length, 0);
  assert.equal((await otto.api(`/api/katalog/${artikel.katalog_id}`)).status, 404);
  assert.equal((await otto.api(`/api/katalog/${artikel.katalog_id}/wert`)).status, 404);
  // Gelernter Barcode verrät den privaten Eintrag nicht
  const scan = (await otto.api('/api/katalog/barcode/4961818000001')).json;
  assert.equal(scan.treffer.length, 0);
  assert.equal((await nina.api('/api/katalog/barcode/4961818000001')).json.treffer[0].id, artikel.katalog_id);
  // Fremder privater Eintrag darf nicht verknüpft werden
  const r = await post(otto, '/api/artikel', { typ: 'zubehoer', titel: 'Klau', katalog_id: artikel.katalog_id });
  assert.equal(r.status, 400);
});

test('Plattformen sind feste Kategorien mit Kürzel und Filter', async () => {
  await post(otto, '/api/artikel', { typ: 'spiel', titel: 'Astro Bot', plattform: 'PS5' });
  await post(otto, '/api/artikel', { typ: 'konsole', titel: 'PlayStation 5 Slim', plattform: 'PlayStation 5' });
  const plattformen = (await otto.api('/api/artikel/plattformen')).json;
  const ps5 = plattformen.find((p) => p.kurz === 'PS5');
  assert.equal(ps5.anzahl, 2);
  assert.equal(ps5.hersteller, 'Sony');
  const gefiltert = (await otto.api(`/api/artikel?plattform_id=${ps5.id}`)).json;
  assert.equal(gefiltert.length, 2);
  const alle = (await otto.api('/api/plattformen')).json;
  assert.ok(alle.length >= 40);
  assert.equal(alle.find((p) => p.id === ps5.id).meine, 2);
  // Nur das Moderationsteam darf Plattformen anlegen
  assert.equal((await post(otto, '/api/moderation/plattformen', { name: 'Evercade', kurz: 'EVC', hersteller: 'Blaze' })).status, 403);
  assert.equal((await post(moni, '/api/moderation/plattformen', { name: 'Evercade', kurz: 'EVC', hersteller: 'Blaze', aliase: 'Evercade VS' })).status, 201);
  const evercade = (await post(otto, '/api/artikel', { typ: 'konsole', titel: 'Evercade VS', plattform: 'Evercade VS' })).json;
  assert.equal(evercade.plattform, 'Evercade');
});

test('Kommentare sind privat', async () => {
  const k = (await post(moni, '/api/katalog', { typ: 'spiel', titel: 'Kommentar-Test', veroeffentlichen: true })).json;
  const kommentar = (await post(nina, `/api/katalog/${k.id}/kommentare`, { text: 'Suche noch die USK-Version' })).json;
  assert.equal((await nina.api(`/api/katalog/${k.id}/kommentare`)).json.length, 1);
  assert.equal((await otto.api(`/api/katalog/${k.id}/kommentare`)).json.length, 0);
  assert.equal((await otto.api(`/api/kommentare/${kommentar.id}`, { methode: 'DELETE' })).status, 404);
  const geaendert = (await nina.api(`/api/kommentare/${kommentar.id}`, { methode: 'PUT', daten: { text: 'Gefunden!' } })).json;
  assert.equal(geaendert.text, 'Gefunden!');
  assert.equal((await post(nina, `/api/katalog/${k.id}/kommentare`, { text: '  ' })).status, 400);
});

test('Varianten: freigegebene Liste + private Vorschläge, Exemplare je Variante', async () => {
  const ps1 = (await post(moni, '/api/katalog', { typ: 'konsole', titel: 'PlayStation', plattformen: ['PlayStation'], veroeffentlichen: true })).json;
  const v1 = (await post(moni, `/api/katalog/${ps1.id}/varianten`, { modellnummer: 'SCPH-1002', region: 'pal_eu', erscheinungsjahr: 1995, veroeffentlichen: true })).json;
  assert.equal(v1.bezeichnung, 'SCPH-1002');
  assert.equal(v1.status, 'freigegeben');
  const v2 = (await post(moni, `/api/katalog/${ps1.id}/varianten`, { bezeichnung: 'PSone', modellnummer: 'SCPH-102', veroeffentlichen: true })).json;
  const eigene = (await post(nina, `/api/katalog/${ps1.id}/varianten`, { bezeichnung: 'Debug-Station', modellnummer: 'DTL-H1202', einreichen: true })).json;
  assert.equal(eigene.status, 'eingereicht');

  assert.equal((await otto.api(`/api/katalog/${ps1.id}/varianten`)).json.length, 2, 'eingereichte Variante ist für andere unsichtbar');
  assert.equal((await nina.api(`/api/katalog/${ps1.id}/varianten`)).json.length, 3);

  // Zwei Exemplare derselben Konsole in unterschiedlichen Revisionen
  await post(otto, '/api/artikel', { typ: 'konsole', titel: 'PlayStation', katalog_id: ps1.id, variante_id: v1.id, modellnummer: 'SCPH-1002' });
  await post(otto, '/api/artikel', { typ: 'konsole', titel: 'PlayStation', katalog_id: ps1.id, variante_id: v2.id });
  const fremdeVariante = await post(otto, '/api/artikel', { typ: 'konsole', titel: 'PlayStation', katalog_id: ps1.id, variante_id: eigene.id });
  assert.equal(fremdeVariante.status, 400);

  const seite = (await otto.api(`/api/katalog-seite/${ps1.id}`)).json;
  assert.equal(seite.meineExemplare.length, 2);
  assert.deepEqual(seite.varianten.map((v) => v.meine), [1, 1]);

});
