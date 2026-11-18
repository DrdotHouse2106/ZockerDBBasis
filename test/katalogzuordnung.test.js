// Katalogeintrag am Exemplar wählen, Filter „ohne Katalogeintrag“, Barcode-Zuordnung und frühere Titel (weitere_titel).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

const post = (c, pfad, daten) => c.api(pfad, { methode: 'POST', daten });
const put = (c, pfad, daten) => c.api(pfad, { methode: 'PUT', daten });

test('Filter „Ohne Katalogeintrag“: ohne katalog_id oder nur mit eigenem privatem Eintrag', async () => {
  const server = await starteTestServer();
  try {
    const { db, kontext } = server;
    const chef = await server.registriere('chef');
    const anna = await server.registriere('anna');
    const offiziell = (await post(chef, '/api/katalog', { typ: 'spiel', titel: 'Super Metroid', plattformen: ['Super Nintendo'], veroeffentlichen: true })).json;
    const mitKatalog = (await post(anna, '/api/artikel', { typ: 'spiel', titel: 'Super Metroid', katalog_id: offiziell.id, plattform: 'Super Nintendo' })).json;
    const eigener = (await post(anna, '/api/artikel', { typ: 'spiel', titel: 'Selbstgebautes Spiel', plattform: 'Super Nintendo' })).json; // bekommt einen eigenen privaten Eintrag
    assert.ok(eigener.katalog_id, 'eigener privater Eintrag');
    const ohne = db.prepare("INSERT INTO artikel (typ, titel, benutzer_id, bestand) VALUES ('spiel', 'Ganz ohne', (SELECT id FROM benutzer WHERE benutzername = 'anna'), 'besitz') RETURNING id").pluck().get();
    const ids = (await anna.api('/api/artikel?ohne_katalog=1')).json.map((a) => a.id).sort();
    assert.deepEqual(ids, [eigener.id, ohne].sort());
    assert.ok(!ids.includes(mitKatalog.id));
    assert.equal((await anna.api('/api/artikel')).json.length, 3);
    // Ein eigener Eintrag, der freigegeben wurde, zählt als Katalogeintrag
    db.prepare("UPDATE katalog SET status = 'freigegeben' WHERE id = ?").run(eigener.katalog_id);
    assert.deepEqual((await anna.api('/api/artikel?ohne_katalog=1')).json.map((a) => a.id), [ohne]);
    assert.ok(kontext);
  } finally { await server.stoppe(); }
});

test('Anderen Katalogeintrag wählen: Verknüpfung, Ausgabe zurück, Barcode-Zuordnung, ungenutzter eigener Eintrag wird gelöscht', async () => {
  const server = await starteTestServer();
  try {
    const { db, kontext } = server;
    const chef = await server.registriere('chef');
    const anna = await server.registriere('anna');
    const bernd = await server.registriere('bernd');
    const idVon = (n) => db.prepare('SELECT id FROM benutzer WHERE benutzername = ?').pluck().get(n);
    const richtig = (await post(chef, '/api/katalog', { typ: 'spiel', titel: 'Zelda Link to the Past', plattformen: ['Super Nintendo'], veroeffentlichen: true })).json;
    const v = db.prepare("INSERT INTO katalog_varianten (katalog_id, bezeichnung, status) VALUES (?, 'Alt', 'freigegeben') RETURNING id").pluck().get(richtig.id);
    const zuordnungen = (code) => db.prepare('SELECT katalog_id, benutzer_id FROM barcode_zuordnungen WHERE code = ? ORDER BY benutzer_id, katalog_id').all(code);

    // Exemplar mit Barcode und eigenem privatem Eintrag
    const artikel = (await post(anna, '/api/artikel', { typ: 'spiel', titel: 'Zelda LttP', barcode: '4902370500001', plattform: 'Super Nintendo' })).json;
    const privat = artikel.katalog_id;
    assert.equal(db.prepare('SELECT status FROM katalog WHERE id = ?').pluck().get(privat), 'privat');
    assert.deepEqual(zuordnungen('4902370500001'), [{ katalog_id: privat, benutzer_id: idVon('anna') }]);
    db.prepare('UPDATE artikel SET variante_id = NULL WHERE id = ?').run(artikel.id);
    // Fremde Zuordnung desselben Codes bleibt
    kontext.katalog.verknuepfeBarcode('4902370500001', richtig.id, idVon('bernd'));

    // Auswahl: unbekannt / nicht sichtbar → Fehler
    assert.equal((await post(anna, `/api/artikel/${artikel.id}/katalog`, { katalog_id: 99999 })).status, 400);
    assert.equal((await post(anna, `/api/artikel/${artikel.id}/katalog`, {})).status, 400);
    assert.equal((await post(bernd, `/api/artikel/${artikel.id}/katalog`, { katalog_id: richtig.id })).status, 404, 'nur eigene Exemplare');
    const privatBernd = (await post(bernd, '/api/artikel', { typ: 'spiel', titel: 'Berndiges', plattform: 'Super Nintendo' })).json.katalog_id;
    assert.equal((await post(anna, `/api/artikel/${artikel.id}/katalog`, { katalog_id: privatBernd })).status, 400, 'fremder privater Eintrag nicht sichtbar');

    // Wechsel
    db.prepare('UPDATE artikel SET variante_id = ? WHERE id = ?').run(v, artikel.id);
    const r = await post(anna, `/api/artikel/${artikel.id}/katalog`, { katalog_id: richtig.id });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.artikel.katalog_id, richtig.id);
    assert.equal(r.json.artikel.variante_id, null, 'Ausgabe zurückgesetzt');
    assert.equal(r.json.artikel.titel, 'Zelda LttP', 'eigene Angaben bleiben');
    assert.equal(r.json.eigener_eintrag_geloescht, true);
    assert.equal(db.prepare('SELECT 1 FROM katalog WHERE id = ?').get(privat), undefined, 'ungenutzter privater Eintrag gelöscht');
    assert.deepEqual(zuordnungen('4902370500001'), [{ katalog_id: richtig.id, benutzer_id: idVon('anna') }, { katalog_id: richtig.id, benutzer_id: idVon('bernd') }]);
    assert.equal((await anna.api('/api/artikel?ohne_katalog=1')).json.length, 0);

    // Erneut dasselbe: nichts passiert; ein anderer Eintrag mit Verwendung bleibt erhalten
    assert.equal((await post(anna, `/api/artikel/${artikel.id}/katalog`, { katalog_id: richtig.id })).json.eigener_eintrag_geloescht, false);
    const zweites = (await post(anna, '/api/artikel', { typ: 'spiel', titel: 'Noch eins', plattform: 'Super Nintendo' })).json;
    const zweitesPrivat = zweites.katalog_id;
    const drittes = (await post(anna, '/api/artikel', { typ: 'spiel', titel: 'Noch eins', katalog_id: zweitesPrivat, plattform: 'Super Nintendo' })).json;
    const w = await post(anna, `/api/artikel/${zweites.id}/katalog`, { katalog_id: richtig.id });
    assert.equal(w.json.eigener_eintrag_geloescht, false, 'ein anderes Exemplar nutzt den Eintrag noch');
    assert.ok(db.prepare('SELECT 1 FROM katalog WHERE id = ?').get(zweitesPrivat));
    assert.ok(drittes);

    // Freigegebene Einträge werden nie gelöscht
    const frei = (await post(chef, '/api/katalog', { typ: 'spiel', titel: 'Freigegeben', veroeffentlichen: true })).json;
    const x = (await post(chef, '/api/artikel', { typ: 'spiel', titel: 'Freigegeben', katalog_id: frei.id, plattform: 'Super Nintendo' })).json;
    assert.equal((await post(chef, `/api/artikel/${x.id}/katalog`, { katalog_id: richtig.id })).json.eigener_eintrag_geloescht, false);
    assert.ok(db.prepare('SELECT 1 FROM katalog WHERE id = ?').get(frei.id));
  } finally { await server.stoppe(); }
});

test('Normales Bearbeiten mit anderem katalog_id entfernt die alte eigene Barcode-Zuordnung', async () => {
  const server = await starteTestServer();
  try {
    const { db, kontext } = server;
    const chef = await server.registriere('chef');
    const anna = await server.registriere('anna');
    const bernd = await server.registriere('bernd');
    const idVon = (n) => db.prepare('SELECT id FROM benutzer WHERE benutzername = ?').pluck().get(n);
    const alt = (await post(chef, '/api/katalog', { typ: 'spiel', titel: 'Alter Treffer', veroeffentlichen: true })).json;
    const neu = (await post(chef, '/api/katalog', { typ: 'spiel', titel: 'Neuer Treffer', veroeffentlichen: true })).json;
    const artikel = (await post(anna, '/api/artikel', { typ: 'spiel', titel: 'Spiel', katalog_id: alt.id, barcode: '0012345678905', plattform: 'Game Boy' })).json;
    kontext.katalog.verknuepfeBarcode('0012345678905', alt.id, idVon('bernd'));
    const zeilen = () => db.prepare('SELECT katalog_id, benutzer_id FROM barcode_zuordnungen WHERE code = ? ORDER BY benutzer_id').all('0012345678905');
    assert.deepEqual(zeilen(), [{ katalog_id: alt.id, benutzer_id: idVon('anna') }, { katalog_id: alt.id, benutzer_id: idVon('bernd') }]);
    assert.equal((await put(anna, `/api/artikel/${artikel.id}`, { katalog_id: neu.id })).status, 200);
    assert.deepEqual(zeilen(), [{ katalog_id: neu.id, benutzer_id: idVon('anna') }, { katalog_id: alt.id, benutzer_id: idVon('bernd') }]);
    // Ohne Änderung des Katalogeintrags bleibt alles
    assert.equal((await put(anna, `/api/artikel/${artikel.id}`, { notizen: 'x', katalog_id: neu.id })).status, 200);
    assert.equal(zeilen().length, 2);
    assert.ok(bernd);
  } finally { await server.stoppe(); }
});

test('Umbenennen: der bisherige Titel steht in weitere_titel, wird gesucht und auf der Katalogseite genannt', async () => {
  const server = await starteTestServer();
  try {
    const { db, kontext } = server;
    const chef = await server.registriere('chef');
    const eintrag = (await post(chef, '/api/katalog', { typ: 'spiel', titel: 'Tamriel Unlimited', plattformen: ['PlayStation 4'], veroeffentlichen: true })).json;
    assert.equal(db.prepare('SELECT weitere_titel FROM katalog WHERE id = ?').pluck().get(eintrag.id), null);
    // Moderation benennt um
    const r = await put(chef, `/api/katalog/${eintrag.id}`, { typ: 'spiel', titel: 'The Elder Scrolls Online', plattformen: ['PlayStation 4'] });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(JSON.parse(db.prepare('SELECT weitere_titel FROM katalog WHERE id = ?').pluck().get(eintrag.id)), ['Tamriel Unlimited']);
    // Suche findet beide Titel
    for (const q of ['Tamriel Unlimited', 'tamriel', 'Elder Scrolls']) {
      assert.deepEqual((await chef.api(`/api/katalog/suche?q=${encodeURIComponent(q)}`)).json.lokal.map((e) => e.id), [eintrag.id], q);
    }
    // Tippfehler im früheren Titel
    assert.deepEqual(kontext.katalog.sucheLokal('Tamrel Unlimitd', 'spiel', { id: 0 }).map((e) => e.id), [eintrag.id]);
    // Katalogseite
    const seite = (await chef.api(`/api/katalog-seite/${eintrag.id}`)).json;
    assert.deepEqual(seite.eintrag.weitere_titel, ['Tamriel Unlimited']);
    // Weitere Umbenennung: neuester zuerst, kein Doppeltes, aktueller Titel nie in der Liste, Rückbenennung räumt auf
    await put(chef, `/api/katalog/${eintrag.id}`, { typ: 'spiel', titel: 'ESO', plattformen: ['PlayStation 4'] });
    assert.deepEqual(JSON.parse(db.prepare('SELECT weitere_titel FROM katalog WHERE id = ?').pluck().get(eintrag.id)), ['The Elder Scrolls Online', 'Tamriel Unlimited']);
    await put(chef, `/api/katalog/${eintrag.id}`, { typ: 'spiel', titel: 'Tamriel Unlimited', plattformen: ['PlayStation 4'] });
    assert.deepEqual(JSON.parse(db.prepare('SELECT weitere_titel FROM katalog WHERE id = ?').pluck().get(eintrag.id)), ['ESO', 'The Elder Scrolls Online']);
    // Gleicher Titel (nur Groß-/Kleinschreibung der Bearbeitung ohne Änderung): nichts Neues
    await put(chef, `/api/katalog/${eintrag.id}`, { typ: 'spiel', titel: 'Tamriel Unlimited', plattformen: ['PlayStation 4'] });
    assert.deepEqual(JSON.parse(db.prepare('SELECT weitere_titel FROM katalog WHERE id = ?').pluck().get(eintrag.id)), ['ESO', 'The Elder Scrolls Online']);
    // Import (speichere) mit neuem Titel merkt sich den alten ebenfalls
    const igdb = kontext.katalog.speichere({ quelle: 'igdb', externe_id: 'game:4711', typ: 'spiel', titel: 'Erster Titel', plattformen: ['PlayStation 4'] });
    kontext.katalog.speichere({ quelle: 'igdb', externe_id: 'game:4711', typ: 'spiel', titel: 'Zweiter Titel', plattformen: ['PlayStation 4'] });
    assert.deepEqual(JSON.parse(db.prepare('SELECT weitere_titel FROM katalog WHERE id = ?').pluck().get(igdb.id)), ['Erster Titel']);
  } finally { await server.stoppe(); }
});
