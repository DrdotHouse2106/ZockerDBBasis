import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { PROJEKT_WURZEL } from './config.js';
import { oeffneDatenbank } from './db.js';
import { MODULE } from './module.js';
import { erstelleErweiterungen } from './erweiterungen.js';
import {
  ladeSitzung, pruefeHerkunft, erfordereAnmeldung, erfordereAdmin,
} from './middleware/auth.js';
import { erstelleCache } from './services/cache.js';
import { erstelleIgdbDienst } from './services/igdb.js';
import { erstelleBarcodeDienst } from './services/barcode.js';
import { erstelleKatalogDienst } from './services/katalog.js';
import { erstelleZentrale } from './services/zentrale.js';
import { erstelleSyncDienst } from './services/sync.js';
import { erstelleKonvolutDienst } from './services/konvolute.js';
import { konvoluteRouter } from './routes/konvolute.js';
import { zentraleRouter, zentraleAdminRouter } from './routes/zentrale.js';
import { erstelleKontenDienst, KontoFehler } from './services/konten.js';
import { erstelleDateiDienst } from './services/dateien.js';
import { erstelleSpeicherDienst } from './services/speicher.js';
import { erstellePlattformDienst } from './services/plattformen.js';
import { erstelleEinstellungsDienst } from './services/einstellungen.js';
import { erstelleSicherungsDienst } from './services/sicherung.js';
import { erstelleAktualisierung, leseBuild } from './services/aktualisierung.js';
import { erstelleVorschlagDienst } from './services/vorschlaege.js';
import { vorschlaegeRouter } from './routes/vorschlaege.js';
import { erstelleMailDienst } from './services/mail.js';
import { erstelleCaptchaDienst } from './services/captcha.js';
import { erstelleKontoMailDienst } from './services/kontomail.js';
import { erstelleBenachrichtigungsDienst } from './services/benachrichtigungen.js';
import { ladeSchluessel } from './services/sicherheit.js';
import { ValidierungsFehler } from './services/validierung.js';
import { benachrichtigungenRouter } from './routes/benachrichtigungen.js';
import { importCsvRouter } from './routes/importcsv.js';
import { seitenRouter, seitenAdminRouter } from './routes/seiten.js';
import { teilenRouter } from './routes/teilen.js';
import { authRouter } from './routes/auth.js';
import { artikelRouter } from './routes/artikel.js';
import { katalogRouter, katalogUnterRouter } from './routes/katalog.js';
import { oeffentlichRouter } from './routes/oeffentlich.js';
import { statistikRouter } from './routes/statistik.js';
import { exportRouter } from './routes/export.js';
import { statusRouter } from './routes/status.js';
import { medienRouter } from './routes/medien.js';
import { adminRouter } from './routes/admin.js';
import { plattformenRouter } from './routes/plattformen.js';

const { version } = JSON.parse(fs.readFileSync(path.join(PROJEKT_WURZEL, 'package.json'), 'utf8'));
// Stand des Docker-Images (Commit und Bauzeit), leer bei einer Installation ohne Docker
const build = leseBuild();

export function erstelleApp(konfiguration, { db = oeffneDatenbank(konfiguration.datenbankPfad), fetchFn } = {}) {
  const datenVerzeichnis = konfiguration.datenbankPfad === ':memory:'
    ? konfiguration.uploadVerzeichnis
    : path.dirname(konfiguration.datenbankPfad);
  const schluessel = ladeSchluessel(konfiguration.konten.appGeheimnis, datenVerzeichnis);

  // Einstellungen aus der Weboberfläche über die .env legen – vor dem Start aller Dienste
  const einstellungen = erstelleEinstellungsDienst(db, { konfiguration, schluessel, nachAenderung: (geaendert) => baueDiensteNeu(geaendert) });
  einstellungen.wendeAn();

  const erweiterungen = erstelleErweiterungen();
  const cache = erstelleCache(db, konfiguration.cacheTtlStunden);
  const igdb = erstelleIgdbDienst(konfiguration.igdb, db, { fetchFn });
  const barcode = erstelleBarcodeDienst(konfiguration.barcode, { fetchFn });
  const plattformen = erstellePlattformDienst(db);
  const zentrale = erstelleZentrale(db, { konfiguration, fetchFn, version, build, cache });
  const katalog = erstelleKatalogDienst(db, { igdb, barcode, cache, plattformen, erweiterungen, zentrale });
  zentrale.setzeKatalog(katalog);
  const konten = erstelleKontenDienst(db, { schluessel, sitzungTage: konfiguration.konten.sitzungTage });
  const dateien = erstelleDateiDienst(db, { uploadVerzeichnis: konfiguration.uploadVerzeichnis, erweiterungen });
  const speicher = erstelleSpeicherDienst(db, { standardMb: () => konfiguration.speicherKontingentMb ?? 1024, dateien, erweiterungen });
  const sicherung = erstelleSicherungsDienst(db, konfiguration);
  const aktualisierung = erstelleAktualisierung({ konfiguration, sicherung, build, fetchFn });
  const neuesCaptcha = () => erstelleCaptchaDienst(konfiguration.captcha, { schluessel, fetchFn });
  const captcha = neuesCaptcha();
  const neueMail = () => erstelleMailDienst(konfiguration.mail, { transportFn: konfiguration.mailTransportFn });
  const mail = neueMail();
  const kontoMail = erstelleKontoMailDienst(db, { mail, konfiguration, konten });
  const benachrichtigungen = erstelleBenachrichtigungsDienst(db, { mail, konfiguration });
  const konvolute = erstelleKonvolutDienst(db, { erweiterungen });
  const vorschlaege = erstelleVorschlagDienst(db, { katalog, dateien, zentrale, plattformen, benachrichtigungen });
  // Fotos zu Vorschlägen: nur für Einsender und Moderationsteam
  erweiterungen.an('dateien.zugriff', (b, datei) => vorschlaege.darfSehen(b, datei));
  const sync = erstelleSyncDienst(db, { zentrale, katalog, schluessel, dateien, speicher, plattformen, erweiterungen });
  const kontext = {
    db, cache, igdb, barcode, zentrale, katalog, konten, dateien, speicher, plattformen, einstellungen, sicherung, aktualisierung, mail, kontoMail,
    benachrichtigungen, sync, konvolute, vorschlaege, captcha, konfiguration, version, build, schluessel, erweiterungen, module: MODULE.map((m) => m.name),
  };
  // Zusatzmodule legen ihre Dienste im Kontext ab und registrieren sich an den Andockpunkten
  for (const modul of MODULE) modul.erstelle?.(kontext, { fetchFn });

  /**
   * Nach einer Änderung in Admin → Einstellungen: betroffene Dienste mit der neuen Konfiguration
   * neu aufbauen. Die Objekte bleiben dieselben (Object.assign), damit alle Router sie weiter nutzen.
   */
  function baueDiensteNeu(geaendert = []) {
    const betrifft = (...praefixe) => geaendert.some((s) => praefixe.some((p) => s.startsWith(p)));
    if (betrifft('TWITCH_')) {
      db.prepare("DELETE FROM einstellungen WHERE schluessel = 'igdb_token'").run(); // Token gehört zur alten Client-ID
      Object.assign(igdb, erstelleIgdbDienst(konfiguration.igdb, db, { fetchFn }));
    }
    if (betrifft('BARCODE_', 'OPENGTINDB_')) Object.assign(barcode, erstelleBarcodeDienst(konfiguration.barcode, { fetchFn }));
    if (betrifft('SMTP_')) Object.assign(mail, neueMail());
    if (betrifft('CAPTCHA_', 'RECAPTCHA_')) Object.assign(captcha, neuesCaptcha());
    for (const modul of MODULE) modul.baueNeu?.(kontext, { betrifft, fetchFn });
  }

  const app = express();
  app.disable('x-powered-by');
  if (konfiguration.vertrauteProxies) {
    const wert = konfiguration.vertrauteProxies;
    app.set('trust proxy', /^\d+$/.test(wert) ? Number(wert) : wert);
  }

  app.use((req, res, next) => {
    // Browser sollen die Seite nur noch per HTTPS aufrufen (nur wenn die Anfrage per HTTPS kam)
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // reCAPTCHA (nur wenn gewählt) braucht Skripte und Frames von Google
    const google = captcha.anbieter === 'recaptcha' ? ' https://www.google.com https://www.gstatic.com https://www.recaptcha.net' : '';
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'SAMEORIGIN',
      'Permissions-Policy': 'camera=(self)',
      'Content-Security-Policy': [
        "default-src 'self'",
        "img-src 'self' data: blob: https:",
        "style-src 'self' 'unsafe-inline'",
        `script-src 'self'${google}`,
        `connect-src 'self'${google}`,
        "object-src 'self'",
        `frame-src 'self'${google}`,
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    });
    next();
  });

  // API-Antworten und Dateien nie in Suchmaschinen aufnehmen
  app.use('/api', (_req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });

  // Ohne Anmeldung erreichbar, damit Docker-Healthchecks funktionieren.
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Zusatzmodule: frühe Middleware und eigene Seiten (z. B. öffentliche Seiten, Webhooks) – vor der JSON-Verarbeitung
  for (const modul of MODULE) modul.vorApi?.(app, kontext);
  // Geteilte Sammlung per geheimem Link (auch ohne Konto)
  app.use(teilenRouter(kontext));

  app.use('/api', pruefeHerkunft, express.json({ limit: '20mb' }), ladeSitzung(konten));
  for (const modul of MODULE) modul.apiMiddleware?.(app, kontext);
  app.use('/api', authRouter(kontext));
  app.use('/api', seitenRouter(kontext)); // ohne Anmeldung: Rechtliches
  const angemeldet = erfordereAnmeldung(konfiguration.konten);
  for (const modul of MODULE) modul.oeffentlicheApi?.(app, kontext, { angemeldet });
  app.use('/api', oeffentlichRouter(kontext)); // ohne Anmeldung nur mit PUBLIC_CATALOG

  app.use('/api', angemeldet, statusRouter(kontext));
  app.use('/api/artikel', angemeldet, artikelRouter(kontext));
  app.use('/api/konvolute', angemeldet, konvoluteRouter(kontext));
  app.use('/api/katalog', angemeldet, katalogRouter(kontext));
  app.use('/api/statistik', angemeldet, statistikRouter(kontext));
  app.use('/api/admin', angemeldet, erfordereAdmin, adminRouter(kontext), seitenAdminRouter(kontext), zentraleAdminRouter(kontext));
  app.use('/api/moderation/plattformen', angemeldet, plattformenRouter(kontext));
  app.use('/api', angemeldet, vorschlaegeRouter(kontext));
  app.use('/api', angemeldet, katalogUnterRouter(kontext), benachrichtigungenRouter(kontext), importCsvRouter(kontext));
  app.use('/api', angemeldet, medienRouter(kontext), exportRouter(kontext), zentraleRouter(kontext));
  for (const modul of MODULE) modul.api?.(app, kontext, { angemeldet, erfordereAdmin });
  app.use('/api', (_req, res) => res.status(404).json({ fehler: 'Unbekannter API-Endpunkt.' }));

  // Gebaute Oberfläche (npm run build) ausliefern, inkl. Fallback für die Single-Page-App.
  const distVerzeichnis = path.join(PROJEKT_WURZEL, 'dist');
  if (fs.existsSync(distVerzeichnis)) {
    app.use(express.static(distVerzeichnis, {
      setHeaders: (res, datei) => {
        if (datei.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        else res.set('Cache-Control', 'no-cache');
      },
    }));
    // security.txt (RFC 9116) – express.static liefert Punkt-Ordner sonst nicht aus
    app.get('/.well-known/security.txt', (_req, res) => res.type('text/plain; charset=utf-8')
      .sendFile(path.join(distVerzeichnis, '.well-known', 'security.txt'), { dotfiles: 'allow' }));
    app.get('/{*pfad}', (_req, res) => res.sendFile(path.join(distVerzeichnis, 'index.html')));
  }

  // Zentrale Fehlerbehandlung – alle Meldungen auf Deutsch.
  app.use((fehler, req, res, _next) => {
    if (fehler instanceof ValidierungsFehler) {
      return res.status(400).json({ fehler: fehler.message, felder: fehler.fehler });
    }
    if (fehler instanceof KontoFehler) return res.status(fehler.status).json({ fehler: fehler.message, code: fehler.code });
    if (fehler instanceof multer.MulterError) {
      const maxMb = req.path.includes('/medien') ? konfiguration.maxMedienMb : konfiguration.maxUploadMb;
      const meldung = fehler.code === 'LIMIT_FILE_SIZE'
        ? `Die Datei ist zu groß (maximal ${maxMb} MB).`
        : 'Die Datei konnte nicht hochgeladen werden.';
      return res.status(400).json({ fehler: meldung });
    }
    if (fehler.type === 'entity.parse.failed') return res.status(400).json({ fehler: 'Ungültige JSON-Daten.' });
    if (fehler.type === 'entity.too.large') return res.status(413).json({ fehler: 'Die Anfrage ist zu groß.' });
    if (fehler.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(400).json({ fehler: 'Ein verknüpfter Eintrag existiert nicht.' });
    console.error(fehler);
    res.status(500).json({ fehler: 'Interner Serverfehler. Details stehen im Server-Log.' });
  });

  return { app, db, kontext };
}
