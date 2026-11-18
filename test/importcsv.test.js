import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { leseCsv, erkenneZuordnung, zeileZuArtikel, datumVon } from '../server/services/csvimport.js';

test('CSV lesen: Anführungszeichen, Zeilenumbrüche, Trennzeichen-Erkennung', () => {
  const csv = leseCsv('﻿Title,Platform,Notes\n"Zelda, A Link to the Past",SNES,"Mit ""Poster""\nund Karte"\n\nTetris,Game Boy,\n');
  assert.equal(csv.trennzeichen, ',');
  assert.deepEqual(csv.kopf, ['Title', 'Platform', 'Notes']);
  assert.equal(csv.zeilen.length, 2);
  assert.equal(csv.zeilen[0][0], 'Zelda, A Link to the Past');
  assert.equal(csv.zeilen[0][2], 'Mit "Poster"\nund Karte');
});

test('CLZ-typische Spalten und Werte werden übersetzt', () => {
  const kopf = ['Title', 'Platform', 'Region', 'Completeness', 'Condition', 'Purchase Price', 'Purchase Date', 'Barcode', 'Quantity', 'Notes'];
  const z = erkenneZuordnung(kopf);
  assert.equal(z.titel, 0);
  assert.equal(z.kaufpreis, 5);
  const a = zeileZuArtikel(['Super Metroid', 'SNES', 'Germany', 'Complete', 'Very Good', '€ 1.234,50', '24.12.2019', '4 902370 501', '2', 'Top'], z);
  assert.deepEqual({ region: a.region, voll: a.vollstaendigkeit, zustand: a.zustand, datum: a.kaufdatum, anzahl: a.anzahl, preis: a.kaufpreis },
    { region: 'pal_de', voll: 'cib', zustand: 'sehr_gut', datum: '2019-12-24', anzahl: 2, preis: '1.234,50' });
  assert.equal(zeileZuArtikel(['X', 'N64', 'Australia', 'Loose', 'Sealed'], z).region, 'pal_eu');
  assert.equal(zeileZuArtikel(['X', 'N64', 'USA', 'Loose', ''], z).vollstaendigkeit, 'nur_geraet');
  assert.equal(zeileZuArtikel(['X', 'Game Boy', 'PAL', 'Modul mit Schutzhülle, ohne Karton', ''], z).vollstaendigkeit, 'mit_huelle');
  assert.equal(zeileZuArtikel(['X', 'N64', 'Japan', 'New', ''], z).zustand, 'neu_ovp');
  assert.equal(zeileZuArtikel(['X', 'N64', '', '', '', '$1,234.50'], z).kaufpreis, '1234.50');
});

test('CLZ Games Web: englische Daten, Box/Manual, Collection Status', () => {
  assert.equal(datumVon('Aug 17, 2023'), '2023-08-17');
  assert.equal(datumVon('Jan 01, 1980'), '1980-01-01');
  assert.equal(datumVon('17 Aug 2023'), '2023-08-17');
  assert.equal(datumVon('3. Okt 2024'), '2024-10-03');
  assert.equal(datumVon('Apr 1995'), null, 'nur Monat und Jahr: kein Kaufdatum');
  const kopf = ['Platform', 'Title', 'Release Date', 'Publisher', 'Box', 'Manual', 'Collection Status', 'Purchase Date', 'Purchase Price'];
  const z = erkenneZuordnung(kopf);
  assert.deepEqual([z.plattform, z.titel, z.box, z.anleitung, z.sammlungsstatus, z.kaufdatum, z.vollstaendigkeit], [0, 1, 4, 5, 6, 7, undefined]);
  const zeile = (box, manual, status = 'In Collection') => zeileZuArtikel(['Game Boy', 'The Lion King', 'Apr 1995', 'THQ', box, manual, status, 'Oct 20, 2024', '$ 12.50'], z);
  assert.equal(zeile('Yes', 'Yes').vollstaendigkeit, 'cib');
  assert.equal(zeile('Yes', 'No').vollstaendigkeit, 'fehlt_anleitung');
  assert.equal(zeile('No', 'No').vollstaendigkeit, 'nur_geraet');
  assert.equal(zeile('', '').vollstaendigkeit, null);
  assert.equal(zeile('Yes', 'Yes').kaufdatum, '2024-10-20');
  assert.equal(zeile('Yes', 'Yes').bestand, undefined, 'In Collection → Standard „Im Besitz“');
  assert.equal(zeile('Yes', 'Yes', 'Sold').bestand, 'verkauft');
  assert.match(zeile('Yes', 'Yes', 'Wish List').ueberspringen, /Wunschliste/);

  // Weitere CLZ-Spalten: Kaufort an die Notizen, Lagerort, Seriennummer, durchgespielt – „Completed Year“ wird nicht zur Vollständigkeit
  const k2 = ['Title', 'Platform', 'Completed', 'Completed Date', 'Completed Year', 'Purchase Store', 'Location', 'Storage Device', 'Storage Slot', 'Serial No.', 'Notes'];
  const z2 = erkenneZuordnung(k2);
  assert.equal(z2.vollstaendigkeit, undefined);
  const a = zeileZuArtikel(['Halo', 'Xbox', 'Yes', 'Mar 03, 2021', '2021', 'Flohmarkt', 'Keller', 'Box 3', '12', 'SN1', 'Kratzer'], z2);
  assert.deepEqual([a.notizen, a.lagerort_ort, a.lagerort_regal, a.lagerort_fach, a.seriennummer, a.spielstatus, a.durchgespielt_am],
    ['Kratzer\nGekauft bei: Flohmarkt', 'Keller', 'Box 3', '12', 'SN1', 'durchgespielt', '2021-03-03']);
});

let server;
let nutzer;
before(async () => {
  server = await starteTestServer();
  const admin = await server.registriere('admin');
  await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel: 'Super Metroid', plattformen: ['Super Nintendo'], veroeffentlichen: true } });
  nutzer = await server.registriere('sammler');
});
after(async () => { await server.stoppe(); });

test('Import über die API: Analyse, Katalogabgleich, fehlerhafte Zeilen', async () => {
  const text = 'Titel;Plattform;Zustand;Kaufpreis (EUR);Anzahl\nSuper Metroid;SNES;Gut;49,99;1\n;SNES;Gut;;1\nUnbekanntes Spiel;N64;;;3\n';
  const analyse = (await nutzer.api('/api/import/csv/analyse', { methode: 'POST', daten: { text } })).json;
  assert.equal(analyse.zeilen, 3);
  assert.equal(analyse.trennzeichen, ';');
  assert.equal(analyse.zuordnung.titel, 0);
  assert.equal(analyse.vorschau[0].plattform, 'Super Nintendo');

  const r = await nutzer.api('/api/import/csv', { methode: 'POST', daten: { text, zuordnung: analyse.zuordnung, standardTyp: 'spiel' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.importiert, 2);
  assert.equal(r.json.verknuepft, 1);
  assert.equal(r.json.fehlerhaft[0].zeile, 3);
  const liste = (await nutzer.api('/api/artikel')).json;
  const metroid = (liste.artikel ?? liste).find((a) => a.titel === 'Super Metroid');
  assert.equal(metroid.importiert_aus, 'csv', 'Importe sind markiert und zählen nicht als Neuzugang');
  assert.ok(metroid.katalog_id);
  assert.equal(metroid.kaufpreis, 49.99);
  assert.equal(metroid.zustand, 'gut');
});

test('CLZ-Import über die API: Wunschliste übersprungen, Verkauftes als verkauft', async () => {
  const text = 'Platform;Title;Box;Manual;Collection Status;Location;Completed\n"Game Boy";"Tarzan";Yes;No;"In Collection";Keller;Yes\n"Game Boy";"Wario Land";;;"Wish List"\n"Game Boy";"Tetris";No;No;Sold\n';
  const analyse = (await nutzer.api('/api/import/csv/analyse', { methode: 'POST', daten: { text } })).json;
  const r = (await nutzer.api('/api/import/csv', { methode: 'POST', daten: { text, zuordnung: analyse.zuordnung, standardTyp: 'spiel' } })).json;
  assert.equal(r.importiert, 2);
  assert.match(r.fehlerhaft[0].fehler.sammlungsstatus, /Wunschliste/);
  const tetris = server.db.prepare("SELECT bestand, vollstaendigkeit FROM artikel WHERE titel = 'Tetris'").get();
  assert.deepEqual(tetris, { bestand: 'verkauft', vollstaendigkeit: 'nur_geraet' });
  assert.deepEqual(server.db.prepare("SELECT vollstaendigkeit, lagerort_ort, spielstatus FROM artikel WHERE titel = 'Tarzan'").get(),
    { vollstaendigkeit: 'fehlt_anleitung', lagerort_ort: 'Keller', spielstatus: 'durchgespielt' });
});

test('CLZ-Export wie aus CLZ Games Web: Hardware Type, Doppelname der Plattform, Value nicht als Marktwert, Zustand als Notiz, Download digital', () => {
  const kopf = ['Platform', 'Title', 'Box', 'Completeness', 'Condition', 'Manual', 'Value', 'Hardware Type', 'Type', 'Format', 'Barcode'];
  const z = erkenneZuordnung(kopf);
  assert.equal(z.marktwert, undefined, '„Value“ sind Dollar-Schätzwerte von CLZ');
  const konsole = zeileZuArtikel(['Atari 2600/VCS', 'Atari 2600 Jr.', 'No', 'Loose', '', 'No', '41.38', 'Console', '', '', ''], z);
  assert.deepEqual([konsole.typ, konsole.vollstaendigkeit, konsole.marktwert], ['konsole', 'nur_geraet', null]);
  assert.equal(zeileZuArtikel(['Xbox', 'Pad', 'No', 'Loose', '', 'No', '', 'Controller', '', '', ''], z).typ, 'zubehoer');
  const spiel = zeileZuArtikel(['PC', 'Spiel', 'Yes', 'CIB', 'Verkratzt', 'Yes', '', '', '', 'Download', ''], z);
  assert.equal(spiel.notizen, 'Zustand: Verkratzt');
  assert.equal(spiel.bestand, 'digital');
  assert.equal(zeileZuArtikel(['PC', 'Spiel', 'Yes', 'CIB', 'Very Good', 'Yes', '', '', '', 'DVD', ''], z).notizen, null, 'bekannter Zustand → keine Notiz');
});

test('CSV-Import: Plattform „Atari 2600/VCS“, Abgleich über Barcode und Originaltitel', async () => {
  const db = server.db;
  const atari = db.prepare("SELECT id FROM plattformen WHERE name = 'Atari 2600'").pluck().get();
  const gb = db.prepare("SELECT id FROM plattformen WHERE name = 'Game Boy'").pluck().get();
  const neu = (titel, original, plattform) => {
    const id = db.prepare(`INSERT INTO katalog (quelle, typ, titel, titel_original, plattformen, status) VALUES ('eigen', 'spiel', ?, ?, '[]', 'freigegeben') RETURNING id`).pluck().get(titel, original);
    db.prepare('INSERT INTO katalog_plattformen (katalog_id, plattform_id) VALUES (?, ?)').run(id, plattform);
    return id;
  };
  const koenig = neu('Der König der Löwen', 'The Lion King', gb);
  const pitfall = neu('Pitfall!', null, atari);
  db.prepare("INSERT INTO barcode_zuordnungen (code, katalog_id, benutzer_id) VALUES ('4012345678901', ?, (SELECT MIN(id) FROM benutzer))").run(pitfall);
  const text = 'Platform;Title;Barcode\n"Game Boy";"The Lion King";\n"Atari 2600/VCS";"Pitfall (Activision)";4012345678901\n';
  const analyse = (await nutzer.api('/api/import/csv/analyse', { methode: 'POST', daten: { text } })).json;
  const r = (await nutzer.api('/api/import/csv', { methode: 'POST', daten: { text, zuordnung: analyse.zuordnung, standardTyp: 'spiel' } })).json;
  assert.deepEqual([r.importiert, r.verknuepft], [2, 2]);
  const zeilen = db.prepare("SELECT titel, katalog_id, plattform_id FROM artikel WHERE titel IN ('The Lion King', 'Pitfall (Activision)') ORDER BY titel").all();
  assert.deepEqual(zeilen.map((x) => [x.katalog_id, x.plattform_id]), [[pitfall, atari], [koenig, gb]]);
});

test('CSV-Import bleibt bei großem Katalog schnell (Titel-Abgleich über Index, nicht über den ganzen Katalog)', async () => {
  const db = server.db;
  const ins = db.prepare("INSERT INTO katalog (quelle, typ, titel, titel_original, plattformen, status) VALUES ('eigen', 'spiel', ?, ?, '[]', 'freigegeben')");
  db.transaction(() => { for (let i = 0; i < 100000; i++) ins.run(`Lastspiel ${i}`, `Load Game ${i}`); })();
  const text = `Platform;Title\n${Array.from({ length: 300 }, (_, i) => `PC;Gibt es nicht ${i}`).join('\n')}\n`;
  const analyse = (await nutzer.api('/api/import/csv/analyse', { methode: 'POST', daten: { text } })).json;
  const beginn = Date.now();
  const r = (await nutzer.api('/api/import/csv', { methode: 'POST', daten: { text, zuordnung: analyse.zuordnung, standardTyp: 'spiel' } })).json;
  assert.equal(r.importiert, 300);
  assert.ok(Date.now() - beginn < 2000, `Import dauerte ${Date.now() - beginn} ms`);
  // Die Nachzuordnung im Hintergrund abwarten (sonst bremst sie den nächsten Test) – auch sie bleibt zügig, weil die Suche
  // den vorab normalisierten Suchtext nutzt (vorher über 5 Minuten für diese 300 Exemplare, jetzt rund 20 Sekunden)
  const ich = db.prepare('SELECT benutzer_id FROM artikel WHERE titel = ?').pluck().get('Gibt es nicht 0');
  const start = Date.now();
  await server.kontext.nachzuordnung.warte(ich);
  assert.ok(Date.now() - start < 90_000, `Nachzuordnung dauerte ${Date.now() - start} ms`);
});


test('Nachträgliche Zuordnung: tolerant beim Titel, Plattform muss passen, Hauptspiel vor Bundle, Platzhalter wird ersetzt', async () => {
  const db = server.db;
  const p = (name) => db.prepare('SELECT id FROM plattformen WHERE name = ?').pluck().get(name);
  const [gba, ds, gc] = [p('Game Boy Advance'), p('Nintendo DS'), p('Nintendo GameCube')];
  const neu = (titel, plattform, spieltyp = null) => {
    const id = db.prepare(`INSERT INTO katalog (quelle, typ, titel, plattformen, status, spieltyp) VALUES ('igdb', 'spiel', ?, '[]', 'freigegeben', ?) RETURNING id`).pluck().get(titel, spieltyp);
    db.prepare('INSERT INTO katalog_plattformen (katalog_id, plattform_id) VALUES (?, ?)').run(id, plattform);
    return id;
  };
  const planet = neu('Treasure Planet', gba);
  const platin = neu('Pokémon Platinum', ds);
  const kirby = neu('Kirby Air Ride', gc);
  neu('Kirby Air Ride', gc, 'bundle');
  neu('Rayman 3: Hoodlum Havoc', ds); // falsche Plattform
  const c = await server.registriere('zuordner');
  const text = 'Platform;Title\nGame Boy Advance;Disney\'s Treasure Planet\nNintendo DS;Pokémon Platinum Version\nGameCube;Kirby Air Ride\nGameCube;Rayman 3: Hoodlum Havoc\nGameCube;Gibt es nicht\n';
  const analyse = (await c.api('/api/import/csv/analyse', { methode: 'POST', daten: { text } })).json;
  const r = (await c.api('/api/import/csv', { methode: 'POST', daten: { text, zuordnung: analyse.zuordnung, standardTyp: 'spiel' } })).json;
  assert.equal(r.importiert, 5);
  assert.equal(r.verknuepft, 0, 'genauer Abgleich: nichts eindeutig (Kirby doppelt, Titel abweichend)');
  assert.equal(r.nachzuordnung.laeuft, true, 'läuft im Hintergrund weiter');
  const ich = db.prepare("SELECT id FROM benutzer WHERE benutzername = 'zuordner'").pluck().get();
  const fertig = await server.kontext.nachzuordnung.warte(ich);
  assert.deepEqual([fertig.laeuft, fertig.gesamt, fertig.verknuepft], [false, 5, 3]);
  const link = (titel) => db.prepare('SELECT katalog_id FROM artikel WHERE benutzer_id = ? AND titel = ?').pluck().get(ich, titel);
  assert.deepEqual([link("Disney's Treasure Planet"), link('Pokémon Platinum Version'), link('Kirby Air Ride'), link('Rayman 3: Hoodlum Havoc')], [planet, platin, kirby, null]);
  assert.match(db.prepare("SELECT titel FROM benachrichtigungen WHERE benutzer_id = ? ORDER BY id DESC").pluck().get(ich) ?? '', /3 von 5/);

  // „Spiele zuordnen“: offene Exemplare mit Vorschlägen – Rayman gibt es nur für eine andere Plattform
  const liste = (await c.api('/api/import/zuordnen/liste')).json;
  assert.equal(liste.gesamt, 2);
  const ray = liste.eintraege.find((e) => e.artikel.titel === 'Rayman 3: Hoodlum Havoc');
  assert.deepEqual([ray.vorschlaege[0].titel, ray.vorschlaege[0].passende_plattform], ['Rayman 3: Hoodlum Havoc', false]);

  // Platzhalter (privater eigener Eintrag, z. B. durch ein Foto entstanden) wird ersetzt und gelöscht; erneuter Lauf über „alle“
  const platzhalter = db.prepare(`INSERT INTO katalog (quelle, typ, titel, plattformen, status, erstellt_von) VALUES ('eigen', 'spiel', 'Rayman 3: Hoodlum Havoc', '[]', 'privat', ?) RETURNING id`).pluck().get(ich);
  db.prepare('UPDATE artikel SET katalog_id = ? WHERE benutzer_id = ? AND titel = ?').run(platzhalter, ich, 'Rayman 3: Hoodlum Havoc');
  const rayman = neu('Rayman 3 - Hoodlum Havoc', gc);
  assert.equal((await c.api('/api/import/zuordnen', { methode: 'POST', daten: {} })).status, 200);
  const zweiter = await server.kontext.nachzuordnung.warte(ich);
  assert.deepEqual([zweiter.gesamt, zweiter.verknuepft], [2, 1]);
  assert.equal(link('Rayman 3: Hoodlum Havoc'), rayman);
  assert.equal(db.prepare('SELECT 1 FROM katalog WHERE id = ?').get(platzhalter), undefined);
  assert.equal((await c.api('/api/import/zuordnen')).json.laeuft, false);
});

test('Import rückgängig machen: alle oder nur unveränderte Exemplare, nur eigene Importe', async () => {
  const db = server.db;
  const c = await server.registriere('umzug');
  const text = 'Platform;Title\nPC;Rückgängig A\nPC;Rückgängig B\nPC;Rückgängig C\n';
  const analyse = (await c.api('/api/import/csv/analyse', { methode: 'POST', daten: { text } })).json;
  const r = (await c.api('/api/import/csv', { methode: 'POST', daten: { text, zuordnung: analyse.zuordnung, standardTyp: 'spiel', katalogAbgleich: false, datei: 'export.csv' } })).json;
  assert.equal(r.importiert, 3);
  assert.ok(r.import_id);

  let liste = (await c.api('/api/import/liste')).json.importe;
  assert.deepEqual([liste[0].id, liste[0].datei, liste[0].anzahl, liste[0].vorhanden, liste[0].bearbeitet], [r.import_id, 'export.csv', 3, 3, 0]);
  // Ein Exemplar nachbearbeiten (später geändert)
  const b = db.prepare("SELECT id FROM artikel WHERE titel = 'Rückgängig B'").pluck().get();
  db.prepare("UPDATE artikel SET notizen = 'geprüft', aktualisiert_am = datetime('now', '+1 minute') WHERE id = ?").run(b);
  assert.equal((await c.api('/api/import/liste')).json.importe[0].bearbeitet, 1);

  // Fremde dürfen den Import nicht rückgängig machen
  const fremd = await server.registriere('fremder');
  assert.equal((await fremd.api(`/api/import/${r.import_id}`, { methode: 'DELETE' })).status, 404);

  // Nur unveränderte entfernen → B bleibt
  let weg = (await c.api(`/api/import/${r.import_id}?nur_unveraendert=1`, { methode: 'DELETE' })).json;
  assert.deepEqual(weg, { entfernt: 2, uebrig: 1 });
  assert.deepEqual(db.prepare("SELECT titel FROM artikel WHERE titel LIKE 'Rückgängig %'").pluck().all(), ['Rückgängig B']);
  liste = (await c.api('/api/import/liste')).json.importe;
  assert.equal(liste[0].rueckgaengig_am, null, 'noch nicht ganz rückgängig');
  // Rest entfernen
  weg = (await c.api(`/api/import/${r.import_id}`, { methode: 'DELETE' })).json;
  assert.deepEqual(weg, { entfernt: 1, uebrig: 0 });
  assert.ok((await c.api('/api/import/liste')).json.importe[0].rueckgaengig_am);
});
