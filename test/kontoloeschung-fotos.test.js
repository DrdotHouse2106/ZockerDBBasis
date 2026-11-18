// Konto löschen: geteilte Fotos auf Wunsch anonym der Community überlassen; sonst Lücken melden (Besitzer, Moderation).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { starteTestServer } from './hilfen.js';

let server;
let admin;
let bernd;
before(async () => {
  server = await starteTestServer({ env: { PHOTO_SHARING: 'true', MEDIA_SHARING: 'true' } });
  admin = await server.registriere('admin');
  bernd = await server.registriere('bernd');
});
after(async () => { await server.stoppe(); });

const foto = () => sharp({ create: { width: 200, height: 200, channels: 3, background: '#2244cc' } }).png().toBuffer();
async function fotoHoch(client, artikelId, freigeben = true) {
  const formular = new FormData();
  formular.append('art', 'foto_modul');
  formular.append('sichtbarkeit', freigeben ? 'eingereicht' : 'privat');
  formular.append('datei', new Blob([await foto()], { type: 'image/png' }), 'foto.png');
  const m = (await client.api(`/api/artikel/${artikelId}/medien`, { methode: 'POST', formular })).json;
  if (freigeben) server.db.prepare("UPDATE medien SET sichtbarkeit = 'freigegeben', name_nennen = 1 WHERE id = ?").run(m.id);
  return m;
}
let nr = 0;
/** Freigegebener Katalogeintrag (bleibt beim Löschen des Kontos) und ein Exemplar davon. */
async function spiel(client, titel) {
  nr += 1;
  const k = server.db.prepare(`INSERT INTO katalog (quelle, externe_id, typ, titel, plattformen, status)
    VALUES ('eigen', ?, 'spiel', ?, '["Nintendo 64"]', 'freigegeben') RETURNING id`).pluck().get(`test:loeschen:${nr}`, titel);
  return (await client.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel, plattform: 'Nintendo 64', katalog_id: k } })).json;
}
const loeschen = (client, daten) => client.api('/api/konto', { methode: 'DELETE', daten: { passwort: 'sehr-geheimes-passwort', ...daten } });
const meldungen = async (client) => (await client.api('/api/benachrichtigungen')).json.eintraege;

test('Geteilte Fotos der Community überlassen: bleiben ohne Namen, private werden gelöscht', async () => {
  const anna = await server.registriere('anna');
  const a = await spiel(anna, 'Banjo-Kazooie');
  const geteilt = await fotoHoch(anna, a.id);
  const privat = await fotoHoch(anna, a.id, false);
  assert.equal((await anna.api('/api/konto')).json.geteilte_fotos, 1);
  assert.equal((await loeschen(anna, { fotos_ueberlassen: true })).status, 204);
  const m = server.db.prepare('SELECT benutzer_id, name_nennen, sichtbarkeit, datei FROM medien WHERE id = ?').get(geteilt.id);
  assert.deepEqual({ ...m, datei: undefined }, { benutzer_id: null, name_nennen: 0, sichtbarkeit: 'freigegeben', datei: undefined });
  assert.equal(fs.existsSync(server.kontext.dateien.pfadVon(m.datei)), true);
  assert.equal(server.db.prepare('SELECT COUNT(*) FROM medien WHERE id = ?').pluck().get(privat.id), 0, 'privates Foto weg');
  // Für andere weiter sichtbar – ohne Fotografen
  const liste = (await bernd.api(`/api/katalog/${a.katalog_id}/medien`)).json;
  const f = liste.find((x) => x.id === geteilt.id);
  assert.ok(f);
  assert.equal(f.hochgeladen_von, null);
  assert.equal((await bernd.api(f.url)).status, 200);
  assert.ok((await meldungen(admin)).some((n) => /1 Fotos der Community überlassen/.test(n.titel)));
});

test('Ohne Überlassen: Fotos weg, Besitzer werden einmal gefragt, Moderation bekommt einen anonymen Hinweis', async () => {
  const carla = await server.registriere('carla');
  const c1 = await spiel(carla, 'Diddy Kong Racing');
  const c2 = await spiel(carla, 'Blast Corps');
  const f1 = await fotoHoch(carla, c1.id);
  await fotoHoch(carla, c2.id);
  // Bernd besitzt beide Spiele, Dora hat Foto-Nachfragen abgeschaltet
  await bernd.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Diddy Kong Racing', katalog_id: c1.katalog_id } });
  await bernd.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Blast Corps', katalog_id: c2.katalog_id } });
  const dora = await server.registriere('dora');
  await dora.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Diddy Kong Racing', katalog_id: c1.katalog_id } });
  await dora.api('/api/konto', { methode: 'PUT', daten: { fotos_nachfragen: false } });
  const datei = server.db.prepare('SELECT datei FROM medien WHERE id = ?').pluck().get(f1.id);

  assert.equal((await loeschen(carla)).status, 204);
  assert.equal(server.db.prepare('SELECT COUNT(*) FROM medien WHERE id = ?').pluck().get(f1.id), 0);
  await new Promise((weiter) => { setTimeout(weiter, 50); });
  assert.equal(fs.existsSync(server.kontext.dateien.pfadVon(datei)), false);
  const fuerBernd = (await meldungen(bernd)).filter((n) => /neue(s)? Foto/.test(n.titel));
  assert.equal(fuerBernd.length, 1, 'eine gesammelte Meldung');
  assert.equal(fuerBernd[0].titel, '2 Einträge deiner Sammlung brauchen neue Fotos');
  assert.equal((await meldungen(dora)).some((n) => /neue(s)? Foto/.test(n.titel)), false, 'Foto-Nachfragen abgeschaltet');
  const hinweis = (await meldungen(admin)).find((n) => /2 geteilte Fotos entfernt/.test(n.titel));
  assert.ok(hinweis);
  assert.match(hinweis.text, /2 Einträge haben jetzt kein freigegebenes Foto mehr/);
  assert.doesNotMatch(`${hinweis.titel} ${hinweis.text}`, /carla/i, 'anonym');
});
