# 🎮 ZockDB Basis

**Deine Spielesammlung selbst gehostet – mobil, auf Deutsch, auf deinem eigenen Server.**

<p><img src="client/public/icons/icon.svg" alt="ZockDB-Logo" width="96"></p>

ZockDB Basis ist die frei verfügbare Grundversion von [zockdb.de](https://zockdb.de): eine Progressive Web App (PWA) zur
Verwaltung von **Spielen, Konsolen und Zubehör** – für dich allein oder zusammen mit Familie und Freunden. Gemacht für
Sammler im deutschsprachigen Raum: PAL-/USK-Regionen, CIB-Status, Sonderfarben, Editionen und Modellrevisionen lassen
sich sauber erfassen – per Titelsuche, **Barcode-Scan mit der Handykamera** oder als eigener Eintrag.

> 🌐 **Kein eigener Server? Nutze [zockdb.de](https://zockdb.de)** – sofort startklar, mit Erfolgen, Tauschbörse,
> Marktpreisen und Community. Wer dort mitmacht oder Zusatzleistungen bucht, **unterstützt die Weiterentwicklung von ZockDB**. Danke! 💜

> 🇬🇧 An English version is available in [README.en.md](README.en.md).

> 🔒 **Sicherheitslücke gefunden?** Bitte vertraulich per E-Mail an [security@zockdb.de](mailto:security@zockdb.de) –
> Details in der [SECURITY.md](SECURITY.md).

<p align="center">
  <img src="docs/bilder/sammlung-mobil.png" alt="Sammlungsansicht auf dem Smartphone" width="200" />
  &nbsp;
  <img src="docs/bilder/scans-mobil.png" alt="Scans und Dokumente zu einem Spiel" width="200" />
  &nbsp;
  <img src="docs/bilder/druck-mobil.png" alt="Cover-Scan in Originalgröße drucken" width="200" />
</p>

## Funktionen

- **Sammlung** mit Spielen, Konsolen und Zubehör – Zustand, Vollständigkeit (CIB, lose …), Region, Farbe, Edition,
  Modellnummer, Seriennummer, Kaufpreis, eigene Schätzung, Notizen und eigene Fotos
- **Barcode-Scanner im Browser** (EAN/UPC) über die Kamera – ganz ohne App-Store; einmal zugeordnete Barcodes werden gelernt
- **Online-Suche über IGDB** (Twitch-API) für Spiele und Konsolen mit Cover, Jahr und Publisher, zwischengespeichert
- **Plattformen als feste Kategorien** (PS5, Switch, N64 …) nach Hersteller gruppiert, **Varianten/Revisionen** als Sammel-Checkliste,
  mehrere Exemplare je Spiel
- **Scans & Handbücher** je Spiel (auch hochauflösende TIFF-Scans und PDFs) und **Cover-Druck in Originalgröße**
- **Private Kommentare**, **Statistik**, **Filter & Suche**
- **Mehrere Benutzer** mit eigenem, getrenntem Konto – Rollen *Nutzer*, *Moderator*, *Administrator*
- **Zwei-Faktor-Anmeldung** (TOTP) mit Wiederherstellungscodes, sichere Passwortspeicherung (scrypt)
- **Sammlung per Link teilen** – auch mit Menschen ohne Konto, Preise und Notizen bleiben privat
- **E-Mail** für „Passwort vergessen“, Bestätigung der Adresse und Benachrichtigungen (optional, per SMTP)
- **Export/Import:** JSON (vollständige Sicherung), CSV im deutschen Excel-Format, **Import aus CLZ Games/Excel**
- **Automatische Datensicherung** (7 Tage täglich, 12 Monate monatlich)
- **Einstellungen über die Weboberfläche** – ohne Neustart, API-Schlüssel verschlüsselt gespeichert
- **PWA:** installierbar auf Android, iOS und Desktop, zuletzt geladene Daten auch offline; hell & dunkel
- **Komplett auf Deutsch**

**Technik:** Node.js 22 · Express 5 · SQLite (better-sqlite3) · sharp · React 19 · Vite · Tailwind CSS 4

## Schnellstart mit Docker

Voraussetzung: [Docker](https://docs.docker.com/get-docker/) mit Docker Compose – oder Portainer, Dockge, Synology/QNAP.

1. [`docker-compose.yml`](docker-compose.yml) speichern bzw. in Portainer/Dockge als neuen **Stack** einfügen.
2. Die Einträge unter `environment:` anpassen (alle sind kommentiert; leere Werte `""` = Standard).
3. Starten:

```bash
docker compose up -d
```

Die App läuft unter **<http://localhost:3000>**. **Das erste Konto, das du registrierst, wird Administrator.**
Danach kannst du die Registrierung unter *Mehr → Administration → Einstellungen* schließen.

```bash
docker compose logs -f                        # Protokoll ansehen
docker compose pull && docker compose up -d   # Auf die neueste Version aktualisieren
```

Alle Daten (SQLite-Datenbank, Fotos, Scans und `geheimnis.key`) liegen im Docker-Volume `sammlung-daten` und bleiben
bei Updates erhalten. Setze `APP_SECRET` einmalig (`openssl rand -base64 32`) und ändere es danach **nie** wieder –
oder sichere `geheimnis.key` aus dem Volume; ohne diesen Schlüssel lassen sich 2FA-Geheimnisse nicht mehr entschlüsseln.

## Konfiguration

Mit Docker als Einträge unter `environment:`, ohne Docker in der Datei `.env` (Vorlage: [`.env.example`](.env.example)).
Viele Werte lassen sich zusätzlich unter *Administration → Einstellungen* ändern.

| Variable | Standard | Beschreibung |
| --- | --- | --- |
| `PORT` | `3000` | Port des Servers |
| `APP_SECRET` | automatisch | Schlüssel für 2FA-Geheimnisse und gespeicherte API-Schlüssel |
| `REGISTRATION_OPEN` | `true` | Dürfen sich neue Benutzer selbst registrieren? |
| `REQUIRE_2FA` | `false` | Zwei-Faktor-Anmeldung für alle Pflicht |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | – | Zugang für die Online-Suche über IGDB (siehe unten) |
| `BARCODE_PROVIDERS` | `opengtindb,upcitemdb` | Barcode-Datenbanken in Abfragereihenfolge; leer = nur gelernte Barcodes |
| `OPENGTINDB_QUERYID` | – | Zugangsnummer für [opengtindb.org](https://opengtindb.org) |
| `STORAGE_QUOTA_MB` | `1024` | Speicher je Benutzer für Fotos und Scans (`0` = unbegrenzt) |
| `MAX_UPLOAD_MB` / `MEDIA_MAX_MB` | `8` / `200` | Maximale Größe von Fotos bzw. Scans/PDFs |
| `BACKUP_ENABLED` / `BACKUP_DAYS` / `BACKUP_MONTHS` | `true` / `7` / `12` | Automatische Datenbank-Sicherung |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | – / `587` | E-Mail-Versand |
| `PUBLIC_URL` | – | Adresse, unter der die App erreichbar ist (nötig für Links in E-Mails) |
| `CAPTCHA_PROVIDER` | `altcha` | Spam-Schutz bei der Registrierung: `altcha`, `recaptcha` oder `aus` |
| `TRUST_PROXY` | – | Hinter einem Reverse-Proxy `1` setzen |
| `SESSION_DAYS` / `COOKIE_SECURE` | `30` / `auto` | Gültigkeit der Anmeldung, Cookie nur über HTTPS |

## IGDB-Zugang einrichten

[IGDB](https://www.igdb.com) ist eine kostenlose Spieldatenbank von Twitch.

1. Unter <https://dev.twitch.tv/console> anmelden (Zwei-Faktor-Anmeldung muss aktiv sein).
2. *Anwendungen → Deine Anwendung registrieren*: Name frei wählbar, OAuth-Redirect `http://localhost`,
   Kategorie *Application Integration*, Client-Typ *Vertraulich*.
3. **Client-ID** kopieren, **neues Geheimnis** erzeugen und beide Werte eintragen.

Ohne IGDB funktioniert die App vollständig – du legst Artikel dann als eigene Einträge an.

## Barcode-Scanner, HTTPS und Reverse-Proxy

Browser geben die Kamera nur über **HTTPS** (oder `localhost`) frei. Empfohlen ist ein Reverse-Proxy mit automatischen
Zertifikaten, z. B. [Caddy](https://caddyserver.com):

```caddyfile
sammlung.example.de {
    reverse_proxy zockdb:3000
}
```

Dazu `TRUST_PROXY: "1"` setzen und den Port nur lokal freigeben (`"127.0.0.1:3000:3000"`). Für den Zugriff nur im
Heimnetz eignen sich auch [Tailscale](https://tailscale.com) oder der Proxy deines NAS.

## Datensicherung

- **Je Benutzer:** *Mehr → Datensicherung → JSON-Export* (jederzeit wieder importierbar).
- **Automatisch:** täglich eine Sicherung der Datenbank im Datenordner (`sicherungen/`), einsehbar unter
  *Administration → Sicherungen*. Zum Wiederherstellen den Container stoppen, die Datei als `sammlung.db` in den
  Datenordner kopieren (`sammlung.db-wal` und `-shm` vorher löschen) und neu starten.
- **Komplett:** Sichere das gesamte Datenverzeichnis `/app/data` (inklusive `geheimnis.key`) – z. B. per
  Proxmox-/NAS-Backup – und bewahre eine Kopie außer Haus auf.

## Installation ohne Docker

Voraussetzung: **Node.js 22** oder neuer.

```bash
git clone https://github.com/DrdotHouse2106/ZockDBBasis.git
cd ZockDBBasis
npm ci
cp .env.example .env
npm run build     # Oberfläche bauen
npm start         # → http://localhost:3000
```

Entwicklung mit Hot-Reload: `npm run dev` (Oberfläche unter <http://localhost:5173>). Tests: `npm test`,
Browser-Tests: `npm run test:e2e`.

## Mitwirken

Beiträge sind willkommen – siehe [CONTRIBUTING.md](CONTRIBUTING.md). Dieses Repository wird automatisch aus der
Entwicklung von zockdb.de aktualisiert; Pull Requests werden dort übernommen und erscheinen danach hier.

## Lizenz

**[PolyForm Noncommercial License 1.0.0](LICENSE)** ([deutsche Zusammenfassung](LIZENZ.md)): private, Hobby- und
gemeinnützige Nutzung ist erlaubt – inklusive Selbsthosting für dich, Familie, Freunde oder deinen Verein.
Kommerzielle Nutzung nur mit gesonderter Erlaubnis. Spieldaten und Coverbilder stammen von [IGDB.com](https://www.igdb.com).
