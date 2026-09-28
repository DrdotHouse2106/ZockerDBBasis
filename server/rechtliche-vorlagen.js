// Vorlagen für die rechtlichen Seiten einer eigenen Installation. Sie werden beim ersten Start in die Datenbank
// übernommen und können danach von Administratoren in der App bearbeitet werden (Administration → Rechtliches).
// Für eine rein private Nutzung (Familie, Freunde) sind sie meist nicht nötig. Die Texte sind Vorlagen und
// KEINE Rechtsberatung – bitte vor einer Veröffentlichung prüfen (lassen) und alle Angaben in [ECKIGEN KLAMMERN] ersetzen.
// Zusatzmodule können eigene, ausführlichere Vorlagen mitbringen (rechtlicheVorlagen).

export const RECHTLICHE_VORLAGEN = [
  {
    slug: 'impressum',
    titel: 'Impressum',
    inhalt: `# Impressum

**Hinweis für Betreiber:** Nur nötig, wenn dein Server öffentlich (geschäftsmäßig) angeboten wird. Bitte alle Angaben in eckigen Klammern ersetzen.

## Angaben gemäß § 5 DDG

[Vorname Nachname]
[Straße Hausnummer]
[PLZ Ort]

## Kontakt

E-Mail: [kontakt@example.de]
`,
  },
  {
    slug: 'datenschutz',
    titel: 'Datenschutzerklärung',
    inhalt: `# Datenschutzerklärung

**Hinweis für Betreiber:** Vorlage für eine eigene Installation. Bitte an deine Umgebung (Hosting, Reverse-Proxy) anpassen.

## 1. Verantwortlicher

[Vorname Nachname], [Anschrift], E-Mail: [kontakt@example.de]

## 2. Überblick

Diese Anwendung dient der Verwaltung von Videospiel-, Konsolen- und Zubehörsammlungen. Es gibt **kein Tracking, keine Analyse-Tools und keine Werbe-Cookies**.

## 3. Benutzerkonto und Sammlung

Gespeichert werden Benutzername, optional Anzeigename und E-Mail-Adresse, das Passwort nur als sicherer Hash (scrypt) sowie deine Sammlungsdaten, Fotos und Scans. Die Sammlung ist privat; über einen geheimen Link kannst du sie selbst mit anderen teilen. Die E-Mail-Adresse nutzen wir nur für „Passwort vergessen“, Sicherheitshinweise und – wenn du es einschaltest – Benachrichtigungen.

Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.

## 4. Cookies und lokale Speicherung

Nur ein technisch notwendiges Sitzungs-Cookie für die Anmeldung. Die App speichert zuletzt geladene Daten auf deinem Gerät, damit sie offline funktioniert (§ 25 Abs. 2 Nr. 2 TDDDG).

## 5. Externe Dienste

- **Spieldaten und Coverbilder (IGDB):** Suchen stellt der Server; Coverbilder lädt dein Browser von images.igdb.com (Twitch Interactive, Inc., USA). Dabei wird deine IP-Adresse übertragen.
- **Barcode-Datenbanken:** Der Server fragt Produktnamen zu Barcodes ab, ohne Daten über dich zu übermitteln.
- **Zentraler Katalog (zockerdb.de):** Suchbegriffe und Barcodes schickt der Server – nicht dein Browser – an zockerdb.de, um Spieldaten zu finden. Dabei werden keine Daten über dich übertragen. [Falls die anonyme Datenspende eingeschaltet ist:] Wöchentlich meldet der Server nur, wie viele Sammler hier einen Titel besitzen – ohne Namen, Preise oder Notizen; du kannst dich im Konto ausnehmen.
- **Sync mit zockerdb.de (nur wenn du ihn selbst einrichtest):** Deine Sammlung wird mit deinem Konto auf zockerdb.de abgeglichen. Dafür gelten zusätzlich die Datenschutzhinweise von zockerdb.de.
- **Kamera (Barcode-Scanner):** Das Bild wird nur lokal im Browser ausgewertet.

## 6. Speicherdauer und deine Rechte

Daten bleiben gespeichert, bis du dein Konto löschst (jederzeit unter „Konto & Sicherheit“). Du hast das Recht auf Auskunft (auch selbst unter „Konto → Datenauskunft“), Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit (JSON-Export) und Widerspruch sowie auf Beschwerde bei einer Aufsichtsbehörde.

Stand: [Datum]
`,
  },
  {
    slug: 'nutzungsbedingungen',
    titel: 'Nutzungsbedingungen',
    inhalt: `# Nutzungsbedingungen

**Hinweis für Betreiber:** Vorlage für eine eigene Installation.

## 1. Leistung

Dieser Server ermöglicht die Verwaltung einer Videospielsammlung. Es besteht kein Anspruch auf ständige Verfügbarkeit.

## 2. Benutzerkonto und Inhalte

Du bist für die Geheimhaltung deiner Zugangsdaten und für die Inhalte verantwortlich, die du einstellst (Einträge, Fotos, Scans). Cover, Artwork und Handbücher sind in der Regel urheberrechtlich geschützt – lade nur hoch, was du nutzen darfst.

## 3. Angaben ohne Gewähr

Wert- und Preisangaben sind unverbindliche Schätzungen.

## 4. Kündigung und Haftung

Du kannst dein Konto jederzeit selbst löschen. Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, im Übrigen nur bei Verletzung wesentlicher Pflichten.

Stand: [Datum]
`,
  },
  {
    slug: 'sicherheit',
    titel: 'Sicherheit',
    inhalt: `# Sicherheit

Passwörter werden nur als sicherer Hash gespeichert, die Zwei-Faktor-Anmeldung wird unterstützt, und jede Sammlung ist standardmäßig privat.

## Sicherheitslücke gefunden?

Bitte vertraulich melden:

- **Für die Software ZockerDB:** per E-Mail an [security@zockerdb.de](mailto:security@zockerdb.de)
- **Für diesen Server:** [E-Mail-Adresse des Betreibers]

Bitte greife bei der Suche nicht auf fremde Daten zu und beeinträchtige den Betrieb nicht.
`,
  },
];
