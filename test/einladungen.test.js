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
    const token = new URL(e.json.link.replace('/#/?', '/?')).searchParams.get('einladung');
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
  } finally {
    await server.stoppe();
  }
});
