// Startet eine frische ZockerDB-Instanz für die Browser-Tests (leere Datenbank in einem temporären Ordner).
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ladeKonfiguration } from '../server/config.js';
import { erstelleApp } from '../server/app.js';
import { oeffneDatenbank } from '../server/db.js';

// Passt der Build in dist/ zum Testlauf (mit bzw. ohne Zusatzmodul)? Sonst kurz neu bauen – z. B. nach „npm run test:e2e:basis“
const kennung = (() => { try { return JSON.parse(fs.readFileSync(path.resolve('dist/.modul.json'), 'utf8')); } catch { return null; } })();
const modulAus = ['aus', 'false', '0', 'nein'].includes(String(process.env.ZOCKERDB_MODULE ?? '').toLowerCase());
const erwartet = modulAus || kennung?.verfuegbar === false ? 'aus' : 'an';
if (!kennung || kennung.modul !== erwartet) {
  console.log(`E2E: Oberfläche wird neu gebaut (${erwartet === 'aus' ? 'ohne' : 'mit'} Zusatzmodul) …`);
  execSync('npx vite build', { stdio: 'inherit', env: process.env });
}

const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'zockerdb-e2e-'));
const konfiguration = ladeKonfiguration({
  PORT: process.env.E2E_PORT || '4310',
  UPLOAD_DIR: path.join(ordner, 'uploads'),
  DATABASE_PATH: path.join(ordner, 'db.sqlite'),
  BARCODE_PROVIDERS: '',
  APP_SECRET: 'e2e-geheimnis',
  REGISTRATIONS_PER_HOUR: '1000',
  CAPTCHA_PROVIDER: 'aus',
  MARKET_MIN_ACCOUNT_DAYS: '0',
  ZOCKERDB_CENTRAL: 'aus', // Browser-Tests (auch die Basis-Variante in der CI) melden sich nie bei zockerdb.de an
});
const { app } = erstelleApp(konfiguration, { db: oeffneDatenbank(konfiguration.datenbankPfad) });
const server = app.listen(konfiguration.port, '127.0.0.1', () => console.log(`E2E-Server auf Port ${konfiguration.port}`));

const beenden = () => server.close(() => { fs.rmSync(ordner, { recursive: true, force: true }); process.exit(0); });
process.on('SIGTERM', beenden);
process.on('SIGINT', beenden);
