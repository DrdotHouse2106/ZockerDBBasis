// Sicherheitsprüfung: Ersteinrichtung über das Internet, Drosselung von Anmeldeversuchen, Bilder ohne Metadaten,
// Erkennung interner Adressen (SSRF-Schutz) und Prüfung importierter Katalogeinträge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { starteTestServer } from './hilfen.js';
import { istInterneAdresse } from '../server/services/netz.js';
import { jpegOhneMetadaten } from '../server/services/medien.js';

const PASSWORT = 'sehr-geheimes-passwort';
const GPS = { IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '52/1 31/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '13/1 24/1 0/1' } };

test('Interne Adressen werden auch in IPv6-Schreibweisen erkannt', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.178.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '[::1]', '::',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::7f00:1', '64:ff9b::a9fe:a9fe', '64:ff9b:1::1', '2002:c0a8:0101::1', '2001:0:4136:e378::1',
    'fc00::1', 'fd12:3456::1', 'fe80::1', 'fe80::1%eth0', 'fec0::1', 'ff02::1', '100::1', 'kein-ip', '']) {
    assert.equal(istInterneAdresse(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2a00:1450:4001:82a::200e', '2606:4700::1111', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:0808:0808::1']) {
    assert.equal(istInterneAdresse(ip), false, ip);
  }
});

test('Ersteinrichtung über das Internet bzw. einen Proxy braucht den Code aus dem Server-Protokoll', async () => {
  const server = await starteTestServer();
  const ausgaben = [];
  const original = console.log;
  console.log = (...teile) => { ausgaben.push(teile.join(' ')); };
  try {
    const gast = server.client();
    const proxy = { 'X-Forwarded-For': '203.0.113.9' };
    const status = (await gast.api('/api/auth/status', { headers: proxy })).json;
    assert.equal(status.ersteinrichtung, true);
    assert.equal(status.einrichtungscode, true);
    const code = ausgaben.join('\n').match(/Administrator\): ([A-Z2-7]{4}(?:-[A-Z2-7]{4}){3})/)?.[1];
    assert.ok(code, 'Code im Protokoll');
    assert.equal(JSON.stringify(status).includes(code), false, 'der Code selbst steht nur im Protokoll');
    const registrieren = (extra) => gast.api('/api/auth/registrieren', {
      methode: 'POST', headers: proxy, daten: { benutzername: 'chefin', passwort: PASSWORT, bedingungen_akzeptiert: true, ...extra },
    });
    let r = await registrieren({});
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'einrichtungscode');
    assert.equal((await registrieren({ einrichtungscode: 'AAAA-AAAA-AAAA-AAAA' })).status, 403);
    r = await registrieren({ einrichtungscode: code.toLowerCase().replace(/-/g, ' ') }); // Groß-/Kleinschreibung und Trenner egal
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.benutzer.rolle, 'admin');
    // Danach ist keine Ersteinrichtung mehr – kein Code nötig
    assert.equal((await server.client().api('/api/auth/status', { headers: proxy })).json.einrichtungscode, false);
  } finally {
    console.log = original;
    await server.stoppe();
  }
});

test('Anmeldeversuche werden je öffentlicher IP-Adresse gedrosselt (auch mit wechselnden Benutzernamen)', async () => {
  const server = await starteTestServer({ env: { TRUST_PROXY: 'loopback' } }); // wie hinter einem Reverse-Proxy
  try {
    await server.registriere('admin');
    const gast = server.client();
    const anmelden = (benutzername, ip, passwort = 'falsch-falsch-falsch') => gast.api('/api/auth/anmelden', {
      methode: 'POST', headers: { 'X-Forwarded-For': ip }, daten: { benutzername, passwort },
    });
    for (let i = 0; i < 30; i++) assert.equal((await anmelden(`name${i}`, '203.0.113.7')).status, 401);
    assert.equal((await anmelden('noch-einer', '203.0.113.7')).status, 429, 'Password-Spraying gestoppt');
    assert.equal((await anmelden('admin', '203.0.113.7', PASSWORT)).status, 429, 'auch mit richtigem Passwort erst nach Ablauf');
    // Andere Besucher sind nicht betroffen
    assert.equal((await anmelden('admin', '198.51.100.20', PASSWORT)).status, 200);
    // Interne Adressen (z. B. ein Proxy ohne TRUST_PROXY) sperren nicht alle gemeinsam
    for (let i = 0; i < 31; i++) await anmelden(`intern${i}`, '10.0.0.5');
    assert.equal((await anmelden('admin', '10.0.0.5', PASSWORT)).status, 200);
  } finally {
    await server.stoppe();
  }
});

test('Passwort ändern: falsches bisheriges Passwort wird gedrosselt', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const aendern = (altesPasswort) => anna.api('/api/konto/passwort', { methode: 'POST', daten: { altesPasswort, neuesPasswort: 'ein-neues-passwort' } });
    for (let i = 0; i < 10; i++) assert.equal((await aendern('falsch-falsch')).status, 400);
    assert.equal((await aendern(PASSWORT)).status, 429);
  } finally {
    await server.stoppe();
  }
});

test('Fotos und Scans werden ohne Metadaten (GPS) gespeichert – JPEG verlustfrei', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const artikel = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Zelda' } })).json;
    const roh = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#3366cc' } }).jpeg({ quality: 90 }).toBuffer();
    const mitGps = await sharp(roh).withExif(GPS).jpeg({ quality: 90 }).toBuffer();
    assert.ok((await sharp(mitGps).metadata()).exif, 'Testbild enthält EXIF');

    // Artikelfoto
    const formular = new FormData();
    formular.append('bild', new Blob([mitGps], { type: 'image/jpeg' }), 'handy.jpg');
    const r = await anna.api(`/api/artikel/${artikel.id}/bild`, { methode: 'POST', formular });
    assert.equal(r.status, 200, r.text);
    const gespeichert = fs.readFileSync(server.kontext.dateien.pfadVon(r.json.bild_datei));
    const meta = await sharp(gespeichert).metadata();
    assert.equal(meta.exif, undefined, 'keine EXIF-Daten mehr');
    assert.equal(r.json.bild_groesse, gespeichert.length);
    // Pixel unverändert (verlustfrei, keine Neukodierung)
    assert.deepEqual(await sharp(gespeichert).raw().toBuffer(), await sharp(mitGps).raw().toBuffer());

    // Gedrehtes Handyfoto (EXIF-Ausrichtung 6): wird aufrecht gespeichert, ebenfalls ohne Metadaten
    const gedreht = await sharp(roh).withExif(GPS).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const f2 = new FormData();
    f2.append('bild', new Blob([gedreht], { type: 'image/jpeg' }), 'hochkant.jpg');
    const r2 = await anna.api(`/api/artikel/${artikel.id}/bild`, { methode: 'POST', formular: f2 });
    const m2 = await sharp(fs.readFileSync(server.kontext.dateien.pfadVon(r2.json.bild_datei))).metadata();
    assert.equal(m2.exif, undefined);
    assert.deepEqual([m2.width, m2.height], [48, 64], 'aufrecht gedreht');

    // Scan (PNG mit EXIF) – Original ohne Metadaten
    const png = await sharp(roh).withExif(GPS).png().toBuffer();
    const f3 = new FormData();
    f3.append('art', 'cover_vorne');
    f3.append('datei', new Blob([png], { type: 'image/png' }), 'scan.png');
    const scan = await anna.api(`/api/artikel/${artikel.id}/medien`, { methode: 'POST', formular: f3 });
    assert.equal(scan.status, 201, scan.text);
    const original = fs.readFileSync(server.kontext.dateien.pfadVon(scan.json.original_url.split('/').pop()));
    assert.equal((await sharp(original).metadata()).exif, undefined);

    // Kaputte Datei wird abgelehnt statt gespeichert
    const f4 = new FormData();
    f4.append('bild', new Blob([Buffer.from('<html>kein Bild</html>')], { type: 'image/jpeg' }), 'falsch.jpg');
    assert.equal((await anna.api(`/api/artikel/${artikel.id}/bild`, { methode: 'POST', formular: f4 })).status, 400);
  } finally {
    await server.stoppe();
  }
});

test('JPEG-Bereinigung: angehängte Zusatzbilder und Kommentare fallen weg', async () => {
  const bild = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } }).withExif(GPS).jpeg().toBuffer();
  const angehaengt = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).withExif(GPS).jpeg().toBuffer();
  const sauber = jpegOhneMetadaten(Buffer.concat([bild, angehaengt]));
  assert.ok(sauber);
  assert.equal(sauber.includes(Buffer.from('Exif\0\0')), false);
  assert.deepEqual(sauber.subarray(-2), Buffer.from([0xff, 0xd9]));
  assert.equal(jpegOhneMetadaten(Buffer.from('kein jpeg')), null);
});

test('JSON-Import prüft eigene Katalogeinträge wie beim Anlegen', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const r = await anna.api('/api/import', {
      methode: 'POST',
      daten: {
        artikel: [{ typ: 'spiel', titel: 'Gut', katalog_id: 1 }, { typ: 'spiel', titel: 'Kaputt', katalog_id: 2 }],
        eigeneKatalogeintraege: [
          { id: 1, externe_id: 'a', typ: 'spiel', titel: 'Gut', plattformen: '["SNES"]', cover_url: 'javascript:alert(1)' },
          { id: 2, externe_id: 'b', typ: 'boese', titel: 'x'.repeat(5000) },
        ],
      },
    });
    assert.equal(r.status, 200, r.text);
    const eigene = server.db.prepare("SELECT titel, typ, cover_url, plattformen FROM katalog WHERE quelle = 'eigen'").all();
    assert.equal(eigene.length, 1, 'ungültiger Eintrag übersprungen');
    assert.equal(eigene[0].cover_url, null, 'nur http(s)-Bildadressen');
    assert.deepEqual(JSON.parse(eigene[0].plattformen), ['SNES']);
  } finally {
    await server.stoppe();
  }
});
