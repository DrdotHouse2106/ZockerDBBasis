// Barcode-Scanner mit künstlicher Kamera: Chromium spielt ein Bild mit einem EAN-13 als Kamerabild ab.
// Unter Linux hat Chromium keine eingebaute Barcode-Erkennung – geprüft wird also der ZXing-Weg (WebAssembly) wie auf
// dem iPhone, samt Content-Security-Policy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { anmelden } from './hilfen.js';

const CODE = '4005556004126';
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = L.map((c) => [...c].map((b) => (b === '1' ? '0' : '1')).reverse().join(''));
const R = L.map((c) => [...c].map((b) => (b === '1' ? '0' : '1')).join(''));
const PARITAET = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** Y4M-Video (640×480, Graustufen) mit dem Barcode in der Bildmitte. */
function kameraVideo(datei) {
  const z = [...CODE].map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITAET[z[0]][i - 1] === 'L' ? L : G)[z[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[z[i]];
  bits += '101';
  const [B, H, modul] = [640, 480, 4];
  const y = Buffer.alloc(B * H, 235);
  const links = Math.floor((B - bits.length * modul) / 2);
  for (let zeile = 180; zeile < 300; zeile++) {
    for (let x = 0; x < bits.length * modul; x++) if (bits[Math.floor(x / modul)] === '1') y[zeile * B + links + x] = 16;
  }
  const uv = Buffer.alloc((B / 2) * (H / 2), 128);
  const bild = Buffer.concat([Buffer.from('FRAME\n'), y, uv, uv]);
  fs.writeFileSync(datei, Buffer.concat([Buffer.from(`YUV4MPEG2 W${B} H${H} F10:1 Ip A1:1 C420jpeg\n`), bild, bild, bild]));
}

const video = path.join(os.tmpdir(), 'zockerdb-scanner-test.y4m');
kameraVideo(video);
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] },
});

test('Scanner erkennt einen EAN-13 über die Kamera', async ({ page }) => {
  const fehler = [];
  page.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
  await anmelden(page, 'scanner_e2e');
  await page.goto('/?app=1#/neu?scan=1');
  await expect(page).toHaveURL(new RegExp(`barcode=${CODE}`), { timeout: 15_000 });
  expect(fehler.filter((f) => /Content Security Policy|wasm/i.test(f))).toEqual([]);
});
