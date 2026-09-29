import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { PLATTFORM_STAMMDATEN } from '../shared/konstanten.js';
import { ordnePlattformZu, ladePlattformIndex } from './services/plattformen.js';
import { RECHTLICHE_VORLAGEN } from './rechtliche-vorlagen.js';
import { MODULE } from './module.js';

// Migrationen werden der Reihe nach ausgeführt. Neue Änderungen am Schema
// immer als neuen Eintrag unten anhängen – bestehende nie verändern.
const MIGRATIONEN = [
  `
  CREATE TABLE katalog (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    quelle           TEXT    NOT NULL,              -- 'igdb' oder 'eigen'
    externe_id       TEXT,                          -- z. B. IGDB-ID
    typ              TEXT    NOT NULL DEFAULT 'spiel',
    titel            TEXT    NOT NULL,
    plattformen      TEXT    NOT NULL DEFAULT '[]', -- JSON-Array
    erscheinungsjahr INTEGER,
    hersteller       TEXT,
    cover_url        TEXT,
    beschreibung     TEXT,
    daten            TEXT,                          -- Rohdaten (JSON)
    erstellt_am      TEXT    NOT NULL DEFAULT (datetime('now')),
    aktualisiert_am  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (quelle, externe_id)
  );
  CREATE INDEX idx_katalog_titel ON katalog (titel COLLATE NOCASE);

  CREATE TABLE barcodes (
    code         TEXT PRIMARY KEY,
    katalog_id   INTEGER REFERENCES katalog (id) ON DELETE SET NULL,
    produktname  TEXT,
    quelle       TEXT,
    abgerufen_am TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE api_cache (
    schluessel   TEXT PRIMARY KEY,
    daten        TEXT    NOT NULL,
    abgerufen_am INTEGER NOT NULL                   -- Unix-Zeit in ms
  );

  CREATE TABLE einstellungen (
    schluessel TEXT PRIMARY KEY,
    wert       TEXT
  );

  CREATE TABLE artikel (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    typ              TEXT    NOT NULL,
    titel            TEXT    NOT NULL,
    plattform        TEXT,
    katalog_id       INTEGER REFERENCES katalog (id) ON DELETE SET NULL,
    barcode          TEXT,
    cover_url        TEXT,
    bild_datei       TEXT,
    zustand          TEXT,
    vollstaendigkeit TEXT,
    region           TEXT,
    farbe            TEXT,
    edition          TEXT,
    modellnummer     TEXT,
    seriennummer     TEXT,
    notizen          TEXT,
    kaufpreis        REAL,
    kaufdatum        TEXT,
    anzahl           INTEGER NOT NULL DEFAULT 1,
    erstellt_am      TEXT    NOT NULL DEFAULT (datetime('now')),
    aktualisiert_am  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_artikel_typ ON artikel (typ);
  CREATE INDEX idx_artikel_titel ON artikel (titel COLLATE NOCASE);
  CREATE INDEX idx_artikel_barcode ON artikel (barcode);
  `,
  // 2: Benutzerkonten, Sitzungen, 2FA, Scans/Dokumente
  `
  CREATE TABLE benutzer (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzername         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    anzeigename          TEXT,
    passwort_hash        TEXT    NOT NULL,
    rolle                TEXT    NOT NULL DEFAULT 'nutzer',   -- 'admin' oder 'nutzer'
    gesperrt             INTEGER NOT NULL DEFAULT 0,
    totp_geheimnis       TEXT,                                -- verschlüsselt
    totp_aktiv           INTEGER NOT NULL DEFAULT 0,
    totp_letzter_schritt INTEGER,
    wiederherstellungscodes TEXT,                             -- JSON-Array mit Hashes
    sammlung_oeffentlich INTEGER NOT NULL DEFAULT 0,
    erstellt_am          TEXT    NOT NULL DEFAULT (datetime('now')),
    letzte_anmeldung     TEXT
  );

  CREATE TABLE sitzungen (
    token_hash   TEXT PRIMARY KEY,
    benutzer_id  INTEGER NOT NULL REFERENCES benutzer (id) ON DELETE CASCADE,
    stufe        TEXT    NOT NULL DEFAULT 'voll',            -- 'voll' oder '2fa' (wartet auf Code)
    laeuft_ab    INTEGER NOT NULL,                           -- Unix-Zeit in ms
    erstellt_am  TEXT    NOT NULL DEFAULT (datetime('now')),
    geraet       TEXT
  );
  CREATE INDEX idx_sitzungen_benutzer ON sitzungen (benutzer_id);

  ALTER TABLE artikel ADD COLUMN benutzer_id INTEGER REFERENCES benutzer (id) ON DELETE CASCADE;
  ALTER TABLE artikel ADD COLUMN marktwert REAL;
  CREATE INDEX idx_artikel_benutzer ON artikel (benutzer_id);

  ALTER TABLE katalog ADD COLUMN erstellt_von INTEGER REFERENCES benutzer (id) ON DELETE SET NULL;

  CREATE TABLE medien (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    katalog_id      INTEGER NOT NULL REFERENCES katalog (id) ON DELETE CASCADE,
    benutzer_id     INTEGER REFERENCES benutzer (id) ON DELETE CASCADE,
    art             TEXT    NOT NULL,     -- cover_vorne, cover_hinten, cover_komplett, handbuch, label, sonstiges
    titel           TEXT,
    sichtbarkeit    TEXT    NOT NULL DEFAULT 'privat',       -- 'privat' oder 'geteilt'
    datei           TEXT    NOT NULL,     -- Original
    anzeige_datei   TEXT,                 -- browsertaugliche Version (z. B. aus TIFF)
    vorschau_datei  TEXT,                 -- kleines Vorschaubild
    originalname    TEXT,
    mime            TEXT    NOT NULL,
    groesse         INTEGER NOT NULL,
    breite          INTEGER,
    hoehe           INTEGER,
    dpi             REAL,
    seiten          INTEGER,
    erstellt_am     TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_medien_katalog ON medien (katalog_id);

  `,
  // 3: Prüfstatus, Plattform-Stammdaten, Varianten, Kommentare
  `
  CREATE TABLE plattformen (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    kurz             TEXT    NOT NULL,
    hersteller       TEXT    NOT NULL DEFAULT 'Sonstige',
    typ              TEXT    NOT NULL DEFAULT 'konsole',   -- konsole, handheld, computer, sonstige
    erscheinungsjahr INTEGER,
    aliase           TEXT    NOT NULL DEFAULT '[]'         -- JSON-Array alternativer Namen
  );

  CREATE TABLE katalog_plattformen (
    katalog_id   INTEGER NOT NULL REFERENCES katalog (id) ON DELETE CASCADE,
    plattform_id INTEGER NOT NULL REFERENCES plattformen (id) ON DELETE CASCADE,
    PRIMARY KEY (katalog_id, plattform_id)
  );
  CREATE INDEX idx_katalog_plattformen_plattform ON katalog_plattformen (plattform_id);

  ALTER TABLE artikel ADD COLUMN plattform_id INTEGER REFERENCES plattformen (id) ON DELETE SET NULL;
  CREATE INDEX idx_artikel_plattform ON artikel (plattform_id);

  -- Moderation des globalen Katalogs
  ALTER TABLE katalog ADD COLUMN status TEXT NOT NULL DEFAULT 'freigegeben';
  ALTER TABLE katalog ADD COLUMN eingereicht_am TEXT;
  ALTER TABLE katalog ADD COLUMN geprueft_von INTEGER REFERENCES benutzer (id) ON DELETE SET NULL;
  ALTER TABLE katalog ADD COLUMN geprueft_am TEXT;
  ALTER TABLE katalog ADD COLUMN pruefung_notiz TEXT;
  UPDATE katalog SET status = CASE
    WHEN quelle = 'igdb' THEN 'freigegeben'
    WHEN erstellt_von IN (SELECT id FROM benutzer WHERE rolle = 'admin') THEN 'freigegeben'
    ELSE 'eingereicht' END,
    eingereicht_am = CASE WHEN quelle = 'eigen' THEN erstellt_am END;
  CREATE INDEX idx_katalog_status ON katalog (status);

  -- Bekannte Varianten/Revisionen eines Katalogeintrags (z. B. SCPH-1002, SCPH-5502 …)
  CREATE TABLE katalog_varianten (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    katalog_id       INTEGER NOT NULL REFERENCES katalog (id) ON DELETE CASCADE,
    bezeichnung      TEXT    NOT NULL,
    modellnummer     TEXT,
    farbe            TEXT,
    edition          TEXT,
    region           TEXT,
    erscheinungsjahr INTEGER,
    beschreibung     TEXT,
    status           TEXT    NOT NULL DEFAULT 'privat',
    erstellt_von     INTEGER REFERENCES benutzer (id) ON DELETE SET NULL,
    geprueft_von     INTEGER REFERENCES benutzer (id) ON DELETE SET NULL,
    pruefung_notiz   TEXT,
    erstellt_am      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_varianten_katalog ON katalog_varianten (katalog_id);
  ALTER TABLE artikel ADD COLUMN variante_id INTEGER REFERENCES katalog_varianten (id) ON DELETE SET NULL;

  -- Scans: „geteilt“ wird zu „eingereicht“ (muss jetzt freigegeben werden)
  UPDATE medien SET sichtbarkeit = 'eingereicht' WHERE sichtbarkeit = 'geteilt';
  ALTER TABLE medien ADD COLUMN geprueft_von INTEGER REFERENCES benutzer (id) ON DELETE SET NULL;
  ALTER TABLE medien ADD COLUMN geprueft_am TEXT;
  ALTER TABLE medien ADD COLUMN pruefung_notiz TEXT;

  -- Barcode-Zuordnungen je Benutzer (private Einträge verraten so nichts an andere)
  CREATE TABLE barcode_zuordnungen (
    code        TEXT    NOT NULL,
    katalog_id  INTEGER NOT NULL REFERENCES katalog (id) ON DELETE CASCADE,
    benutzer_id INTEGER NOT NULL REFERENCES benutzer (id) ON DELETE CASCADE,
    erstellt_am TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (code, katalog_id, benutzer_id)
  );
  INSERT OR IGNORE INTO barcode_zuordnungen (code, katalog_id, benutzer_id)
    SELECT DISTINCT a.barcode, a.katalog_id, a.benutzer_id FROM artikel a
    WHERE a.barcode IS NOT NULL AND a.katalog_id IS NOT NULL AND a.benutzer_id IS NOT NULL;

  -- Private Kommentare/Notizen zu einem Spiel oder Gerät
  CREATE TABLE kommentare (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzer_id     INTEGER NOT NULL REFERENCES benutzer (id) ON DELETE CASCADE,
    katalog_id      INTEGER NOT NULL REFERENCES katalog (id) ON DELETE CASCADE,
    text            TEXT    NOT NULL,
    erstellt_am     TEXT    NOT NULL DEFAULT (datetime('now')),
    aktualisiert_am TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_kommentare ON kommentare (benutzer_id, katalog_id);

  -- Preis-Historie: automatische Marktpreise und gemeldete Angebote/Verkäufe

  -- Kauflinks zu konkreten Angeboten, gepflegt vom Moderationsteam
  `,
  // 4: Plattform-Stammdaten übernehmen und bestehende Freitext-Plattformen zuordnen
  (db) => {
    const einfuegen = db.prepare(`INSERT OR IGNORE INTO plattformen (name, kurz, hersteller, typ, erscheinungsjahr, aliase)
                                  VALUES (?, ?, ?, ?, ?, ?)`);
    for (const p of PLATTFORM_STAMMDATEN) einfuegen.run(p.name, p.kurz, p.hersteller, p.typ, p.jahr, JSON.stringify(p.aliase));
    const index = ladePlattformIndex(db);
    const setzeArtikel = db.prepare('UPDATE artikel SET plattform_id = ?, plattform = ? WHERE id = ?');
    for (const a of db.prepare('SELECT id, plattform FROM artikel WHERE plattform IS NOT NULL').all()) {
      const p = ordnePlattformZu(index, a.plattform);
      if (p) setzeArtikel.run(p.id, p.name, a.id);
    }
    const verknuepfe = db.prepare('INSERT OR IGNORE INTO katalog_plattformen (katalog_id, plattform_id) VALUES (?, ?)');
    for (const k of db.prepare('SELECT id, plattformen FROM katalog').all()) {
      for (const name of JSON.parse(k.plattformen || '[]')) {
        const p = ordnePlattformZu(index, name);
        if (p) verknuepfe.run(k.id, p.id);
      }
    }
  },
  // 5: Rechtliche Seiten
  `
  CREATE TABLE seiten (
    slug            TEXT PRIMARY KEY,
    titel           TEXT NOT NULL,
    inhalt          TEXT NOT NULL DEFAULT '',
    aktualisiert_am TEXT NOT NULL DEFAULT (datetime('now')),
    aktualisiert_von INTEGER REFERENCES benutzer (id) ON DELETE SET NULL
  );

  -- Meldungen rechtswidriger/fehlerhafter Inhalte (Notice-and-Takedown, Art. 16 DSA)

  -- Von Moderatoren bearbeitete Einträge werden bei IGDB-Aktualisierungen nicht überschrieben
  ALTER TABLE katalog ADD COLUMN manuell_bearbeitet INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE benutzer ADD COLUMN bedingungen_akzeptiert_am TEXT;
  `,
  (db) => {
    const einfuegen = db.prepare('INSERT OR IGNORE INTO seiten (slug, titel, inhalt) VALUES (?, ?, ?)');
    // Ein Zusatzmodul kann ausführlichere Vorlagen mitbringen (z. B. für zockerdb.de)
    const vorlagen = MODULE.find((m) => m.rechtlicheVorlagen)?.rechtlicheVorlagen ?? RECHTLICHE_VORLAGEN;
    for (const v of vorlagen) einfuegen.run(v.slug, v.titel, v.inhalt);
  },
  // 7: Automatische Vorprüfung von Einreichungen (Felder am Katalog)
  `
  ALTER TABLE katalog ADD COLUMN automatisch_geprueft INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE katalog ADD COLUMN menschliche_pruefung INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE katalog ADD COLUMN ki_hinweis TEXT;
  ALTER TABLE katalog_varianten ADD COLUMN eingereicht_am TEXT;
  ALTER TABLE katalog_varianten ADD COLUMN automatisch_geprueft INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE katalog_varianten ADD COLUMN menschliche_pruefung INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE katalog_varianten ADD COLUMN ki_hinweis TEXT;
  UPDATE katalog_varianten SET eingereicht_am = erstellt_am WHERE status = 'eingereicht';
  `,
  // 8: (frei – gehört inzwischen zum Zusatzmodul von zockerdb.de)
  'SELECT 1',
  // 9: Speicherplatz-Kontingent je Benutzer (Größen inkl. abgeleiteter Dateien)
  `
  ALTER TABLE benutzer ADD COLUMN speicher_limit_mb INTEGER;   -- NULL = Standard (STORAGE_QUOTA_MB), 0 = unbegrenzt
  ALTER TABLE medien ADD COLUMN groesse_gesamt INTEGER;        -- Original + Anzeige- und Vorschaudatei in Byte
  ALTER TABLE artikel ADD COLUMN bild_groesse INTEGER;
  `,
  // 10: Server-Einstellungen über die Weboberfläche, Sammlerhinweise und SEO-Angaben am Katalog
  `
  CREATE TABLE server_einstellungen (
    schluessel     TEXT PRIMARY KEY,              -- Name wie in der .env, z. B. REGISTRATION_OPEN
    wert           TEXT,                          -- bei Geheimnissen AES-256-GCM-verschlüsselt
    verschluesselt INTEGER NOT NULL DEFAULT 0,
    geaendert_von  INTEGER REFERENCES benutzer (id) ON DELETE SET NULL,
    geaendert_am   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE einstellungen_protokoll (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    schluessel  TEXT    NOT NULL,
    aktion      TEXT    NOT NULL,                 -- geaendert, zurueckgesetzt, entfernt
    alt         TEXT,                             -- Geheimnisse nie im Klartext
    neu         TEXT,
    benutzer_id INTEGER REFERENCES benutzer (id) ON DELETE SET NULL,
    erstellt_am TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  ALTER TABLE katalog ADD COLUMN sammlerhinweise TEXT;
  ALTER TABLE katalog ADD COLUMN seo_titel TEXT;
  ALTER TABLE katalog ADD COLUMN seo_beschreibung TEXT;
  CREATE INDEX IF NOT EXISTS idx_artikel_katalog ON artikel (katalog_id);
  `,
  // 11: E-Mail-Adresse, Bestätigungs- und Passwort-Links
  `
  ALTER TABLE benutzer ADD COLUMN email TEXT;          -- nur bestätigte Adressen
  CREATE UNIQUE INDEX idx_benutzer_email ON benutzer (email) WHERE email IS NOT NULL;
  CREATE TABLE konto_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzer_id INTEGER NOT NULL REFERENCES benutzer (id) ON DELETE CASCADE,
    zweck       TEXT    NOT NULL,                     -- email, passwort
    token_hash  TEXT    NOT NULL UNIQUE,              -- SHA-256, der Link selbst wird nie gespeichert
    email       TEXT,                                 -- neue, noch unbestätigte Adresse
    laeuft_ab   INTEGER NOT NULL,
    erstellt_am TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_konto_tokens_benutzer ON konto_tokens (benutzer_id, zweck);
  `,
  // 12: Benachrichtigungen
  `
  CREATE TABLE benachrichtigungen (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzer_id INTEGER NOT NULL REFERENCES benutzer (id) ON DELETE CASCADE,
    art         TEXT    NOT NULL,       -- freigabe, ablehnung, meldung, rolle, erfolg …
    titel       TEXT    NOT NULL,
    text        TEXT,
    link        TEXT,                   -- App-Adresse, z. B. #/katalog/5
    gelesen     INTEGER NOT NULL DEFAULT 0,
    erstellt_am TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_benachrichtigungen ON benachrichtigungen (benutzer_id, gelesen, id);
  ALTER TABLE benutzer ADD COLUMN benachrichtigung_email INTEGER NOT NULL DEFAULT 0;
  `,
  // 13: Sammlung per geheimem Link teilen (auch ohne Konto)
  `
  ALTER TABLE benutzer ADD COLUMN freigabe_token TEXT;
  ALTER TABLE benutzer ADD COLUMN freigabe_wert INTEGER NOT NULL DEFAULT 0;
  CREATE UNIQUE INDEX idx_benutzer_freigabe ON benutzer (freigabe_token) WHERE freigabe_token IS NOT NULL;
  `,
  // 14: (frei – Erfolge gehören inzwischen zum Zusatzmodul von zockerdb.de)
  'SELECT 1',
  // 15: (frei – gehört inzwischen zum Zusatzmodul von zockerdb.de)
  'SELECT 1',
  // 16: Versionsstand der Migrationen von Zusatzmodulen (jedes Modul zählt für sich)
  `
  CREATE TABLE modul_versionen (modul TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0);
  `,
  // 17: Originaltitel (z. B. englischer IGDB-Name), wenn der Katalog den echten deutschen Titel führt
  `
  ALTER TABLE katalog ADD COLUMN titel_original TEXT;
  `,
  // 18: Verbindung zu zockerdb.de – zentraler Katalog, Einreichungen, Datenspende und Sync der Sammlung
  `
  ALTER TABLE katalog ADD COLUMN zentral_id INTEGER;        -- eigener Eintrag: ID der Einreichung bei zockerdb.de
  ALTER TABLE katalog ADD COLUMN zentral_status TEXT;       -- eingereicht, freigegeben, abgelehnt
  ALTER TABLE katalog ADD COLUMN zentral_hinweis TEXT;      -- Begründung der Moderation von zockerdb.de
  ALTER TABLE katalog ADD COLUMN zentral_abgleich TEXT;     -- zuletzt mit zockerdb.de abgeglichen (Titel, Texte)
  ALTER TABLE artikel ADD COLUMN sync_uuid TEXT;            -- gleiche Kennung auf allen verbundenen Servern
  ALTER TABLE artikel ADD COLUMN sync_bild INTEGER NOT NULL DEFAULT 0;   -- eigenes Foto zu zockerdb.de übertragen
  ALTER TABLE artikel ADD COLUMN sync_bild_hash TEXT;       -- Prüfsumme des zuletzt übertragenen/geladenen Fotos
  UPDATE artikel SET sync_uuid = lower(hex(randomblob(16)));
  CREATE UNIQUE INDEX idx_artikel_sync ON artikel (benutzer_id, sync_uuid);
  CREATE INDEX idx_artikel_aktualisiert ON artikel (benutzer_id, aktualisiert_am);
  CREATE TRIGGER artikel_sync_uuid AFTER INSERT ON artikel WHEN NEW.sync_uuid IS NULL
  BEGIN UPDATE artikel SET sync_uuid = lower(hex(randomblob(16))) WHERE id = NEW.id; END;
  -- Gelöschte Artikel merken, damit der Sync die Löschung weitergeben kann (ohne Fremdschlüssel: Konten-Löschung)
  CREATE TABLE artikel_geloescht (
    benutzer_id  INTEGER NOT NULL,
    sync_uuid    TEXT    NOT NULL,
    geloescht_am TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (benutzer_id, sync_uuid)
  );
  CREATE TRIGGER artikel_geloescht_merken AFTER DELETE ON artikel WHEN OLD.benutzer_id IS NOT NULL AND OLD.sync_uuid IS NOT NULL
  BEGIN INSERT OR REPLACE INTO artikel_geloescht (benutzer_id, sync_uuid) VALUES (OLD.benutzer_id, OLD.sync_uuid); END;
  -- Selbst gehostet: Verbindung eines Benutzers mit seinem Konto auf zockerdb.de
  CREATE TABLE sync_verbindungen (
    benutzer_id   INTEGER PRIMARY KEY REFERENCES benutzer (id) ON DELETE CASCADE,
    token         TEXT    NOT NULL,          -- verschlüsselt
    konto         TEXT,                      -- Benutzername auf zockerdb.de
    stand_entfernt TEXT,                     -- bis hierhin Änderungen von zockerdb.de übernommen
    stand_lokal   TEXT,                      -- bis hierhin eigene Änderungen übertragen
    letzter_lauf  TEXT,
    fehler        TEXT,
    erstellt_am   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  -- Darf die eigene Sammlung (anonym, nur Anzahlen) in die Datenspende an zockerdb.de einfließen?
  ALTER TABLE benutzer ADD COLUMN datenspende INTEGER NOT NULL DEFAULT 1;
  `,
  // 19: Herkunft ohne Einzelpreis (Konvolut, Geschenk, „schon immer“) und Konvolute mit Gesamtpreis
  `
  CREATE TABLE konvolute (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzer_id  INTEGER NOT NULL REFERENCES benutzer (id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    preis        REAL,                       -- Gesamtpreis (leer = unbekannt)
    kaufdatum    TEXT,                       -- auch ungefähr (JJJJ oder JJJJ-MM)
    quelle       TEXT,                       -- z. B. Flohmarkt, Kleinanzeigen
    notizen      TEXT,
    aufteilung   TEXT    NOT NULL DEFAULT 'gleich',   -- gleich, wert
    erstellt_am  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_konvolute_benutzer ON konvolute (benutzer_id);
  ALTER TABLE artikel ADD COLUMN herkunft TEXT;
  ALTER TABLE artikel ADD COLUMN konvolut_id INTEGER REFERENCES konvolute (id) ON DELETE SET NULL;
  ALTER TABLE artikel ADD COLUMN kaufpreis_anteilig INTEGER NOT NULL DEFAULT 0;  -- Kaufpreis = Anteil am Konvolut
  CREATE INDEX idx_artikel_konvolut ON artikel (konvolut_id);
  `,
  // 20: Link zur Seite des Spiels auf IGDB.com (Quellenangabe „Auf IGDB.com ansehen“)
  `
  ALTER TABLE katalog ADD COLUMN igdb_url TEXT;
  `,
  // 21: Fotos zu Vorschlägen (nur für die Moderation), Plattform-Vorschläge, Einladungslinks
  `
  CREATE TABLE vorschlag_fotos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    katalog_id     INTEGER,                       -- ohne Fremdschlüssel: Aufräumen löscht auch die Datei
    benutzer_id    INTEGER,                       -- NULL = von einer anderen Installation übermittelt
    datei          TEXT    NOT NULL,
    groesse        INTEGER NOT NULL DEFAULT 0,
    zentral_gesendet INTEGER NOT NULL DEFAULT 0,  -- an zockerdb.de weitergegeben
    erstellt_am    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_vorschlag_fotos_katalog ON vorschlag_fotos (katalog_id);

  CREATE TABLE plattform_vorschlaege (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzer_id      INTEGER REFERENCES benutzer (id) ON DELETE SET NULL,
    instanz_id       INTEGER,                     -- zockerdb.de: Vorschlag einer selbst gehosteten Installation
    name             TEXT    NOT NULL,
    hersteller       TEXT,
    erscheinungsjahr INTEGER,
    typ              TEXT    NOT NULL DEFAULT 'konsole',
    hinweis          TEXT,
    status           TEXT    NOT NULL DEFAULT 'offen',  -- offen, angenommen, abgelehnt
    antwort          TEXT,
    plattform_id     INTEGER REFERENCES plattformen (id) ON DELETE SET NULL,
    zentral_id       INTEGER,                     -- selbst gehostet: Kennung des Vorschlags bei zockerdb.de
    erstellt_am      TEXT    NOT NULL DEFAULT (datetime('now')),
    entschieden_am   TEXT
  );

  CREATE TABLE einladungen (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash   TEXT    NOT NULL UNIQUE,
    notiz        TEXT,
    erstellt_von INTEGER REFERENCES benutzer (id) ON DELETE SET NULL,
    laeuft_ab    TEXT    NOT NULL,
    benutzt_am   TEXT,
    benutzer_id  INTEGER REFERENCES benutzer (id) ON DELETE SET NULL,
    erstellt_am  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  `,
  // 22: Ideen & Wünsche – Funktionen vorschlagen und abstimmen
  `
  CREATE TABLE ideen (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    benutzer_id  INTEGER REFERENCES benutzer (id) ON DELETE SET NULL,
    instanz_id   INTEGER,                        -- zockerdb.de: Idee von einer selbst gehosteten Installation
    titel        TEXT    NOT NULL,
    beschreibung TEXT,
    bereich      TEXT    NOT NULL DEFAULT 'sonstiges',
    status       TEXT    NOT NULL DEFAULT 'neu', -- neu, geplant, in_arbeit, umgesetzt, abgelehnt
    antwort      TEXT,
    zentral_id   INTEGER,                        -- selbst gehostet: Kennung der Idee bei zockerdb.de
    erstellt_am  TEXT    NOT NULL DEFAULT (datetime('now')),
    geaendert_am TEXT
  );
  CREATE INDEX idx_ideen_status ON ideen (status);
  CREATE TABLE ideen_stimmen (
    idee_id     INTEGER NOT NULL REFERENCES ideen (id) ON DELETE CASCADE,
    benutzer_id INTEGER NOT NULL REFERENCES benutzer (id) ON DELETE CASCADE,
    erstellt_am TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (idee_id, benutzer_id)
  );
  `,
];

export function oeffneDatenbank(dateipfad) {
  if (dateipfad !== ':memory:') {
    fs.mkdirSync(path.dirname(dateipfad), { recursive: true });
  }
  let db;
  try {
    db = new Database(dateipfad);
  } catch (fehler) {
    // Häufigster Fall bei Docker: eingebundener Ordner gehört root, die App läuft aber als Benutzer 1000
    if (fehler.code === 'SQLITE_CANTOPEN' || fehler.code === 'SQLITE_READONLY') {
      const ordner = path.dirname(path.resolve(dateipfad));
      console.error(`\n❌ Die Datenbank ${dateipfad} lässt sich nicht öffnen oder beschreiben.
   Der Ordner ${ordner} muss für den Benutzer beschreibbar sein, unter dem die App läuft${process.getuid ? ` (Benutzer-ID ${process.getuid()})` : ''}.
   Bei Docker mit eingebundenem Ordner auf dem Server z. B.:  chown -R 1000:1000 /pfad/zum/ordner\n`);
    }
    throw fehler;
  }
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migriere(db);
  return db;
}

function fuehreAus(db, migration) {
  if (typeof migration === 'function') migration(db);
  else db.exec(migration);
}

function migriere(db) {
  const aktuell = db.pragma('user_version', { simple: true });
  for (let i = aktuell; i < MIGRATIONEN.length; i++) {
    db.transaction(() => {
      fuehreAus(db, MIGRATIONEN[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
  // Danach die Migrationen der Zusatzmodule – jedes Modul mit eigenem Versionsstand
  for (const modul of MODULE) {
    const liste = modul.migrationen ?? [];
    const stand = db.prepare('SELECT version FROM modul_versionen WHERE modul = ?').get(modul.name)?.version ?? 0;
    for (let i = stand; i < liste.length; i++) {
      db.transaction(() => {
        fuehreAus(db, liste[i]);
        db.prepare(`INSERT INTO modul_versionen (modul, version) VALUES (?, ?)
          ON CONFLICT (modul) DO UPDATE SET version = excluded.version`).run(modul.name, i + 1);
      })();
    }
  }
}
