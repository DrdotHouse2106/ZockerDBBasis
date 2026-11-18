import { test } from 'node:test';
import assert from 'node:assert/strict';

// Herkunft einer Fehlermeldung aus der Browser-Kennung: Art, Gerät, Systemversion, Browser
const erkenne = async (ua, schluessel) => {
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua, maxTouchPoints: 0 }, configurable: true });
  return (await import(`../client/src/zugang.js?${schluessel}`)).umgebung();
};

test('Fehlermeldungen nennen Gerät, Systemversion und Browser', async () => {
  assert.equal(await erkenne('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1', 'a'),
    'Browser · iPhone · iOS 18.6.2 · Safari');
  assert.equal(await erkenne('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', 'b'),
    'Browser · Android 14 · Chrome');
  assert.equal(await erkenne('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0', 'c'),
    'Browser · Windows 10/11 · Edge');
});
