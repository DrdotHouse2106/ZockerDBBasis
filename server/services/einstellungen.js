// Server-Einstellungen über die Weboberfläche (Admin → Einstellungen).
//
// Die .env bleibt die Grundeinstellung. Werte, die ein Administrator in der Oberfläche setzt,
// werden in der Datenbank gespeichert und haben Vorrang. Geheimnisse (API-Schlüssel) werden
// mit AES-256-GCM verschlüsselt abgelegt und nie wieder im Klartext ausgeliefert.
// Pfade, Port, Proxy- und Cookie-Einstellungen sowie APP_SECRET sind bewusst nur über die
// .env änderbar – eine Fehleinstellung dort könnte den Server aussperren oder unsicher machen.
import { ladeKonfiguration, uebernehmeKonfiguration } from '../config.js';
import { verschluessele, entschluessele } from './sicherheit.js';
import { ValidierungsFehler } from './validierung.js';
import { MODULE } from '../module.js';

export const JA_NEIN = { typ: 'jaNein' };

/** Über die Oberfläche änderbare Einstellungen des Kerns. `sicher` = nur mit Passwortbestätigung. Module ergänzen eigene. */
export const EINSTELLUNGEN = [
  { schluessel: 'REGISTRATION_OPEN', gruppe: 'Konten & Sicherheit', titel: 'Registrierung offen', ...JA_NEIN, sicher: true,
    hinweis: 'Dürfen sich neue Benutzer selbst registrieren?' },
  { schluessel: 'ACCESS_REQUESTS', gruppe: 'Konten & Sicherheit', titel: 'Zugang anfragen bei geschlossener Registrierung', ...JA_NEIN,
    hinweis: 'Interessierte können auf der Anmeldeseite (und der öffentlichen Startseite) Name, E-Mail und eine Nachricht schicken. Du siehst die Anfragen unter Administration → Benutzer und kannst mit einem Klick einladen. Anfragen werden nach 90 Tagen gelöscht.' },
  { schluessel: 'REQUIRE_2FA', gruppe: 'Konten & Sicherheit', titel: 'Zwei-Faktor-Anmeldung für alle Pflicht', ...JA_NEIN, sicher: true,
    hinweis: 'Benutzer ohne 2FA müssen sie vor der Nutzung einrichten.' },
  { schluessel: 'CAPTCHA_PROVIDER', gruppe: 'Konten & Sicherheit', titel: 'Spam-Schutz bei Registrierung', typ: 'auswahl', sicher: true,
    optionen: [['altcha', 'ALTCHA (ohne Google, ohne Cookies)'], ['recaptcha', 'Google reCAPTCHA v3 (mit Einwilligung)'], ['aus', 'Aus']],
    hinweis: 'reCAPTCHA überträgt Daten an Google (USA) und wird erst nach Einwilligung geladen – Datenschutzerklärung anpassen.' },
  { schluessel: 'RECAPTCHA_SITE_KEY', gruppe: 'Konten & Sicherheit', titel: 'reCAPTCHA-Websiteschlüssel', typ: 'text' },
  { schluessel: 'RECAPTCHA_SECRET', gruppe: 'Konten & Sicherheit', titel: 'reCAPTCHA-Geheimschlüssel', typ: 'geheim', sicher: true },
  { schluessel: 'RECAPTCHA_MIN_SCORE', gruppe: 'Konten & Sicherheit', titel: 'reCAPTCHA-Mindestscore', typ: 'dezimal', min: 0.1, max: 0.9,
    hinweis: '0,1 (lässt fast alle durch) bis 0,9 (sehr streng). Standard 0,5.' },
  { schluessel: 'REQUIRE_EMAIL', gruppe: 'Konten & Sicherheit', titel: 'E-Mail-Adresse bei der Registrierung Pflicht', ...JA_NEIN,
    hinweis: 'Nur wirksam, wenn der E-Mail-Versand eingerichtet ist.' },
  { schluessel: 'ZOCKERDB_CENTRAL', gruppe: 'Verbindung zu zockerdb.de', titel: 'Zentraler Katalog', typ: 'text', sicher: true,
    platzhalter: 'https://zockerdb.de',
    hinweis: 'Suche und Barcodes laufen über zockerdb.de: deutsche Titel und Texte, keine eigenen IGDB-Zugangsdaten nötig, und jeder gefundene Titel bereichert den gemeinsamen Katalog. „aus“ = nur eigene IGDB-Zugangsdaten.' },
  { schluessel: 'ZOCKERDB_DONATE', gruppe: 'Verbindung zu zockerdb.de', titel: 'Anonyme Datenspende', ...JA_NEIN,
    hinweis: 'Wöchentlich nur Anzahlen je Katalogeintrag (wie viele Sammler, wie viele Exemplare) – keine Namen, Preise oder Notizen. Vorschau unter Administration → Übersicht. Benutzer können sich im Konto ausnehmen.' },
  { schluessel: 'UPDATE_URL', gruppe: 'Update per Knopf', titel: 'Watchtower-Adresse', typ: 'url', sicher: true,
    platzhalter: 'http://watchtower:8080/v1/update',
    hinweis: 'Adresse der HTTP-API eines Watchtower-Containers. Damit erscheint unter Administration → Übersicht der Knopf „Jetzt aktualisieren“. Einrichtung siehe README.' },
  { schluessel: 'UPDATE_TOKEN', gruppe: 'Update per Knopf', titel: 'Watchtower-Token', typ: 'geheim', sicher: true,
    hinweis: 'Derselbe Wert wie WATCHTOWER_HTTP_API_TOKEN beim Watchtower-Container.' },
  { schluessel: 'UPDATE_CHECK_REPO', gruppe: 'Update per Knopf', titel: 'GitHub-Repository für die Update-Prüfung', typ: 'text', sicher: true,
    platzhalter: 'DrdotHouse2106/ZockerDBBasis',
    hinweis: 'Die Übersicht zeigt „Neue Version verfügbar“, sobald dort ein neuerer Stand fertig gebaut ist (letzter erfolgreicher CI-Lauf). „aus“ schaltet die Prüfung ab.' },
  { schluessel: 'UPDATE_GITHUB_TOKEN', gruppe: 'Update per Knopf', titel: 'GitHub-Token (nur für private Repositorys)', typ: 'geheim', sicher: true,
    hinweis: 'GitHub → Settings → Developer settings → Fine-grained tokens: nur dieses Repository, Berechtigung „Actions: Read-only“.' },
  { schluessel: 'STORAGE_QUOTA_MB', gruppe: 'Uploads & Speicher', titel: 'Speicherplatz je Benutzer (MB)', typ: 'zahl', min: 0, max: 10_000_000,
    hinweis: '0 = unbegrenzt. Freigegebene Scans zählen nicht mit.' },
  { schluessel: 'MAX_UPLOAD_MB', gruppe: 'Uploads & Speicher', titel: 'Maximale Größe von Artikelfotos (MB)', typ: 'zahl', min: 1, max: 100 },
  { schluessel: 'MEDIA_MAX_MB', gruppe: 'Uploads & Speicher', titel: 'Maximale Größe von Scans/PDFs (MB)', typ: 'zahl', min: 1, max: 2000 },
  { schluessel: 'PHOTO_MAX_PX', gruppe: 'Uploads & Speicher', titel: 'Fotos verkleinern auf (Pixel, lange Seite)', typ: 'zahl', min: 0, max: 10000,
    hinweis: 'Fotos werden als WebP gespeichert und auf diese Größe verkleinert – ein Handyfoto braucht dann meist unter 1 MB statt 4–8 MB. 0 = Originalgröße (trotzdem WebP). Scans von Cover und Anleitung bleiben unverändert in voller Auflösung.' },
  { schluessel: 'BACKUP_ENABLED', gruppe: 'Uploads & Speicher', titel: 'Automatische Datenbank-Sicherung', ...JA_NEIN,
    hinweis: 'Täglich eine Sicherung der Datenbank im Datenordner (Unterordner „sicherungen“).' },
  { schluessel: 'BACKUP_DAYS', gruppe: 'Uploads & Speicher', titel: 'Tägliche Sicherungen aufbewahren (Tage)', typ: 'zahl', min: 1, max: 90 },
  { schluessel: 'BACKUP_MONTHS', gruppe: 'Uploads & Speicher', titel: 'Monatliche Sicherungen aufbewahren (Monate)', typ: 'zahl', min: 0, max: 120,
    hinweis: '0 = keine monatlichen Sicherungen.' },
  { schluessel: 'PUBLIC_URL', gruppe: 'E-Mail (SMTP)', titel: 'Öffentliche Adresse', typ: 'url', platzhalter: 'https://sammlung.example.de',
    hinweis: 'Adresse, unter der die App erreichbar ist – nötig für Links in E-Mails.' },
  { schluessel: 'SMTP_HOST', gruppe: 'E-Mail (SMTP)', titel: 'SMTP-Server', typ: 'text', platzhalter: 'smtp.example.de',
    hinweis: 'Für „Passwort vergessen“, die Bestätigung der E-Mail-Adresse und Benachrichtigungen. Links in E-Mails brauchen die öffentliche Adresse (PUBLIC_URL).' },
  { schluessel: 'SMTP_PORT', gruppe: 'E-Mail (SMTP)', titel: 'Port', typ: 'zahl', min: 1, max: 65535, hinweis: '587 (STARTTLS) oder 465 (TLS).' },
  { schluessel: 'SMTP_SECURE', gruppe: 'E-Mail (SMTP)', titel: 'Verschlüsselung', typ: 'auswahl',
    optionen: [['auto', 'Automatisch (465 = TLS, sonst STARTTLS)'], ['true', 'TLS'], ['false', 'STARTTLS']] },
  { schluessel: 'SMTP_USER', gruppe: 'E-Mail (SMTP)', titel: 'Benutzername', typ: 'text' },
  { schluessel: 'SMTP_PASSWORD', gruppe: 'E-Mail (SMTP)', titel: 'Passwort', typ: 'geheim', sicher: true },
  { schluessel: 'SMTP_FROM', gruppe: 'E-Mail (SMTP)', titel: 'Absender', typ: 'text', platzhalter: 'ZockerDB <noreply@zockerdb.de>' },
  { schluessel: 'SMTP_BCC', gruppe: 'E-Mail (SMTP)', titel: 'Kopie aller E-Mails an (BCC)', typ: 'text', platzhalter: 'pruefung@example.de',
    hinweis: 'Jede versendete E-Mail geht zusätzlich unsichtbar an diese Adresse – zum Prüfen der Texte. Leer = aus. Achtung: Die Kopien enthalten auch Links zum Zurücksetzen von Passwörtern; nach der Prüfphase wieder leeren.' },
  { schluessel: 'TWITCH_CLIENT_ID', gruppe: 'Spieledaten (IGDB) & Barcodes', titel: 'Twitch Client-ID (IGDB)', typ: 'text' },
  { schluessel: 'TWITCH_CLIENT_SECRET', gruppe: 'Spieledaten (IGDB) & Barcodes', titel: 'Twitch Client-Secret (IGDB)', typ: 'geheim', sicher: true },
  { schluessel: 'BARCODE_PROVIDERS', gruppe: 'Spieledaten (IGDB) & Barcodes', titel: 'Barcode-Dienste', typ: 'text', platzhalter: 'opengtindb,upcitemdb',
    hinweis: 'Kommagetrennt, Reihenfolge = Abfragereihenfolge.' },
  { schluessel: 'STEAM_API_KEY', gruppe: 'Spieledaten (IGDB) & Barcodes', titel: 'Steam-API-Schlüssel (Import der Steam-Bibliothek)', typ: 'geheim', sicher: true,
    hinweis: 'Kostenlos unter steamcommunity.com/dev/apikey (mit Steam-Konto anmelden, Domain angeben). Ohne Schlüssel ist der Steam-Import ausgeblendet.' },
  { schluessel: 'OPENGTINDB_QUERYID', gruppe: 'Spieledaten (IGDB) & Barcodes', titel: 'OpenGTINDB-Query-ID', typ: 'geheim', sicher: true },
];

/** Was gilt, wenn weder .env noch Oberfläche einen Wert setzen – wird als Platzhalter bzw. „Standard (Ja)“ angezeigt. */
const STANDARDWERTE = {
  REGISTRATION_OPEN: 'true', ACCESS_REQUESTS: 'true', REQUIRE_2FA: 'false', REQUIRE_EMAIL: 'false', RECAPTCHA_MIN_SCORE: '0.5', ZOCKERDB_DONATE: 'false',
  STORAGE_QUOTA_MB: '1024', MAX_UPLOAD_MB: '8', MEDIA_MAX_MB: '200', PHOTO_MAX_PX: '2560', BACKUP_ENABLED: 'true', BACKUP_DAYS: '7', BACKUP_MONTHS: '12', SMTP_PORT: '587',
};

/** Kern und Zusatzmodule zusammen. Standardwerte der Module (`standard`) haben Vorrang. */
const AUSGEBLENDET = new Set(MODULE.flatMap((m) => m.ausgeblendeteEinstellungen ?? []));
const ALLE = [...EINSTELLUNGEN, ...MODULE.flatMap((m) => m.einstellungen ?? [])]
  .map((d) => (d.standard === undefined && STANDARDWERTE[d.schluessel] !== undefined ? { ...d, standard: STANDARDWERTE[d.schluessel] } : d));

const PER_SCHLUESSEL = new Map(ALLE.map((d) => [d.schluessel, d]));
const JA = ['1', 'true', 'ja', 'yes', 'on'];

/** Kürzt Geheimnisse für die Anzeige: ••••1234 */
export function maskiere(wert) {
  const text = String(wert ?? '');
  if (!text) return '';
  return text.length <= 8 ? '••••' : `••••${text.slice(-4)}`;
}

/** Prüft und normalisiert einen Wert; liefert den Text, wie er auch in der .env stünde. */
function normalisiere(definition, wert) {
  const text = String(wert ?? '').trim();
  switch (definition.typ) {
    case 'jaNein':
      return wert === true || JA.includes(text.toLowerCase()) ? 'true' : 'false';
    case 'zahl': {
      const n = Number(text);
      if (!text || !Number.isInteger(n) || n < definition.min || n > definition.max) {
        throw new Error(`Bitte eine ganze Zahl zwischen ${definition.min} und ${definition.max.toLocaleString('de-DE')} angeben.`);
      }
      return String(n);
    }
    case 'dezimal': {
      const n = Number(text.replace(',', '.'));
      if (!text || !Number.isFinite(n) || n < definition.min || n > definition.max) {
        throw new Error(`Bitte einen Wert zwischen ${String(definition.min).replace('.', ',')} und ${definition.max} angeben.`);
      }
      return String(n);
    }
    case 'auswahl':
      if (!definition.optionen.some(([w]) => w === text)) throw new Error('Ungültige Auswahl.');
      return text;
    case 'liste': {
      // Domains: https://, www. und Pfade entfernen, doppelte streichen
      const eintraege = text.split(/[\s,;]+/).map((d) => d.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '')).filter(Boolean);
      const falsch = eintraege.find((d) => !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
      if (falsch) throw new Error(`„${falsch}“ ist keine gültige Domain (z. B. nintendo.de).`);
      return [...new Set(eintraege)].join(', ');
    }
    case 'url':
      if (text && !/^https?:\/\/[^\s/]+[^\s]*$/i.test(text)) throw new Error('Bitte eine vollständige Adresse mit https:// angeben.');
      return text.replace(/\/+$/, '');
    default:
      if (text.length > 2000) throw new Error('Der Wert ist zu lang.');
      if (/[\r\n]/.test(text)) throw new Error('Zeilenumbrüche sind nicht erlaubt.');
      return text;
  }
}

export function erstelleEinstellungsDienst(db, { konfiguration, schluessel, nachAenderung = () => {} }) {
  const alleZeilen = db.prepare(`SELECT e.*, COALESCE(b.anzeigename, b.benutzername) AS geaendert_von_name
    FROM server_einstellungen e LEFT JOIN benutzer b ON b.id = e.geaendert_von`);
  const schreiben = db.prepare(`INSERT INTO server_einstellungen (schluessel, wert, verschluesselt, geaendert_von, geaendert_am)
    VALUES (@schluessel, @wert, @verschluesselt, @benutzer, datetime('now'))
    ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert, verschluesselt = excluded.verschluesselt,
      geaendert_von = excluded.geaendert_von, geaendert_am = excluded.geaendert_am`);
  const loeschen = db.prepare('DELETE FROM server_einstellungen WHERE schluessel = ?');
  const protokollieren = db.prepare(`INSERT INTO einstellungen_protokoll (schluessel, aktion, alt, neu, benutzer_id)
    VALUES (?, ?, ?, ?, ?)`);
  const quellEnv = () => konfiguration.quellEnv ?? process.env;

  /** Gespeicherte Werte (entschlüsselt) als { SCHLUESSEL: wert }. */
  function gespeicherteWerte() {
    const werte = {};
    for (const z of alleZeilen.all()) {
      if (!PER_SCHLUESSEL.has(z.schluessel)) continue;
      try {
        werte[z.schluessel] = z.verschluesselt ? entschluessele(z.wert, schluessel) : z.wert ?? '';
      } catch {
        console.warn(`[einstellungen] ${z.schluessel} konnte nicht entschlüsselt werden (APP_SECRET geändert?) – .env-Wert wird verwendet.`);
      }
    }
    return werte;
  }

  /** Lädt die Konfiguration aus .env + Datenbank neu und überträgt sie in das laufende Objekt. */
  function wendeAn() {
    const env = quellEnv();
    const neu = ladeKonfiguration({ ...env, ...gespeicherteWerte() });
    uebernehmeKonfiguration(konfiguration, neu);
    konfiguration.quellEnv = env;
    return konfiguration;
  }

  /** Alle Einstellungen für die Admin-Oberfläche – Geheimnisse nur maskiert. */
  function liste() {
    const env = quellEnv();
    const zeilen = new Map(alleZeilen.all().map((z) => [z.schluessel, z]));
    const werte = gespeicherteWerte();
    // Werte, die ein Modul ausblendet (z. B. auf zockerdb.de, das selbst die Zentrale ist) – außer sie werden genutzt
    return ALLE.filter((d) => !AUSGEBLENDET.has(d.schluessel) || konfiguration.zentrale?.url).map((d) => {
      const zeile = zeilen.get(d.schluessel);
      const envWert = env[d.schluessel] ?? '';
      const imWeb = zeile && Object.hasOwn(werte, d.schluessel);
      const aktuell = imWeb ? werte[d.schluessel] : envWert;
      const geheim = d.typ === 'geheim';
      return {
        ...d,
        herkunft: imWeb ? 'web' : envWert !== '' ? 'env' : 'standard',
        wert: geheim ? null : aktuell,
        gesetzt: aktuell !== '',
        maskiert: geheim ? maskiere(aktuell) : null,
        env_wert: geheim ? maskiere(envWert) : envWert,
        geaendert_am: imWeb ? zeile.geaendert_am : null,
        geaendert_von: imWeb ? zeile.geaendert_von_name : null,
      };
    });
  }

  /** Braucht diese Änderung eine Bestätigung mit Passwort (und 2FA)? */
  function brauchtBestaetigung({ werte = {}, zuruecksetzen = [], entfernen = [] }) {
    const betroffen = [...Object.keys(werte).filter((k) => !(PER_SCHLUESSEL.get(k)?.typ === 'geheim' && !String(werte[k] ?? '').trim())),
      ...zuruecksetzen, ...entfernen];
    return betroffen.some((k) => PER_SCHLUESSEL.get(k)?.sicher);
  }

  /**
   * Übernimmt Änderungen. `werte`: neue Werte (leere Geheimnisse = unverändert),
   * `zuruecksetzen`: zurück auf den .env-Wert, `entfernen`: Geheimnis leeren (auch wenn in .env gesetzt).
   */
  function setze({ werte = {}, zuruecksetzen = [], entfernen = [] }, benutzer) {
    const fehler = {};
    const env = quellEnv();
    const vorher = gespeicherteWerte();
    const aktuellerWert = (k) => (Object.hasOwn(vorher, k) ? vorher[k] : env[k] ?? '');
    const aenderungen = [];

    for (const [k, roh] of Object.entries(werte ?? {})) {
      const d = PER_SCHLUESSEL.get(k);
      if (!d) { fehler[k] = 'Diese Einstellung kann nur in der .env geändert werden.'; continue; }
      if (d.typ === 'geheim' && !String(roh ?? '').trim()) continue; // leer = unverändert
      try {
        const neu = normalisiere(d, roh);
        if (neu !== aktuellerWert(k)) aenderungen.push({ d, aktion: 'geaendert', neu });
      } catch (e) {
        fehler[k] = e.message;
      }
    }
    for (const k of zuruecksetzen ?? []) {
      const d = PER_SCHLUESSEL.get(k);
      if (!d) fehler[k] = 'Unbekannte Einstellung.';
      else if (Object.hasOwn(vorher, k)) aenderungen.push({ d, aktion: 'zurueckgesetzt' });
    }
    for (const k of entfernen ?? []) {
      const d = PER_SCHLUESSEL.get(k);
      if (!d) fehler[k] = 'Unbekannte Einstellung.';
      else aenderungen.push({ d, aktion: 'entfernt', neu: '' });
    }
    if (Object.keys(fehler).length) throw new ValidierungsFehler(fehler);
    if (!aenderungen.length) return [];

    const anzeige = (d, w) => (w == null ? null : d.typ === 'geheim' ? maskiere(w) || '(leer)' : w || '(leer)');
    db.transaction(() => {
      for (const { d, aktion, neu } of aenderungen) {
        const alt = aktuellerWert(d.schluessel);
        if (aktion === 'zurueckgesetzt') {
          loeschen.run(d.schluessel);
          protokollieren.run(d.schluessel, aktion, anzeige(d, alt), anzeige(d, env[d.schluessel] ?? ''), benutzer?.id ?? null);
          continue;
        }
        const geheim = d.typ === 'geheim' && neu !== '';
        schreiben.run({ schluessel: d.schluessel, wert: geheim ? verschluessele(neu, schluessel) : neu, verschluesselt: geheim ? 1 : 0, benutzer: benutzer?.id ?? null });
        protokollieren.run(d.schluessel, aktion, anzeige(d, alt), anzeige(d, neu), benutzer?.id ?? null);
      }
    })();

    wendeAn();
    const geaendert = aenderungen.map((a) => a.d.schluessel);
    nachAenderung(geaendert);
    return geaendert;
  }

  function protokoll(limit = 100) {
    return db.prepare(`SELECT p.id, p.schluessel, p.aktion, p.alt, p.neu, p.erstellt_am, COALESCE(b.anzeigename, b.benutzername) AS benutzer
      FROM einstellungen_protokoll p LEFT JOIN benutzer b ON b.id = p.benutzer_id ORDER BY p.id DESC LIMIT ?`).all(limit)
      .map((z) => ({ ...z, titel: PER_SCHLUESSEL.get(z.schluessel)?.titel ?? z.schluessel }));
  }

  return { liste, setze, wendeAn, brauchtBestaetigung, protokoll };
}
