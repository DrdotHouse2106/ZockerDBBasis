// Katalogseite (GET /api/katalog-liste?q=…): fehlertolerante Titelsuche wie beim Hinzufügen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Katalog-Liste: Apostrophe, Wortreihenfolge, römische Zahlen und Tippfehler', async () => {
  const server = await starteTestServer();
  try {
    const admin = await server.registriere('admin');
    for (const titel of ["Assassin's Creed", "Assassin's Creed IV: Black Flag", 'Final Fantasy VII', 'Tetris']) {
      await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel, plattformen: ['PC'], veroeffentlichen: true } });
    }
    const suche = async (q) => (await admin.api(`/api/katalog-liste?q=${encodeURIComponent(q)}`)).json;
    const titel = (r) => r.eintraege.map((e) => e.titel);

    let r = await suche('Assassins creed');
    assert.deepEqual(titel(r).slice(0, 2).sort(), ["Assassin's Creed", "Assassin's Creed IV: Black Flag"]);
    assert.equal(r.unscharf, false);
    assert.equal(titel(r)[0], "Assassin's Creed", 'Titelanfang zuerst');
    assert.deepEqual(titel(await suche('black flag assassins')), ["Assassin's Creed IV: Black Flag"]);
    assert.deepEqual(titel(await suche('final fantasy 7')), ['Final Fantasy VII']);
    // Tippfehler: gröberer zweiter Versuch über Wortanfänge, als „ähnlich“ gekennzeichnet
    for (const vertippt of ['Asasins Creed', 'Assassinss Creeed', 'assasin creed', 'Final Fantsy 7', 'Tetirs']) {
      r = await suche(vertippt);
      assert.equal(r.unscharf, true, vertippt);
      assert.ok(r.gesamt >= 1, vertippt);
    }
    assert.equal(titel(await suche('Asasins Creed'))[0], "Assassin's Creed", 'bester Treffer zuerst');
    assert.equal(titel(await suche('Final Fantsy 7'))[0], 'Final Fantasy VII');
    // Zu weit weg oder zu kurz: nichts
    assert.equal((await suche('Zelda')).gesamt, 0);
    assert.equal((await suche('Tetrus Racing')).gesamt, 0, 'jedes Wort muss passen');
    // Auch die Suche beim Hinzufügen verzeiht Tippfehler
    const lokal = (await admin.api(`/api/katalog/suche?q=${encodeURIComponent('Asasins Creed')}`)).json.lokal;
    assert.equal(lokal[0]?.titel, "Assassin's Creed");
  } finally {
    await server.stoppe();
  }
});

test('Katalog-Liste: kleine DLCs und Pakete erscheinen nicht (nur am Hauptspiel)', async () => {
  const server = await starteTestServer();
  try {
    const admin = await server.registriere('admin');
    for (const titel of ['Tropico 5', 'Tropico 5: The Big Cheese', 'Tropico 5: Waterborne']) {
      await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel, plattformen: ['PC'], veroeffentlichen: true } });
    }
    server.db.prepare("UPDATE katalog SET spieltyp = 'dlc_addon' WHERE titel = 'Tropico 5: The Big Cheese'").run();
    server.db.prepare("UPDATE katalog SET spieltyp = 'expansion' WHERE titel = 'Tropico 5: Waterborne'").run();
    const titel = async (q) => (await admin.api(`/api/katalog-liste?q=${encodeURIComponent(q)}`)).json.eintraege.map((e) => e.titel).sort();
    assert.deepEqual(await titel('Tropico'), ['Tropico 5', 'Tropico 5: Waterborne'], 'DLC versteckt, Erweiterung bleibt');
    assert.deepEqual(await titel('Big Cheese'), []);
  } finally {
    await server.stoppe();
  }
});

test('Zusammengeschrieben gesucht: „Watchdogs“ findet „Watch Dogs“ – auch beim Hinzufügen und mit Tippfehler', async () => {
  const server = await starteTestServer();
  try {
    const admin = await server.registriere('admin');
    for (const titel of ['Watch Dogs', 'Watch Dogs 2', 'Dogs of War']) {
      await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel, plattformen: ['PC'], veroeffentlichen: true } });
    }
    const liste = async (q) => (await admin.api(`/api/katalog-liste?q=${encodeURIComponent(q)}`)).json;
    let r = await liste('Watchdogs');
    assert.deepEqual(r.eintraege.map((e) => e.titel).sort(), ['Watch Dogs', 'Watch Dogs 2']);
    assert.equal(r.unscharf, false);
    assert.deepEqual((await liste('watchdogs 2')).eintraege.map((e) => e.titel), ['Watch Dogs 2']);
    // Tippfehler im zusammengeschriebenen Wort: über den gröberen zweiten Versuch
    r = await liste('Wachdogs');
    assert.ok(r.eintraege.some((e) => e.titel === 'Watch Dogs'), JSON.stringify(r.eintraege.map((e) => e.titel)));
    const lokal = (await admin.api(`/api/katalog/suche?q=${encodeURIComponent('Watchdogs')}`)).json.lokal;
    assert.ok(lokal.some((e) => e.titel === 'Watch Dogs'));
  } finally {
    await server.stoppe();
  }
});

test('Buchstaben und Ziffern zusammengeschrieben: „FC25“ findet „EA Sports FC 25“ – auch beim Hinzufügen', async () => {
  const server = await starteTestServer();
  try {
    const admin = await server.registriere('admin');
    for (const titel of ['EA Sports FC 25', 'EA Sports FC 24', 'FIFA 25 Legacy']) {
      await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel, plattformen: ['PC'], veroeffentlichen: true } });
    }
    const liste = async (q) => (await admin.api(`/api/katalog-liste?q=${encodeURIComponent(q)}`)).json.eintraege.map((e) => e.titel);
    assert.deepEqual(await liste('FC25'), ['EA Sports FC 25']);
    assert.deepEqual(await liste('FC 25'), ['EA Sports FC 25']);
    const lokal = (await admin.api(`/api/katalog/suche?q=${encodeURIComponent('fc25')}`)).json.lokal.map((e) => e.titel);
    assert.deepEqual(lokal, ['EA Sports FC 25']);
  } finally {
    await server.stoppe();
  }
});
