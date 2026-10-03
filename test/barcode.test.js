// Barcode-Erkennung: Prüfziffer und Lesen eines gezeichneten EAN-13 mit ZXing (WebAssembly) – wie auf dem iPhone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { pruefzifferOk } from '../client/src/barcode.js';

test('Prüfziffer: EAN-13, EAN-8, UPC-A; Fehllesungen werden verworfen', () => {
  assert.equal(pruefzifferOk('4005556004126'), true);
  assert.equal(pruefzifferOk('4005556004128'), false);
  assert.equal(pruefzifferOk('96385074'), true); // EAN-8
  assert.equal(pruefzifferOk('045496590420'), true); // UPC-A (Nintendo)
  assert.equal(pruefzifferOk('045496590421'), false);
  assert.equal(pruefzifferOk('12ab'), false);
});

// EAN-13-Muster zeichnen (L-, G- und R-Codes, Paritäten nach der ersten Ziffer)
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = L.map((c) => [...c].map((b) => (b === '1' ? '0' : '1')).reverse().join(''));
const R = L.map((c) => [...c].map((b) => (b === '1' ? '0' : '1')).join(''));
const PARITAET = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
function ean13Bild(code, modul = 3, hoehe = 120, rand = 30) {
  const z = [...code].map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITAET[z[0]][i - 1] === 'L' ? L : G)[z[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[z[i]];
  bits += '101';
  const breite = bits.length * modul + 2 * rand;
  const data = new Uint8ClampedArray(breite * hoehe * 4).fill(255);
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < bits.length * modul; x++) {
      if (bits[Math.floor(x / modul)] === '1') {
        const i = (y * breite + x + rand) * 4;
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
      }
    }
  }
  return { data, width: breite, height: hoehe, colorSpace: 'srgb' };
}

test('ZXing (WebAssembly) liest einen EAN-13 aus dem Bild', async () => {
  const require = createRequire(import.meta.url);
  const { readBarcodes, prepareZXingModule } = await import('zxing-wasm/reader');
  const wasm = require.resolve('zxing-wasm/reader/zxing_reader.wasm');
  // Unter Node die Datei direkt übergeben (im Browser liefert Vite sie als eigene Datei aus, siehe client/src/barcode.js)
  prepareZXingModule({ overrides: { wasmBinary: fs.readFileSync(wasm) }, fireImmediately: true });
  const treffer = await readBarcodes(ean13Bild('4005556004126'), { formats: ['EAN13'], tryHarder: true });
  assert.deepEqual(treffer.map((t) => t.text), ['4005556004126']);
  assert.equal(pruefzifferOk(treffer[0].text), true);
});
