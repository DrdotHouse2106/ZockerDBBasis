// Zugang anfragen: Bei geschlossener Registrierung bitten Interessenten um eine Einladung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Zugangsanfrage: Formular, Prüfungen, Benachrichtigung, Einladen und Löschen', async () => {
  const mails = [];
  const server = await starteTestServer({ env: { REGISTRATION_OPEN: 'false', PUBLIC_URL: 'https://zockerdb.example' }, mailFn: async (m) => { mails.push(m); } });
  try {
    // Vor der Ersteinrichtung gibt es keine Anfragen – das erste Konto legt man direkt an
    assert.equal((await server.client().api('/api/auth/status')).json.zugangsanfragen, false);
    const admin = await server.registriere('chefin');
    const gast = server.client();
    assert.equal((await gast.api('/api/auth/status')).json.zugangsanfragen, true);

    const ohneMail = await gast.api('/api/auth/zugang', { methode: 'POST', daten: { name: 'Max', einwilligung: true } });
    assert.equal(ohneMail.status, 400);
    assert.ok(ohneMail.json.felder.email);
    const ohneEinwilligung = await gast.api('/api/auth/zugang', { methode: 'POST', daten: { email: 'max@example.de' } });
    assert.equal(ohneEinwilligung.status, 400);
    assert.ok(ohneEinwilligung.json.felder.einwilligung);

    // Bot füllt das unsichtbare Feld: scheinbar angenommen, aber nichts gespeichert
    const bot = await gast.api('/api/auth/zugang', { methode: 'POST', daten: { email: 'bot@example.de', einwilligung: true, webseite: 'http://spam' } });
    assert.equal(bot.status, 201);
    assert.equal(server.db.prepare('SELECT COUNT(*) FROM zugangsanfragen').pluck().get(), 0);

    const daten = { name: 'Max', email: 'Max@Example.de', nachricht: 'Ich sammle Mega Drive.', einwilligung: true };
    assert.equal((await gast.api('/api/auth/zugang', { methode: 'POST', daten })).status, 201);
    // Gleiche Adresse nochmal: keine doppelte Anfrage
    assert.equal((await gast.api('/api/auth/zugang', { methode: 'POST', daten: { ...daten, nachricht: 'Und SNES.' } })).status, 201);
    assert.equal(server.db.prepare('SELECT COUNT(*) FROM zugangsanfragen').pluck().get(), 1);
    // Höchstens drei Anfragen je Stunde und Adresse
    assert.equal((await gast.api('/api/auth/zugang', { methode: 'POST', daten: { ...daten, email: 'moritz@example.de' } })).status, 201);
    assert.equal((await gast.api('/api/auth/zugang', { methode: 'POST', daten: { ...daten, email: 'erik@example.de' } })).status, 429);

    const hinweis = (await admin.api('/api/benachrichtigungen')).json.eintraege.find((b) => b.titel === 'Neue Zugangsanfrage');
    assert.ok(hinweis, 'Administratoren werden benachrichtigt');
    assert.match(hinweis.text, /Max möchte mitmachen/);

    // Nur Administratoren sehen die Anfragen
    assert.equal((await gast.api('/api/admin/zugangsanfragen')).status, 401);
    const liste = (await admin.api('/api/admin/zugangsanfragen')).json;
    assert.equal(liste.length, 2);
    const max = liste.find((a) => a.email === 'max@example.de');
    assert.equal(max.nachricht, 'Und SNES.');

    // E-Mail-Versand eingerichtet: Einladung geht direkt an die angegebene Adresse
    const e = await admin.api(`/api/admin/zugangsanfragen/${max.id}/einladen`, { methode: 'POST' });
    assert.equal(e.status, 201, e.text);
    assert.equal(e.json.versendet, true);
    assert.match(e.json.link, /#\/\?einladung=/);
    assert.equal(e.json.anfrage_email, 'max@example.de');
    assert.equal((await admin.api('/api/admin/zugangsanfragen')).json.find((a) => a.id === max.id).status, 'eingeladen');
    assert.equal((await admin.api('/api/admin/einladungen')).json[0].notiz, 'Zugangsanfrage: Max');
    assert.equal(mails.filter((m) => /Einladung/.test(m.subject ?? m.betreff ?? '') && JSON.stringify(m.to ?? m.an).includes('max@example.de')).length, 1);

    const moritz = liste.find((a) => a.email === 'moritz@example.de');
    assert.equal((await admin.api(`/api/admin/zugangsanfragen/${moritz.id}`, { methode: 'DELETE' })).status, 204);
    assert.equal((await admin.api(`/api/admin/zugangsanfragen/${moritz.id}`, { methode: 'DELETE' })).status, 404);

    // Nach 90 Tagen verschwinden Anfragen
    server.db.prepare("UPDATE zugangsanfragen SET erstellt_am = datetime('now', '-91 days')").run();
    assert.equal((await admin.api('/api/admin/zugangsanfragen')).json.length, 0);
  } finally {
    await server.stoppe();
  }
});

test('Zugangsanfrage: aus bei offener Registrierung oder abgeschaltet', async () => {
  for (const env of [{ REGISTRATION_OPEN: 'true' }, { REGISTRATION_OPEN: 'false', ACCESS_REQUESTS: 'false' }]) {
    const server = await starteTestServer({ env });
    try {
      const admin = await server.registriere('chefin');
      if (env.ACCESS_REQUESTS === 'false') {
        // Ohne E-Mail-Versand liefert „Einladen“ den Link zum Weitergeben
        server.db.prepare("INSERT INTO zugangsanfragen (email) VALUES ('alt@example.de')").run();
        const e = await admin.api('/api/admin/zugangsanfragen/1/einladen', { methode: 'POST' });
        assert.equal(e.json.versendet, false);
        assert.match(e.json.link, /einladung=/);
      }
      const gast = server.client();
      assert.equal((await gast.api('/api/auth/status')).json.zugangsanfragen, false);
      const r = await gast.api('/api/auth/zugang', { methode: 'POST', daten: { email: 'max@example.de', einwilligung: true } });
      assert.equal(r.status, 404);
    } finally {
      await server.stoppe();
    }
  }
});

test('Kurzlink /mitmachen: Registrierung, wenn offen – sonst Zugang anfragen', async () => {
  const server = await starteTestServer({ env: { REGISTRATION_OPEN: 'true' } });
  try {
    const ziel = async () => (await server.client().api('/mitmachen', { redirect: 'manual' })).headers.get('location');
    assert.equal(await ziel(), '/?app=1#/?registrieren=1');
    server.kontext.konfiguration.konten.registrierungOffen = false;
    assert.equal(await ziel(), '/?app=1#/?zugang=1');
    server.kontext.konfiguration.konten.zugangsanfragen = false;
    assert.equal(await ziel(), '/?app=1#/');
  } finally {
    await server.stoppe();
  }
});
