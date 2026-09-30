// Fotos des Gegenstands (Modul, Disc, Verpackung …): eigene Arten neben den Scans, getrennt teilbar (PHOTO_SHARING),
// Einwilligung zur öffentlichen Anzeige nur für Fotos und nur durch den Fotografen selbst.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { starteTestServer } from './hilfen.js';
import { gesuchteFotos, datentraegerVon, istFotoArt } from '../shared/konstanten.js';
import { medienDateien, webDateiVon } from '../server/services/medien.js';

const jpeg = () => sharp({ create: { width: 80, height: 60, channels: 3, background: '#224488' } }).jpeg().toBuffer();

async function hochladen(client, artikelId, { puffer, typ = 'image/jpeg', name = 'foto.jpg', felder = {} }) {
  const formular = new FormData();
  for (const [k, v] of Object.entries(felder)) formular.append(k, v);
  formular.append('datei', new Blob([puffer], { type: typ }), name);
  return client.api(`/api/artikel/${artikelId}/medien`, { methode: 'POST', formular });
}

test('Gesuchte Fotos richten sich nach Art und Datenträger der Plattform', () => {
  assert.equal(datentraegerVon({ kurz: 'N64', name: 'Nintendo 64' }), 'modul');
  assert.equal(datentraegerVon({ kurz: 'PS2' }), 'disc');
  assert.equal(datentraegerVon({ kurz: 'Amiga' }), 'diskette');
  assert.equal(datentraegerVon({ name: 'Sega Dreamcast (JP)' }), 'disc', 'unbekanntes Kürzel: aus dem Namen');
  assert.equal(datentraegerVon({ kurz: 'Sonst.', name: 'Sonstige' }), null);
  assert.deepEqual(gesuchteFotos('spiel', { kurz: 'N64' }), ['foto_modul', 'foto_vorne', 'foto_hinten', 'foto_komplett']);
  assert.deepEqual(gesuchteFotos('spiel', { kurz: 'PS1' }).slice(0, 1), ['foto_disc']);
  assert.deepEqual(gesuchteFotos('spiel', null), ['foto_vorne', 'foto_hinten', 'foto_komplett'], 'ohne Plattform kein Datenträger');
  assert.deepEqual(gesuchteFotos('konsole', { kurz: 'SNES' }), ['foto_geraet', 'foto_vorne', 'foto_detail']);
  assert.equal(istFotoArt('foto_modul'), true);
  assert.equal(istFotoArt('cover_vorne'), false);
  assert.equal(istFotoArt('label'), false);
  assert.equal(webDateiVon('m-abc.jpg'), 'm-abc-web.webp');
  assert.deepEqual(medienDateien({ datei: 'm-a.png', anzeige_datei: null, vorschau_datei: 'm-a-vorschau.webp' }), ['m-a.png', 'm-a-vorschau.webp', 'm-a-web.webp']);
});

test('Fotos: getrennt von Scans teilbar, Einwilligung nur für Fotos und nur durch den Fotografen', async () => {
  // Wie die Basis-Version: Scans teilen aus, Fotos teilen aus
  const server = await starteTestServer({ env: { MEDIA_SHARING: 'false', PHOTO_SHARING: 'false' } });
  try {
    await server.registriere('admin'); // erstes Konto = Administrator
    const anna = await server.registriere('anna');
    const artikel = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Super Mario 64', plattform: 'Nintendo 64' } })).json;
    assert.equal((await anna.api('/api/status')).json.fotosTeilenErlaubt, false);

    // Privat geht immer
    const privat = await hochladen(anna, artikel.id, { puffer: await jpeg(), felder: { art: 'foto_modul' } });
    assert.equal(privat.status, 201, privat.text);
    assert.equal(privat.json.ist_foto, true);
    assert.equal(privat.json.sichtbarkeit, 'privat');
    assert.equal(privat.json.oeffentlich, false);
    assert.equal(privat.json.oeffentlich_erlaubt, false);
    // Teilen und öffentliche Anzeige sind aus
    let r = await hochladen(anna, artikel.id, { puffer: await jpeg(), felder: { art: 'foto_vorne', sichtbarkeit: 'eingereicht' } });
    assert.equal(r.status, 400);
    assert.match(r.json.felder.sichtbarkeit, /Teilen von Fotos/);
    r = await anna.api(`/api/medien/${privat.json.id}`, { methode: 'PUT', daten: { oeffentlich_erlaubt: true } });
    assert.equal(r.status, 400);

    // Fotos sind Bilder – eine PDF-Datei ist kein Foto
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
    r = await hochladen(anna, artikel.id, { puffer: pdf, typ: 'application/pdf', name: 'modul.pdf', felder: { art: 'foto_modul' } });
    assert.equal(r.status, 400);
    assert.match(r.json.felder.art, /JPG, PNG oder WebP/);
    await new Promise((fertig) => { setTimeout(fertig, 50); }); // Dateien werden im Hintergrund gelöscht
    assert.equal(fs.readdirSync(server.kontext.dateien.verzeichnis).filter((d) => d.endsWith('.pdf')).length, 0, 'abgelehnte Datei gelöscht');
  } finally {
    await server.stoppe();
  }

  // Fotos teilen an, Scans teilen aus
  const s2 = await starteTestServer({ env: { MEDIA_SHARING: 'false', PHOTO_SHARING: 'true' } });
  try {
    const admin = await s2.registriere('admin');
    const anna = await s2.registriere('anna');
    const bernd = await s2.registriere('bernd');
    const artikel = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Super Mario 64', plattform: 'Nintendo 64' } })).json;
    // Scan teilen bleibt verboten
    let r = await hochladen(anna, artikel.id, { puffer: await jpeg(), felder: { art: 'cover_vorne', sichtbarkeit: 'eingereicht' } });
    assert.equal(r.status, 400);
    assert.match(r.json.felder.sichtbarkeit, /Teilen von Scans/);
    // Öffentliche Anzeige für einen Scan: nie
    const scan = (await hochladen(anna, artikel.id, { puffer: await jpeg(), felder: { art: 'cover_vorne' } })).json;
    r = await anna.api(`/api/medien/${scan.id}`, { methode: 'PUT', daten: { oeffentlich_erlaubt: true } });
    assert.equal(r.status, 400);
    assert.match(r.json.felder.oeffentlich_erlaubt, /keine Scans/);

    // Foto mit Einwilligung: wird damit zur Prüfung eingereicht, der Zeitpunkt der Einwilligung ist gespeichert
    r = await hochladen(anna, artikel.id, { puffer: await jpeg(), felder: { art: 'foto_modul', oeffentlich_erlaubt: 'true', name_nennen: 'true' } });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.sichtbarkeit, 'eingereicht');
    assert.equal(r.json.oeffentlich_erlaubt, true);
    assert.equal(r.json.name_nennen, true);
    assert.equal(r.json.oeffentlich, false, 'öffentlich erst nach der Prüfung');
    const zeile = s2.db.prepare('SELECT oeffentlich_erlaubt_am FROM medien WHERE id = ?').get(r.json.id);
    assert.match(zeile.oeffentlich_erlaubt_am, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);

    // Andere (auch Moderatoren) können die Einwilligung nicht für den Fotografen erteilen oder sehen
    const foto = r.json;
    await admin.api(`/api/medien/${foto.id}`, { methode: 'PUT', daten: { oeffentlich_erlaubt: false, name_nennen: false } });
    const nachher = (await anna.api(`/api/medien/${foto.id}`)).json;
    assert.equal(nachher.oeffentlich_erlaubt, true);
    assert.equal(nachher.name_nennen, true);
    const fuerAdmin = (await admin.api(`/api/medien/${foto.id}`)).json;
    assert.equal(fuerAdmin.oeffentlich_erlaubt, true, 'die Moderation sieht die Einwilligung');
    assert.equal(fuerAdmin.name_nennen, undefined);
    // Umwandeln in einen Scan nimmt die Einwilligung zurück
    const umgewandelt = (await anna.api(`/api/medien/${foto.id}`, { methode: 'PUT', daten: { art: 'label' } })).json;
    assert.equal(umgewandelt.oeffentlich_erlaubt, false);
    assert.equal(umgewandelt.ist_foto, false);
    assert.equal(umgewandelt.sichtbarkeit, 'privat', 'Scans teilen ist aus – aus dem eingereichten Foto wird ein privater Scan');

    // Löschen entfernt auch die (später erzeugte) Web-Version
    const f2 = (await hochladen(anna, artikel.id, { puffer: await jpeg(), felder: { art: 'foto_vorne' } })).json;
    const m = s2.db.prepare('SELECT datei FROM medien WHERE id = ?').get(f2.id);
    const web = s2.kontext.dateien.pfadVon(webDateiVon(m.datei));
    fs.writeFileSync(web, 'x');
    assert.equal((await anna.api(`/api/medien/${f2.id}`, { methode: 'DELETE' })).status, 204);
    await new Promise((fertig) => { setTimeout(fertig, 50); });
    assert.equal(fs.existsSync(web), false);
    assert.equal((await bernd.api(`/api/medien/${f2.id}`)).status, 404);
  } finally {
    await s2.stoppe();
  }
});
