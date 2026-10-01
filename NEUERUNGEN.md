# Neuerungen

Was sich in ZockerDB geändert hat – die neuesten Einträge stehen oben. Die Administration zeigt beim Update-Hinweis
automatisch, welche dieser Einträge der neue Stand gegenüber deinem installierten mitbringt.

<!--
Pflege: Jede für Nutzer oder Admins sichtbare Änderung bekommt hier einen Eintrag.
Format: „## TT.MM.JJJJ – Titel“ (die Überschrift ist die Kennung, nachträglich nicht mehr ändern), darunter Stichpunkte „- …“.
Kurz, verständlich, ohne Technik-Jargon. Funktionen, die es nur auf zockerdb.de gibt, gehören in die Hinweise des Moduls.
-->

## 01.10.2026 – E-Mails im dunklen Modus
- Das Logo erscheint klein neben dem Namen statt riesig (verkleinert mitgeschickt, feste Größe auch für Outlook)
- Eigene Farben für den dunklen Modus: Der Knopf bleibt weiß beschriftet und gut lesbar, Mailprogramme färben nicht mehr selbst um
- Der Ersatzlink unter dem Knopf ist anklickbar

## 01.10.2026 – Logo in E-Mails
- E-Mails (Einladung, Passwort vergessen, Bestätigung, Benachrichtigungen) zeigen oben das ZockerDB-Logo – direkt in der Mail eingebettet, damit es auch erscheint, wenn das Mailprogramm externe Bilder blockiert

## 01.10.2026 – Einladungen: gelöschte Konten verschwinden aus der Liste
- Wurde das Konto einer eingeladenen Person gelöscht, steht die Einladung nicht mehr als „angenommen von @–“ in der Liste
- Auch angenommene Einladungen lassen sich jetzt aus der Liste entfernen
- Die Felder zum Einladen stehen auf dem Handy untereinander statt gequetscht nebeneinander

## 01.10.2026 – Touren und Fußleiste auf dem iPhone
- Tour „Erste Schritte“: Der Spielstatus lässt sich beim entsprechenden Schritt jetzt wirklich ausprobieren
- Die Markierung der Tour wackelt und verrutscht nicht mehr: Während eines Schritts bleibt die Seite stehen, die Abdunkelung reicht immer bis an den Bildschirmrand
- Sehr hohe Bereiche (z. B. die Liste unter „Mehr“) werden nur oben markiert, die Erklärung steht darunter statt mitten im Bild
- Reiter in wischbaren Leisten (z. B. „Sicherungen“ in der Administration) werden für die Tour ins Bild gescrollt, statt außerhalb markiert zu werden
- Fußleiste rutschte auf dem iPhone in die Bildmitte, wenn beim Seitenwechsel noch die Tastatur offen war (z. B. nach der Suche unter „Hinzufügen“) – behoben; in der Tour öffnet „Hinzufügen“ die Tastatur nicht mehr von selbst

## 30.09.2026 – Fotos: Varianten und Nachfrage nach dem Hinzufügen
- Fotos lassen sich einer Variante zuordnen (z. B. PAL oder NTSC, Platinum) – beim Hochladen ist die Variante deines Exemplars vorausgewählt, Fotos zeigen sie an
- Hat dein Exemplar eine Variante, zählt die Checkliste nur Fotos genau dieser Variante – so sieht man, dass z. B. das NTSC-Modul noch fehlt
- Nach dem Hinzufügen eines Spiels fragt die App einmal, ob du ein fehlendes Foto gleich machen möchtest (nur wenn Fotos geteilt werden können, je Spiel nur einmal, mit „Nicht mehr fragen“)

## 30.09.2026 – Fotos: So sieht es aus (Modul, Disc, Verpackung)
- Neuer Bereich „Fotos“ auf der Seite eines Spiels oder Geräts und beim eigenen Exemplar: Fotos von Modul, Disc oder Diskette, Verpackung vorne und hinten, alles zusammen (komplett) sowie bei Geräten Gerät und Details wie Typenschild – ergänzend zum Cover
- Eine Checkliste zeigt, welche Fotos es schon gibt (✓), welche gerade geprüft werden (⏳) und welche noch fehlen (＋) – ein Tipp auf „＋“ öffnet das Hochladen mit der passenden Fotoart; welcher Datenträger gesucht wird, richtet sich nach der Plattform (N64: Modul, PlayStation: Disc, Amiga: Diskette)
- Hochladen direkt mit der Handykamera oder aus der Galerie, mit Vorschau und Tipps für gute Fotos; Standort und Kameradaten werden entfernt
- Fotos lassen sich getrennt von Scans mit anderen teilen (neue Einstellung `PHOTO_SHARING`, in der Basis-Version standardmäßig aus) – ein Foto des eigenen Moduls ist keine Kopie eines geschützten Covers
- Wer die öffentliche Anzeige erlaubt, kann das beim Foto jederzeit wieder zurücknehmen; die Einwilligung wird mit Zeitpunkt gespeichert und ist in der Datenauskunft enthalten
- „Scans & Dokumente“ enthält nur noch Scans (Cover, Anleitung, Label); PDF-Dateien können keine Fotos sein. Wird ein geteiltes Foto nachträglich zum Scan erklärt und ist das Teilen von Scans aus, wird es privat
- Die Tour „Erste Schritte“ zeigt den neuen Fotobereich am Beispielspiel

## 30.09.2026 – Sicherheitsprüfung: Fotos ohne GPS, Schutz der Ersteinrichtung, bessere Anmelde-Drosselung
- Fotos und Scans werden ohne Metadaten gespeichert – Handyfotos enthalten sonst oft die GPS-Position (z. B. der eigenen Wohnung), die andere bei öffentlichen Sammlungen oder freigegebenen Scans sehen könnten. JPEG-Scans bleiben dabei verlustfrei; bereits hochgeladene Fotos und Scans werden nach dem Update einmalig im Hintergrund bereinigt
- Ersteinrichtung über das Internet oder einen Reverse-Proxy: Für das erste Konto (Administrator) braucht es einen Einrichtungscode aus dem Server-Protokoll – so kann niemand eine frisch gestartete Installation übernehmen
- Anmeldung: Fehlversuche werden jetzt auch je öffentlicher IP-Adresse (viele Benutzernamen durchprobieren) und je Konto über alle IP-Adressen gedrosselt; ebenso das bisherige Passwort beim Passwortwechsel
- Schutz vor Anfragen ins interne Netz erkennt jetzt auch seltene IPv6-Schreibweisen (NAT64, 6to4, IPv4-kompatibel, Site-Local)
- JSON-Import: eigene Katalogeinträge werden wie beim Anlegen geprüft (Typ, Längen, nur http(s)-Bildadressen)

## 30.09.2026 – Geführte Touren
- Neu hier? Auf der Sammlungsseite startest du die Tour „Erste Schritte“: Die App zeigt dir mit Markierung und Pfeil, wo was ist – Suchen, Filtern, Hinzufügen, Barcode scannen, Einträge pflegen, Katalog, Kalender und „Mehr“
- Wo du selbst tippen sollst, zeigt ein Finger auf die Stelle
- Die Tour legt ein Beispielspiel an, damit du alles ausprobieren kannst – am Ende wird es wieder gelöscht (oder du behältst es)
- Für Administratoren gibt es eine Tour durch die Administration
- Alle Touren findest du unter „Mehr → Hilfe & Touren“; erledigte oder abgelehnte Touren werden nicht erneut angeboten – auch nicht auf anderen Geräten
- Die Datenauskunft enthält jetzt auch deine Einstellungen zu Zusatzfeldern, „Meine Systeme“ und Touren

## 30.09.2026 – Releasekalender: Highlights statt Unbekanntem
- „Erscheint demnächst“ zeigt jetzt kuratiert die gefragtesten Titel – nach Vorfreude bei IGDB und Wunschlisten der Sammler auf zockerdb.de (Sammler aus Deutschland zählen doppelt, Bundles und Zusatzinhalte nur halb)
- Im Kalender wählst du zwischen „Highlights“ (Standard) und „Alle Titel“; Spiele auf deiner Wunschliste sind immer dabei
- Die Vorschau auf der Sammlungsseite zeigt die 20 gefragtesten Titel der nächsten 60 Tage, weiter nach Datum sortiert

## 30.09.2026 – Hinweis: Barcodes lernt ZockerDB von der Community
- Bei einem noch unbekannten Barcode erklärt ein Hinweis, dass Spieldatenbanken keine Barcodes führen und die Zuordnung durch die Auswahl der Sammler entsteht – danach erkennen alle das Spiel sofort
- Auch unter „Nicht gefunden?“ ein kurzer Hinweis, dass der Katalog von der Mithilfe der Community lebt

## 30.09.2026 – Hauptspiele vor Bundles und Zusatzinhalten
- Der Katalog kennt jetzt den Spieltyp aus IGDB (Hauptspiel, Bundle, DLC, Remaster …) – bei zockerdb.de für alle Einträge aus dem Datenabzug nach dem Update automatisch nachgetragen, selbst gehostete Installationen erhalten ihn über zockerdb.de
- Beim Barcode-Scan und in der Katalogsuche stehen Bundles, Pakete und Zusatzinhalte hinter dem Hauptspiel mit gleich gut passendem Titel; ein genau passendes Bundle (z. B. „Ezio Trilogy“) bleibt aber oben

## 30.09.2026 – Bessere Reihenfolge der Barcode-Treffer
- Beim ersten Scan eines unbekannten Barcodes steht jetzt der Titel oben, der am besten zum Produktnamen passt – das Hauptspiel vor Editionen und Zusatzinhalten, die passende Plattform zuerst
- Ab dem zweiten Scan eines Barcodes wird direkt über den gemerkten Barcode gefunden

## 30.09.2026 – Barcode legt die Plattform fest
- Ein Barcode gehört zu genau einer Version eines Spiels – die App merkt sich jetzt beim Eintragen auch die Plattform (bereits erfasste Exemplare mit Barcode wurden nachgetragen)
- Beim nächsten Scan desselben Barcodes (auch durch andere Sammler) steht die Plattform fest: „Plattform: PlayStation 3 (aus dem Barcode)“; im Formular ist nur sie vorausgewählt, Ausnahmen über „Andere Plattform …“

## 30.09.2026 – Aufgeräumte Detailseite eines Exemplars
- Oben nur Cover, Titel und Plattform; Spielstatus als eine Auswahl statt fünf Knöpfen
- Seltener gebrauchte Aktionen (weiteres Exemplar, Katalogseite, verleihen, verkauft, eigenes Foto, bearbeiten, löschen) im Menü „Weitere Aktionen“
- Kommentare, Cover & Handbücher und Scans sind zusammen eingeklappt und öffnen sich mit einem Tipp

## 30.09.2026 – Releasekalender ohne Doppelungen
- Erscheint ein Spiel am selben Tag für mehrere Plattformen, gibt es nur noch eine Kachel mit allen Plattformen („PS5 · PC · XSX“) – in der Vorschau über der Sammlung und im Kalender

## 30.09.2026 – Plattformwahl beim Hinzufügen
- Wählst du ein Spiel aus dem Katalog, stehen nur noch die Plattformen zur Wahl, für die es erschienen ist (z. B. PS3, Xbox 360 …) – gibt es nur eine, ist sie gleich gesetzt; „Andere Plattform …“ öffnet bei Bedarf die volle Liste
- Nach einem Barcode-Scan wird die Plattform aus dem Produktnamen (z. B. „Ps3“) vorausgewählt

## 30.09.2026 – Barcode-Scan erkennt Händlertitel besser
- Liefert die Barcode-Datenbank einen Händlertitel wie „Assassin's Creed 4: Black Flag - Bonus Edition - Ps3 Boxed + Instructions B1393“, werden Zusätze (Verpackung, Anleitung, Artikelnummern, Editionen) schrittweise entfernt und auch „4“ ↔ „IV“ probiert, bis das Spiel gefunden ist
- Steht im Produktnamen eine Plattform (z. B. PS3), erscheinen passende Einträge zuerst

## 30.09.2026 – Zusätzliche Felder: Lagerort, Zustand & Wartung, Beilagen
- Unter *Konto → Zusätzliche Felder* einschaltbar, standardmäßig aus – das Eintragen bleibt so einfach wie bisher
- Lagerort in drei Stufen (Ort → Regal/Schrank → Fach/Kiste) mit Vorschlägen aus bereits verwendeten Orten; Übersicht mit Anzahl je Ort unter *Mehr → Lagerorte*, dort auch mehrere Exemplare auf einmal zuordnen; Suche und Filter nach Lagerort
- Zustand & Wartung: Verlauf je Exemplar (Batterie, Recap, Laufwerk/Laser, Entgilbung, Reinigung, Mods, Reparatur); angeboten wird nur, was zum Gerät passt (z. B. kein Laufwerk beim Modul)
- Hinweis zum Batteriealter bei Modulen und Konsolen mit Speicherbatterie („Originalbatterie vermutlich rund 30 Jahre alt – Spielstände sichern“)
- Welche Merkmale ein Titel hat (Speicherbatterie, Laufwerk, Elkos, vergilbender Kunststoff), gibt es als Standard je Plattform; Korrekturen können alle vorschlagen, das Moderationsteam übernimmt sie
- Beilagen-Checkliste (Anleitung, Poster, Netzteil, Controller …) und Seriennummer der OVP mit Anzeige „passt“/„passt nicht“
- Lagerort, Beilagen und Wartungsverlauf sind in Export, Import und Datenauskunft enthalten; Lagerort und Beilagen auch im Sync

## 30.09.2026 – Offlinemodus
- Die App startet auch ohne Verbindung und zeigt die zuletzt geladene Sammlung, Exemplare, Katalogseiten und Cover
- Neue Einträge, Änderungen (auch Spielstatus) und Löschungen ohne Verbindung werden gespeichert und automatisch übertragen, sobald du wieder online bist – mit Zähler „3 Änderungen warten“
- Barcode offline scannen: „Barcode offline merken“ legt den Eintrag später an, Titel und Details ergänzt du danach
- Wurde ein Eintrag inzwischen an anderer Stelle geändert oder gelöscht, entscheidest du: meine Änderung speichern oder den Server-Stand behalten
- Suche und Filter funktionieren offline in den zuletzt geladenen Daten (deutlich gekennzeichnet); beim Abmelden werden gespeicherte Daten und die Warteschlange gelöscht

## 30.09.2026 – Leihliste
- Am Exemplar „Verleihen …“: an einen Namen oder an einen ZockerDB-Benutzer, mit Datum und geplanter Rückgabe (optional mit privater Notiz)
- Benutzer werden benachrichtigt, sehen die Leihe unter „Ausgeliehen von anderen“ (nur Titel, Plattform, Verleiher – keine Preise) und bestätigen oder lehnen ab
- Überfällige Rückgaben: Erinnerung per Benachrichtigung (und ggf. E-Mail), höchstens einmal pro Woche
- „Zurückbekommen“ mit Verlauf; Leihliste unter „Mehr → Leihliste“, Filter „Verliehen“ in der Sammlung; verliehene Stücke bleiben im Sammlungswert

## 30.09.2026 – Spielstatus und Erfahrungsberichte
- Auf der Seite eines Spiels in deiner Sammlung den Spielstatus antippen: Nicht gespielt, Angefangen, Durchgespielt, 100 %, Abgebrochen (das Datum „durchgespielt“ wird gemerkt)
- Filter „Spielstatus“ in der Sammlung und in der Statistik der „Pile of Shame“ (noch nicht gespielte Spiele); auch für digitale Spiele
- Erfahrungsberichte: Zu Spielen aus deiner Sammlung kannst du freiwillig einen Bericht (optional mit 1–5 Sternen) auf der Katalogseite veröffentlichen – sichtbar für angemeldete Benutzer mit deinem Namen, jederzeit bearbeiten oder zurückziehen
- Berichte lassen sich melden; das Moderationsteam kann sie ausblenden. Private Kommentare und Notizen bleiben privat
- Export, Import, Sync und Datenauskunft enthalten Spielstatus und Berichte

## 29.09.2026 – Digitale Spiele von Hand (PlayStation, eShop …)
- Beim Anlegen eines Spiels über die kleine Zeile „Nur digital gekauft?“ auf digital umschalten und den Store wählen (PlayStation Store, Nintendo eShop, Xbox, Steam, GOG, Epic, anderer) – Kennzeichnung „DIGITAL · PLAYSTATION“ usw. über dem Cover
- Hinweis: nur gekaufte Spiele eintragen, keine Abo-Spiele (PlayStation Plus, Game Pass, Nintendo Switch Online)
- Unter der Sammlung und im Katalog ein Knopf zu den eigenen digitalen Spielen

## 29.09.2026 – Steam-Bibliothek importieren
- Unter „Import“: Steam-Profil angeben, alle Spiele samt Spielzeit werden als digitale Spiele übernommen; erneut importieren aktualisiert und ergänzt
- Digitale Spiele tragen über dem Cover den Schriftzug „DIGITAL · STEAM“, stehen unter dem eigenen Filter „Digital“ und zählen nicht zu Sammlung, Sammlungswert, Statistik und öffentlichen Zahlen
- Zuordnung zum Katalog über den Titel (PC bevorzugt), sonst eigener Eintrag mit Steam-Cover; „Trennen & entfernen“ löscht alle importierten Steam-Spiele
- Voraussetzung: Steam-API-Schlüssel in der Administration (Einstellungen → Spieledaten) und öffentliche „Spieldetails“ im Steam-Profil
- PlayStation: keine offizielle Schnittstelle – daher kein Import (nur manuell oder per CSV)

## 29.09.2026 – Scanner: Bild der Frontkamera gespiegelt
- Laptop-/Frontkameras (z. B. MacBook) zeigen das Bild jetzt wie einen Spiegel – der Barcode bewegt sich in die Richtung, in die man ihn schiebt
- Knopf „Bild spiegeln“ / „Nicht spiegeln“ im Scanner, die Wahl wird gemerkt

## 29.09.2026 – Katalog und Kalender standardmäßig PAL
- Katalog und Releasekalender zeigen standardmäßig nur Spiele, die in Europa (bzw. Australien oder weltweit) erschienen sind
- Auswahl daneben: NTSC-U, NTSC-J oder alle Regionen – die Wahl im Katalog wird gemerkt
- Einträge ohne bekannte Erscheinungstermine (z. B. eigene) werden immer gezeigt

## 29.09.2026 – Verkaufte Exemplare behalten
- Am Exemplar „Verkauft / abgegeben …“: verkauft oder verschenkt/getauscht, mit Datum und Verkaufspreis – bei mehreren Stück auch nur ein Teil (z. B. 2 von 3)
- Verkaufte Stücke verschwinden aus Sammlung, Sammlungswert und Statistik, bleiben aber unter „Verkauft & abgegeben“ mit Foto, Kaufpreis und Herkunft sichtbar
- Statistik: Verkäufe mit Erlös und Gewinn/Verlust (bei Konvoluten anteilig), je Jahr
- „Zurück in die Sammlung“ macht es rückgängig; Export, Import und Sync nehmen den Status mit

## 29.09.2026 – Releasekalender „Erscheint demnächst“
- Neue Seite „Erscheint demnächst“ (Mehr → Erscheint demnächst, am Desktop „Kalender“): Termine nach Monat, für deine Systeme, einzelne Plattform oder alle
- Umschalter „Kürzlich erschienen“, Zeitraum 30 Tage / 4 Monate / 1 Jahr; europäische bzw. weltweite Termine werden bevorzugt
- Auf der Sammlungsseite oben eine einklappbare Reihe „Erscheint demnächst“
- Installationen mit Verbindung zu zockerdb.de holen die Termine von dort; die Titel landen dabei im eigenen Katalog
- „Mehr“: Der Serverstatus ist nur noch für Admins sichtbar

## 29.09.2026 – Kamera-Hinweis für iPhone
- Der Barcode-Scanner erklärt auf iPhone/iPad, warum iOS nach der Kamera fragt und wie man sie in Safari dauerhaft erlaubt

## 29.09.2026 – Einladungen per E-Mail
- Einladungen lassen sich direkt per E-Mail verschicken (Link kopieren geht weiterhin)
- Behoben: Einladungslinks führten ohne Anmeldung auf die öffentliche Startseite statt zur Registrierung
- Neue Einstellung „Kopie aller E-Mails an (BCC)“ zum Prüfen der versendeten E-Mails
- Unbekannte Adressen antworten mit „nicht gefunden“ (404) – Bots auf Lückensuche verfälschen die Besucherstatistik nicht mehr

## 29.09.2026 – Meine Systeme
- Im Katalog erscheinen die gängigen Systeme (Standardsysteme); unter „Systeme auswählen“ legt jeder seine eigene Auswahl fest
- „Alle Systeme zeigen“ blendet die übrigen ein; Systeme, von denen man etwas besitzt, sind immer dabei
- Plattformen lassen sich in der Moderation als Standardsystem markieren; neue Plattformen ordnen vorhandene Katalogeinträge automatisch zu

## 29.09.2026 – Coverbilder wieder sichtbar
- Behoben: Coverbilder von IGDB wurden nicht angezeigt, sobald die App im Offline-Zwischenspeicher lief

## 29.09.2026 – Neuerungen beim Update sehen
- Ist ein Update verfügbar, zeigt Administration → Übersicht, was der neue Stand mitbringt – im Vergleich zu deiner installierten Version
- Die Versionshinweise deines installierten Stands lassen sich jederzeit aufklappen

## 29.09.2026 – Einstellungen übersichtlicher, IGDB-Verbindung testen
- Die Gruppen unter Administration → Einstellungen lassen sich einklappen; dein Browser merkt sich, welche offen sind
- Das Änderungsprotokoll ist standardmäßig eingeklappt
- Neuer Knopf „IGDB-Verbindung testen“: prüft Client-ID und Secret mit einer Beispielsuche
- Neuer Katalogstatus „Ausgeblendet“ für Einträge, die die Datenquelle entfernt hat

## 29.09.2026 – Update-Prüfung
- Die Übersicht zeigt, ob eine neuere Version verfügbar ist oder du auf dem neuesten Stand bist
- Hinweis mit dem passenden Befehl für einzelne Container (z. B. Plesk, Portainer)

## 29.09.2026 – Ideen & Wünsche
- Funktionen vorschlagen, abstimmen und den Stand der Umsetzung verfolgen

## 29.09.2026 – Vorschläge mit Fotos, Einladungen
- Beim Vorschlagen eines Titels lassen sich Belegfotos anhängen (nur für die Moderation sichtbar)
- Fehlende Plattformen vorschlagen
- Einladungslinks: Admins laden neue Benutzer ein, auch wenn die Registrierung geschlossen ist
- Einstellungen zeigen die Standardwerte, Listen (z. B. erlaubte Seiten) sind übersichtlicher
- Seitentitel auf großen Bildschirmen vollständig lesbar, niedrigere Menüleiste auf dem iPhone
- Die Startseite zeigt „Kostenlos registrieren“ nur noch bei offener Registrierung

## 28.09.2026 – Update per Knopf
- „Jetzt aktualisieren“ in der Administration (über einen Watchtower-Container), vorher automatische Sicherung
- Installierter Stand des Images wird angezeigt
- Verständliche Meldung, wenn der Datenordner nicht beschreibbar ist

## 28.09.2026 – Scans und Quellenangaben
- Scans sind für eigene Originale gedacht; Hinweis zum Urheberrecht in der Druckansicht, Teilen von Scans standardmäßig aus
- Link „Auf IGDB.com ansehen“ je Spiel als Quellenangabe
- Neuer Name: ZockerDB

## 27.09.2026 – Herkunft und Konvolute
- Herkunft eines Exemplars auch ohne Einzelpreis, ungefähres Kaufdatum
- Konvolute mit automatischer Verteilung des Kaufpreises

## 27.09.2026 – Verbindung zu zockerdb.de
- Gemeinsamer Katalog über zockerdb.de: Suche, gelernte Barcodes, Einreichungen und freiwillige, anonyme Datenspende mit Vorschau
- Sync der Sammlung mit einem zockerdb.de-Konto in beide Richtungen (auch Varianten und gelöschte Fotos)
- Titel vorschlagen und korrigieren, Duplikate erkennen, deutsche Konsolennamen
- Land und Sprache der Spieltexte im Konto

## 27.09.2026 – Bessere Suche
- Erst der eigene Katalog, IGDB nur bei wenigen Treffern oder auf Wunsch seitenweise
- Eine eingetippte EAN wird als Barcode gesucht
- Echte deutsche Titel statt Übersetzungen, Originaltitel bleibt suchbar
