// Fotos des Gegenstands (Modul, Disc, Verpackung …): eigene Arten neben den Scans, getrennt teilbar (PHOTO_SHARING),
// Einwilligung zur öffentlichen Anzeige nur für Fotos und nur durch den Fotografen selbst.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { starteTestServer } from './hilfen.js';
import { gesuchteFotos, datentraegerVon, istFotoArt } from '../shared/konstanten.js';
import { medienDateien, webDateiVon, kameraAusExif } from '../server/services/medien.js';
import { exifAusJpeg } from '../shared/exif.js';

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
  assert.deepEqual(gesuchteFotos('spiel', { kurz: 'N64' }), ['foto_modul', 'foto_vorne', 'foto_hinten']);
  assert.deepEqual(gesuchteFotos('spiel', { kurz: 'PS1' }).slice(0, 1), ['foto_disc']);
  assert.deepEqual(gesuchteFotos('spiel', null), ['foto_vorne', 'foto_hinten'], 'ohne Plattform kein Datenträger');
  // „Alles zusammen“ wird nicht gesucht; Anleitung und Beilagen nur, wenn am Exemplar angehakt
  assert.deepEqual(gesuchteFotos('spiel', { kurz: 'PS4' }, { beilagen: { ovp: true, anleitung: true } }), ['foto_disc', 'foto_vorne', 'foto_hinten', 'foto_anleitung']);
  assert.deepEqual(gesuchteFotos('spiel', { kurz: 'PS4' }, { beilagen: { ovp: true, anleitung: false, poster: true } }), ['foto_disc', 'foto_vorne', 'foto_hinten', 'foto_beilagen']);
  assert.deepEqual(gesuchteFotos('spiel', { kurz: 'PS4' }, { beilagen: {} }), ['foto_disc', 'foto_vorne', 'foto_hinten']);
  assert.ok(!gesuchteFotos('spiel', { kurz: 'PS4' }, { versiegelt: true, beilagen: { anleitung: true } }).includes('foto_anleitung'), 'eingeschweißt: kein Anleitungsfoto');
  assert.deepEqual(gesuchteFotos('konsole', { kurz: 'SNES' }), ['foto_geraet', 'foto_vorne', 'foto_detail']);
  assert.equal(istFotoArt('foto_modul'), true);
  assert.equal(istFotoArt('cover_vorne'), false);
  assert.equal(istFotoArt('label'), false);
  assert.equal(webDateiVon('m-abc.jpg'), 'm-abc-web.webp');
  assert.deepEqual(medienDateien({ datei: 'm-a.png', anzeige_datei: null, vorschau_datei: 'm-a-vorschau.webp' }), ['m-a.png', 'm-a-vorschau.webp', 'm-a-web.webp', 'm-a-helfer.webp']);
  assert.deepEqual(medienDateien({ datei: 'm-b.webp', frei_datei: 'm-b-frei.webp', frei_status: 'angenommen' }),
    ['m-b.webp', 'm-b-frei.webp', 'm-b-web.webp', 'm-b-frei-web.webp', 'm-b-helfer.webp'], 'freigestellte Fassung samt Web-Version fällt mit dem Foto weg');
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

test('Fotos einer Variante zuordnen: nur passende, sichtbare Varianten', async () => {
  const server = await starteTestServer({ env: { PHOTO_SHARING: 'true' } });
  try {
    const admin = await server.registriere('admin');
    const anna = await server.registriere('anna');
    const bernd = await server.registriere('bernd');
    const artikel = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Mario Kart 64', plattform: 'Nintendo 64' } })).json;
    const foto = (await hochladen(anna, artikel.id, { puffer: await jpeg(), felder: { art: 'foto_modul' } })).json;
    const katalogId = foto.katalog_id;
    server.db.prepare("UPDATE katalog SET status = 'freigegeben' WHERE id = ?").run(katalogId); // gemeinsamer Katalog (ohne Moderationsoberfläche)
    const pal = (await admin.api(`/api/katalog/${katalogId}/varianten`, { methode: 'POST', daten: { bezeichnung: 'PAL', region: 'pal_eu', veroeffentlichen: true } })).json;
    const fremd = (await bernd.api(`/api/katalog/${katalogId}/varianten`, { methode: 'POST', daten: { bezeichnung: 'Bernds Privatvariante' } })).json;
    const anderesSpiel = (await bernd.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'F-Zero X', plattform: 'Nintendo 64' } })).json;
    const f2 = (await hochladen(bernd, anderesSpiel.id, { puffer: await jpeg(), felder: { art: 'foto_modul' } })).json;
    const andereVariante = (await bernd.api(`/api/katalog/${f2.katalog_id}/varianten`, { methode: 'POST', daten: { bezeichnung: 'NTSC' } })).json;
    assert.ok(andereVariante.id && fremd.id && pal.id);

    // Beim Hochladen und nachträglich
    let r = await hochladen(anna, artikel.id, { puffer: await jpeg(), felder: { art: 'foto_vorne', variante_id: String(pal.id) } });
    assert.equal(r.status, 201, r.text);
    assert.deepEqual([r.json.variante_id, r.json.variante], [pal.id, 'PAL']);
    r = await anna.api(`/api/medien/${foto.id}`, { methode: 'PUT', daten: { variante_id: pal.id } });
    assert.equal(r.json.variante, 'PAL');
    // Variante eines anderen Spiels oder die private Variante eines anderen Benutzers: abgelehnt
    for (const v of [andereVariante.id, fremd.id, 999999]) {
      assert.equal((await anna.api(`/api/medien/${foto.id}`, { methode: 'PUT', daten: { variante_id: v } })).status, 400, String(v));
    }
    assert.equal((await hochladen(anna, artikel.id, { puffer: await jpeg(), felder: { art: 'foto_hinten', variante_id: String(andereVariante.id) } })).status, 400);
    // Entfernen
    r = await anna.api(`/api/medien/${foto.id}`, { methode: 'PUT', daten: { variante_id: null } });
    assert.deepEqual([r.json.variante_id, r.json.variante], [null, null]);
  } finally {
    await server.stoppe();
  }
});

test('Abgebrochener Foto-Upload ergibt eine verständliche Meldung statt „Interner Serverfehler“', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const artikel = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Donkey Kong 64', plattform: 'Nintendo 64' } })).json;
    const abgeschnitten = '--X\r\nContent-Disposition: form-data; name="art"\r\n\r\nfoto_vorne\r\n--X\r\n'
      + 'Content-Disposition: form-data; name="datei"; filename="IMG_0001.jpg"\r\nContent-Type: image/jpeg\r\n\r\nabc';
    const r = await anna.api(`/api/artikel/${artikel.id}/medien`, { methode: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=X' }, formular: abgeschnitten });
    assert.equal(r.status, 400);
    assert.match(r.json.fehler, /nicht vollständig/);
  } finally {
    await server.stoppe();
  }
});

test('Fassung am Foto: wird vom Exemplar übernommen, Platinum-Cover nur beim Platinum-Exemplar, korrigierbar', async () => {
  const server = await starteTestServer();
  try {
    const { db } = server;
    await server.registriere('admin');
    const anna = await server.registriere('anna');
    const platin = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Gran Turismo 4', plattform: 'PS2', edition: 'Platinum' } })).json;
    const katalogId = platin.katalog_id;
    const pal = db.prepare("INSERT INTO katalog_varianten (katalog_id, bezeichnung, region, status) VALUES (?, 'PAL-DE', 'pal_de', 'freigegeben') RETURNING id").pluck().get(katalogId);
    db.prepare('UPDATE artikel SET variante_id = ? WHERE id = ?').run(pal, platin.id);

    // Hochladen am Platinum-Exemplar: Fassung kommt vom Exemplar, nicht aus der Bezeichnung
    const foto = (await hochladen(anna, platin.id, { puffer: await jpeg(), felder: { art: 'foto_vorne', variante_id: String(pal) } })).json;
    assert.equal(foto.edition, 'Platinum');
    assert.equal(foto.titel, null);
    db.prepare("UPDATE medien SET sichtbarkeit = 'freigegeben' WHERE id = ?").run(foto.id);

    // Cover: beim Platinum-Exemplar das Platinum-Foto, bei der Erstauflage nicht
    const erst = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Gran Turismo 4', plattform: 'PS2', katalog_id: katalogId, variante_id: pal } })).json;
    const bild = async (id) => (await anna.api(`/api/artikel/${id}`)).json.bild_url;
    assert.match(await bild(platin.id), new RegExp(foto.vorschau_url.split('/').pop()));
    assert.doesNotMatch(String(await bild(erst.id)), new RegExp(foto.vorschau_url.split('/').pop()));

    // Korrektur durch den Fotografen: Fassung leeren → gilt als Erstauflage, geht erneut in die Prüfung
    const geaendert = (await anna.api(`/api/medien/${foto.id}`, { methode: 'PUT', daten: { edition: '' } })).json;
    assert.equal(geaendert.edition, null);
    assert.equal(geaendert.sichtbarkeit, 'eingereicht');
    assert.equal((await anna.api(`/api/medien/${foto.id}`, { methode: 'PUT', daten: { edition: 5 } })).status, 400);
  } finally {
    await server.stoppe();
  }
});

test('Region am Foto: vom Exemplar übernommen, PAL-UK-Cover nicht beim deutschen Exemplar, korrigierbar', async () => {
  const server = await starteTestServer();
  try {
    const { db } = server;
    await server.registriere('admin');
    const anna = await server.registriere('anna');
    const uk = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'FIFA 12', plattform: 'PS3', region: 'pal_uk' } })).json;
    const katalogId = uk.katalog_id;
    const foto = (await hochladen(anna, uk.id, { puffer: await jpeg(), felder: { art: 'foto_vorne' } })).json;
    assert.equal(foto.region, 'pal_uk');
    db.prepare("UPDATE medien SET sichtbarkeit = 'freigegeben' WHERE id = ?").run(foto.id);
    db.prepare("UPDATE katalog SET status = 'freigegeben' WHERE id = ?").run(katalogId);

    // Cover: beim UK-Exemplar das UK-Foto, beim deutschen nicht
    const de = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'FIFA 12', plattform: 'PS3', katalog_id: katalogId, region: 'pal_de' } })).json;
    const datei = new RegExp(foto.vorschau_url.split('/').pop());
    const bild = async (id) => (await anna.api(`/api/artikel/${id}`)).json.bild_url;
    assert.match(await bild(uk.id), datei);
    assert.doesNotMatch(String(await bild(de.id)), datei);
    // Spieleseite: das Foto gilt als Cover der Region PAL-UK (auch ohne Variante)
    const eintrag = (await anna.api(`/api/katalog/${katalogId}`)).json;
    assert.ok(eintrag.cover_regionen.some((c) => c.region === 'pal_uk' && c.quelle === 'community'));

    // Korrektur: Region ändern → erneut prüfen; unbekannte Region abgelehnt; leer = unbekannt
    const geaendert = (await anna.api(`/api/medien/${foto.id}`, { methode: 'PUT', daten: { region: 'pal_de' } })).json;
    assert.equal(geaendert.region, 'pal_de');
    assert.equal(geaendert.sichtbarkeit, 'eingereicht');
    // Andere Region als das (UK-)Exemplar: gehört nicht mehr dazu, bleibt beim Spiel
    assert.equal(geaendert.artikel_id, null);
    assert.equal(db.prepare('SELECT katalog_id FROM medien WHERE id = ?').pluck().get(foto.id), katalogId);
    // Gleiche Region wie das Exemplar: bleibt dabei
    const deFoto = (await hochladen(anna, de.id, { puffer: await jpeg(), felder: { art: 'foto_hinten' } })).json;
    assert.equal((await anna.api(`/api/medien/${deFoto.id}`, { methode: 'PUT', daten: { region: 'pal_de' } })).json.artikel_id, de.id);
    assert.equal((await anna.api(`/api/medien/${foto.id}`, { methode: 'PUT', daten: { region: 'mars' } })).status, 400);
    assert.equal((await anna.api(`/api/medien/${foto.id}`, { methode: 'PUT', daten: { region: '' } })).json.region, null);
  } finally {
    await server.stoppe();
  }
});

test('Migration: bestehende Spielfotos bekommen die Fassung, wenn der Hochladende nur eine hat', async () => {
  const path = await import('node:path');
  const os = await import('node:os');
  const { oeffneDatenbank } = await import('../server/db.js');
  const datei = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fassung-')), 'test.db');
  let db = oeffneDatenbank(datei);
  const benutzer = db.prepare("INSERT INTO benutzer (benutzername, passwort_hash) VALUES ('fritz', 'x') RETURNING id").pluck().get();
  const katalog = (titel) => db.prepare("INSERT INTO katalog (quelle, externe_id, typ, titel, plattformen, status) VALUES ('eigen', ?, 'spiel', ?, '[]', 'freigegeben') RETURNING id").pluck().get(`test:${titel}`, titel);
  const eins = katalog('Eins');
  const zwei = katalog('Zwei');
  const exemplar = (k, edition) => db.prepare("INSERT INTO artikel (benutzer_id, typ, titel, katalog_id, edition) VALUES (?, 'spiel', 'x', ?, ?)").run(benutzer, k, edition);
  exemplar(eins, 'Platinum');
  exemplar(zwei, 'Platinum');
  exemplar(zwei, null); // zwei Fassungen → offen lassen
  const foto = (k) => db.prepare(`INSERT INTO medien (katalog_id, benutzer_id, art, sichtbarkeit, datei, mime, groesse)
    VALUES (?, ?, 'foto_vorne', 'freigegeben', ?, 'image/webp', 1) RETURNING id`).pluck().get(k, benutzer, `f${k}.webp`);
  const f1 = foto(eins);
  const f2 = foto(zwei);
  db.prepare('UPDATE medien SET edition = NULL').run();
  db.pragma(`user_version = ${db.pragma('user_version', { simple: true }) - 9}`); // Fassung, Kameradaten, vier Freistell-Migrationen, Avatar, Exemplar und Region am Foto
  db.close();
  db = oeffneDatenbank(datei);
  const edition = (id) => db.prepare('SELECT edition FROM medien WHERE id = ?').pluck().get(id);
  assert.equal(edition(f1), 'Platinum');
  assert.equal(edition(f2), null);
  db.close();
});

test('Kameradaten: nur der Hinweis „Original hatte Hersteller/Modell“ wird gespeichert, die Daten selbst nicht', async () => {
  // Lesen der EXIF-Tags Make/Model
  const exif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } })
    .withExif({ IFD0: { Make: 'Apple', Model: 'iPhone 15' } }).jpeg().toBuffer();
  assert.equal(kameraAusExif((await sharp(exif).metadata()).exif), 'Apple iPhone 15');
  assert.equal(kameraAusExif(undefined), null);
  assert.equal(kameraAusExif(Buffer.from('Exif\0\0kaputt')), null);
  // JPEG-Kopf im Browser: APP1-Block finden
  assert.equal(kameraAusExif(exifAusJpeg(new Uint8Array(exif))), 'Apple iPhone 15');
  assert.equal(exifAusJpeg(new Uint8Array(await jpeg())), null);

  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const artikel = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Kamerafoto', plattform: 'PS2' } })).json;
    const mitKamera = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#224488' } })
      .withExif({ IFD0: { Make: 'Apple', Model: 'iPhone 15' } }).jpeg().toBuffer();
    const a = (await hochladen(anna, artikel.id, { puffer: mitKamera, felder: { art: 'foto_vorne' } })).json;
    const b = (await hochladen(anna, artikel.id, { puffer: await jpeg(), felder: { art: 'foto_hinten' } })).json;
    const kamera = (id) => server.db.prepare('SELECT kamera_daten FROM medien WHERE id = ?').pluck().get(id);
    assert.deepEqual([kamera(a.id), kamera(b.id)], [1, 0]);
    // Im Browser zugeschnitten (Kameradaten dabei verworfen): der Browser meldet sie vorher
    const c = (await hochladen(anna, artikel.id, { puffer: await jpeg(), felder: { art: 'foto_disc', kamera_original: '1' } })).json;
    assert.equal(kamera(c.id), 1);
    // Die gespeicherte Datei enthält die Kameradaten nicht mehr
    const original = await anna.api(a.original_url);
    assert.equal(original.status, 200);
    assert.equal(kameraAusExif((await sharp(original.puffer).metadata()).exif), null);
  } finally {
    await server.stoppe();
  }
});

test('Exemplar am Foto: Upload merkt sich das Exemplar, nur der Fotograf sieht die Zuordnung', async () => {
  const server = await starteTestServer({ env: { PHOTO_SHARING: 'true', MEDIA_SHARING: 'true' } });
  try {
    const anna = await server.registriere('anna');
    const bernd = await server.registriere('bernd');
    const k = server.db.prepare(`INSERT INTO katalog (quelle, externe_id, typ, titel, plattformen, status)
      VALUES ('eigen', 'test:exemplar', 'spiel', 'Zelda', '["Nintendo 64"]', 'freigegeben') RETURNING id`).pluck().get();
    const a1 = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Zelda', plattform: 'Nintendo 64', katalog_id: k } })).json;
    const formular = new FormData();
    formular.append('art', 'foto_modul');
    formular.append('sichtbarkeit', 'eingereicht');
    formular.append('datei', new Blob([await sharp({ create: { width: 50, height: 50, channels: 3, background: '#123456' } }).png().toBuffer()], { type: 'image/png' }), 'f.png');
    const m = (await anna.api(`/api/artikel/${a1.id}/medien`, { methode: 'POST', formular })).json;
    assert.equal(m.artikel_id, a1.id);
    server.db.prepare("UPDATE medien SET sichtbarkeit = 'freigegeben' WHERE id = ?").run(m.id);
    const fremd = (await bernd.api(`/api/katalog/${a1.katalog_id}/medien`)).json.find((x) => x.id === m.id);
    assert.equal(fremd.artikel_id, null, 'andere sehen nicht, zu welchem Exemplar es gehört');
  } finally {
    await server.stoppe();
  }
});
