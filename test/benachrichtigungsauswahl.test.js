// Benachrichtigungen je Art abschaltbar: App, E-Mail und Push einzeln.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

// Der E-Mail-Versand läuft im Hintergrund
const warte = () => new Promise((r) => { setTimeout(r, 100); });

test('Benachrichtigungen je Art und Kanal abschalten; Konto & Sicherheit bleibt in der App immer an', async () => {
  const mails = [];
  const server = await starteTestServer({ env: { PUBLIC_URL: 'https://zockerdb.example', SMTP_FROM: 'ZockerDB <noreply@zockerdb.example>' }, mailFn: async (m) => { mails.push(m); } });
  try {
    const admin = await server.registriere('admin');
    const nutzer = await server.registriere('sammler');
    const id = server.db.prepare("SELECT id FROM benutzer WHERE benutzername = 'sammler'").pluck().get();
    server.db.prepare("UPDATE benutzer SET email = 'sammler@example.org', benachrichtigung_email = 1 WHERE id = ?").run(id);
    const b = server.kontext.benachrichtigungen;

    // Standard: alles an; Moderation nur für Moderatoren sichtbar
    let a = (await nutzer.api('/api/benachrichtigungen/auswahl')).json;
    assert.equal(a.kanaele.email, true);
    assert.equal(a.kanaele.email_an, true);
    assert.ok(a.kategorien.every((k) => k.app && k.email && k.push));
    assert.equal(a.kategorien.some((k) => k.id === 'moderation'), false);
    assert.ok((await admin.api('/api/benachrichtigungen/auswahl')).json.kategorien.some((k) => k.id === 'moderation'));

    b.sende(id, { art: 'freigabe', titel: 'Foto freigegeben' });
    await warte();
    assert.equal(mails.filter((m) => /Foto freigegeben/.test(m.subject)).length, 1);

    // „Deine Beiträge“: E-Mail aus, App an → nur in der Glocke
    a = (await nutzer.api('/api/benachrichtigungen/auswahl', { methode: 'PUT', daten: { kategorien: { beitraege: { email: false } } } })).json;
    assert.deepEqual(a.kategorien.find((k) => k.id === 'beitraege'), { ...a.kategorien.find((k) => k.id === 'beitraege'), app: true, email: false, push: true });
    b.sende(id, { art: 'ablehnung', titel: 'Vorschlag abgelehnt' });
    await warte();
    assert.equal(mails.filter((m) => /Vorschlag abgelehnt/.test(m.subject)).length, 0);
    let liste = (await nutzer.api('/api/benachrichtigungen')).json.eintraege;
    assert.ok(liste.some((n) => n.titel === 'Vorschlag abgelehnt'));

    // „Verleih“ ganz aus → weder Glocke noch E-Mail
    await nutzer.api('/api/benachrichtigungen/auswahl', { methode: 'PUT', daten: { kategorien: { leihe: { app: false, email: false, push: false } } } });
    b.sende(id, { art: 'leihe', titel: 'Rückgabe fällig' });
    await warte();
    liste = (await nutzer.api('/api/benachrichtigungen')).json.eintraege;
    assert.equal(liste.some((n) => n.titel === 'Rückgabe fällig'), false);
    assert.equal(mails.some((m) => /Rückgabe fällig/.test(m.subject)), false);

    // Konto & Sicherheit: App lässt sich nicht abschalten
    a = (await nutzer.api('/api/benachrichtigungen/auswahl', { methode: 'PUT', daten: { kategorien: { system: { app: false, email: false } } } })).json;
    assert.equal(a.kategorien.find((k) => k.id === 'system').app, true);
    b.sende(id, { art: 'system', titel: 'Neues Gerät angemeldet' });
    assert.ok((await nutzer.api('/api/benachrichtigungen')).json.eintraege.some((n) => n.titel === 'Neues Gerät angemeldet'));

    // Unbekannte Arten werden immer zugestellt; ohne Hauptschalter keine E-Mails
    server.db.prepare('UPDATE benutzer SET benachrichtigung_email = 0 WHERE id = ?').run(id);
    b.sende(id, { art: 'freigabe', titel: 'Noch ein Foto' });
    await warte();
    assert.equal(mails.some((m) => /Noch ein Foto/.test(m.subject)), false);
    assert.equal((await server.client().api('/api/benachrichtigungen/auswahl')).status, 401);
  } finally {
    await server.stoppe();
  }
});
