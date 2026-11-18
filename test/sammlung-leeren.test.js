// Sammlung leeren: alle eigenen Einträge, Konvolute und Artikelbilder weg, Konto und andere Sammler bleiben – nur mit Passwort.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { starteTestServer } from './hilfen.js';

test('Sammlung leeren: nur mit Passwort, löscht alles Eigene, sonst nichts', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const bernd = await server.registriere('bernd');
    const lege = (c, daten) => c.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', plattform: 'PC', ...daten } });
    const a1 = (await lege(anna, { titel: 'Tetris' })).json;
    const verkauft = (await lege(anna, { titel: 'Doom' })).json;
    server.db.prepare("UPDATE artikel SET bestand = 'verkauft' WHERE id = ?").run(verkauft.id);
    const k = (await anna.api('/api/konvolute', { methode: 'POST', daten: { name: 'Flohmarkt-Kiste', preis: '30,00' } })).json;
    await lege(anna, { titel: 'Myst', konvolut_id: k.id });
    await lege(bernd, { titel: 'Quake' });
    const formular = new FormData();
    formular.append('bild', new Blob([await sharp({ create: { width: 40, height: 30, channels: 3, background: '#36c' } }).png().toBuffer()], { type: 'image/png' }), 'a.png');
    const bild = (await anna.api(`/api/artikel/${a1.id}/bild`, { methode: 'POST', formular })).json.bild_datei;
    const bildPfad = server.kontext.dateien.pfadVon(bild);
    assert.ok(fs.existsSync(bildPfad));

    const zaehle = (name) => server.db.prepare('SELECT COUNT(*) FROM artikel a JOIN benutzer b ON b.id = a.benutzer_id WHERE b.benutzername = ?').pluck().get(name);
    assert.equal(zaehle('anna'), 3);

    let r = await anna.api('/api/konto/sammlung-leeren', { methode: 'POST', daten: { passwort: 'falsch' } });
    assert.equal(r.status, 400, 'falsches Passwort');
    assert.equal(zaehle('anna'), 3);
    assert.equal((await server.client().api('/api/konto/sammlung-leeren', { methode: 'POST', daten: { passwort: 'sehr-geheimes-passwort' } })).status, 401);

    r = await anna.api('/api/konto/sammlung-leeren', { methode: 'POST', daten: { passwort: 'sehr-geheimes-passwort' } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.geloescht, 3);
    assert.equal(zaehle('anna'), 0);
    assert.equal(server.db.prepare('SELECT COUNT(*) FROM konvolute').pluck().get(), 0);
    // Dateien werden im Hintergrund gelöscht
    for (let i = 0; i < 50 && fs.existsSync(bildPfad); i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(fs.existsSync(bildPfad), false, 'Artikelbild gelöscht');
    assert.equal(zaehle('bernd'), 1, 'andere Sammler unberührt');
    assert.equal((await anna.api('/api/konto')).status, 200, 'Konto bleibt');
    // Für den Abgleich mit der App als gelöscht gemerkt
    assert.ok(server.db.prepare('SELECT COUNT(*) FROM artikel_geloescht').pluck().get() >= 3);
  } finally {
    await server.stoppe();
  }
});
