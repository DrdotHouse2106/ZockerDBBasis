// Fotos je Farbe bei Figurenserien: Kachel, Farbumschalter, Exemplar-Cover nach Farbe, Spieleseite ohne Katalog-Bild.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { gesuchteFotos } from '../shared/konstanten.js';

test('Figurenfotos: je Farbe auf der Serienseite und als Cover des Exemplars', async () => {
  const server = await starteTestServer();
  try {
    const admin = await server.registriere('admin');
    const anna = await server.registriere('anna');
    const { db } = server;
    const serie = db.prepare("INSERT INTO serien (name, status, mit_farben, farben) VALUES ('Fotoserie', 'freigegeben', 1, ?) RETURNING id")
      .pluck().get(JSON.stringify([{ name: 'Rot', hex: '#ff0000' }, { name: 'Grün', hex: null }]));
    const figur = db.prepare(`INSERT INTO katalog (quelle, externe_id, typ, titel, plattformen, status, serie_id, serien_nummer)
      VALUES ('eigen', 'test:foto:1', 'merch', 'Fotomonster', '[]', 'freigegeben', ?, '1') RETURNING id`).pluck().get(serie);
    const farbe = (name) => db.prepare("INSERT INTO katalog_varianten (katalog_id, bezeichnung, farbe, status) VALUES (?, ?, ?, 'freigegeben') RETURNING id").pluck().get(figur, name, name);
    const rot = farbe('Rot');
    const gruen = farbe('Grün');
    const foto = (datei, variante, sichtbarkeit = 'freigegeben') => db.prepare(`INSERT INTO medien (katalog_id, art, sichtbarkeit, datei, anzeige_datei, vorschau_datei, mime, groesse, variante_id)
      VALUES (?, 'foto_figur', ?, ?, ?, ?, 'image/webp', 1, ?)`).run(figur, sichtbarkeit, `${datei}.webp`, `${datei}-anzeige.webp`, `${datei}-klein.webp`, variante);
    foto('rot', rot);
    foto('gruen-ungeprueft', gruen, 'eingereicht'); // nicht freigegeben: zählt für andere nicht

    let seite = (await anna.api(`/api/serien/${serie}`)).json;
    let f = seite.zeilen.find((z) => z.nummer === '1').figuren[0];
    assert.equal(f.foto_url, '/api/dateien/rot-klein.webp', 'ohne Katalog-Bild: Foto einer Farbe für die Kachel');
    assert.deepEqual(f.farben.map((v) => [v.farbe, v.foto_url]), [['Rot', '/api/dateien/rot-klein.webp'], ['Grün', null]]);

    // Foto ohne Farbe wird zum Bild der Kachel
    foto('allgemein', null);
    f = (await anna.api(`/api/serien/${serie}`)).json.zeilen.find((z) => z.nummer === '1').figuren[0];
    assert.equal(f.foto_url, '/api/dateien/allgemein-klein.webp');

    // Exemplar in Grün (kein freigegebenes Foto) → allgemeines Foto; in Rot → das rote
    const neu = async (variante) => (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'merch', titel: 'Fotomonster', katalog_id: figur, variante_id: variante } })).json;
    assert.equal((await neu(rot)).bild_url, '/api/dateien/rot-klein.webp');
    assert.equal((await neu(gruen)).bild_url, '/api/dateien/allgemein-klein.webp');

    // Spieleseite der Figur: ohne Katalog-Bild das Foto der Figur
    assert.equal((await admin.api(`/api/katalog/${figur}`)).json.cover_passend, '/api/dateien/allgemein-anzeige.webp');
    // … auch über die Daten der Spieleseite (die die Web-App lädt)
    assert.equal((await admin.api(`/api/katalog-seite/${figur}`)).json.eintrag.cover_passend, '/api/dateien/allgemein-anzeige.webp');

    // Angenommene freigestellte Fassung (Hintergrund entfernt): wird überall als Cover gezeigt; nur zu prüfende noch nicht
    db.prepare("UPDATE medien SET frei_datei = 'allgemein-frei.webp', frei_status = 'fertig' WHERE datei = 'allgemein.webp'").run();
    assert.equal((await admin.api(`/api/katalog/${figur}`)).json.cover_passend, '/api/dateien/allgemein-anzeige.webp', 'noch nicht angenommen');
    db.prepare("UPDATE medien SET frei_status = 'angenommen' WHERE datei = 'allgemein.webp'").run();
    assert.equal((await admin.api(`/api/katalog/${figur}`)).json.cover_passend, '/api/dateien/allgemein-frei.webp');
    f = (await anna.api(`/api/serien/${serie}`)).json.zeilen.find((z) => z.nummer === '1').figuren[0];
    assert.equal(f.foto_url, '/api/dateien/allgemein-frei.webp', 'Serienseite');
    assert.equal((await neu(gruen)).bild_url, '/api/dateien/allgemein-frei.webp', 'Exemplar');

    // Figur ohne freigegebenes Foto: das eigene, noch nicht geprüfte Foto ist für den Hochladenden das Cover – für andere nicht
    const zweite = db.prepare(`INSERT INTO katalog (quelle, externe_id, typ, titel, plattformen, status, serie_id, serien_nummer)
      VALUES ('eigen', 'test:foto:2', 'merch', 'Hydra', '[]', 'freigegeben', ?, '2') RETURNING id`).pluck().get(serie);
    const annaId = db.prepare("SELECT id FROM benutzer WHERE benutzername = 'anna'").pluck().get();
    db.prepare(`INSERT INTO medien (katalog_id, benutzer_id, art, sichtbarkeit, datei, anzeige_datei, vorschau_datei, mime, groesse)
      VALUES (?, ?, 'foto_figur', 'eingereicht', 'hydra.webp', 'hydra-anzeige.webp', 'hydra-klein.webp', 'image/webp', 1)`).run(zweite, annaId);
    assert.equal((await anna.api(`/api/katalog/${zweite}`)).json.cover_passend, '/api/dateien/hydra-anzeige.webp');
    assert.equal((await admin.api(`/api/katalog/${zweite}`)).json.cover_passend, null, 'fremdes Foto in Prüfung: kein Cover');

    // Bei losen Figuren und Merch wird zuerst das Foto des Artikels selbst gesucht
    assert.deepEqual(gesuchteFotos('merch'), ['foto_figur'], 'lose Figur: keine Verpackungsfotos, Detail freiwillig');
    assert.deepEqual(gesuchteFotos('merch', null, { mitVerpackung: true }), ['foto_figur', 'foto_vorne', 'foto_hinten']);
    assert.deepEqual(gesuchteFotos('merch', null, { merchKategorie: 'karte' }), ['foto_karte_vorne'], 'Karten: nur die Vorderseite (Rückseite meist gleich)');
    assert.deepEqual(gesuchteFotos('merch', null, { versiegelt: true }), ['foto_vorne', 'foto_hinten']);
  } finally {
    await server.stoppe();
  }
});
