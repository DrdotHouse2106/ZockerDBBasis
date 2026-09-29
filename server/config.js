import path from 'node:path';
import fs from 'node:fs';
import { PROJEKT_WURZEL } from './pfade.js';
import { zahl, jaNein, pfad, basisUrl } from './konfig-hilfen.js';
import { MODULE } from './module.js';

export { PROJEKT_WURZEL };
export { lesePakete } from './konfig-hilfen.js';

// .env-Datei laden, falls vorhanden (Node >= 20.12 bringt das von Haus aus mit).
// Bereits gesetzte Umgebungsvariablen (z. B. aus Docker) haben Vorrang.
const envDatei = path.join(PROJEKT_WURZEL, '.env');
if (fs.existsSync(envDatei) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envDatei);
}

/** Adresse der Zentrale: Standard zockerdb.de, „aus“ schaltet ab. Nur https (http nur für localhost, z. B. Tests). */
function zentraleUrl(wert) {
  const roh = String(wert ?? '').trim();
  if (['aus', 'false', '0', 'nein', 'off'].includes(roh.toLowerCase())) return '';
  const url = basisUrl(roh || 'https://zockerdb.de');
  if (/^https:\/\//.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) return url;
  return '';
}

export function ladeKonfiguration(env = process.env) {
  const konfiguration = {
    port: zahl(env.PORT, 3000),
    host: env.HOST || '0.0.0.0',
    datenbankPfad: pfad(env.DATABASE_PATH, 'data/sammlung.db'),
    uploadVerzeichnis: pfad(env.UPLOAD_DIR, 'data/uploads'),
    maxUploadMb: zahl(env.MAX_UPLOAD_MB, 8),
    maxMedienMb: zahl(env.MEDIA_MAX_MB, 200),
    // Scans mit anderen Benutzern teilen (braucht die Moderation eines Zusatzmoduls)
    medienTeilenErlaubt: jaNein(env.MEDIA_SHARING, false),
    // Speicherplatz je Benutzer für eigene Fotos und Scans in MB (0 = unbegrenzt)
    speicherKontingentMb: Math.max(0, zahl(env.STORAGE_QUOTA_MB, 1024)),
    // Katalog auch ohne Anmeldung zeigen (öffentliche Seiten liefert ein Zusatzmodul)
    oeffentlicherKatalog: jaNein(env.PUBLIC_CATALOG, false),
    // Öffentliche Adresse, z. B. https://sammlung.example.de – für Links in E-Mails
    oeffentlicheUrl: basisUrl(env.PUBLIC_URL),
    cacheTtlStunden: zahl(env.CACHE_TTL_HOURS, 24 * 7),
    // Automatische Datenbank-Sicherung: die letzten X Tage täglich, die letzten Y Monate monatlich
    sicherung: {
      aktiv: jaNein(env.BACKUP_ENABLED, true),
      tage: Math.max(1, zahl(env.BACKUP_DAYS, 7)),
      monate: Math.max(0, zahl(env.BACKUP_MONTHS, 12)),
      verzeichnis: env.BACKUP_DIR ? pfad(env.BACKUP_DIR, '') : '',
    },
    // Verbindung zu zockerdb.de: zentraler Katalog (Suche, Barcodes, deutsche Titel und Texte), Einreichungen,
    // freiwillige anonyme Datenspende und Sync der Sammlung. ZOCKERDB_CENTRAL=aus → eigene IGDB-Zugangsdaten nutzen.
    zentrale: {
      url: zentraleUrl(env.ZOCKERDB_CENTRAL),
      spende: jaNein(env.ZOCKERDB_DONATE, false),
    },
    // Update per Knopf: Watchtower-HTTP-API (z. B. http://watchtower:8080/v1/update) und deren Token
    aktualisierung: {
      url: /^https?:\/\/\S+$/i.test(String(env.UPDATE_URL ?? '').trim()) ? String(env.UPDATE_URL).trim() : '',
      token: String(env.UPDATE_TOKEN ?? '').trim(),
      // Woher die App erfährt, ob es einen neueren Stand gibt: letzter erfolgreicher CI-Lauf dieses GitHub-Repositorys
      // „aus“ schaltet die Prüfung ab
      repo: String(env.UPDATE_CHECK_REPO ?? '').trim().toLowerCase() === 'aus' ? ''
        : /^[\w.-]+\/[\w.-]+$/.test(String(env.UPDATE_CHECK_REPO ?? '').trim()) ? String(env.UPDATE_CHECK_REPO).trim() : 'DrdotHouse2106/ZockerDBBasis',
      githubToken: String(env.UPDATE_GITHUB_TOKEN ?? '').trim(),
    },
    // Steam-Import der eigenen Bibliothek (Schlüssel: https://steamcommunity.com/dev/apikey)
    steam: {
      apiKey: (env.STEAM_API_KEY || '').trim(),
    },
    igdb: {
      clientId: (env.TWITCH_CLIENT_ID || '').trim(),
      clientSecret: (env.TWITCH_CLIENT_SECRET || '').trim(),
    },
    barcode: {
      // Kommagetrennte Liste der Online-Dienste für die EAN-/UPC-Suche.
      anbieter: (env.BARCODE_PROVIDERS ?? 'opengtindb,upcitemdb')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      openGtinDbQueryId: (env.OPENGTINDB_QUERYID || '').trim(),
    },
    konten: {
      // Geheimer Schlüssel zum Verschlüsseln der 2FA-Geheimnisse. Ohne Angabe wird
      // automatisch einer erzeugt und neben der Datenbank gespeichert.
      appGeheimnis: (env.APP_SECRET || '').trim(),
      registrierungOffen: jaNein(env.REGISTRATION_OPEN, true),
      zweiFaktorPflicht: jaNein(env.REQUIRE_2FA, false),
      sitzungTage: zahl(env.SESSION_DAYS, 30),
      registrierungenProStunde: zahl(env.REGISTRATIONS_PER_HOUR, 5),
      cookieSicher: (env.COOKIE_SECURE || 'auto').trim().toLowerCase(),
    },
    // E-Mail-Versand (Passwort vergessen, Bestätigung der E-Mail-Adresse, Benachrichtigungen)
    mail: {
      host: (env.SMTP_HOST || '').trim(),
      port: zahl(env.SMTP_PORT, 587),
      sicher: (env.SMTP_SECURE || 'auto').trim().toLowerCase(), // auto (465 = TLS), true, false (STARTTLS)
      benutzer: (env.SMTP_USER || '').trim(),
      passwort: env.SMTP_PASSWORD || '',
      absender: (env.SMTP_FROM || '').trim(), // z. B. "ZockerDB <noreply@zockerdb.de>"
      bcc: (env.SMTP_BCC || '').trim(), // Kopie aller E-Mails an diese Adresse (zum Prüfen, danach leeren)
    },
    // Spam-Schutz für Registrierung und „Passwort vergessen“: altcha, recaptcha oder aus
    captcha: {
      anbieter: (env.CAPTCHA_PROVIDER || 'altcha').trim().toLowerCase(),
      recaptchaSiteKey: (env.RECAPTCHA_SITE_KEY || '').trim(),
      recaptchaSecret: (env.RECAPTCHA_SECRET || '').trim(),
      mindestScore: Math.min(0.9, Math.max(0.1, Number.parseFloat(env.RECAPTCHA_MIN_SCORE || '') || 0.5)),
    },
    // Muss bei der Registrierung eine E-Mail-Adresse angegeben werden?
    emailPflicht: jaNein(env.REQUIRE_EMAIL, false),
    vertrauteProxies: env.TRUST_PROXY || '',
  };
  // Zusatzmodule ergänzen ihre eigenen Einstellungen
  for (const modul of MODULE) modul.konfiguration?.(env, konfiguration);
  // Quelle merken: Einstellungen aus der Weboberfläche werden darüber gelegt (siehe services/einstellungen.js)
  Object.defineProperty(konfiguration, 'quellEnv', { value: env, enumerable: false, writable: true });
  return konfiguration;
}

/** Überträgt eine neu geladene Konfiguration in das bestehende Objekt, damit alle Verweise aktuell bleiben. */
export function uebernehmeKonfiguration(ziel, neu) {
  for (const [schluessel, wert] of Object.entries(neu)) {
    const istObjekt = (w) => w && typeof w === 'object' && !Array.isArray(w);
    if (istObjekt(wert) && istObjekt(ziel[schluessel])) Object.assign(ziel[schluessel], wert);
    else ziel[schluessel] = wert;
  }
  return ziel;
}
