// Fotos freistellen: Warteschlange, Helfer-Rechte, Maske über das Foto legen, Entscheidung des Fotografen, Fehlerfälle.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { starteTestServer } from './hilfen.js';

let server;
let admin;
let anna;
let bernd;
let annaArtikel;
let berndArtikel;
before(async () => {
  server = await starteTestServer({ env: { PHOTO_SHARING: 'true', MEDIA_SHARING: 'true' } });
  admin = await server.registriere('admin');
  anna = await server.registriere('anna');
  bernd = await server.registriere('bernd');
  annaArtikel = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Super Mario 64', plattform: 'Nintendo 64' } })).json;
  berndArtikel = (await bernd.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Zelda', plattform: 'Nintendo 64' } })).json;
});
after(async () => { await server.stoppe(); });

const foto = () => sharp({ create: { width: 300, height: 200, channels: 3, background: '#cc2244' } }).png().toBuffer();
/** Maske: weißes Rechteck (Motiv) auf Schwarz – `anteil` der Fläche. */
async function maske(anteil = 0.4, breite = 150, hoehe = 100) {
  const motiv = await sharp({ create: { width: Math.round(breite * Math.sqrt(anteil)), height: Math.round(hoehe * Math.sqrt(anteil)), channels: 3, background: '#fff' } }).png().toBuffer();
  return sharp({ create: { width: breite, height: hoehe, channels: 3, background: '#000' } }).composite([{ input: motiv, left: 0, top: 0 }]).greyscale().png().toBuffer();
}
async function hochladen(client, artikelId, { art = 'foto_modul', sichtbarkeit = 'privat' } = {}) {
  const formular = new FormData();
  formular.append('art', art);
  formular.append('sichtbarkeit', sichtbarkeit);
  formular.append('datei', new Blob([await foto()], { type: 'image/png' }), 'foto.png');
  const r = await client.api(`/api/artikel/${artikelId}/medien`, { methode: 'POST', formular });
  assert.equal(r.status, 201, r.text);
  return r.json;
}
const rohBild = (client, pfad, puffer, methode = 'PUT') => client.api(pfad, { methode, formular: puffer, headers: { 'Content-Type': 'image/png' } });
const auftragZu = (medienId) => server.db.prepare('SELECT * FROM freistell_auftraege WHERE medien_id = ?').get(medienId);
const mediumVon = async (client, katalogId, id) => (await client.api(`/api/katalog/${katalogId}/medien`)).json.find((m) => m.id === id);

test('Upload reiht Fotos des Gegenstands ein, Scans und Details nicht', async () => {
  const modul = await hochladen(anna, annaArtikel.id, { art: 'foto_modul' });
  assert.equal(auftragZu(modul.id)?.status, 'offen');
  const detail = await hochladen(anna, annaArtikel.id, { art: 'foto_detail' });
  assert.equal(auftragZu(detail.id), undefined, 'Detailfotos werden nicht freigestellt');
  assert.equal(modul.frei_status, null);
  assert.equal(modul.frei_url, null);
});

test('Helfen dürfen nur Freigeschaltete mit Häkchen – Admins brauchen nur das Häkchen', async () => {
  assert.equal((await anna.api('/api/freistellen/naechste')).status, 403);
  assert.equal((await admin.api('/api/freistellen/naechste')).status, 403, 'Admin ohne Häkchen');
  const stand = (await admin.api('/api/konto')).json.freistellen;
  assert.deepEqual(stand, { aktiv: true, freigeschaltet: true, hilft: false, darfHelfen: false, limit: 50, heute: 0, zuPruefen: 0 });
  await admin.api('/api/konto', { methode: 'PUT', daten: { freistellen_hilft: true } });
  assert.equal((await admin.api('/api/konto')).json.freistellen.darfHelfen, true);
  assert.equal((await anna.api('/api/konto')).json.freistellen.freigeschaltet, false);
});

test('Helfer holt Auftrag, liefert Maske – Fotograf prüft, nimmt an oder verwirft', async () => {
  const modul = (await anna.api(`/api/katalog/${annaArtikel.katalog_id}/medien`)).json.find((m) => m.art === 'foto_modul');
  const r = await admin.api('/api/freistellen/naechste?anzahl=5');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.auftraege.length, 1);
  const auftrag = r.json.auftraege[0];
  assert.equal(auftrag.medien_id, modul.id);
  assert.equal((await admin.api('/api/freistellen/naechste')).json.auftraege.length, 0, 'reserviert – nicht noch einmal');
  // Bild nur für den, der den Auftrag hält – verkleinert als WebP, nie das Original
  const bild = await admin.api(auftrag.bild_url);
  assert.equal(bild.status, 200);
  const bildMeta = await sharp(bild.puffer).metadata();
  assert.equal(bildMeta.format, 'webp');
  assert.ok(bildMeta.width <= 1200 && bildMeta.height <= 1200);
  assert.equal((await bernd.api(auftrag.bild_url)).status, 404);
  // Maske in anderer Größe – der Server skaliert sie
  const ok = await rohBild(admin, `/api/freistellen/${auftrag.id}`, await maske(0.4));
  assert.equal(ok.status, 200, ok.text);
  assert.equal(auftragZu(modul.id).status, 'fertig');

  let m = await mediumVon(anna, annaArtikel.katalog_id, modul.id);
  assert.equal(m.frei_status, 'fertig');
  assert.match(m.frei_pruefen_url, /-frei\.webp$/);
  assert.equal(m.frei_url, null, 'vor der Entscheidung nirgends gezeigt');
  const datei = m.frei_pruefen_url.replace('/api/dateien/', '');
  const meta = await sharp(server.kontext.dateien.pfadVon(datei)).metadata();
  assert.equal(meta.hasAlpha, true);
  // Auf das Motiv zugeschnitten (Maske: Rechteck oben links, gut 60 % der Breite) mit etwas Rand
  assert.ok(meta.width > 150 && meta.width < 300, `Breite ${meta.width}`);
  assert.ok(meta.height > 100 && meta.height < 200, `Höhe ${meta.height}`);
  assert.equal((await anna.api(m.frei_pruefen_url)).status, 200, 'eigene Datei abrufbar');
  const nachricht = (await anna.api('/api/benachrichtigungen')).json.eintraege.find((b) => /freigestellt/.test(b.titel));
  assert.ok(nachricht, 'Fotograf wird benachrichtigt');
  assert.equal(nachricht.link, '#/freistellen-pruefen');
  // Seite „Freistellungen prüfen“: eigenes Foto mit Original und freigestellter Version; privat – der Admin sieht es nicht
  const liste = (await anna.api('/api/freistellen/pruefen')).json;
  assert.equal(liste.gesamt, 1);
  assert.equal(liste.fotos[0].id, modul.id);
  assert.equal(liste.fotos[0].frei_url, m.frei_pruefen_url);
  assert.equal(liste.fotos[0].eigenes, true);
  assert.equal((await anna.api('/api/konto')).json.freistellen.zuPruefen, 1);
  assert.equal((await admin.api('/api/freistellen/pruefen')).json.fotos.some((f) => f.id === modul.id), false);
  assert.equal((await bernd.api('/api/freistellen/pruefen')).json.gesamt, 0);

  // Fremde dürfen nicht entscheiden
  assert.equal((await bernd.api(`/api/medien/${modul.id}/freistellen/entscheiden`, { methode: 'POST', daten: { annehmen: true } })).status, 404);
  const an = await anna.api(`/api/medien/${modul.id}/freistellen/entscheiden`, { methode: 'POST', daten: { annehmen: true } });
  assert.equal(an.status, 200, an.text);
  m = await mediumVon(anna, annaArtikel.katalog_id, modul.id);
  assert.equal(m.frei_status, 'angenommen');
  assert.deepEqual((await anna.api('/api/freistellen/pruefen')).json, { gesamt: 0, fotos: [] }, 'nichts mehr zu tun');
  assert.match(m.frei_url, /-frei\.webp$/);
  // Ansicht „Übernommen“: zum Zurücknehmen – nur eigene (Bernd sieht nichts)
  const uebernommen = (await anna.api('/api/freistellen/pruefen?uebernommen=1')).json;
  assert.deepEqual(uebernommen.fotos.map((f) => f.id), [modul.id]);
  assert.equal(uebernommen.fotos[0].katalog_typ, 'spiel');
  assert.equal((await bernd.api('/api/freistellen/pruefen?uebernommen=1')).json.gesamt, 0);
  // Verwerfen löscht die Datei, Original bleibt
  const ab = await anna.api(`/api/medien/${modul.id}/freistellen/entscheiden`, { methode: 'POST', daten: { annehmen: false } });
  assert.equal(ab.status, 200);
  assert.equal((await anna.api('/api/freistellen/pruefen?uebernommen=1')).json.gesamt, 0, 'zurückgenommen');
  m = await mediumVon(anna, annaArtikel.katalog_id, modul.id);
  assert.equal(m.frei_status, 'abgelehnt');
  assert.equal(m.frei_url, null);
  await new Promise((weiter) => { setTimeout(weiter, 50); }); // Datei wird im Hintergrund gelöscht
  assert.equal(fs.existsSync(server.kontext.dateien.pfadVon(datei)), false);
  assert.equal((await anna.api(m.url)).status, 200);
});

test('Freigeschaltete Nutzer bekommen nur geteilte Fotos; unplausible Masken zählen als Fehlversuch', async () => {
  // Admin schaltet Bernd frei (Benachrichtigung), Bernd setzt das Häkchen
  const berndId = (await admin.api('/api/admin/benutzer')).json.find((b) => b.benutzername === 'bernd').id;
  assert.equal((await admin.api(`/api/admin/benutzer/${berndId}`, { methode: 'PUT', daten: { freistellen_helfer: true } })).status, 200);
  assert.ok((await bernd.api('/api/benachrichtigungen')).json.eintraege.some((b) => /Freistellen helfen/.test(b.titel)));
  assert.equal((await bernd.api('/api/konto')).json.freistellen.freigeschaltet, true);
  await bernd.api('/api/konto', { methode: 'PUT', daten: { freistellen_hilft: true } });
  assert.equal((await admin.api('/api/admin/benutzer')).json.find((b) => b.id === berndId).freistellen_hilft, 1);

  const privat = await hochladen(anna, annaArtikel.id, { art: 'foto_vorne', sichtbarkeit: 'privat' });
  const geteilt = await hochladen(anna, annaArtikel.id, { art: 'foto_hinten', sichtbarkeit: 'eingereicht' });
  const r = await bernd.api('/api/freistellen/naechste');
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.auftraege.map((a) => a.medien_id), [geteilt.id], 'privates Foto bleibt beim Moderationsteam');
  const auftrag = r.json.auftraege[0];
  assert.equal(auftragZu(privat.id).status, 'offen');

  // Maske fast leer → abgelehnt, Auftrag wieder offen
  const leer = await rohBild(bernd, `/api/freistellen/${auftrag.id}`, await maske(0.005));
  assert.equal(leer.status, 400);
  assert.match(leer.json.felder.maske, /unplausibel/);
  assert.equal(auftragZu(geteilt.id).status, 'offen');
  assert.equal(auftragZu(geteilt.id).versuche, 1);
  // Erneut holen, melden „geht nicht“, dann nach drei Fehlversuchen endgültig
  let erneut = (await bernd.api('/api/freistellen/naechste')).json.auftraege[0];
  assert.equal((await bernd.api(`/api/freistellen/${erneut.id}/fehler`, { methode: 'POST', daten: {} })).status, 200);
  erneut = (await bernd.api('/api/freistellen/naechste')).json.auftraege[0];
  assert.equal((await bernd.api(`/api/freistellen/${erneut.id}/fehler`, { methode: 'POST', daten: {} })).status, 200);
  assert.equal(auftragZu(geteilt.id).status, 'fehler');
  assert.equal((await bernd.api('/api/freistellen/naechste')).json.auftraege.length, 0);
  // Ohne Reservierung keine Abgabe
  assert.equal((await rohBild(bernd, `/api/freistellen/${erneut.id}`, await maske())).status, 409);
});

test('Abgelaufene Reservierung wird wieder frei; eigenes Foto direkt mit Maske vom starken Handy', async () => {
  const m = await hochladen(bernd, berndArtikel.id, { art: 'foto_figur' });
  const r = await admin.api('/api/freistellen/naechste');
  assert.ok(r.json.auftraege.some((a) => a.medien_id === m.id));
  server.db.prepare('UPDATE freistell_auftraege SET reserviert_bis = ? WHERE medien_id = ?').run(Date.now() - 1000, m.id);
  assert.equal(server.kontext.freistellen.raeumeAuf() >= 1, true);
  assert.equal(auftragZu(m.id).status, 'offen');

  // Fotograf liefert selbst, hat das Ergebnis schon gesehen → sofort angenommen; Auftrag erledigt
  const eigen = await rohBild(bernd, `/api/medien/${m.id}/freistellen?angenommen=1`, await maske(0.5, 300, 200));
  assert.equal(eigen.status, 200, eigen.text);
  assert.equal(eigen.json.frei_status, 'angenommen');
  assert.equal(auftragZu(m.id).status, 'fertig');
  const sicht = await mediumVon(bernd, berndArtikel.katalog_id, m.id);
  assert.match(sicht.frei_url, /-frei\.webp$/);
  // Fremde dürfen keine Maske zu meinem Foto schicken; Detailfotos sind nicht freistellbar
  assert.equal((await rohBild(anna, `/api/medien/${m.id}/freistellen`, await maske())).status, 404);
  const detail = await hochladen(bernd, berndArtikel.id, { art: 'foto_detail' });
  assert.equal((await rohBild(bernd, `/api/medien/${detail.id}/freistellen`, await maske())).status, 400);

  // Löschen des Fotos räumt die freigestellte Datei weg
  const datei = sicht.frei_url.replace('/api/dateien/', '');
  assert.equal(fs.existsSync(server.kontext.dateien.pfadVon(datei)), true);
  assert.equal((await bernd.api(`/api/medien/${m.id}`, { methode: 'DELETE' })).status, 204);
  await new Promise((weiter) => { setTimeout(weiter, 50); });
  assert.equal(fs.existsSync(server.kontext.dateien.pfadVon(datei)), false);
});

test('Tageslimit je Helfer: nur so viele Aufträge, danach leer bis zum nächsten Tag', async () => {
  // Admin hat heute schon einen Auftrag erledigt (Test oben); Limit 2 → genau ein weiterer
  for (let i = 0; i < 3; i++) await hochladen(anna, annaArtikel.id, { art: 'foto_modul' });
  const abgelehnt = await admin.api('/api/konto', { methode: 'PUT', daten: { freistellen_limit: -1 } });
  assert.equal(abgelehnt.status, 400);
  // Heute zählen erledigte und gerade reservierte Aufträge des Admins (aus den Tests oben)
  const vorher = (await admin.api('/api/konto')).json.freistellen.heute;
  assert.ok(vorher >= 1, 'ein erledigter Auftrag von heute zählt');
  assert.equal((await admin.api('/api/konto', { methode: 'PUT', daten: { freistellen_limit: vorher + 1 } })).status, 200);
  assert.equal((await admin.api('/api/konto')).json.freistellen.limit, vorher + 1);
  let r = (await admin.api('/api/freistellen/naechste?anzahl=20')).json;
  assert.equal(r.auftraege.length, 1, 'Limit minus bisherige = genau einer');
  assert.equal(r.rest, 0);
  assert.equal(r.limit, vorher + 1);
  r = (await admin.api('/api/freistellen/naechste')).json;
  assert.deepEqual(r.auftraege, []);
  assert.equal(r.heute, vorher + 1, 'reservierter zählt mit');
  // Unbegrenzt: alles, was da ist
  await admin.api('/api/konto', { methode: 'PUT', daten: { freistellen_limit: 0 } });
  r = (await admin.api('/api/freistellen/naechste?anzahl=20')).json;
  assert.ok(r.auftraege.length >= 2);
  assert.equal(r.rest, null);
  assert.equal(r.limit, null);
});

test('Administration: Stand der Warteschlange und Nachholen; Einstellung schaltet alles ab', async () => {
  const stand = (await admin.api('/api/admin/freistellen')).json;
  assert.equal(stand.aktiv, true);
  assert.equal(stand.helfer, 2, 'Admin und Bernd');
  assert.equal((await admin.api('/api/admin/uebersicht')).json.freistellen.aktiv, true);
  // Ein Foto ohne Auftrag (z. B. aus der Zeit vor der Funktion) wird nachgeholt
  const alt = await hochladen(anna, annaArtikel.id, { art: 'foto_modul' }); // Discs kommen nur auf Wunsch dran
  server.db.prepare('DELETE FROM freistell_auftraege WHERE medien_id = ?').run(alt.id);
  const nach = (await admin.api('/api/admin/freistellen/nachholen', { methode: 'POST', daten: {} })).json;
  assert.equal(nach.eingereiht, 1);
  assert.equal(auftragZu(alt.id).status, 'offen');
  assert.equal((await anna.api('/api/admin/freistellen')).status, 403);

  server.kontext.konfiguration.fotosFreistellen = false;
  assert.equal((await admin.api('/api/freistellen/naechste')).status, 404);
  const neu = await hochladen(anna, annaArtikel.id, { art: 'foto_geraet' });
  assert.equal(auftragZu(neu.id), undefined, 'ausgeschaltet: nichts eingereiht');
  assert.equal((await anna.api('/api/konto')).json.freistellen.aktiv, false);
  server.kontext.konfiguration.fotosFreistellen = true;
});

test('Freistellungen prüfen: Moderatoren sehen geteilte Fotos anderer und entscheiden direkt', async () => {
  const geteilt = await hochladen(bernd, berndArtikel.id, { art: 'foto_figur', sichtbarkeit: 'eingereicht' });
  const ok = await rohBild(bernd, `/api/medien/${geteilt.id}/freistellen`, await maske(0.5, 300, 200));
  assert.equal(ok.json.frei_status, 'fertig');
  // Standard: Der Fotograf entscheidet – frische Fotos anderer sieht der Moderator nur mit „alle“
  assert.equal((await admin.api('/api/freistellen/pruefen')).json.fotos.some((x) => x.id === geteilt.id), false);
  const liste = (await admin.api('/api/freistellen/pruefen?alle=1')).json;
  const f = liste.fotos.find((x) => x.id === geteilt.id);
  assert.ok(f, 'geteiltes Foto erscheint beim Moderator mit „alle“');
  assert.equal(f.liegt_lange, false);
  // Nach 30 Tagen ohne Entscheidung erscheint es auch ohne „alle“
  server.db.prepare("UPDATE freistell_auftraege SET erledigt_am = datetime('now', '-31 days') WHERE medien_id = ?").run(geteilt.id);
  server.db.prepare("UPDATE medien SET erstellt_am = datetime('now', '-31 days') WHERE id = ?").run(geteilt.id);
  const lange = (await admin.api('/api/freistellen/pruefen')).json.fotos.find((x) => x.id === geteilt.id);
  assert.equal(lange?.liegt_lange, true);
  assert.equal(f.eigenes, false);
  assert.equal((await admin.api(f.frei_url)).status, 200, 'Datei für den Moderator abrufbar');
  assert.equal((await admin.api(f.url)).status, 200);
  assert.equal((await anna.api('/api/freistellen/pruefen')).json.fotos.some((x) => x.id === geteilt.id), false, 'andere Nutzer sehen es nicht');
  const an = await admin.api(`/api/medien/${geteilt.id}/freistellen/entscheiden`, { methode: 'POST', daten: { annehmen: true } });
  assert.equal(an.status, 200);
  assert.equal((await admin.api('/api/freistellen/pruefen')).json.fotos.some((x) => x.id === geteilt.id), false);
});

test('Migration: Freistell-Spalten kommen auch auf Datenbanken, die die Migrationen an alter Stelle übersprungen haben', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const { oeffneDatenbank } = await import('../server/db.js');
  const datei = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'freistellen-migration-')), 'test.db');
  let db = oeffneDatenbank(datei);
  const ende = db.pragma('user_version', { simple: true });
  // Index direkt hinter der Nachhol-Migration (danach folgen weitere Migrationen, die hier nicht interessieren)
  const nachFreistellen = ende - 4;
  const spalten = (tabelle) => db.prepare(`PRAGMA table_info(${tabelle})`).all().map((sp) => sp.name);
  const benutzer = db.prepare("INSERT INTO benutzer (benutzername, passwort_hash) VALUES ('alt', 'x') RETURNING id").pluck().get();
  /** Stand vor den Freistell-Migrationen herstellen: Spalten und Tabelle weg, Version wie angegeben. */
  const alterStand = (version) => {
    db.exec(`DROP TABLE IF EXISTS freistell_auftraege;
      ALTER TABLE benutzer DROP COLUMN freistellen_helfer; ALTER TABLE benutzer DROP COLUMN freistellen_hilft;
      ALTER TABLE benutzer DROP COLUMN freistellen_limit;
      ALTER TABLE medien DROP COLUMN frei_datei; ALTER TABLE medien DROP COLUMN frei_status;`);
    assert.equal(spalten('medien').includes('frei_datei'), false);
    db.pragma(`user_version = ${version}`);
    db.close();
    db = oeffneDatenbank(datei);
  };
  const vollstaendig = (hinweis) => {
    assert.equal(db.pragma('user_version', { simple: true }), ende, hinweis);
    for (const sp of ['freistellen_helfer', 'freistellen_hilft', 'freistellen_limit']) assert.ok(spalten('benutzer').includes(sp), `${hinweis}: benutzer.${sp}`);
    for (const sp of ['frei_datei', 'frei_status']) assert.ok(spalten('medien').includes(sp), `${hinweis}: medien.${sp}`);
    assert.ok(spalten('freistell_auftraege').includes('erledigt_von'), `${hinweis}: freistell_auftraege.erledigt_von`);
    assert.equal(db.prepare('SELECT freistellen_limit FROM benutzer WHERE id = ?').pluck().get(benutzer), 50, `${hinweis}: Standardlimit`);
  };

  // Bestehende Datenbank vom Stand vor dem Freistellen (letzte Migration: Kameradaten am Foto)
  alterStand(nachFreistellen - 3);
  vollstaendig('Stand vor dem Freistellen');
  // Server, der die Freistell-Version mit den Migrationen mitten in der Liste schon gestartet hat: Version um zwei weiter,
  // Spalten fehlen trotzdem
  alterStand(nachFreistellen - 1);
  vollstaendig('Stand nach dem Start mit Migrationen an alter Stelle');
  // Zwischenstand (nur die erste Freistell-Version gestartet)
  alterStand(nachFreistellen - 2);
  vollstaendig('Zwischenstand');
  // Neu angelegte Datenbank: alle drei noch einmal ausführen ändert nichts
  db.pragma(`user_version = ${nachFreistellen - 3}`);
  db.close();
  db = oeffneDatenbank(datei);
  vollstaendig('Wiederholung auf vollständiger Datenbank');
  db.close();
});

test('Meldungen zu freigestellten Fotos: eine am Tag, die hochzählt – nie per E-Mail', async () => {
  const b = server.kontext.benachrichtigungen;
  const id = (await bernd.api('/api/konto')).json.id;
  const melde = () => b.sendeGesammelt(id, {
    art: 'freistellen', schluessel: 'freistellen',
    titel: (n) => (n === 1 ? 'Ein Foto ist freigestellt – jetzt prüfen' : `${n} Fotos sind freigestellt – jetzt prüfen`),
    link: '#/freistellen-pruefen',
  });
  melde(); melde(); melde();
  const eintraege = (await bernd.api('/api/benachrichtigungen')).json.eintraege.filter((e) => e.link === '#/freistellen-pruefen');
  assert.equal(eintraege.length, 1);
  assert.equal(eintraege[0].titel, '3 Fotos sind freigestellt – jetzt prüfen');
  // E-Mail lässt sich für diese Kategorie nicht einschalten
  b.setzeAuswahl(id, { freistellen: { email: true } });
  const k = b.auswahl(id).kategorien.find((x) => x.id === 'freistellen');
  assert.equal(k.email, false);
  assert.equal(k.ohne_email, true);
});

test('Discs und Disc-Hüllen nur auf Wunsch: nicht automatisch eingereiht, anfordern möglich; Modul-Hüllen weiter automatisch', async () => {
  const ps2 = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Ico', plattform: 'PlayStation 2' } })).json;
  const disc = await hochladen(anna, ps2.id, { art: 'foto_disc' });
  const huelle = await hochladen(anna, ps2.id, { art: 'foto_vorne' });
  assert.equal(auftragZu(disc.id), undefined, 'Disc nicht automatisch');
  assert.equal(auftragZu(huelle.id), undefined, 'Disc-Hülle nicht automatisch');
  const pc = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Diablo', plattform: 'PC' } })).json;
  const pcHuelle = await hochladen(anna, pc.id, { art: 'foto_vorne' });
  assert.equal(auftragZu(pcHuelle.id), undefined, 'PC-Hülle nicht automatisch');
  const modulHuelle = await hochladen(anna, annaArtikel.id, { art: 'foto_vorne' }); // Nintendo 64
  assert.equal(auftragZu(modulHuelle.id)?.status, 'offen', 'Verpackung eines Modul-Spiels weiter automatisch');
  // Am Foto: „Hintergrund entfernen lassen“
  const m = await mediumVon(anna, ps2.katalog_id, disc.id);
  assert.equal(m.frei_anfordern, true);
  assert.equal((await bernd.api(`/api/medien/${disc.id}/freistellen/anfordern`, { methode: 'POST', daten: {} })).status, 404, 'nur der Fotograf');
  const r = await anna.api(`/api/medien/${disc.id}/freistellen/anfordern`, { methode: 'POST', daten: {} });
  assert.equal(r.status, 200, r.text);
  assert.equal(auftragZu(disc.id).status, 'offen');
  assert.equal(auftragZu(disc.id).manuell, 1);
  const nachher = await mediumVon(anna, ps2.katalog_id, disc.id);
  assert.equal(nachher.frei_anfordern, false);
  assert.equal(nachher.frei_in_arbeit, true);
  // Aufräumen nimmt automatisch eingereihte Discs aus der Schlange, angeforderte bleiben; „Nachholen“ reiht Discs nicht ein
  server.db.prepare('INSERT INTO freistell_auftraege (medien_id) VALUES (?)').run(huelle.id);
  server.kontext.freistellen.raeumeAuf();
  assert.equal(auftragZu(huelle.id), undefined);
  assert.equal(auftragZu(disc.id).status, 'offen');
  server.kontext.freistellen.nachholen();
  assert.equal(auftragZu(huelle.id), undefined);
});

test('Freistellungen prüfen: Fotos ohne Fotografen sieht die Moderation immer', async () => {
  const m = await hochladen(bernd, berndArtikel.id, { art: 'foto_modul', sichtbarkeit: 'eingereicht' });
  await rohBild(bernd, `/api/medien/${m.id}/freistellen`, await maske(0.5, 300, 200));
  server.db.prepare("UPDATE medien SET benutzer_id = NULL, sichtbarkeit = 'freigegeben' WHERE id = ?").run(m.id);
  const f = (await admin.api('/api/freistellen/pruefen')).json.fotos.find((x) => x.id === m.id);
  assert.equal(f?.ohne_fotograf, true);
  assert.equal((await anna.api('/api/freistellen/pruefen')).json.fotos.some((x) => x.id === m.id), false, 'nur Moderation');
});

test('Zuschnitt nachholen: vorhandene freigestellte Fassungen werden einmalig auf das Motiv zugeschnitten (neuer Dateiname)', async () => {
  const m = await hochladen(bernd, berndArtikel.id, { art: 'foto_modul' });
  // Alte, ungeschnittene Fassung: 300 × 200, Motiv nur oben links
  const alt = `alt-${m.id}-frei.webp`;
  const motiv = await sharp({ create: { width: 80, height: 60, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
  await sharp({ create: { width: 300, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: motiv, left: 10, top: 10 }]).webp().toFile(server.kontext.dateien.pfadVon(alt));
  server.db.prepare("UPDATE medien SET frei_datei = ?, frei_status = 'angenommen' WHERE id = ?").run(alt, m.id);
  server.db.prepare("DELETE FROM datenpakete WHERE name = 'freistellen-zuschnitt-v1'").run();
  assert.ok(await server.kontext.freistellen.zuschnittNachholen() >= 1);
  const neu = server.db.prepare('SELECT frei_datei FROM medien WHERE id = ?').pluck().get(m.id);
  assert.notEqual(neu, alt);
  const meta = await sharp(server.kontext.dateien.pfadVon(neu)).metadata();
  assert.ok(meta.width < 120 && meta.height < 100, `${meta.width} × ${meta.height}`);
  await new Promise((weiter) => { setTimeout(weiter, 50); });
  assert.equal(fs.existsSync(server.kontext.dateien.pfadVon(alt)), false);
  assert.equal(await server.kontext.freistellen.zuschnittNachholen(), 0, 'nur einmal');
});
