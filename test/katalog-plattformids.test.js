import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Katalogeintrag liefert die zugeordneten Plattform-IDs (für die Plattformauswahl beim Hinzufügen)', async () => {
  const server = await starteTestServer();
  try {
    const admin = await server.registriere('admin');
    const k = (await admin.api('/api/katalog', { methode: 'POST', daten: { typ: 'spiel', titel: 'NBA 2K16 (Test)', plattformen: ['PlayStation 4', 'Xbox One'], veroeffentlichen: true } })).json;
    const e = (await admin.api(`/api/katalog/${k.id}`)).json;
    const namen = server.db.prepare(`SELECT p.kurz FROM plattformen p WHERE p.id IN (${e.plattform_ids.map(() => '?').join(',')})`).pluck().all(...e.plattform_ids);
    assert.deepEqual(namen.sort(), ['PS4', 'XOne'].sort());
  } finally {
    await server.stoppe();
  }
});
