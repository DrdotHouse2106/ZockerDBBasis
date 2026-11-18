import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standardPlattform, suchPlattform, istComputer } from '../shared/plattformwahl.js';
import { starteTestServer } from './hilfen.js';

const PS4 = { id: 1, name: 'PlayStation 4' };
const PC = { id: 2, name: 'PC' };
const XONE = { id: 3, name: 'Xbox One' };

test('Standard-Plattform: eigenes Exemplar → Meine Systeme → erste Konsole, PC nur zuletzt', () => {
  assert.equal(standardPlattform([PC, PS4, XONE]), PS4.id, 'erste Konsole statt PC');
  assert.equal(standardPlattform([PC]), PC.id, 'PC, wenn es nichts anderes gibt');
  assert.equal(standardPlattform([]), null);
  assert.equal(standardPlattform([PC, PS4, XONE], { eigene: PC.id }), PC.id, 'eigenes Exemplar zuerst – auch PC');
  assert.equal(standardPlattform([PC, PS4, XONE], { eigene: 99 }), PS4.id, 'Exemplar einer fremden Plattform zählt nicht');
  assert.equal(standardPlattform([PC, PS4, XONE], { systeme: new Set([XONE.id]) }), XONE.id, 'Meine Systeme vor erster Konsole');
  assert.equal(standardPlattform([PC, PS4, XONE], { systeme: new Set([PC.id, XONE.id]) }), XONE.id, 'bei Meine Systeme Konsole vor PC');
  assert.equal(standardPlattform([PC, PS4], { systeme: new Set([PC.id]) }), PC.id, 'nur PC unter Meine Systeme');
  assert.equal(suchPlattform(['PC', 'PlayStation 4']), 'PlayStation 4');
  assert.ok(istComputer('PC (Microsoft Windows)'));
});

test('Spieleseite: ?plattform filtert eigene Exemplare, ohne Parameter wie bisher', async () => {
  const server = await starteTestServer();
  try {
    const { db } = server;
    const id = db.prepare("INSERT INTO katalog (quelle, externe_id, typ, titel, plattformen, status) VALUES ('eigen', 'pw1', 'spiel', 'Mehrplattformspiel', '[\"PC\",\"PlayStation 4\",\"Xbox One\"]', 'freigegeben') RETURNING id").pluck().get();
    const pid = (name) => db.prepare('SELECT id FROM plattformen WHERE name = ?').pluck().get(name);
    const [pc, ps4, xone] = [pid('PC'), pid('PlayStation 4'), pid('Xbox One')];
    for (const p of [pc, ps4, xone]) db.prepare('INSERT INTO katalog_plattformen (katalog_id, plattform_id) VALUES (?, ?)').run(id, p);
    const anna = await server.registriere('anna');

    // Ohne Exemplar und ohne Meine Systeme: erste Konsole (nicht PC)
    let s = (await anna.api(`/api/katalog-seite/${id}?plattform=auto`)).json;
    assert.deepEqual(s.plattformWahl, { gewaehlt: ps4, standard: ps4 });
    // Meine Systeme
    assert.equal((await anna.api('/api/konto', { methode: 'PUT', daten: { meine_systeme: [pc, xone] } })).status, 200);
    s = (await anna.api(`/api/katalog-seite/${id}?plattform=auto`)).json;
    assert.equal(s.plattformWahl.standard, xone, 'Meine Systeme, Konsole vor PC');

    // Eigenes Exemplar entscheidet
    const neu = async (plattform) => (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Mehrplattformspiel', katalog_id: id, plattform } })).json;
    const aufPc = await neu('PC');
    const aufPs4 = await neu('PlayStation 4');
    s = (await anna.api(`/api/katalog-seite/${id}?plattform=auto`)).json;
    assert.equal(s.plattformWahl.standard, pc, 'Plattform des (ersten) eigenen Exemplars');
    assert.deepEqual(s.meineExemplare.map((a) => a.id), [aufPc.id], 'gefiltert auf die Standard-Plattform');

    s = (await anna.api(`/api/katalog-seite/${id}?plattform=${ps4}`)).json;
    assert.equal(s.plattformWahl.gewaehlt, ps4);
    assert.deepEqual(s.meineExemplare.map((a) => a.id), [aufPs4.id]);
    s = (await anna.api(`/api/katalog-seite/${id}?plattform=${xone}`)).json;
    assert.deepEqual(s.meineExemplare, []);

    // Ohne Parameter (ältere App) bzw. mit unbekannter Plattform: alles wie bisher
    for (const pfad of [`/api/katalog-seite/${id}`, `/api/katalog-seite/${id}?plattform=999999`, `/api/katalog-seite/${id}?plattform=abc`]) {
      s = (await anna.api(pfad)).json;
      assert.equal(s.plattformWahl.gewaehlt, null, pfad);
      assert.equal(s.meineExemplare.length, 2, pfad);
    }

    // Nur eine Plattform: keine Auswahl, keine Filterung
    const einzeln = db.prepare("INSERT INTO katalog (quelle, externe_id, typ, titel, plattformen, status) VALUES ('eigen', 'pw2', 'spiel', 'Exklusiv', '[\"PlayStation 4\"]', 'freigegeben') RETURNING id").pluck().get();
    db.prepare('INSERT INTO katalog_plattformen (katalog_id, plattform_id) VALUES (?, ?)').run(einzeln, ps4);
    s = (await anna.api(`/api/katalog-seite/${einzeln}?plattform=auto`)).json;
    assert.deepEqual(s.plattformWahl, { gewaehlt: null, standard: null });
  } finally {
    await server.stoppe();
  }
});
