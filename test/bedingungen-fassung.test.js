// Fassungen der Nutzungsbedingungen: Jeder Beitrag merkt sich, unter welcher Fassung er eingereicht wurde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Beiträge merken sich die Fassung der Nutzungsbedingungen', async () => {
  const server = await starteTestServer();
  try {
    const { db } = server;
    const admin = await server.registriere('admin');
    const anna = await server.registriere('anna');
    const fassung = () => db.prepare("SELECT MAX(id) FROM seiten_versionen WHERE slug = 'nutzungsbedingungen'").pluck().get();
    const erste = fassung();
    assert.ok(erste, 'Vorlage ist als erste Fassung gespeichert');

    // Katalogeintrag privat anlegen: noch keine Fassung; beim Einreichen wird die aktuelle gemerkt
    const eintrag = (await anna.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel: 'Exot', plattformen: ['Amiga'] } })).json;
    const version = (id) => db.prepare('SELECT bedingungen_version FROM katalog WHERE id = ?').pluck().get(id);
    if (eintrag.status === 'privat') {
      assert.equal(version(eintrag.id), null);
      db.prepare("UPDATE katalog SET status = 'eingereicht' WHERE id = ?").run(eintrag.id);
    }
    assert.equal(version(eintrag.id), erste);

    // Neue Fassung: gleiche Speicherung erzeugt keine Kopie, geänderter Text schon
    const alt = (await admin.api('/api/seiten/nutzungsbedingungen')).json;
    assert.equal((await admin.api('/api/admin/seiten/nutzungsbedingungen', { methode: 'PUT', daten: { titel: alt.titel, inhalt: alt.inhalt } })).status, 200);
    assert.equal(fassung(), erste, 'unveränderter Text – keine neue Fassung');
    await admin.api('/api/admin/seiten/nutzungsbedingungen', { methode: 'PUT', daten: { titel: alt.titel, inhalt: `${alt.inhalt}\n\nNeu.` } });
    const zweite = fassung();
    assert.ok(zweite > erste);

    // Variante einreichen: neue Fassung; der alte Eintrag behält seine
    const v = await anna.api(`/api/katalog/${eintrag.id}/varianten`, { methode: 'POST', daten: { bezeichnung: 'Rot', einreichen: true } });
    assert.equal(v.status, 201, v.text);
    // Ohne Moderation (Basis-Version) bleibt die Variante privat – dann wie beim Katalogeintrag direkt einreichen
    if (v.json.status === 'privat') db.prepare("UPDATE katalog_varianten SET status = 'eingereicht' WHERE id = ?").run(v.json.id);
    assert.equal(db.prepare('SELECT bedingungen_version FROM katalog_varianten WHERE id = ?').pluck().get(v.json.id), zweite);
    assert.equal(version(eintrag.id), erste);

    // Datei: Freigabe und Einwilligung in die öffentliche Anzeige merken die Fassung
    const medium = db.prepare("INSERT INTO medien (katalog_id, benutzer_id, art, datei, mime, groesse) VALUES (?, (SELECT id FROM benutzer WHERE benutzername = 'anna'), 'foto_modul', 'x.jpg', 'image/jpeg', 1) RETURNING id").pluck().get(eintrag.id);
    const mv = () => db.prepare('SELECT bedingungen_version FROM medien WHERE id = ?').pluck().get(medium);
    assert.equal(mv(), null, 'privat: keine Fassung');
    db.prepare("UPDATE medien SET sichtbarkeit = 'eingereicht' WHERE id = ?").run(medium);
    assert.equal(mv(), zweite);
    // Einwilligung in die öffentliche Anzeige unter einer späteren Fassung wird ebenfalls festgehalten
    await admin.api('/api/admin/seiten/nutzungsbedingungen', { methode: 'PUT', daten: { titel: alt.titel, inhalt: `${alt.inhalt}\n\nNoch neuer.` } });
    db.prepare('UPDATE medien SET oeffentlich_erlaubt = 1 WHERE id = ?').run(medium);
    assert.equal(mv(), fassung());
  } finally {
    await server.stoppe();
  }
});
