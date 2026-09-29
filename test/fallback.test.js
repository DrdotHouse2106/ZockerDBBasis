// Unbekannte Adressen: App-Hülle mit Status 404 (keine Scheinseiten für Suchmaschinen, nicht in der Besucherstatistik)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { starteTestServer } from './hilfen.js';
import { PROJEKT_WURZEL } from '../server/pfade.js';

test('Unbekannte Adressen liefern 404, die App selbst 200', { skip: !fs.existsSync(path.join(PROJEKT_WURZEL, 'dist', 'index.html')) && 'ohne Build (npm run build)' }, async () => {
  const server = await starteTestServer();
  try {
    const gast = server.client();
    const bot = await gast.api('/wp-login.php');
    assert.equal(bot.status, 404);
    assert.match(bot.text, /<div id="root">|<html/i, 'die App-Hülle kommt trotzdem');
    assert.equal((await gast.api('/?app=1')).status, 200);
    assert.equal((await gast.api('/index.html')).status, 200);
  } finally {
    await server.stoppe();
  }
});
