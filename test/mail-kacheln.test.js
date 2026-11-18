// E-Mails mit Bildkacheln (Cover): nur https-Bilder, Texte maskiert, Kacheln verlinkt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mailHtml } from '../server/services/mail.js';

test('mailHtml: Abschnitte mit Bildkacheln', () => {
  const html = mailHtml({
    titel: 'Test', absaetze: ['Hallo'],
    abschnitte: [{ titel: 'Neu', kacheln: [
      { bild: 'https://images.example/cover.jpg', titel: 'Zelda <b>', text: 'SNES', url: 'https://app.example/?app=1#/katalog/1' },
      { bild: 'http://unsicher.example/x.jpg', titel: 'Ohne https' },
      { bild: 'javascript:alert(1)', titel: 'Böse' },
    ] }, { titel: 'Leer', kacheln: [] }],
  });
  assert.match(html, /<h2[^>]*>Neu<\/h2>/);
  assert.match(html, /<img src="https:\/\/images\.example\/cover\.jpg"/);
  assert.match(html, /Zelda &lt;b&gt;/);
  assert.match(html, /href="https:\/\/app\.example\/\?app=1#\/katalog\/1"/);
  assert.doesNotMatch(html, /unsicher\.example|javascript:/);
  assert.match(html, /Ohne https/, 'Kachel bleibt, nur ohne Bild');
  assert.doesNotMatch(html, />Leer</, 'leere Abschnitte entfallen');
});

test('Benachrichtigungs-Mail zeigt das Cover des verlinkten Spiels bzw. Exemplars', async () => {
  const { starteTestServer } = await import('./hilfen.js');
  const postfach = [];
  const server = await starteTestServer({ env: { PUBLIC_URL: 'https://zockerdb.example', SMTP_FROM: 'x@zockerdb.example' }, mailFn: async (m) => { postfach.push(m); } });
  try {
    const admin = await server.registriere('admin');
    const anna = await server.registriere('anna');
    const k = (await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel: 'Super Metroid', plattformen: ['Super Nintendo'], veroeffentlichen: true } })).json;
    server.db.prepare("UPDATE katalog SET cover_url = 'https://images.example/metroid.jpg' WHERE id = ?").run(k.id);
    const annaId = server.db.prepare("SELECT id FROM benutzer WHERE benutzername = 'anna'").pluck().get();
    server.db.prepare("UPDATE benutzer SET email = 'anna@example.org', benachrichtigung_email = 1 WHERE id = ?").run(annaId);
    const a = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Super Metroid', katalog_id: k.id } })).json;

    server.kontext.benachrichtigungen.sende(annaId, { art: 'freigabe', titel: 'Zum Spiel', link: `#/katalog/${k.id}` });
    server.kontext.benachrichtigungen.sende(annaId, { art: 'freigabe', titel: 'Zum Exemplar', link: `#/artikel/${a.id}` });
    server.kontext.benachrichtigungen.sende(annaId, { art: 'freigabe', titel: 'Ohne Spiel', link: '#/sammlung' });
    await new Promise((r) => setTimeout(r, 50));
    const mail = (titel) => postfach.find((m) => m.subject.endsWith(titel));
    assert.match(mail('Zum Spiel').html, /<img src="https:\/\/images\.example\/metroid\.jpg"/);
    assert.match(mail('Zum Exemplar').html, /<img src="https:\/\/images\.example\/metroid\.jpg"/);
    assert.doesNotMatch(mail('Ohne Spiel').html, /images\.example/);
  } finally {
    await server.stoppe();
  }
});
