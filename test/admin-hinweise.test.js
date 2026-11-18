// Sicherheitshinweise für Administratoren (Bot-Falle, Kopierschutz …): eigene Kategorie, ganz abschaltbar, E-Mail standardmäßig aus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Kategorie „Sicherheitshinweise (Administration)“: nur für Admins, E-Mail aus, App abschaltbar', async () => {
  const postfach = [];
  const server = await starteTestServer({ env: { PUBLIC_URL: 'https://zockerdb.example', SMTP_FROM: 'x@zockerdb.example' }, mailFn: async (m) => { postfach.push(m); } });
  try {
    const admin = await server.registriere('chef');
    const nutzer = await server.registriere('sammler');
    const id = (n) => server.db.prepare('SELECT id FROM benutzer WHERE benutzername = ?').pluck().get(n);
    server.db.prepare("UPDATE benutzer SET email = 'chef@example.org', benachrichtigung_email = 1 WHERE id = ?").run(id('chef'));
    const auswahl = async (c) => (await c.api('/api/benachrichtigungen/auswahl')).json;

    const k = (await auswahl(admin)).kategorien.find((x) => x.id === 'admin_hinweise');
    assert.ok(k, 'für Admins sichtbar');
    assert.deepEqual([k.app, k.email, k.push, k.app_pflicht], [true, false, false, false]);
    assert.ok(!(await auswahl(nutzer)).kategorien.some((x) => x.id === 'admin_hinweise'), 'nicht für normale Sammler');

    const b = server.kontext.benachrichtigungen;
    b.sende(id('chef'), { art: 'admin_hinweis', titel: 'Auffälligkeit: Bot-Falle', link: '#/admin?reiter=sicherheit' });
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(postfach.length, 0, 'keine E-Mail im Standard');
    assert.equal(server.db.prepare("SELECT COUNT(*) FROM benachrichtigungen WHERE art = 'admin_hinweis'").pluck().get(), 1);

    // Ganz abschalten – auch in der App
    const r = await admin.api('/api/benachrichtigungen/auswahl', { methode: 'PUT', daten: { kategorien: { admin_hinweise: { app: false } } } });
    assert.equal(r.status, 200, r.text);
    const nachher = r.json.kategorien.find((x) => x.id === 'admin_hinweise');
    assert.deepEqual([nachher.app, nachher.email], [false, false], 'E-Mail bleibt beim Standard „aus“');
    b.sende(id('chef'), { art: 'admin_hinweis', titel: 'Auffälligkeit: Bot-Falle', link: '#/admin?reiter=sicherheit' });
    assert.equal(server.db.prepare("SELECT COUNT(*) FROM benachrichtigungen WHERE art = 'admin_hinweis'").pluck().get(), 1, 'nichts Neues');
    // Konto & Sicherheit bleibt unabhängig davon
    b.sende(id('chef'), { art: 'system', titel: 'Wichtig' });
    // Die Mail geht im Hintergrund raus – unter Last kann das dauern (höchstens 2 s warten statt fester 30 ms)
    for (let i = 0; i < 100 && postfach.length < 1; i++) await new Promise((r2) => setTimeout(r2, 20));
    assert.equal(postfach.length, 1);
  } finally {
    await server.stoppe();
  }
});
