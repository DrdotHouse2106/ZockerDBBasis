import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

const PASSWORT = 'sehr-geheimes-passwort';
const postfach = [];
let server;
let admin;

const letzteMail = (an) => [...postfach].reverse().find((m) => m.to === an);
const tokenAus = (mail, pfad) => mail.text.match(new RegExp(`#/${pfad}\\?token=([\\w-]+)`))[1];

before(async () => {
  server = await starteTestServer({
    env: { PUBLIC_URL: 'https://zockerdb.example', SMTP_FROM: 'ZockerDB <noreply@zockerdb.example>' },
    mailFn: async (m) => { postfach.push(m); },
  });
  admin = await server.registriere('chefin');
});
after(async () => { await server.stoppe(); });

test('Registrierung mit E-Mail: Bestätigungslink, danach ist die Adresse hinterlegt', async () => {
  const gast = server.client();
  assert.equal((await gast.api('/api/auth/status')).json.emailAktiv, true);
  const r = await gast.api('/api/auth/registrieren', { methode: 'POST', daten: { benutzername: 'mia', passwort: PASSWORT, email: 'Mia@Example.org', bedingungen_akzeptiert: true } });
  assert.equal(r.status, 201, r.text);
  const mail = letzteMail('mia@example.org');
  assert.match(mail.subject, /bestätige deine E-Mail-Adresse/);
  assert.match(mail.text, /https:\/\/zockerdb\.example\/\?app=1#\/email-bestaetigen\?token=/);
  let konto = (await gast.api('/api/konto')).json;
  assert.equal(konto.email, null);
  assert.equal(konto.ausstehendeEmail, 'mia@example.org');

  const b = await server.client().api('/api/auth/email-bestaetigen', { methode: 'POST', daten: { token: tokenAus(mail, 'email-bestaetigen') } });
  assert.equal(b.status, 200, b.text);
  konto = (await gast.api('/api/konto')).json;
  assert.equal(konto.email, 'mia@example.org');
  // Einmal verwendbar
  assert.equal((await server.client().api('/api/auth/email-bestaetigen', { methode: 'POST', daten: { token: tokenAus(mail, 'email-bestaetigen') } })).status, 400);
});

test('Passwort vergessen: Link per E-Mail, neues Passwort, alle Sitzungen beendet', async () => {
  const gast = server.client();
  const anfrage = await gast.api('/api/auth/passwort-vergessen', { methode: 'POST', daten: { kennung: 'mia@example.org' } });
  assert.equal(anfrage.status, 200);
  const mail = letzteMail('mia@example.org');
  assert.match(mail.subject, /Passwort zurücksetzen/);

  // Unbekannte Konten bekommen dieselbe Antwort, aber keine E-Mail
  const vorher = postfach.length;
  const unbekannt = await gast.api('/api/auth/passwort-vergessen', { methode: 'POST', daten: { kennung: 'niemand' } });
  assert.equal(unbekannt.status, 200);
  assert.equal(unbekannt.json.hinweis, anfrage.json.hinweis);
  assert.equal(postfach.length, vorher);

  const token = tokenAus(mail, 'passwort-neu');
  assert.equal((await gast.api('/api/auth/passwort-zuruecksetzen', { methode: 'POST', daten: { token, neuesPasswort: 'kurz' } })).status, 400);
  const ok = await gast.api('/api/auth/passwort-zuruecksetzen', { methode: 'POST', daten: { token, neuesPasswort: 'ein-ganz-neues-passwort' } });
  assert.equal(ok.status, 200, ok.text);
  assert.match(letzteMail('mia@example.org').subject, /Passwort wurde zurückgesetzt/);
  assert.equal((await gast.api('/api/auth/passwort-zuruecksetzen', { methode: 'POST', daten: { token, neuesPasswort: 'noch-ein-passwort-123' } })).status, 400);

  const alt = await gast.api('/api/auth/anmelden', { methode: 'POST', daten: { benutzername: 'mia', passwort: PASSWORT } });
  assert.equal(alt.status, 401);
  const neu = await gast.api('/api/auth/anmelden', { methode: 'POST', daten: { benutzername: 'mia', passwort: 'ein-ganz-neues-passwort' } });
  assert.equal(neu.status, 200);
});

test('Vergebene Adresse wird nicht verraten, sondern der Inhaber informiert', async () => {
  const bernd = await server.registriere('bernd');
  const r = await bernd.api('/api/konto/email', { methode: 'POST', daten: { email: 'mia@example.org', passwort: PASSWORT } });
  assert.equal(r.status, 200);
  assert.match(letzteMail('mia@example.org').subject, /erneut angegeben/);
  assert.equal((await bernd.api('/api/konto')).json.ausstehendeEmail, null);
});

test('Ohne PUBLIC_URL werden keine Links verschickt', async () => {
  const ohne = await starteTestServer({ env: { SMTP_FROM: 'x@y.de' }, mailFn: async () => {} });
  try {
    const c = await ohne.registriere('otto');
    assert.equal((await c.api('/api/auth/status')).json.emailAktiv, false);
    const r = await c.api('/api/konto/email', { methode: 'POST', daten: { email: 'otto@example.org', passwort: PASSWORT } });
    assert.equal(r.status, 503);
  } finally {
    await ohne.stoppe();
  }
});

test('Test-E-Mail aus der Administration', async () => {
  const r = await admin.api('/api/admin/test-mail', { methode: 'POST', daten: { an: 'test@example.org' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(letzteMail('test@example.org').subject, 'ZockerDB: Test-E-Mail');
});

test('Bei einer Adressänderung wird die alte Adresse informiert', async () => {
  const c = server.client();
  await c.api('/api/auth/anmelden', { methode: 'POST', daten: { benutzername: 'mia', passwort: 'ein-ganz-neues-passwort' } });
  await c.api('/api/konto/email', { methode: 'POST', daten: { email: 'mia.neu@example.org', passwort: 'ein-ganz-neues-passwort' } });
  const token = tokenAus(letzteMail('mia.neu@example.org'), 'email-bestaetigen');
  await server.client().api('/api/auth/email-bestaetigen', { methode: 'POST', daten: { token } });
  const hinweis = letzteMail('mia@example.org');
  assert.match(hinweis.subject, /E-Mail-Adresse wurde geändert/);
  assert.match(hinweis.text, /m…@example\.org/);
});

test('Fußzeile jeder E-Mail: Betreiber aus dem Impressum oder der Einstellung, Links zu Impressum und Datenschutz', async () => {
  const einladung = async () => {
    const r = await admin.api('/api/admin/einladungen', { methode: 'POST', daten: { email: 'gast@example.org' } });
    assert.equal(r.status, 201, r.text);
    return letzteMail('gast@example.org');
  };
  // Impressum noch mit Platzhaltern: keine Betreiberzeile (statt „[Vorname Nachname]“)
  let m = await einladung();
  assert.doesNotMatch(m.html, /Betreiber:/);
  assert.match(m.html, /<!doctype html>/);
  assert.doesNotMatch(m.html, /zdb-betreiber/, 'Platzhalter wird immer ersetzt');

  const impressum = '# Impressum\n\n## Angaben gemäß § 5 DDG\n\nMax Mustermann  \nMusterstraße 1  \n12345 Musterstadt\n\n## Kontakt\n\nE-Mail: kontakt@zockerdb.example\n';
  assert.equal((await admin.api('/api/admin/seiten/impressum', { methode: 'PUT', daten: { titel: 'Impressum', inhalt: impressum } })).status, 200);
  m = await einladung();
  assert.match(m.html, /Betreiber: Max Mustermann · Musterstraße 1 · 12345 Musterstadt · E-Mail: kontakt@zockerdb\.example/);
  assert.match(m.html, /href="https:\/\/zockerdb\.example\/\?app=1#\/seite\/impressum"/);
  assert.match(m.text, /\n-- \nBetreiber: Max Mustermann/);
  assert.match(m.text, /Impressum: https:\/\/zockerdb\.example\/\?app=1#\/seite\/impressum/);

  // Eigene Angabe in den Einstellungen geht vor
  server.kontext.konfiguration.mail.betreiber = 'ZockerDB-Team · Postfach 1 · 99999 Irgendwo';
  try {
    m = await einladung();
    assert.match(m.html, /Betreiber: ZockerDB-Team · Postfach 1/);
    assert.doesNotMatch(m.html, /Max Mustermann/);
  } finally {
    server.kontext.konfiguration.mail.betreiber = '';
  }
});
