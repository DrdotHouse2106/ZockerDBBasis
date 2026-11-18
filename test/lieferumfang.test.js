// Lieferumfang je Ausgabe: Logik (Anzeige, CIB), Vorschlag mit Foto, Bestätigung durch die Moderation, Exemplar mit Ausgabe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { starteTestServer } from './hilfen.js';
import { lieferumfangText, lieferumfangStand, normalisiereLieferumfang, lieferumfangPosten } from '../shared/konstanten.js';

const SPECIAL = { zweite_disc: 1, artbook: 1, schuber: 1, steelbook: 1, code: 1 };

test('Lieferumfang: Text, Prüfung der Eingabe', () => {
  assert.equal(lieferumfangText(SPECIAL), 'Steelbook, Artbook, Schuber, 2 Discs, DLC-Code');
  assert.equal(lieferumfangText({ poster: 2, zweite_disc: 2 }), '3 Discs, 2× Poster');
  assert.equal(lieferumfangText(null), '');
  assert.deepEqual(normalisiereLieferumfang({ artbook: true, unbekannt: 1, poster: 0, figur: 12, code: 3 }), { artbook: 1, code: 3 });
  assert.equal(normalisiereLieferumfang('{"artbook":1}').artbook, 1);
  assert.equal(normalisiereLieferumfang({}), null);
  assert.equal(normalisiereLieferumfang('kaputt{'), null);
  assert.deepEqual(lieferumfangPosten(SPECIAL).map((p) => p.schluessel), ['steelbook', 'artbook', 'schuber', 'zweite_disc', 'code']);
});

test('CIB mit Lieferumfang: alles da = vollständig, sonst „Unvollständig – Artbook fehlt“; ohne Lieferumfang die alte Logik', () => {
  const alles = { ovp: true, anleitung: true, steelbook: true, artbook: true, schuber: true, zweite_disc: true, code: true };
  assert.equal(lieferumfangStand(alles, SPECIAL).text, 'Vollständig (CIB)');
  assert.equal(lieferumfangStand(alles, SPECIAL).cib, true);
  // Anleitung „gab es nicht“ zählt wie vorhanden
  assert.equal(lieferumfangStand({ ...alles, anleitung: 'ohne' }, SPECIAL).cib, true);

  const ohneArtbook = lieferumfangStand({ ...alles, artbook: false }, SPECIAL);
  assert.equal(ohneArtbook.text, 'Unvollständig – Artbook fehlt');
  assert.equal(ohneArtbook.cib, false);
  assert.equal(lieferumfangStand({ ...alles, artbook: false, schuber: false }, SPECIAL).text, 'Unvollständig – Artbook, Schuber fehlen');
  // Eingelöster Code (in der Checkliste nicht mehr „vorhanden“) zählt als fehlend
  assert.deepEqual(lieferumfangStand({ ...alles, code: false }, SPECIAL).fehlt.map((f) => f.schluessel), ['code']);
  // Zu wenige Stück
  assert.equal(lieferumfangStand({ ...alles, poster: 1 }, { ...SPECIAL, poster: 2 }).fehlt[0].schluessel, 'poster');
  // Noch nichts zum Artbook eingetragen: keine Aussage („vollständig“ gibt es erst, wenn alles bestätigt ist)
  const offen = lieferumfangStand({ ovp: true, anleitung: true, steelbook: true }, SPECIAL);
  assert.equal(offen.text, null);
  assert.equal(offen.cib, false);
  assert.equal(offen.offen.length, 4);
  // OVP fehlt → mit aufgeführt
  assert.match(lieferumfangStand({ ...alles, ovp: false }, SPECIAL).text, /^Unvollständig – OVP fehlt$/);

  // Ohne Lieferumfang bleibt es bei OVP + Anleitung
  assert.equal(lieferumfangStand({ ovp: true, anleitung: true }, null).text, 'Vollständig (CIB)');
  assert.equal(lieferumfangStand({ ovp: true, anleitung: false }, null).text, 'Unvollständig – Anleitung fehlt');
  assert.equal(lieferumfangStand({ ovp: true }, null).text, null);
  assert.equal(lieferumfangStand({ ovp: true, anleitung: true }, null).mitLieferumfang, false);
});

const warte = () => new Promise((r) => setTimeout(r, 150)); // Dateien werden im Hintergrund gelöscht

async function foto() {
  return sharp({ create: { width: 300, height: 200, channels: 3, background: '#aa7733' } }).jpeg().toBuffer();
}

test('Lieferumfang vorschlagen (mit Foto), Moderation bestätigt; Foto danach gelöscht; Exemplar sieht den Lieferumfang', async () => {
  const server = await starteTestServer();
  try {
    const { db, kontext } = server;
    const chef = await server.registriere('chef'); // erstes Konto = Administrator
    const anna = await server.registriere('anna');
    const bernd = await server.registriere('bernd');
    const k = kontext.katalog.speichere({ quelle: 'igdb', externe_id: 'game:8801', typ: 'spiel', titel: 'Horizon Forbidden West', plattformen: ['PlayStation 5'] });
    const v = db.prepare("INSERT INTO katalog_varianten (katalog_id, bezeichnung, edition, status) VALUES (?, 'Special Edition', 'Special Edition', 'freigegeben') RETURNING id").pluck().get(k.id);
    const varianten = async (c) => (await c.api(`/api/katalog/${k.id}/varianten`)).json;

    // Eingabe wird geprüft
    const formular = async (lu, mitFoto = true) => {
      const f = new FormData();
      f.append('lieferumfang', JSON.stringify(lu));
      f.append('begruendung', 'eigenes Exemplar');
      if (mitFoto) f.append('foto', new Blob([await foto()], { type: 'image/jpeg' }), 'beilagen.jpg');
      return f;
    };
    assert.equal((await anna.api(`/api/varianten/${v}/lieferumfang`, { methode: 'POST', formular: await formular({ gibtsnicht: 1 }, false) })).status, 400);

    // Vorschlag von Anna: noch nicht übernommen
    const r = await anna.api(`/api/varianten/${v}/lieferumfang`, { methode: 'POST', formular: await formular(SPECIAL) });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.vorgeschlagen, true);
    assert.equal((await varianten(anna))[0].lieferumfang, null, 'erst die Moderation bestätigt');
    const dateiName = db.prepare('SELECT foto FROM lieferumfang_vorschlaege').pluck().get();
    assert.match(dateiName, /^lieferumfang-.*\.webp$/);
    assert.ok(fs.existsSync(path.join(kontext.konfiguration.uploadVerzeichnis, dateiName)));

    // Nur Moderation (und die Einsenderin) sehen Vorschläge und Foto
    assert.equal((await bernd.api('/api/lieferumfang/vorschlaege')).status, 403);
    assert.equal((await bernd.api(`/api/dateien/${dateiName}`)).status, 404);
    assert.equal((await anna.api(`/api/dateien/${dateiName}`)).status, 200);
    const offen = (await chef.api('/api/lieferumfang/vorschlaege')).json;
    assert.equal(offen.length, 1);
    assert.deepEqual([offen[0].text, offen[0].von, offen[0].quelle, offen[0].katalog_titel], ['Steelbook, Artbook, Schuber, 2 Discs, DLC-Code', 'anna', 'sammler', 'Horizon Forbidden West']);
    assert.equal((await chef.api(offen[0].foto_url)).status, 200);

    // Ein neuer Vorschlag derselben Person ersetzt den alten (altes Foto weg)
    await anna.api(`/api/varianten/${v}/lieferumfang`, { methode: 'POST', formular: await formular({ ...SPECIAL, figur: 1 }, false) });
    assert.equal(db.prepare("SELECT COUNT(*) FROM lieferumfang_vorschlaege WHERE status = 'offen'").pluck().get(), 1);
    await warte();
    assert.ok(!fs.existsSync(path.join(kontext.konfiguration.uploadVerzeichnis, dateiName)), 'altes Foto gelöscht');
    const neu = (await anna.api(`/api/varianten/${v}/lieferumfang`, { methode: 'POST', formular: await formular(SPECIAL) }));
    assert.equal(neu.status, 201);
    const foto2 = db.prepare("SELECT foto FROM lieferumfang_vorschlaege WHERE status = 'offen'").pluck().get();

    // Moderation bestätigt (mit Korrektur: ohne DLC-Code)
    const id = (await chef.api('/api/lieferumfang/vorschlaege')).json[0].id;
    assert.equal((await bernd.api(`/api/lieferumfang/vorschlaege/${id}`, { methode: 'POST', daten: { uebernehmen: true } })).status, 403);
    const { code: _code, ...ohneCode } = SPECIAL;
    const ok = await chef.api(`/api/lieferumfang/vorschlaege/${id}`, { methode: 'POST', daten: { uebernehmen: true, lieferumfang: ohneCode } });
    assert.equal(ok.status, 200, ok.text);
    assert.deepEqual((await varianten(bernd))[0].lieferumfang, ohneCode);
    await warte();
    assert.ok(!fs.existsSync(path.join(kontext.konfiguration.uploadVerzeichnis, foto2)), 'Foto nach der Entscheidung gelöscht');
    assert.equal(db.prepare('SELECT status FROM lieferumfang_vorschlaege WHERE id = ?').pluck().get(id), 'uebernommen');
    assert.match(db.prepare("SELECT titel FROM benachrichtigungen WHERE titel LIKE '%Lieferumfang%'").pluck().get(), /übernommen/);

    // Die öffentliche Spieleseite liefert den Lieferumfang je Ausgabe
    const seite = (await bernd.api(`/api/katalog-seite/${k.id}`)).json;
    assert.deepEqual(seite.varianten[0].lieferumfang, ohneCode);

    // Das Exemplar mit dieser Ausgabe kennt den Lieferumfang
    const a = (await bernd.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: k.titel, katalog_id: k.id, variante_id: v, beilagen: { ovp: true, anleitung: 'ohne', artbook: false } } })).json;
    const detail = (await bernd.api(`/api/artikel/${a.id}`)).json;
    assert.deepEqual(detail.variante_lieferumfang, ohneCode);
    assert.equal(lieferumfangStand(detail.beilagen, detail.variante_lieferumfang).text, 'Unvollständig – Artbook fehlt');

    // Ablehnen: nichts ändert sich
    await anna.api(`/api/varianten/${v}/lieferumfang`, { methode: 'POST', formular: await formular({ poster: 1 }, false) });
    const id2 = (await chef.api('/api/lieferumfang/vorschlaege')).json[0].id;
    assert.equal((await chef.api(`/api/lieferumfang/vorschlaege/${id2}`, { methode: 'POST', daten: { uebernehmen: false } })).status, 200);
    assert.deepEqual((await varianten(bernd))[0].lieferumfang, ohneCode);
    assert.equal((await chef.api('/api/lieferumfang/vorschlaege')).json.length, 0);
    assert.equal((await chef.api(`/api/lieferumfang/vorschlaege/${id2}`, { methode: 'POST', daten: { uebernehmen: true } })).status, 404, 'schon entschieden');

    // Die Moderation trägt direkt ein; eigene, noch nicht freigegebene Ausgabe ebenso; unveränderter Vorschlag wird erkannt
    assert.equal((await chef.api(`/api/varianten/${v}/lieferumfang`, { methode: 'POST', formular: await formular(SPECIAL, false) })).json.gespeichert, true);
    assert.deepEqual((await varianten(chef))[0].lieferumfang, SPECIAL);
    assert.equal((await anna.api(`/api/varianten/${v}/lieferumfang`, { methode: 'POST', formular: await formular(SPECIAL, false) })).json.unveraendert, true);
    const eigene = (await bernd.api(`/api/katalog/${k.id}/varianten`, { methode: 'POST', daten: { bezeichnung: 'Meine Edition', lieferumfang: { artbook: 1, poster: 2 } } })).json;
    assert.equal(eigene.lieferumfang, JSON.stringify({ artbook: 1, poster: 2 }));
    assert.equal((await bernd.api(`/api/varianten/${eigene.id}/lieferumfang`, { methode: 'POST', formular: await formular({ figur: 1 }, false) })).json.gespeichert, true);

    // Konto löschen entfernt offene Vorschläge samt Foto
    await anna.api(`/api/varianten/${v}/lieferumfang`, { methode: 'POST', formular: await formular({ steelbook: 1 }) });
    const foto3 = db.prepare("SELECT foto FROM lieferumfang_vorschlaege WHERE status = 'offen'").pluck().get();
    assert.ok(foto3);
    assert.equal((await anna.api('/api/konto', { methode: 'DELETE', daten: { passwort: 'sehr-geheimes-passwort' } })).status, 204);
    assert.equal(db.prepare('SELECT COUNT(*) FROM lieferumfang_vorschlaege').pluck().get(), 0);
    await warte();
    assert.ok(!fs.existsSync(path.join(kontext.konfiguration.uploadVerzeichnis, foto3)));
  } finally {
    await server.stoppe();
  }
});
