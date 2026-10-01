// Einladungslinks: Konto für Bekannte, auch wenn die Registrierung geschlossen ist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Einladung: einmal nutzbar, gilt bei geschlossener Registrierung, nur Admins erstellen sie', async () => {
  const server = await starteTestServer({ env: { REGISTRATION_OPEN: 'false', CAPTCHA_PROVIDER: 'altcha' } });
  try {
    const admin = await server.registriere('chefin'); // erstes Konto: immer möglich
    const daten = { benutzername: 'max', passwort: 'sehr-geheimes-passwort', bedingungen_akzeptiert: true };
    const ohne = await server.client().api('/api/auth/registrieren', { methode: 'POST', daten });
    assert.equal(ohne.status, 403, 'Registrierung geschlossen');

    const e = await admin.api('/api/admin/einladungen', { methode: 'POST', daten: { notiz: 'Kumpel Max' } });
    assert.equal(e.status, 201);
    // „?app=1“, sonst zeigt „/“ ohne Anmeldung die öffentliche Startseite statt der App
    assert.match(e.json.link, /\/\?app=1#\/\?einladung=/);
    const token = e.json.link.split('einladung=')[1];
    assert.ok(token);
    assert.ok(!JSON.stringify(server.db.prepare('SELECT * FROM einladungen').all()).includes(token), 'nur die Prüfsumme gespeichert');

    const gast = server.client();
    assert.equal((await gast.api(`/api/auth/einladung/${token}`)).json.gueltig, true);
    assert.equal((await gast.api('/api/auth/einladung/falsch')).json.gueltig, false);
    // Ohne Spam-Prüfung, weil der Link selbst der Nachweis ist
    const r = await gast.api('/api/auth/registrieren', { methode: 'POST', daten: { ...daten, einladung: token } });
    assert.equal(r.status, 201);
    assert.equal(r.json.benutzer.benutzername, 'max');

    const nochmal = await server.client().api('/api/auth/registrieren', { methode: 'POST', daten: { ...daten, benutzername: 'moritz', einladung: token } });
    assert.equal(nochmal.status, 403, 'nur einmal nutzbar');
    const liste = (await admin.api('/api/admin/einladungen')).json;
    assert.equal(liste[0].benutzt_von, 'max');

    const max = gast;
    assert.equal((await max.api('/api/admin/einladungen', { methode: 'POST', daten: {} })).status, 403);

    // Konto des Eingeladenen gelöscht → Einladung verschwindet aus der Liste
    server.db.prepare("DELETE FROM benutzer WHERE benutzername = 'max'").run();
    assert.equal((await admin.api('/api/admin/einladungen')).json.some((e) => e.notiz === 'Kumpel Max'), false);
  } finally {
    await server.stoppe();
  }
});

test('Einladung per E-Mail verschicken, Kopie aller E-Mails per BCC', async () => {
  const mails = [];
  const server = await starteTestServer({
    env: { REGISTRATION_OPEN: 'false', SMTP_BCC: 'pruefung@example.de', PUBLIC_URL: 'https://zockerdb.example' },
    mailFn: async (m) => { mails.push(m); },
  });
  try {
    const admin = await server.registriere('chefin');
    const falsch = await admin.api('/api/admin/einladungen', { methode: 'POST', daten: { email: 'keine-adresse' } });
    assert.equal(falsch.status, 400);
    const e = await admin.api('/api/admin/einladungen', { methode: 'POST', daten: { email: 'Max@Example.de' } });
    assert.equal(e.status, 201, e.text);
    assert.equal(e.json.versendet, true);
    assert.equal(e.json.notiz, 'max@example.de', 'ohne Notiz wird die Adresse vermerkt');
    const m = mails.at(-1);
    assert.equal(m.to, 'max@example.de');
    assert.equal(m.bcc, 'pruefung@example.de');
    assert.match(m.subject, /Einladung/);
    assert.ok(m.text.includes(e.json.link) && m.html.includes('Konto anlegen'));
    // Logo eingebettet (cid) – wird von Mailprogrammen auch ohne Nachladen externer Bilder gezeigt
    assert.ok(m.html.includes('src="cid:logo@zockerdb"'));
    assert.equal(m.attachments?.[0]?.cid, 'logo@zockerdb');
    assert.ok(Buffer.isBuffer(m.attachments[0].content) && m.attachments[0].content.length < 15_000, 'Logo verkleinert mitgeschickt');
    assert.ok(m.html.includes('name="color-scheme"') && m.html.includes('width:32px'), 'Dunkelmodus-Farben und feste Logogröße');
    assert.match(e.json.link, /^https:\/\/zockerdb\.example\/\?app=1#\/\?einladung=/);
  } finally {
    await server.stoppe();
  }
});
