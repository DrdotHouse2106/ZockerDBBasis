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
Telefon: [Telefonnummer – neben der E-Mail ist ein zweiter schneller Kontaktweg Pflicht]
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

Gespeichert werden Benutzername, optional Anzeigename und E-Mail-Adresse, das Passwort nur als sicherer Hash (scrypt) sowie deine Sammlungsdaten, Fotos und Scans. Nutzt du die Zwei-Faktor-Anmeldung, wird das Geheimnis dazu verschlüsselt gespeichert, Wiederherstellungscodes nur als Hash. Zu jeder Anmeldung speichern wir eine Sitzung mit Browser- bzw. Gerätekennung und den Zeitpunkten von Anmeldung und letzter Nutzung; unter „Konto & Sicherheit“ kannst du einzelne Geräte abmelden. Die Sammlung ist privat; über einen geheimen Link kannst du sie selbst mit anderen teilen – wer den Link hat, sieht die Sammlung ohne Konto, aber ohne Kaufpreise, Notizen und Seriennummern. Die E-Mail-Adresse nutzen wir nur für „Passwort vergessen“, Sicherheitshinweise und – wenn du es einschaltest – Benachrichtigungen per E-Mail (z. B. zu Freigaben, Leihen oder Erinnerungen).

Von hochgeladenen Fotos entfernen wir Standort, Aufnahmezeit und andere Metadaten; wir merken uns nur, **ob** das Original Kameradaten (Hersteller und Modell) enthielt, als Hinweis bei der Prüfung geteilter Fotos.

Dieser Server richtet sich an Personen ab 16 Jahren; Jüngere brauchen die Zustimmung eines Erziehungsberechtigten (Art. 8 DSGVO).

Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.

**Leihliste:** Trägst du ein Exemplar als verliehen ein, speichern wir den Namen des Entleihers (Freitext) oder das gewählte Benutzerkonto, Leihdatum und geplanten Rückgabetag. Ein verknüpfter Benutzer wird benachrichtigt, bestätigt oder lehnt ab und sieht dann nur Titel, Plattform und deinen Namen – keine Preise oder Notizen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.

**Fotos freistellen (falls eingeschaltet):** Fotos von Figuren, Modulen, Discs, Konsolen und Zubehör können vom Hintergrund freigestellt werden – auf deinem eigenen Handy beim Hochladen oder zeitversetzt auf dem Handy eines anderen Benutzers dieses Servers, der sich dafür freiwillig gemeldet hat und von der Administration freigeschaltet wurde. Das Helfer-Gerät erhält nur eine auf 1.200 Pixel verkleinerte Fassung ohne Metadaten, ohne deinen Namen und ohne Angaben zum Exemplar; die App zeigt sie nicht an und schickt nur eine Maske zurück, aus der der Server die freigestellte Fassung erzeugt. Du wirst benachrichtigt und entscheidest, ob sie gezeigt oder verworfen wird. Zum Auftrag speichern wir Status, Zeitpunkte und welches Konto geholfen hat; Auftrag und freigestellte Fassung werden mit dem Foto gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO, für Helfer Art. 6 Abs. 1 lit. a DSGVO (Häkchen unter „Konto“, jederzeit abschaltbar).

**Ideen und Fehlerberichte:** Mit einer Idee oder Fehlermeldung speichern wir technische Angaben zur Herkunft (App oder Browser, Version, Gerätetyp, Betriebssystem, bei Fehlern auch die Fehlermeldung und die aufgerufene Seite) und – nur wenn du sie auswählst – betroffene Fotos ohne Metadaten. Das sieht nur die Administration; Fehlerberichte werden nach der Bearbeitung, spätestens nach 90 Tagen gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Fehlerbehebung).

Ist die Registrierung geschlossen, kannst du über „Zugang anfragen“ um eine Einladung bitten. Dafür speichern wir deine E-Mail-Adresse, optional Name und Nachricht sowie den Zeitpunkt. Die Administration sieht die Anfrage und schickt dir gegebenenfalls einen Einladungslink. Die Angaben werden spätestens nach 90 Tagen gelöscht, auf Wunsch sofort. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Anbahnung der Nutzung, auf deine Anfrage).

## 4. Cookies und lokale Speicherung

Nur ein technisch notwendiges Sitzungs-Cookie für die Anmeldung. Die App speichert zuletzt geladene Daten auf deinem Gerät, damit sie offline funktioniert (§ 25 Abs. 2 Nr. 2 TDDDG).

## 5. Externe Dienste

- **Spieldaten und Coverbilder (IGDB):** Suchen stellt der Server; Coverbilder lädt dein Browser von images.igdb.com (Twitch Interactive, Inc., USA). Dabei wird deine IP-Adresse übertragen.
- **Barcode-Datenbanken:** Der Server fragt Produktnamen zu Barcodes ab, ohne Daten über dich zu übermitteln.
- **Zentraler Katalog (zockerdb.de):** Suchbegriffe und Barcodes schickt der Server – nicht dein Browser – an zockerdb.de, um Spieldaten zu finden. Dabei werden keine Daten über dich übertragen. Reichst du Vorschläge für den gemeinsamen Katalog ein (neue Einträge, Plattformen, Figurenserien, Lieferumfang – auf Wunsch mit Belegfotos), leitet der Server sie an zockerdb.de weiter: ohne deinen Benutzernamen, nur mit der Kennung dieses Servers; Belegfotos werden dort nach der Entscheidung gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung durch das Einreichen). [Falls die anonyme Datenspende eingeschaltet ist:] Wöchentlich meldet der Server nur, wie viele Sammler hier einen Titel besitzen – ohne Namen, Preise oder Notizen; du kannst dich im Konto ausnehmen.
- **Sync mit zockerdb.de (nur wenn du ihn selbst einrichtest):** Deine Sammlung wird mit deinem Konto auf zockerdb.de abgeglichen. Dafür gelten zusätzlich die Datenschutzhinweise von zockerdb.de.
- **Kamera (Barcode-Scanner):** Das Bild wird nur lokal im Browser ausgewertet.
- **Steam-Bibliothek importieren (nur wenn du es selbst startest):** Auf deinen Wunsch importieren wir deine Steam-Bibliothek über die offizielle Steam Web API. Dazu gibst du deine Steam-ID oder deinen Profilnamen an; ein Steam-Passwort fragen wir nie ab. Abgerufen werden nur deine Spiele und die Spielzeit – bei öffentlichem Profil mit unserem Zugang zur Steam Web API. Gibst du zusätzlich deinen eigenen Steam-API-Schlüssel an, liefert Steam diese Angaben auch bei privatem Profil; den Schlüssel senden wir nur für diesen einen Abruf an Steam und speichern ihn nicht. Wir speichern deine Steam-ID, den Zeitpunkt des letzten Imports und die importierten Spiele samt Spielzeit als digitale Exemplare in deiner Sammlung. Die Daten liegen auf diesem Server in [Land, z. B. Deutschland]. Du kannst die Verknüpfung jederzeit unter „Steam-Import“ entfernen; mit deinem Konto werden die Daten gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (von dir gewünschte Funktion).

## 6. Speicherdauer und deine Rechte

Daten bleiben gespeichert, bis du dein Konto löschst (jederzeit unter „Konto & Sicherheit“). Fotos, die du beim Löschen deines Kontos der Community überlässt, bleiben ohne Bezug zu deinem Konto gespeichert; Metadaten wurden bereits beim Hochladen entfernt. Der Server legt automatisch Sicherungen der Datenbank im Datenordner an (tägliche Stände für [7] Tage, monatliche für [12] Monate); gelöschte Daten können darin entsprechend lange enthalten sein. [Falls eine externe Sicherung eingerichtet ist: Anbieter, Verschlüsselung und Aufbewahrung ergänzen.] Du hast das Recht auf Auskunft (auch selbst unter „Konto → Datenauskunft“), Berichtigung, Löschung, Einschränkung und Datenübertragbarkeit (JSON-Export) sowie auf Beschwerde bei einer Aufsichtsbehörde.

**Widerspruchsrecht (Art. 21 DSGVO): Du kannst aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit gegen Verarbeitungen widersprechen, die wir auf ein berechtigtes Interesse stützen (z. B. Fehlerberichte, Schutz vor Missbrauch).** Ein formloser Widerspruch an [kontakt@example.de] genügt.

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

Dieser Server richtet sich an Personen ab 16 Jahren; Jüngere brauchen die Zustimmung eines Erziehungsberechtigten. Du bist für die Geheimhaltung deiner Zugangsdaten und für die Inhalte verantwortlich, die du einstellst (Einträge, Fotos, Scans). Entfernen wir Inhalte oder sperren wir ein Konto, teilen wir den Grund mit. Cover, Artwork und Handbücher sind in der Regel urheberrechtlich geschützt – lade nur hoch, was du nutzen darfst.

Vorschläge für den gemeinsamen Katalog (Einträge, Plattformen, Figurenserien, Lieferumfang) können an zockerdb.de weitergeleitet werden; dort gelten für sie die Nutzungsbedingungen von zockerdb.de.

Löschst du dein Konto, kannst du freigegebene Fotos der Community überlassen. Du räumst uns dann das einfache, unentgeltliche und zeitlich unbeschränkte Recht ein, sie im bisherigen Umfang weiter zu zeigen – ohne deinen Namen. Ohne diese Wahl werden deine Fotos mit dem Konto gelöscht.

**Fotos freistellen (falls eingeschaltet):** Von deinen Fotos kann eine freigestellte Fassung erzeugt werden – auf deinem Gerät oder auf dem Gerät eines Helfers. Du entscheidest, ob sie gezeigt wird. Helfen ist freiwillig und unentgeltlich; Helfer erhalten nur eine verkleinerte Fassung ohne Namen und dürfen Fotos anderer nicht ansehen, speichern oder weitergeben. Ein Anspruch auf Freistellung besteht nicht; das Ergebnis ist automatisch erzeugt und kann Fehler enthalten.

## 3. Angaben ohne Gewähr

Wert- und Preisangaben sind unverbindliche Schätzungen.

Daten aus der Steam Web API (z. B. importierte Bibliotheken, Spielzeiten) stellen wir ohne Gewähr für Richtigkeit, Vollständigkeit oder Verfügbarkeit bereit. Diese Anwendung steht in keiner Verbindung zu Valve oder Steam und wird von ihnen nicht unterstützt. Steam und das Steam-Logo sind Marken der Valve Corporation.

## 4. Kündigung und Haftung

Du kannst dein Konto jederzeit selbst löschen. Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei schuldhafter Verletzung von Leben, Körper oder Gesundheit sowie nach dem Produkthaftungsgesetz. Bei leichter Fahrlässigkeit haften wir nur bei Verletzung wesentlicher Vertragspflichten (Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung du regelmäßig vertrauen darfst), begrenzt auf den vertragstypischen, vorhersehbaren Schaden.

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
