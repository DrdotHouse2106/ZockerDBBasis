# Neuerungen

Was sich in ZockerDB geändert hat – die neuesten Einträge stehen oben. Die Administration zeigt beim Update-Hinweis
automatisch, welche dieser Einträge der neue Stand gegenüber deinem installierten mitbringt.

<!--
Pflege: Jede für Nutzer oder Admins sichtbare Änderung bekommt hier einen Eintrag.
Format: „## TT.MM.JJJJ – Titel“ (die Überschrift ist die Kennung, nachträglich nicht mehr ändern), darunter Stichpunkte „- …“.
Kurz, verständlich, ohne Technik-Jargon. Funktionen, die es nur auf zockerdb.de gibt, gehören in die Hinweise des Moduls.
Sammler sehen neue Einträge nach einem Update unter „Neu seit deinem letzten Besuch“. Betrifft ein Eintrag nur Admins
oder die Moderation, direkt unter die Überschrift „<!-- für: admin -->“ bzw. „<!-- für: moderation -->“ schreiben.
-->

## 18.11.2026 – Sammlung leeren
- Neu unter **Konto → Sammlung leeren**: löscht mit Passwort-Bestätigung alle Einträge deiner Sammlung (auch Verkauftes, Abgegebenes und Verliehenes) samt Konvoluten, um bei null anzufangen
- Konto, Einstellungen, Wunschliste, Freunde und Fotos bleiben erhalten; vorher lässt sich direkt ein JSON-Export herunterladen, der sich wieder importieren lässt

## 17.11.2026 – Freistellungen gesammelt zurücknehmen
- „Freistellungen prüfen“ hat eine zweite Ansicht **„Übernommen“**: alle Fotos, die gerade ohne Hintergrund gezeigt werden, nebeneinander mit dem Original
- Mehrere auswählen (auch „Alle auswählen“, filterbar nach Spielen, Merch usw.) und mit „Original wiederherstellen“ wieder das Foto mit Hintergrund zeigen
- Moderatoren sehen mit „Auch Fotos anderer Sammler zeigen“ auch geteilte Fotos anderer

## 13.11.2026 – Suche: „FC25“ findet „FC 25“
- Buchstaben und Ziffern dürfen in der Suche zusammengeschrieben sein: „FC25“ findet „EA Sports FC 25“, „PS5“ auch „PS 5“. Das gilt für Katalog, Hinzufügen und die eigene Sammlung

## 29.10.2026 – Einstellungen bestätigen: automatisches Ausfüllen klappt
<!-- für: admin -->
- Beim Bestätigen sicherheitsrelevanter Einstellungen mit Passwort (und 2FA-Code) trägt das automatische Ausfüllen des Handys den Benutzernamen nicht mehr in ein Einstellungsfeld ein – vorher kam danach z. B. „Bitte einen Wert zwischen 0,5 und 1 angeben“

## 22.10.2026 – App: nicht mehr nach einer Nacht abgemeldet
- Die App blieb manchmal nach einer Nacht abgemeldet, obwohl die Anmeldung noch gültig war: Startet das System die App bei gesperrtem Handy im Hintergrund, ließ sich die gespeicherte Anmeldung nicht lesen. Jetzt liest die App sie beim Öffnen erneut und ist wieder angemeldet

## 21.10.2026 – App: Hinweise passend zum eigenen Gerät
- In der App stehen nur noch Hinweise, die zum eigenen Gerät passen – etwa beim Helfen mit dem Freistellen von Fotos
- Die Anleitung „Als App installieren“ unter Einstellungen erscheint in der App nicht mehr, dort ist sie überflüssig

## 21.10.2026 – Quellenhinweis für IGDB auf jeder Seite
- In der Fußzeile jeder Seite steht jetzt „Games metadata is powered by IGDB.com“ mit Link – die Spieldaten und Cover stammen von IGDB.com

## 16.10.2026 – Sammlung: gemerkte Filter lassen sich wieder abwählen
- Öffnete man die Sammlung über das Menü, ließ sich der zuletzt gemerkte Filter (z. B. „Leere Hüllen“ oder „Digital“) nicht mehr abwählen – die Ansicht blieb hängen. Jetzt wirkt das Abwählen sofort

## 15.10.2026 – Monster in my Pocket: Verknüpfung mit dem Spiel
- Die Figurenserie **Monster in my Pocket** wird jetzt mit dem NES-Spiel verknüpft, sobald es im Katalog steht – gleich beim Speichern (z. B. nach einer Suche) statt erst beim nächsten Neustart, und auch bei abweichender Schreibweise („Monster In My Pocket!“)
- Fehlt das Spiel noch im Katalog, holt der Server es kurz nach dem Start selbst (IGDB bzw. zockerdb.de) und verknüpft es – niemand muss erst danach suchen

## 15.10.2026 – Figuren: Bild auf der Eintragsseite, Zurück zur richtigen Stelle
- Die Seite einer Figur zeigt oben jetzt das **Foto der Figur** (freigestellt, wenn übernommen) statt eines leeren Platzhalters. Auch die Cover je Region (PAL-DE, PAL-EU …) erscheinen dort wieder zum Umschalten
- Von einer Figur **zurück zur Serie**: Die Liste steht sofort wieder da, an der Stelle, an der du warst – mit derselben Ansicht und denselben Filtern

## 15.10.2026 – Freistellen im Hintergrund am Ladegerät (iPhone)
- Unter „Freistellen nachholen“ lässt sich das Freistellen **im Hintergrund** einschalten: Hängt das iPhone am Strom (meist nachts, auch gesperrt), stellt es von selbst Fotos aus der Warteschlange frei – wann genau, entscheidet iOS
- Die App bekommt dafür einen **eigenen Zugang, der nur das Freistellen darf** – er steht unter „Konto → Angemeldete Geräte“ als „Freistellen im Hintergrund“, endet beim Ausschalten oder Abmelden in der App und lässt sich dort einzeln abmelden
- Beim Einschalten zeigt ein kurzer Probelauf, ob alles klappt; danach steht dort, wann zuletzt wie viele Fotos freigestellt wurden. Es gilt das Tageslimit

## 15.10.2026 – Figuren-Cover freigestellt
- Das Bild, das allen als **Cover einer Figur** gezeigt wird (Serienseite, Eintrag, Exemplare ohne eigenes Bild), nutzt jetzt die **freigestellte Fassung** ohne Hintergrund, sobald der Fotograf sie übernommen hat – vorher blieb dort das Original stehen
- Verpackungsfotos von Figuren werden weiter wie bisher automatisch freigestellt

## 15.10.2026 – Fotos für leere Verpackungen
- An einer **leeren Verpackung** („Nur OVP“) kannst du wieder Fotos beitragen – vorher erschien fälschlich „Zur Sammlung hinzufügen und Foto beitragen“
- Die Checkliste fragt dort nicht mehr nach Disc, Modul oder Figur, sondern nur nach der Verpackung vorne und hinten – und nach Anleitung, Beilagen oder Steelbook, wenn sie drinliegen
- Auch auf der Spieleseite gilt die leere Verpackung als dein Exemplar für Fotos, wenn du sonst keins hast

## 15.10.2026 – Zurück in die Sammlung an die alte Stelle
- „Zurück“ von einem Eintrag führt wieder an die Stelle der Sammlung, an der man war – auch wenn die Liste erst neu laden muss (vorher landete man dann fast ganz oben)

## 15.10.2026 – Fotos: zurück zur Checkliste, falsche Region wandert, Figuren
- Nach dem Hochladen eines Fotos springt die Seite zur **Checkliste** (was fehlt noch?) statt ans untere Ende des Foto-Kastens
- Ordnest du ein Foto einer **anderen Region oder Plattform** zu als dein Exemplar (z. B. versehentlich das UK-Cover fotografiert), gehört es nicht mehr zum Exemplar. Es bleibt beim Spiel und zählt dort für Exemplare der richtigen Region
- Serienseite: Auch ein Tipp auf das **Bild einer Figur** öffnet den Eintrag, nicht nur der Name
- **Detailfotos** von Figuren sind freiwillig – sie stehen nicht mehr in der Checkliste, lassen sich aber weiter hochladen

## 15.10.2026 – Sammlung verzeiht Tippfehler, Steelbook-Fotos
- Die **Suche in deiner Sammlung** arbeitet jetzt wie die Katalogsuche: Wörter in beliebiger Reihenfolge und über mehrere Angaben hinweg („fifa ps3“, „zelda ocarina“), Apostrophe und römische Zahlen egal („assassins black flag 4“). Findet sie nichts, verzeiht sie kleine Tippfehler („Ocarnia“, „asasins creed“)
- Neue Fotoart **„Steelbook“**: Hat dein Exemplar ein Steelbook, steht es in der Foto-Checkliste (statt eines Fotos „Beilagen“)
- Beim Steelbook gelten **Disc, Anleitung und Beilagen der normalen Ausgabe** – sie werden am Exemplar mit „Wie bei der normalen Ausgabe“ gezeigt und zählen als vorhanden
- Allgemein: Zeigt die Checkliste ein Foto als vorhanden, du hast aber selbst keins, erscheint am Exemplar das passende Foto aus der Community

## 15.10.2026 – Hilfe beim Bestimmen der Region
- Am Feld **Region** erklärt „ⓘ Woran erkenne ich die Region?“, worauf es ankommt: USK-Logo = PAL-DE, nur PEGI = anderes europäisches Land, ESRB = NTSC-U, CERO = NTSC-J – und dass der Barcode nichts über die Region sagt
- Aus der **Produktnummer** wird die Region vorgeschlagen: Bei Nintendo verrät die Endung das Land (z. B. „SNSP-MW-NOE“ = Deutschland, „…-UKV“ = UK), bei PlayStation zumindest USA oder Japan. Ein Tipp auf „übernehmen“ genügt
- Die Hilfe steht auch beim Ändern eines Fotos

## 15.10.2026 – Fotos merken sich die Region
- Neue Fotos übernehmen die **Region deines Exemplars** (z. B. PAL-DE, PAL-UK) – viele Spiele haben je Land ein anderes Cover. Ältere Fotos bekommen sie nachträglich, wenn das Exemplar oder die Variante eine Region hat
- Am Foto steht „Region: …“; über den Stift lässt sie sich ändern. Fotos einer anderen Region erscheinen nicht mehr bei deinem Exemplar, zählen nicht als vorhanden und werden nicht als Cover deines Exemplars genommen
- Auf der Spieleseite erscheinen Community-Fotos mit Region als Cover dieser Region

## 15.10.2026 – Fotos ohne doppelte Angaben
- Heißen Fassung und Variante eines Fotos gleich (z. B. „Special Edition“), steht die Angabe nur noch einmal am Foto

## 15.10.2026 – Sammlung merkt sich Filter und Ansicht, Exemplar zeigt nur seine Fotos
- **„Exemplare gruppieren“** bleibt wie die Sortierung eingestellt – auch, wenn du die Sammlung über einen Link mit Filtern öffnest
- **Filter** (Plattform, Region, Zustand …) bleiben erhalten, wenn du die Sammlung über das Menü wieder öffnest; „Alle Filter zurücksetzen“ vergisst sie
- Am **eigenen Exemplar** stehen nur noch die Fotos dieses Exemplars. Fotos der Community und deiner anderen Exemplare blendest du bei Bedarf mit „… weitere Fotos zeigen“ ein. Neue Fotos merken sich, zu welchem Exemplar sie gehören; bei älteren Fotos gilt das, wenn du nur ein Exemplar des Spiels hast (sonst entscheiden Plattform und Fassung)

## 15.10.2026 – Freistellen: fester Menüpunkt, Knopf am Foto, Zuschnitt nachgeholt
- **„Freistellungen prüfen“** steht jetzt immer unter **Mehr** – mit der Anzahl der Fotos, die auf dich warten
- An eigenen Fotos gibt es **„Hintergrund jetzt entfernen“**: In der App auf Geräten mit eingebauter Freistellung passiert das sofort auf dem Gerät (auch wenn das Foto schon in der Warteschlange wartet); sonst heißt der Knopf „Hintergrund entfernen lassen“ und reiht das Foto für ein Helfer-Gerät ein
- Schon freigestellte Fotos werden nach dem Update einmalig **auf das Motiv zugeschnitten** (im Hintergrund, die Originale bleiben unverändert)

## 15.10.2026 – Freistellen: zugeschnitten, Hüllen nur auf Wunsch, Prüfung durch den Fotografen
- Die freigestellte Version wird jetzt **auf das Motiv zugeschnitten** (mit etwas Rand) – das Original bleibt unverändert
- **Verpackungen von Spielen** werden nur noch bei Modul-Spielen (Karton) automatisch freigestellt; Disc-Hüllen, PC-Spiele und Spiele ohne bekannte Plattform nur auf Wunsch. Noch wartende Hüllen werden beim Start des Servers aus der Warteschlange genommen. Auch das eigene Handy stellt sie nach dem Upload nicht mehr von selbst frei
- „Freistellungen prüfen“: Über freigestellte Fotos entscheidet der Fotograf. Moderatoren sehen neben ihren eigenen nur Fotos ohne Fotografen (Konto gelöscht) und solche, die seit **30 Tagen** niemand geprüft hat; alle anderen per Schalter „Auch Fotos anderer Sammler zeigen“

## 15.10.2026 – Konto löschen: geteilte Fotos der Community überlassen
- Wer sein Konto löscht und Fotos mit der Community geteilt hat, wird gefragt: **mit dem Konto löschen** (Standard) oder **der Community überlassen – ohne Namen**. Überlassene Fotos bleiben im bisherigen Umfang sichtbar, aber ohne Bezug zum Konto; private und noch nicht geprüfte Fotos werden immer gelöscht
- Verschwinden Fotos, fragt ZockerDB die Besitzer der betroffenen Einträge einmal (zusammengefasst), ob sie ein Foto beitragen möchten – nicht, wer Foto-Nachfragen abgeschaltet hat
- Die Vorlagen für Nutzungsbedingungen und Datenschutzerklärung sind entsprechend ergänzt

## 15.10.2026 – Hinweis bei gelöschten Fotos
<!-- für: moderation -->
- Das Moderationsteam bekommt beim Löschen eines Kontos einen anonymen Hinweis, wie viele geteilte Fotos entfernt bzw. der Community überlassen wurden und wie viele Einträge jetzt kein freigegebenes Foto mehr haben
- Admins: Die neuen Absätze der Rechtstexte stehen in den Vorlagen – bitte unter Administration → Rechtstexte in die veröffentlichten Fassungen übernehmen

## 15.10.2026 – Avatar für dein Profil
- Unter **Konto → Avatar** wählst du ein **Symbol** (🎮 👾 🍄 🐉 …) und eine **Farbe** – oder lädst ein **eigenes Bild** hoch. Ohne Auswahl steht dein Anfangsbuchstabe auf einer Farbe
- Eigene Bilder werden auf 256 × 256 Pixel zugeschnitten und ohne Kameradaten gespeichert; sehen können sie nur angemeldete Sammler. Auf geteilten Sammlungsseiten (ohne Anmeldung) erscheint nur das Symbol
- Der Avatar erscheint oben in der Kopfleiste (ein Tipp führt zum Konto), neben deinem Namen und auf geteilten Sammlungen
- Administratoren können ein unpassendes Bild in der Benutzerverwaltung entfernen; der Benutzer wird benachrichtigt

## 15.10.2026 – Freigestellte Fotos: eine Meldung am Tag, keine E-Mails
- **Discs und Verpackungen von Disc-Spielen** (PlayStation, Xbox, GameCube …) werden nicht mehr automatisch freigestellt – dort war die Fehlerquote zu hoch. Wer möchte, tippt am eigenen Foto auf **„Hintergrund entfernen lassen“**; bereits wartende Discs und Disc-Hüllen wurden aus der Warteschlange genommen. Module, Figuren, Karten, Geräte und Verpackungen von Modul-Spielen kommen weiter automatisch dran
- Auf der Seite „Freistellungen prüfen“ (und bei der Prüfung am Foto) öffnet ein Tipp aufs Bild die **Großansicht** – dort wischt man zwischen Original und freigestellter Version; ein helles Schachbrett zeigt, was transparent ist
- Statt einer Benachrichtigung (und E-Mail) je Foto gibt es **höchstens eine Meldung am Tag**, die hochzählt („5 Fotos sind freigestellt – jetzt prüfen“) und zur Seite „Freistellungen prüfen“ führt
- Dafür gibt es nie eine E-Mail; Push und die Meldung in der App lassen sich unter Konto → Benachrichtigungen („Freigestellte Fotos“) abschalten
- Auf der Seite „Freistellungen prüfen“ erscheinen die Rückmeldungen nach „Übernehmen“ bzw. „Original behalten“ jetzt richtig

## 15.10.2026 – Import: Hinweis „noch experimentell“
- Die Importseite weist darauf hin, dass der Import – besonders aus CLZ Games – noch in Erprobung ist und das Ergebnis geprüft werden sollte (Plattform, Ausgabe, Zustand, Kaufpreis, Katalogtreffer); ein Import lässt sich vollständig rückgängig machen

## 15.10.2026 – Update-Fehler beim Freistellen behoben
<!-- für: admin -->
- Auf bestehenden Installationen fehlten nach dem Update mit „Fotos freistellen“ die neuen Datenbankfelder – der Server brach mit „no such column: frei_datei“ ab. Das Update holt sie jetzt automatisch nach, auch wenn die fehlerhafte Version schon gestartet war

## 15.10.2026 – Freistellungen auf einer Seite prüfen
- Neue Seite **„Freistellungen prüfen“**: Alle freigestellten Fotos, die auf deine Entscheidung warten, stehen untereinander – links das Original, rechts die Version ohne Hintergrund (auf Schachbrettmuster, damit man die Ränder gut sieht)
- **„Übernehmen“** oder **„Original behalten“** direkt in der Liste – ohne jedes Mal zum Spiel oder zur Figur zu wechseln; „Alle übernehmen“ erledigt die ganze Seite auf einmal
- Ist nichts mehr offen, zeigt die Seite **„Alles erledigt“**
- Hinkommen: über die Benachrichtigung „Dein Foto ist freigestellt“, den Hinweis im Konto (solange etwas wartet) und für Admins über „Freistellungen prüfen“ in der Übersicht der Administration
- Moderatoren und Admins sehen neben den eigenen auch die geteilten Fotos anderer Sammler; private Fotos bleiben beim Fotografen


## 15.10.2026 – Rechtstexte: Vorlagen nach Rechtsprüfung korrigiert
<!-- für: admin -->
- **Haftungsklausel** in den Nutzungsbedingungen neu gefasst (unbeschränkte Haftung auch bei Verletzung von Leben, Körper und Gesundheit – ohne diesen Zusatz ist die Klausel nach § 309 Nr. 7 BGB unwirksam)
- Neu in den Vorlagen: Mindestalter 16, hervorgehobenes **Widerspruchsrecht** (Art. 21 DSGVO), Begründung bei Entfernen und Sperren, Telefonnummer als zweiter Kontaktweg im Impressum
- Bestehende Installationen übernehmen die Änderungen von Hand unter Administration → Rechtliches; die Vorlagen sind keine Rechtsberatung

## 14.10.2026 – Rechtstexte: Vorlagen ergänzt
<!-- für: admin -->
- Die Vorlagen für Datenschutzerklärung und Nutzungsbedingungen (Administration → Rechtliches) beschreiben jetzt auch **Fotos freistellen** mit Helfer-Geräten, die Zwei-Faktor-Anmeldung, angemeldete Geräte, den Kameradaten-Hinweis bei Fotos, die Leihliste, Ideen und Fehlerberichte, die Weiterleitung von Katalogvorschlägen samt Belegfotos an zockerdb.de und die automatischen Datenbanksicherungen
- Die Vorlagen gelten nur für neue Installationen: Bestehende Texte liegen in der Datenbank und müssen unter Administration → Rechtliches von Hand nachgezogen werden – vor der Veröffentlichung bitte prüfen (lassen), die Vorlagen sind keine Rechtsberatung

## 14.10.2026 – Freistellen in der iPhone-App
- In der App (iOS ab 17) entfernt das iPhone den Hintergrund eigener Fotos von Figuren, Karten, Modulen, Discs, Geräten und Verpackungen gleich nach dem Hochladen – das Ergebnis erscheint direkt beim Foto unter „Freigestellte Version prüfen“ mit „Übernehmen“ oder „Original behalten“
- Helfer-Geräte: Unter Konto → „Beim Freistellen helfen“ startet „Freistellen nachholen“ die Warteschlange auf dem Handy. Die Seite zeigt nur Zähler, die Fotos werden nicht angezeigt und nicht gespeichert; der Bildschirm bleibt an, solange sie arbeitet

## 14.10.2026 – Fotos freistellen (Hintergrund entfernen) mit Helfer-Handys
- Fotos von Figuren, Karten, Modulen, Discs, Geräten und Verpackungen bekommen eine freigestellte Version ohne Hintergrund – gerechnet nicht auf dem Server, sondern von Handys mit eingebauter Freistellung (App, iOS ab 17 oder Android)
- Nach dem Upload kommt das Foto in eine Warteschlange; sobald ein Helfer-Gerät den Hintergrund entfernt hat, bekommst du die Nachricht „Dein Foto ist freigestellt – jetzt prüfen“ und entscheidest beim Foto, ob die freigestellte Version gezeigt wird. Bis dahin und bei „Original behalten“ bleibt alles wie bisher; „Freistellung verwerfen“ geht jederzeit
- Im Konto legst du fest, höchstens wie viele Fotos dein Handy am Tag freistellt (Standard 50, auch unbegrenzt möglich) – so läuft es nicht ewig, wenn nur wenige Helfer da sind
- Helfer-Geräte bekommen die Fotos nur auf 1.200 Pixel verkleinert und zeigen sie nicht an; der Server merkt sich, welches Konto welchen Auftrag hatte
- Unter Konto → „Beim Freistellen helfen“ kannst du dein Handy als Helfer eintragen, wenn ein Administrator dich dafür freigeschaltet hat (Admins und Moderatoren immer). Helfer ohne Moderationsrolle bekommen nur Fotos, die ihr Fotograf mit der Community teilt
<!-- für: admin -->
- Einstellung „Fotos freistellen (Helfer-Geräte)“ unter Uploads & Speicher (Standard an); in der Übersicht der Stand der Warteschlange und „Vorhandene Fotos einreihen“ für alte Fotos; unter Benutzer der Knopf „Darf beim Freistellen helfen“
- Die App bekommt dafür ein Plugin und die Seite „Freistellen nachholen“ (siehe App-Übergabe); bis dahin füllt sich die Warteschlange nur

## 14.10.2026 – Sicherheitsprüfung, zweiter Durchgang
- Fotos dürfen höchstens 80 Megapixel haben, Scans in TIFF, PNG oder WebP höchstens 120, JPEG-Scans weiterhin bis 300 – winzige Dateien mit riesiger Pixelfläche konnten den Server sonst zum Absturz bringen; höchstens zwei Bilder werden gleichzeitig verarbeitet, weitere warten kurz
- PDF-Seiten werden beim Upload blockweise gezählt statt die ganze Datei in den Speicher zu laden
- Einladungslinks lassen sich auch bei gleichzeitigen Anfragen nur einmal einlösen; die Registrierungsdrossel zählt vor dem Anlegen
- Import aus einer Sicherung: höchstens 20.000 Exemplare je Datei; große Anfragen (20 MB) sind nur noch für Import, Sync und Datenspende erlaubt, sonst 2 MB
- Die fehlertolerante Katalogsuche ist je Besucher gedrosselt (60 je Minute)
<!-- für: admin -->
- Rolle entziehen, sperren oder löschen eines anderen Administrators verlangt jetzt das eigene Passwort (und den 2FA-Code), wie schon Passwort setzen und 2FA zurücksetzen
- Belegfotos zu eigenen Katalogvorschlägen werden beim Löschen des Kontos mit entfernt

## 14.10.2026 – Zustand von Figuren und Merch bewerten
- Bei Figuren und Merch heißt das Feld jetzt **„Zustand Figur / Artikel“**, und „Wie bewerte ich den Zustand?“ beschreibt die Stufen passend für Figuren (Farbabrieb, Vergilbung, lockere Gelenke, Bruch)
- Ist die Verpackung geöffnet vorhanden (Box, Blister), lässt sie sich getrennt bewerten: **„Zustand Verpackung“**

## 14.10.2026 – Sammlung merkt sich die Sortierung
- Die gewählte Sortierung der Sammlung (z. B. „Titel (A–Z)“) bleibt auf diesem Gerät erhalten – auch wenn du die Sammlung später über die Menüleiste öffnest

## 14.10.2026 – Kameradaten als Hinweis auf eigene Fotos
- Beim Hochladen eines Fotos wird vermerkt, ob die Datei Kameradaten (Hersteller und Modell, z. B. eines Handys) enthielt. Gespeichert wird nur dieser Vermerk – die Daten selbst, Standort und Aufnahmezeit werden wie bisher entfernt

## 14.10.2026 – Fotos: Fassung auch in der Checkliste, Edition bei Konsolen
- Die Foto-Checkliste am eigenen Exemplar achtet jetzt auf die Fassung: Beim Platinum-Exemplar zählen nur Platinum-Fotos als vorhanden, bei der Erstauflage nur Fotos ohne Fassung
- Konsolen merken sich am Foto ihre **Edition** (z. B. „Zelda Edition“) genauso – mit Anzeige „Edition: …“, Korrektur über „Foto bearbeiten“ und passender Cover-Auswahl

## 14.10.2026 – Fassung am Foto (Platinum, Essentials …)
- Lädst du ein Foto an einem Exemplar mit Fassung hoch (z. B. „Platinum“), merkt sich das Foto diese Fassung – du musst sie nicht mehr in die Bezeichnung schreiben. Am Foto steht „Fassung: Platinum“
- Als Cover eines Exemplars werden nur Fotos derselben Fassung genommen: ein Platinum-Foto erscheint nicht bei der Erstauflage. Fotos ohne Fassung passen weiterhin überall
- Falsch übernommen? Über „Foto bearbeiten“ lässt sich die Fassung ändern oder leeren (leer = Erstauflage / Standard)
- Vorhandene Fotos bekommen die Fassung automatisch, wenn du das Spiel nur in einer Fassung besitzt

## 14.10.2026 – Fotos je Plattform
- Fotos merken sich jetzt die **Plattform** des Exemplars, an dem sie hochgeladen wurden – am Foto steht z. B. „Plattform: PS4“. Bei Spielen für mehrere Plattformen gelten PS4-Fotos deshalb beim PS5-Exemplar nicht mehr als vorhanden: Du wirst dort nach Disc, Vorder- und Rückseite der PS5-Fassung gefragt, und die PS4-Hülle wird nicht zum Cover deines PS5-Exemplars
- Die Fotos der eigenen bzw. auf der Spieleseite gewählten Plattform stehen zuerst. Falsch zugeordnet? Über den Stift am Foto lässt sich die Plattform ändern (eigene Fotos; die Moderation bei allen)
- Bestehende Fotos wurden zugeordnet, wenn der Fotograf das Spiel nur auf einer Plattform hat; sonst bleiben sie ohne Plattform und zählen wie bisher überall
<!-- für: moderation -->
- Moderation → Fotos: Plattform der abgebildeten Fassung direkt wählbar. Die KI-Prüfung meldet, wenn das Foto eine andere Plattform zeigt (z. B. PS4-Logo bei PS5)

## 13.10.2026 – App: Fotos öffnen in der App statt im Browser
- In der iOS- und Android-App öffnet ein Tipp auf ein Foto oder einen Scan jetzt die Bildansicht in der App (mit Blättern und Schließen) – vorher sprang die App in den externen Browser

## 13.10.2026 – Eigenes Figurenfoto als Cover, auch vor der Prüfung
- Hat eine Figur (oder Sammelkarte) noch kein Bild, zeigt die Spieleseite dein eigenes Foto „Figur“ bzw. „Karte vorne“ jetzt schon als Cover, solange es noch geprüft wird – wie auf der Serienseite. Für alle anderen erscheint es, sobald es freigegeben ist

## 13.10.2026 – Fassung auch bei gewählter Variante
- Wählst du beim Erfassen oder Bearbeiten eine Variante wie „PAL-DE“ oder eine Revision, bleibt das Feld **Fassung** (Erstauflage, Platinum, Essentials, Classics …) jetzt sichtbar – vorher verschwand es. Nur bei einer Sonderausgabe (z. B. Collector's Edition) entfällt es

## 13.10.2026 – Suche nach Produktnummer vom Rücken
- Beim Hinzufügen lässt sich jetzt auch nach der **Produktnummer** suchen, z. B. „BLES-00909“ (PS3), „SLES-52345“ (PS2) oder „CUSA-03067“ (PS4) – mit oder ohne Bindestrich, groß oder klein
- Gefunden wird, was bei einer Fassung (Variante) im Katalog oder an einem deiner Exemplare als **Modellnummer** hinterlegt ist. Ist eine Nummer noch unbekannt, sagt die Suche das: dann nach dem Titel suchen und die Nummer beim Erfassen unter „Modellnummer“ eintragen

## 13.10.2026 – Figuren und Karten ohne falsche Fotofragen, Serie 6b aufgeräumt
- Bei **losen Figuren und Merch** fragt ZockerDB nicht mehr nach Fotos der Verpackung – nur noch nach dem Foto des Artikels selbst und Details. Nach Verpackungsfotos wird nur gefragt, wenn du „OVP geöffnet“ oder „OVP ungeöffnet“ angibst
- **Sammelkarten** sind eine eigene Merch-Kategorie (z. B. die amiibo-Karten von Animal Crossing). Bei Karten fragt ZockerDB nur nach **Foto: Karte vorne** statt nach einem Figurenfoto (die Rückseite ist meist bei allen Karten gleich – ein Foto davon ist trotzdem möglich); das Foto der Vorderseite dient auch als Bild der Karte
- Der Knopf **„Serie löschen“** steht jetzt direkt oben neben „Angaben bearbeiten“
- **Monster in my Pocket:** „Serie 6b – Secret Skeleton Dinosaurs“ war nur eine eigene Seite für die Raritäten der Serie 6. Die Skelett-Ausführungen stehen jetzt als Farben („Skelett Gelb“ …) direkt bei den Figuren der Serie 6; Exemplare und Fotos sind mitgewandert

## 13.10.2026 – Fotos nachträglich bearbeiten
- Falsche Fotoart erwischt (z. B. „Detail“ statt „Figur“)? Am Foto gibt es jetzt einen **Stift**: Fotoart, Variante bzw. Farbe und Bezeichnung lassen sich ändern – für den, der das Foto hochgeladen hat, und für das Moderationsteam. Ändert der Fotograf ein schon freigegebenes Foto, prüft die Moderation es erneut
- In der Moderation lässt sich die Fotoart vor der Freigabe direkt korrigieren
- Fehler behoben: Ein **Cover-Bild aus der Fotomediathek** (z. B. HEIC aus Apple Fotos oder Fotos, die nur in iCloud liegen) wurde am Exemplar abgelehnt. Es wird jetzt wie die anderen Fotos vor dem Hochladen vollständig geladen und in JPEG umgewandelt

## 13.10.2026 – Fotos von Figuren, auch je Farbe
- Neue Fotoart **„Foto: Figur / Artikel selbst“** – mit der Farbe als Variante (z. B. Monster in my Pocket in Rot). Bei losen Figuren und Merch wird dieses Foto zuerst gesucht
- Auf der **Serienseite** zeigt die Kachel das Foto der Figur; gibt es Fotos einzelner Farben, schaltest du darunter um. Besitzt du die Figur, führt 📷 direkt zum Hochladen
- Die Fotos dienen auch als **Cover**: Dein Exemplar in Rot zeigt das rote Foto, und Figuren ohne Katalog-Bild bekommen das Foto der Figur – auch auf ihrer Spieleseite

## 13.10.2026 – Serien löschen, Monster in my Pocket aufgeräumt
- Wer eine Serie bearbeiten darf, kann sie unter **„Angaben bearbeiten“** jetzt auch **löschen** (Unterserien einer Hauptserie werden mit gelöscht). Die Figuren bleiben im Katalog, Exemplare in den Sammlungen bleiben erhalten
- Bei **Monster in my Pocket** gibt es die Unterserie „Serie 1 – Secret Monster“ nicht mehr: Sie war nur der Hinweis, dass Nr. 12 Jotun Troll das Secret Monster der ersten Serie ist. Exemplare der doppelten Figur hängen jetzt an Nr. 12 der Serie 1, der Hinweis steht bei Serie 1

## 13.10.2026 – Discs rund zuschneiden
- Beim Zuschneiden eines Fotos gibt es das Format **„Rund (Disc)“**: Die Disc wird kreisrund ausgeschnitten, außen herum bleibt das Bild durchsichtig. Bei Disc-Fotos ist es gleich vorgewählt

## 13.10.2026 – Cover passend zur Region
- Deine Exemplare zeigen jetzt das **Cover ihrer Region**: Ein PAL-Spiel bekommt das europäische Cover statt des amerikanischen, ein japanisches das japanische – soweit es bekannt ist. Ein eigenes Foto oder ein eigenes Cover am Exemplar geht weiterhin vor
- Gibt es von der Community ein freigegebenes Foto „Verpackung vorne“ einer Ausgabe mit Region (z. B. PAL-DE mit USK-Logo), wird das für passende Exemplare genommen
- Auf der **Spieleseite** schaltest du unter dem Cover zwischen den Regionen um (PAL-DE · PAL-EU · NTSC-U · NTSC-J …)
- Die europäischen Cover kommen nach und nach dazu, wenn Spiele neu von IGDB abgeglichen werden

## 13.10.2026 – amiibo als Figurenserie

- Unter **Serien** gibt es jetzt **amiibo** mit allen Reihen, also Figuren (z. B. Super Smash Bros. mit Packungsnummer,
  Super Mario, Zelda, Splatoon) und Karten (z. B. Animal Crossing Serie 1–5): insgesamt über 900 Einträge zum Abhaken.
- Angekündigte Figuren kommen dazu, sobald sie erschienen sind. Fehlt etwas oder stimmt etwas nicht, kann die Moderation
  es direkt in der Serie korrigieren.

## 13.10.2026 – Import rückgängig machen
- Unter Einstellungen → Importieren stehen jetzt deine **letzten Importe** – mit Anzahl, wie viele noch da sind und wie viele du seitdem bearbeitet hast
- **„Rückgängig machen“** entfernt die Exemplare eines Imports wieder – wahlweise alle oder nur die unveränderten, damit deine Nacharbeit erhalten bleibt. Praktisch, wenn beim Umzug vieles falsch zugeordnet wurde

## 13.10.2026 – Jugendschutz im Katalog, Import-Vorlagen anfragen
- Spiele zeigen jetzt, ob sie in Deutschland **indiziert, beschlagnahmt oder vom Index gestrichen** sind – mit Jahr (z. B. „Vom Index gestrichen 2019 (indiziert 1997)“). Im Katalog gibt es dafür einen eigenen Filter. Gepflegt wird das vom Moderationsteam
- **Umzug aus einer anderen App:** Unter Einstellungen → Importieren kannst du eine fertige Import-Vorlage für deine bisherige App anfragen. Auf zockerdb.de gehen dabei Screenshots vom Export und eine kurze Beispieldatei (2–3 Zeilen) mit – sichtbar nur fürs Team und gelöscht, sobald die Vorlage fertig ist. Fragen andere dieselbe App an, stimmen sie einfach mit dafür

## 13.10.2026 – Figurenserien und Spiele verknüpft
- Eine Figurenserie kann jetzt mit dem passenden Spiel verbunden sein: Auf der Serienseite steht **„Zum Spiel“** (z. B. Monster in My Pocket → das NES-Spiel von 1992), auf der Spieleseite umgekehrt **„Figurenserie zum Spiel“** mit Figurenzahl und wie viele davon du hast
- Monster in My Pocket wird automatisch mit dem Spiel verknüpft, sobald es im Katalog steht; weitere Verknüpfungen pflegt die Moderation direkt auf der Serienseite

## 13.10.2026 – Edition direkt als Variante, Datum ohne Punkte
- Trägst du am Exemplar unter **„Edition / Variante“** eine Ausgabe ein, die es im Katalog noch nicht gibt (z. B. „Special Edition“), kannst du sie mit einem Haken gleich **als Variante des Spiels anlegen** – nur für dich oder zur Aufnahme eingereicht. Dein Exemplar wird direkt damit verknüpft. Gibt es sie schon, bietet das Formular sie zum Auswählen an
- **Datumsfelder** (Kaufdatum, Erstkauf laut Beleg) verstehen jetzt auch reine Ziffern wie „29122012“ oder „122012“ – praktisch mit der Zahlentastatur am Handy, die keinen Punkt hat. Beim Verlassen des Felds wird daraus „29.12.2012“

## 13.10.2026 – Barcode: Ausgabe vom vorhandenen Exemplar übernommen
- Scannst du einen Barcode, den du schon einem Exemplar zugeordnet hast, ist beim Hinzufügen jetzt dessen **Ausgabe vorausgewählt** – Variante bzw. Fassung (z. B. Collector's Edition oder Platinum) und Region – statt „Erstauflage / Standard“

## 13.10.2026 – Suche und Spiele zuordnen deutlich schneller
- Die Suche im Katalog (Hinzufügen, Katalog, Spiele zuordnen) ist bei großem Katalog um ein Vielfaches schneller – das nachträgliche Zuordnen nach einem Import braucht statt Minuten nur noch Sekunden
- Gefunden werden dabei auch frühere Titel eines Spiels

## 13.10.2026 – Eigenes Foto zuschneiden
- Beim **eigenen Foto** eines Exemplars kannst du das Bild jetzt vor dem Speichern **zuschneiden** – praktisch, wenn im Katalog das englische Cover hinterlegt ist: Hülle fotografieren, Rahmen aufs deutsche Cover ziehen, „Übernehmen“
- Neues Format **„Frei“**: Breite und Höhe stellst du einzeln ein – auch beim Hochladen von Fotos für die Spieleseite

## 13.10.2026 – Offline: Exemplar öffnet zuverlässig
- Ohne Verbindung öffnet sich ein Exemplar jetzt auch dann, wenn ein Zusatzteil der Seite (etwa die Herkunft) noch nicht zwischengespeichert war – dieser Teil fehlt dann einfach, statt dass die Seite leer bleibt

## 12.10.2026 – Figurenserien: Farben pflegen ohne Versehen, Sammeln mit „Rückgängig“
- **Farben pflegen / vorschlagen** ändert nicht mehr sofort: Antippen **markiert** nur (+ = hinzufügen, − = entfernen), nochmal tippen nimmt die Markierung zurück. Unten zeigt eine Leiste, wie viele Änderungen offen sind – erst **„Speichern“** übernimmt sie, „Verwerfen“ vergisst sie. Vor dem Entfernen wird nachgefragt, und wer den Modus mit offenen Änderungen verlässt, wird gewarnt
- **Sammeln:** Nach dem Antippen steht im Hinweis **„Rückgängig“** – ein versehentlich übernommenes Exemplar ist mit einem Tipp wieder weg

## 12.10.2026 – Figuren: eigene Seite, Infos und Korrekturen der Community
- Der Name einer Figur auf der Serienseite führt jetzt zu ihrer eigenen Seite – mit Fotos, Kommentaren und oben dem Hinweis, zu welcher Serie und Nummer sie gehört
- Auf zockerdb.de gibt es an jeder Figur **„Weißt du mehr? Infos ergänzen“**: für weitere Infos (Variante, Herkunft, Besonderheit) oder wenn Name, Nummer oder Farbe nicht stimmen. Das Moderationsteam schaut es sich an und ergänzt die Figur

## 12.10.2026 – Monster in my Pocket: alle Figuren erfasst
- Die Unterserien von Monster in my Pocket sind jetzt mit ihren Figuren gefüllt – 267 Figuren mit Nummer und Originalnamen, von Serie 1 bis zu den Ninja Warriors
- **Serie 1** und **Serie 4 (Super Scary)** kommen gleich mit den Farben, in denen es jede Figur gab. Bei Serie 2, 3, 6b und 7 sind die Farben der Serie hinterlegt, welche Figur es in welcher Farbe gab, ergänzt ihr über „Farben pflegen / vorschlagen“
- Monster Wrestlers reichen jetzt bis W45 (Physio-Terrorist-Set); bei den „Späten Dinosauriern“ sind die Nummern 223–226 angelegt, die Namen fehlen noch

## 12.10.2026 – Neue Seite „Spiele zuordnen“
- Alle Exemplare ohne Katalogeintrag auf einen Blick, jeweils mit bis zu vier **Vorschlägen** aus dem Katalog (Cover, Originaltitel, Jahr, Plattformen; passende Plattform zuerst, „andere Plattform“ ist markiert). Ein Tipp auf **„Das ist es“** ordnet zu, „Selbst suchen …“ hilft bei allem anderen, „Später“ blendet ein Spiel vorerst aus
- Zu finden nach dem Import über „… Spiele ohne Katalogtreffer zuordnen“, in der Sammlung über Filter → „Nur ohne Katalogeintrag“ → „Einzeln zuordnen“ und über die Benachrichtigung nach der automatischen Zuordnung

## 12.10.2026 – Import: Spiele ohne Katalogtreffer werden nachträglich zugeordnet
- Nach einem Import (z. B. aus CLZ Games) sucht ZockerDB für alles, was nicht genau passte, im Hintergrund weiter nach dem passenden Katalogeintrag – tolerant bei der Schreibweise („Disney's Treasure Planet“ = „Treasure Planet“, „Pokémon Platinum Version“ = „Pokémon Platinum“, „GTA III“ = „GTA 3“) und notfalls online. Zugeordnet wird nur bei eindeutigem Treffer mit gleicher Plattform; Hauptspiele gehen vor Bundles
- Mit dem Eintrag kommen Cover, Angaben und Werte dazu. Der Import zeigt den Fortschritt, am Ende kommt eine Benachrichtigung
- **Schon importiert?** Sammlung → Filter „Nur ohne Katalogeintrag“ → **„Automatisch zuordnen“**. Das ersetzt auch automatisch angelegte private Platzhalter-Einträge

## 12.10.2026 – Figurenserien: „Meine Serien“
- Oben stehen jetzt **„Meine Serien“**: Serien, denen du mit ☆ folgst, Serien, aus denen du schon Figuren hast, und deine eigenen. Alle anderen sind unter „Weitere Serien“ eingeklappt – wer noch keine eigene Serie hat, sieht wie bisher alle
- Welchen Serien du folgst, steht auch in deiner Datenauskunft

## 12.10.2026 – Tour „Figurenserien“
- Neue geführte Tour für Figurenserien: Übersicht und Fortschritt, Unterserien, die Modi Ansehen/Sammeln/Pflegen, Farbpunkte und Filter, fehlende Figuren ergänzen und eigene Serien anlegen. Sie wird auf der Seite „Figurenserien“ angeboten und lässt sich jederzeit unter „Mehr → Hilfe & Touren“ starten
- Touren scrollen jetzt zuverlässig zur markierten Stelle, auch wenn eine Seite beim Laden noch einmal nach oben springt

## 12.10.2026 – Figurenserien: Antippen nur nach Einschalten, Vorschläge mit Foto als Beleg
- Die Serienseite startet in **„Ansehen“**: Antippen ändert nichts, so landet beim Scrollen nichts aus Versehen in der Sammlung. Zum Abhaken **„Sammeln“** einschalten, zum Ergänzen von Farben „Farben pflegen / vorschlagen“
- **Vorschläge brauchen ein Foto:** Schlägst du in einer freigegebenen Serie eine neue Figur oder eine weitere Farbe vor, zählt sie sofort für dich. An die Moderation geht sie erst, wenn du ein Foto als Beleg hinzufügst („📷 Foto …“ an der Karte). Das Foto sieht nur das Moderationsteam; es wird nicht veröffentlicht und nach der Entscheidung gelöscht
- Ohne eigene Moderation (selbst gehostet) bleiben Vorschläge wie bisher privat

## 12.10.2026 – Formular: zwei weitere seitliche Scroll-Fehler behoben
- „Fassung“ (bei einer alten, frei eingegebenen Edition-Bezeichnung) und die Beilage „Beilagen (Kataloge, Werbung, Sicherheitshinweise)“ konnten die Seite beim Bearbeiten seitlich aufreißen – beide Felder bleiben jetzt innerhalb der Seitenbreite; die lange Beilage bekommt dafür eine eigene, breitere Zeile mit Zähler darunter statt daneben

## 12.10.2026 – Figurenserien: Farben nur, wo es sie gibt; ohne „selten“
- Neuer Schalter je Serie: **„Figuren gibt es in verschiedenen Farben“**. Monster in my Pocket hat Farben; neue Serien (z. B. Funko Pop!) sind ohne – dort nimmst du eine Figur mit „+ In die Sammlung“ auf und der Fortschritt zählt nur Figuren. Unterserien übernehmen die Einstellung der Hauptserie
- „Selten“ ist entfernt: Seltenheit ist eine Einschätzung, keine Tatsache. Ein „R“ in „Liste einfügen“ zählt einfach als „gibt es“

## 12.10.2026 – Figurenserien: Karten statt Tabelle
- Die Serienseite zeigt jede Figur als Karte mit Nummer, Name (und Bild, falls vorhanden) und **Farbpunkten**, und zwar nur in den Farben, die es für diese Figur gab: gefüllter Punkt mit ✓ = hast du, heller Ring = fehlt dir, ★ = selten. Antippen übernimmt die Figur in der Farbe in die Sammlung
- **Filter:** Alle · Fehlt mir · Habe ich · Selten, dazu nach Farbe (z. B. „Was fehlt mir in Neongrün?“). Die Farbchips sind zugleich die Legende
- Noch nicht erfasste Nummern erscheinen als gestrichelte Karte zum direkten Anlegen

## 12.10.2026 – Figurenserien wachsen mit der Community
- Jeder kann bei freigegebenen Figuren Farben vorschlagen (auch ganz neue über „+ Farbe“) und fehlende Figuren ergänzen. Vorschläge sind in der Tabelle mit „?“ markiert und zählen zunächst nur für dich; gibt die Moderation sie frei, zählen sie für alle – aus „47 von 48“ wird dann z. B. „47 von 49“
- Neu: **Liste einfügen** (für alle, die eine Serie pflegen): je Zeile „Nr; Name; Farben“, die Farben in Spaltenreihenfolge mit x (gibt es), R (selten) oder - (gab es nicht). Auch direkt aus einer Tabelle kopiert (Tabulatoren); vorhandene Figuren werden ergänzt

## 12.10.2026 – Figurenserien für Merch
- Neu unter „Mehr“ → **Figurenserien**: Serien wie Monster in my Pocket oder Funko Pop! mit Unterserien (z. B. „Serie 1“ bis „Serie 7“), je mit Hersteller, Jahr, Nummernbereich (auch mit Präfix wie „W1–W42“), nie erschienenen Nummern und Hinweisen zum Vertrieb
- Jede Figur hat Nummer und eigenen Namen – der Titel ist nur noch „Cyclops“, angezeigt wird „Monster in my Pocket · Serie 1 · #4“
- **Farbtabelle** je Unterserie: ✓ in deiner Sammlung, x gibt es, R gibt es selten, – gab es in dieser Farbe nicht. Antippen übernimmt die Figur in der Farbe in deine Sammlung
- **Fortschritt** je Unterserie und Serie: Figuren und Farben getrennt, gezählt wird nur, was es wirklich gab (nie erschienene Nummern und nicht existierende Farben zählen nicht)
- Monster in my Pocket ist mit allen Unterserien bereits angelegt; Figurennamen und Farben tragt ihr ein. Eigene Serien sind zuerst privat und werden nach dem Einreichen von der Moderation freigegeben
- In der Sammlung: Filter nach Serie (aus der Serienseite „In meiner Sammlung“), die Suche findet auch den Seriennamen; beim Hinzufügen von Merch weist ein Hinweis auf die Figurenserien hin

## 12.10.2026 – CSV-Import: Zeitüberschreitung (504) behoben
- Bei großem Katalog dauerte der Import mehrerer Hundert Zeilen so lange, dass der Webserver mit „HTTP 504“ abbrach: Der Abgleich mit dem Katalog durchsuchte je Zeile den ganzen Katalog. Jetzt nutzt er die Indizes – im Test 463 Zeilen bei 300.000 Katalogeinträgen in unter einer Sekunde statt 15 Sekunden
- Dieselbe Beschleunigung gilt für die Titelsuche beim Steam-Import

## 12.10.2026 – Umzugsanleitung CLZ: einfacher
- Die Anleitung erklärt jetzt Schritt für Schritt, wie du in CLZ Games Web einen Spalten-Favoriten anlegst – und dass du einfach alle Spaltengruppen anhaken kannst; was ZockerDB nicht braucht, wird ignoriert

## 12.10.2026 – CLZ-Import: Konsolen, Barcode-Abgleich, Doppelnamen
- Konsolen und Controller aus CLZ Games werden über die Spalte „Hardware Type“ erkannt und als Konsole bzw. Zubehör angelegt (bisher als Spiel)
- Plattformnamen wie „Atari 2600/VCS“ werden zugeordnet (jeder Teil des Namens wird einzeln gesucht)
- Der Katalog-Abgleich beim CSV-Import nutzt jetzt zuerst den Barcode und vergleicht auch den Originaltitel – englische Titel wie „The Lion King“ finden so den deutschen Katalogeintrag
- Die CLZ-Spalte „Value“ (Schätzwerte in US-Dollar) wird nicht mehr automatisch als Marktwert übernommen; unbekannte Zustandsangaben (z. B. „Verkratzt“) landen in den Notizen; Format „Download“ wird zum digitalen Spiel

## 12.10.2026 – Umzug von CLZ Games
- Auf der Import-Seite gibt es jetzt die Anleitung „Umzug von CLZ Games – Schritt für Schritt“: welche Spalten du in CLZ Games Web einschaltest und wie du exportierst
- Der CSV-Import versteht mehr von CLZ: englische Daten wie „Aug 17, 2023“, die Spalten Box und Manual (→ CIB, „Fehlt Anleitung“ oder lose), Collection Status („Wish List“ wird nicht übernommen, „Sold“ landet unter „Verkauft & abgegeben“), Serial No., Purchase Store (→ Notizen), Location/Storage Device/Storage Slot (→ Lagerort) und Completed (→ „Durchgespielt“)

## 12.10.2026 – Steam: nur trennen oder Spiele entfernen, Katalog neu abgleichen
- „Trennen & Spiele entfernen“ löscht wie bisher alle importierten Steam-Spiele; neu ist „Nur trennen“ – die Verbindung wird gelöst, die Spiele bleiben
- „Mit Katalog neu abgleichen“ verknüpft Steam-Spiele, die beim Import nur einen privaten Eintrag bekommen haben, nachträglich mit dem gemeinsamen Katalog – ohne Abruf bei Steam. Nicht mehr benötigte private Einträge werden entfernt, es entsteht nichts doppelt. Das passiert auch bei jedem erneuten Import

## 12.10.2026 – Steam-Import auch bei privatem Profil
- Neu im Steam-Import: „Privates Profil? Mit eigenem Steam-API-Schlüssel importieren“. Mit deinem eigenen Schlüssel (steamcommunity.com/dev/apikey) liefert Steam deine Bibliothek, ohne dass du das Profil öffentlich stellen musst
- Der Schlüssel wird nur für diesen einen Import verwendet und nicht gespeichert – zum Aktualisieren gibst du ihn erneut ein
- Alternativ reicht es weiterhin, die Steam-„Spieldetails“ nur für den Import kurz auf öffentlich zu stellen

## 12.10.2026 – Rechtstexte: Steam-Import mit eigenem Schlüssel
<!-- für: admin -->
- Die Vorlage der Datenschutzerklärung beschreibt im Abschnitt zum Steam-Import jetzt auch den eigenen Steam-API-Schlüssel (nur für den Abruf, nicht gespeichert). Bestehende Seiten ändern sich nicht: bitte unter Administration → Seiten übernehmen

## 12.10.2026 – Steam-Import leichter zu finden
- Unter „Mehr“ → Datensicherung gibt es jetzt den Knopf „Steam-Bibliothek importieren“ – er springt direkt zum Steam-Abschnitt der Import-Seite (sichtbar, wenn der Server einen Steam-API-Schlüssel hat)
- Fehlt der Schlüssel, sehen Admins auf der Import-Seite einen Hinweis statt eines leeren Bereichs

## 12.10.2026 – Steelbook auf der Sammlungskarte
- Ist bei einem Exemplar die Beilage „Steelbook“ angehakt, steht „Steelbook“ jetzt auf der Karte in deiner Sammlung – so unterscheidest du z. B. zwei Exemplare mit derselben Disc-Nummer, eines im Steelbook und eines in der normalen Hülle

## 12.10.2026 – Modell- und Drucknummer: Beispiele und Erklärung je Plattform
- Die Beispiele im Feld „Modellnummer“ passen jetzt zur gewählten Plattform – beim GameCube z. B. „DOL-P-GNDD, DOL-GNDD-NOE“ statt PlayStation-Nummern, bei der PS3 „BLES-…“, bei der Xbox „X12-34567“
- Neu: „ⓘ Was bedeuten die Nummern?“ – erklärt je Plattform, wofür die Buchstaben stehen (z. B. P = PAL, D = deutsche Fassung, NOE = Verpackung für Deutschland/Österreich), wo die Nummer steht und welche Nummern nicht gemeint sind
- Auch der Hinweis zur Drucknummer passt jetzt zur Plattform

## 12.10.2026 – Katalogseite ohne Cover: Bild deines Exemplars
- Hat ein Katalogeintrag noch kein Cover, zeigt dir die Katalogseite das Bild deines eigenen Exemplars – mit dem Hinweis „Bild deines Exemplars – im Katalog fehlt noch ein Cover“. Nur du siehst es, öffentlich bleibt der Platzhalter

## 12.10.2026 – „Nur OVP“ springt nicht mehr auf CIB
- Wer bei einer leeren Hülle „Nur OVP“ wählt und dann Anleitung, Inlay und Beilagen ankreuzt, behält „Nur OVP“ – vorher sprang die Vollständigkeit auf „CIB“, obwohl die Disc fehlt

## 12.10.2026 – Beilagen: auch Sicherheitshinweise
- Der Punkt „Werbebeilagen / Kataloge“ heißt jetzt „Beilagen (Kataloge, Werbung, Sicherheitshinweise)“ – lose Blätter wie Sicherheits- oder Gesundheitshinweise gehören dorthin. Was genau dabei ist, steht am besten unter „Welche Beilagen genau?“

## 12.10.2026 – App: Exemplare laden sofort aus dem Zwischenspeicher, „Zurück“ merkt sich die Scrollposition
- Ein Exemplar aus deiner Sammlung zu öffnen zeigte erst „Wird geladen …“, bis die Antwort vom Server da war – jetzt erscheint sofort der zuletzt bekannte Stand aus dem Offline-Zwischenspeicher, im Hintergrund wird aktualisiert
- „Zurück“ aus einem Exemplar (oder einer anderen Seite) in eine lange Liste wie die Sammlung springt nicht mehr an den Anfang, sondern an die Stelle, an der du warst

## 12.10.2026 – Hinzufügen: Dropdowns übernehmen die Auswahl zuverlässig
- Beim Ausfüllen eines neuen Eintrags konnte eine Auswahl aus einem Dropdown-Feld (z. B. Plattform, Zustand, Herkunft) verloren gehen, wenn im Hintergrund gerade etwas anderes auf der Seite aktualisiert wurde – das Menü schloss sich dann, ohne die angetippte Option zu übernehmen. Betraf Browser und App gleichermaßen

## 12.10.2026 – Barcode: fremde Sprachfassungen und Schriften
- Produktnamen wie „Call Of Duty: Modern Warfare 3 (ps3, 2011) Russian Version, Русская Версия“ werden jetzt zu „Call Of Duty: Modern Warfare 3“ – Angaben wie „Russian/French/US Version“ und Text in kyrillischer, griechischer oder asiatischer Schrift fallen weg
- Außerdem entfernt: Sprachkürzel wie „En/ger“, Floskeln wie „Great Value“ oder „Boxed“, einzelne Rest-Buchstaben („Modern Warfare U“) und ein Hersteller, der erst nach der Plattform vorne steht („Ps3 / Sony Playstation 3 Game - Call Of Duty: Ghosts“)
- Zustandsangaben aus Verkaufstiteln fallen weg („…, Cib, Top, Very Good“, „Like New“, „In Good Condition“) – „Top“ nur als eigene Angabe, „Top Spin“ bleibt
- Steht vor dem eigentlichen Namen ein Kürzel und danach der Name noch einmal („Call Of Duty-activ Call Of Duty Black Ops“), zählt nur der wiederholte Name
- Findet der volle Name nichts, sucht ZockerDB als Nächstes bis zur Fortsetzungsnummer („… Modern Warfare 3“) statt gleich nur nach den ersten Wörtern

## 12.10.2026 – Barcode: „Region 2“ und Händlerkürzel stören nicht mehr
- Produktnamen wie „Call of Duty MODERN WARFARE 2 PlayStation 3 PS3 Game UK Version Region 2 VGC“ werden jetzt sauber zu „Call of Duty Modern Warfare 2“ – vorher blieb „Region 2 VGC“ hängen, und es kamen nur andere Call-of-Duty-Teile als Vorschlag

## 12.10.2026 – Fassung: Platinum, Essentials & Co. auswählen
- Beim Erfassen eines Spiels gibt es unter der Plattform jetzt die Auswahl „Fassung“: Erstauflage oder die üblichen Neuauflagen der Plattform – z. B. Platinum und Essentials (PS3, PSP), Platinum (PS1, PS2), PlayStation Hits (PS4), Classics (Xbox, Xbox 360), Player's Choice (GameCube) und Nintendo Selects (Wii, Wii U, 3DS)
- Das klappt auch, wenn für das Spiel noch keine Varianten gepflegt sind (z. B. „F1 2014“ als Essentials)

## 12.10.2026 – CIB bei Disc-Spielen: Inlay immer mit angekreuzt
- Wählst du bei einem neuen Disc-Spiel (z. B. PS3, PS4) „CIB“, ist das Inlay jetzt auch dann angekreuzt, wenn du CIB vor der Plattform gewählt hast oder CIB durch Ankreuzen von OVP und Anleitung entsteht
- Auch bei Spielen, deren Plattform aus dem Barcode-Scan stammt (z. B. „PS3“ im Produktnamen), greifen jetzt Inlay bei CIB und „Anleitung gab es nicht“ bei PS4/Switch

## 12.10.2026 – App: Export- und Download-Knöpfe wieder benutzbar
- Mehrere „Herunterladen“-Knöpfe (z. B. Datenauskunft, Sammlungs-Export, Rechnungen, CSV-Exporte im Händler- und Admin-Bereich) zeigten in der App ins Leere statt die Datei zu laden – jetzt öffnen sie die richtige Adresse

## 11.10.2026 – „Fehlt Inlay“ und Suche nach zusammengeschriebenen Titeln
- Neue Vollständigkeit **„Fehlt Inlay“**: Hülle da, aber der Cover-Einleger fehlt. Markierst du in der Beilagen-Liste das Inlay als „fehlt“, wird sie automatisch gesetzt – das Spiel zählt dann nicht mehr als CIB. Beim Wert zählt es wie „Fehlt Anleitung“. Auch der CSV-Import erkennt „ohne Inlay“.
- Die Suche findet Titel auch zusammengeschrieben: „Watchdogs“ findet „Watch Dogs“ – in der Katalogliste, beim Hinzufügen und mit Tippfehlern („Wachdogs“).

## 11.10.2026 – Rechtstexte: Steam
<!-- für: admin -->
- Die Vorlagen für Datenschutzerklärung und Nutzungsbedingungen erwähnen jetzt den Steam-Bibliotheks-Import sowie den Hinweis „ohne Gewähr, keine Verbindung zu Valve“ – das verlangen die Nutzungsbedingungen der Steam Web API
- Bestehende Seiten ändern sich dadurch nicht: bitte unter Administration → Seiten übernehmen und das Land eintragen, in dem die Daten gespeichert werden

## 11.10.2026 – App: Speichern beim Bearbeiten eines Exemplars
- In der App schlug das Speichern einer Änderung an einem bestehenden Exemplar manchmal fehl („Die Eingaben sind unvollständig oder fehlerhaft“), wenn das Titelbild zuvor für die Offline-Ansicht zwischengespeichert worden war – jetzt bleibt das Titelbild in diesem Fall einfach unverändert

## 11.10.2026 – PS4, PS5, Xbox One/Series und Switch: komplett auch ohne Anleitung
- Bei Spielen für PS4, PS5, Xbox One/Series und Switch liegt meist keine gedruckte Anleitung bei. Beim Erfassen steht die Anleitung dort jetzt gleich auf „gab es nicht“ – das Spiel zählt mit OVP trotzdem als **komplett (CIB)**.
- Wählst du bei diesen Plattformen „CIB“, wird die Anleitung nicht mehr als „vorhanden“ eingetragen. Hast du doch eine, tippst du sie in der Beilagen-Liste an.
- Bei Disc-Spielen (PS1 bis PS5, Xbox, GameCube, Wii …) gehört zu „CIB“ jetzt auch das **Inlay** (Cover-Einleger hinter der Folie) – es wird beim Wählen von CIB gleich mit angekreuzt. Ein Inlay mit „gab es nicht“ (z. B. bei Steelbooks) bleibt so.

## 11.10.2026 – Barcode: bessere Erkennung von Titel und Plattform
- Liefert die Barcode-Datenbank einen Produktnamen wie „Electronic Arts - Plants Vs Zombies 2 Ps-4 Garden Warfare 2 [de-version]“, wird jetzt der Hersteller vor dem Titel entfernt und „Ps-4“ bzw. „PS 4“ als PlayStation 4 erkannt. Vorher suchte die App nach „Electronic Arts“ und fand das Spiel nicht.
- „2K Games“ im Produktnamen wird nicht mehr als PlayStation gelesen.
- Verkäufer-Werbung im Produktnamen („Highly Rated Ebay Seller Great Prices“) wird entfernt.
- Steht der Hersteller ohne Trenner direkt vor der Plattform („Bethesda Softworks Ps4 The Elder Scrolls Online“), wird er ebenfalls entfernt.
- Die Plattform-Auswahl ist erst bedienbar, wenn die Plattformliste geladen ist – vorher konnte sich die Auswahl auf dem iPhone schließen und wieder auf „Plattform wählen“ springen.
- Die Plattform aus dem Barcode wird nur noch übernommen, wenn das gewählte Spiel dafür erschienen ist – vorher stand z. B. bei NBA 2K15 nur „PlayStation (PS1)“ zur Wahl.

## 12.10.2026 – Katalogeinträge zuordnen und früher Titel finden
- **Sammlung:** Neuer Filter „Nur ohne Katalogeintrag“ zeigt Exemplare, die keinem Eintrag aus dem Katalog zugeordnet sind (oder nur einem eigenen, privaten). Nach einem CSV-Import führt der Link „X Spiele ohne Katalogtreffer ansehen“ direkt dorthin; die Umzugsanleitung für CLZ Games erklärt es.
- **Exemplar:** Im Menü „Anderen Katalogeintrag wählen …“: Katalogsuche, die Auswahl ersetzt die Verknüpfung (die Ausgabe wird zurückgesetzt, alle deine Angaben bleiben). Hat das Exemplar einen Barcode, merkt sich ZockerDB künftig den neuen Eintrag; die alte Zuordnung deines Barcodes entfällt – auch beim normalen Bearbeiten. Dein bisheriger eigener, privater Eintrag wird gelöscht, wenn ihn nichts mehr braucht.
- **Katalog:** Wird ein Eintrag umbenannt, bleibt der bisherige Titel erhalten: Die Suche findet ihn weiter, und die Katalogseite zeigt klein „auch bekannt als …“.

## 11.10.2026 – Merch: Figuren, Funko Pops und Sammlerstücke
- Neuer vierter Typ **Merch** (🧸, „Merch & Sammlerstücke“) neben Spiel, Konsole und Zubehör: für Funko Pops, Amiibo und andere Spielfiguren, Statuen, Bücher, Soundtracks, Kleidung und Promo-Material.
- Jeder Merch-Artikel hat eine **Kategorie**; in der Sammlung erscheinen beim Filter „Merch“ passende Kategorie-Chips, die Statistik zeigt „Merch nach Kategorie“.
- Statt Zustand und Vollständigkeit gibt es die **Verpackung** (OVP ungeöffnet, OVP geöffnet, lose); Beilagen sind Sockel, Zertifikat, Karte/Code und Anleitung. Eine Plattform brauchst du nicht.
- Optional verknüpfst du Merch mit einem **Spiel aus dem Katalog** („gehört zu …“), dazu „Nummer“ (z. B. Funko #123) und „Edition“ (Exclusive, Chase, Glow, limitiert).
- CSV-Export/-Import, Backup und Sync kennen Merch und seine Kategorie.

## 11.10.2026 – Lieferumfang je Ausgabe
- Zu einer Ausgabe (z. B. „Special Edition“) kann der **Lieferumfang** hinterlegt sein: Auf der Spieleseite steht bei der Ausgabe z. B. „Lieferumfang: Steelbook, Artbook, Schuber, 2 Discs, DLC-Code“
- Fehlt er, kannst du ihn bei der Ausgabe vorschlagen – auf Wunsch mit einem Foto der Beilagen (nur die Moderation sieht es, es wird nach der Entscheidung gelöscht). Das Moderationsteam bestätigt oder ändert den Vorschlag
- Wählst du beim Hinzufügen oder Bearbeiten eines Exemplars diese Ausgabe, zeigt die Beilagen-Checkliste genau diese Punkte sofort an; „Alles aus dem Lieferumfang ist vorhanden“ hakt alles in einem Tipp ab
- „Vollständig (CIB)“ heißt dann: OVP, Anleitung (oder „gab es nicht“) und alles aus dem Lieferumfang ist da – sonst steht am Exemplar z. B. „Unvollständig – Artbook fehlt“. Ohne Lieferumfang bleibt alles wie bisher
<!-- für: moderation -->
- Moderation → Varianten: Vorschläge zum Lieferumfang prüfen, vor dem Übernehmen ändern oder ablehnen; in Varianten, die du selbst anlegst oder bearbeitest, trägst du den Lieferumfang direkt ein

## 11.10.2026 – Modellnummern und Inlay bei Sonderausgaben
- Modellnummern findet die Suche in deiner Sammlung jetzt auch ohne Bindestrich oder Leerzeichen („CUSA24706“ findet „CUSA-24706“)
- Mehrere Discs mit unterschiedlichen Nummern: einfach mit Komma trennen (z. B. „CUSA-24705, CUSA-24706“) – beide werden gefunden, auch beim Stapel-Scan
- Ist das Inlay als „gab es nicht“ markiert (z. B. Steelbook-Ausgaben ohne Cover-Einleger), wird kein Inlay-Zustand mehr abgefragt

## 11.10.2026 – Beilagen von Sonderausgaben
- Bei Spielen gibt es in der Beilagen-Checkliste jetzt „＋ Sonderausgabe“: Schuber / Sammlerbox, zweite Disc / Data Disc, Artbook, Download-/DLC-Code (unbenutzt), Soundtrack, Figur / Statue sowie Sticker, Pins & weitere Extras
- Bei normalen Spielen bleiben diese Punkte eingeklappt; sobald einer erfasst ist, sind sie immer sichtbar
- Wie bei den anderen Beilagen: vorhanden, fehlt, gab es nicht – mit Anzahl (z. B. zwei Discs)

## 11.10.2026 – Katalogsuche verzeiht Tippfehler
- Die Suche auf der Katalogseite findet Titel jetzt wie beim Hinzufügen: Wörter in beliebiger Reihenfolge, Apostrophe egal („Assassins Creed“ findet „Assassin's Creed“), römische Zahlen wie Ziffern („Final Fantasy 7“)
- Gibt es keinen genauen Treffer, sucht ZockerDB mit Tippfehlern weiter („Asasins Creed“, „Tetirs“) und zeigt „Keine genauen Treffer – ähnliche Titel“ – auch beim Hinzufügen
- Titel, die mit dem Suchbegriff beginnen, stehen oben

## 11.10.2026 – E-Mails mit Cover
- Benachrichtigungen per E-Mail zeigen jetzt das Cover des Spiels, um das es geht (z. B. bei Fotos, Regionsvorschlägen oder Hinweisen zu einem Exemplar)

## 10.10.2026 – Exemplare übernehmen korrigierte Spieltitel
- Wird der Titel eines Katalogeintrags geändert – etwa der deutsche Titel nachgetragen („Landwirtschafts-Simulator 19“ statt „Farming Simulator 19“) –, bekommen deine Exemplare den neuen Titel automatisch
- Exemplare, die du selbst umbenannt hast, behalten ihren Namen

## 09.10.2026 – Update-Prüfung erkennt selbst gebaute Images
<!-- für: admin -->
- Wer das Docker-Image selbst baut und hochlädt, setzt danach das Tag `docker-latest` auf den gebauten Stand – die Update-Prüfung nimmt dann dieses statt des letzten CI-Laufs (siehe README, „Update per Knopf“)
- Einige neuere Versionshinweise hatten kein Datum und fehlten deshalb unter „Neu seit deinem letzten Besuch“ – nachgetragen

## 09.10.2026 – Spieleseite: Plattform wählen
- Gibt es ein Spiel für mehrere Plattformen, steht unter dem Titel eine Leiste mit den Plattformen (z. B. PS4, Xbox One, PC) – ein Tipp wechselt die Plattform, ohne die Seite neu zu laden
- Vorausgewählt ist die Plattform deines eigenen Exemplars, sonst eines deiner Systeme, sonst die erste Konsole (PC nur, wenn es nichts anderes gibt)
- „In deiner Sammlung“ zeigt dann deine Exemplare dieser Plattform; die Auswahl steht in der Adresse und lässt sich teilen oder als Lesezeichen speichern
- Titel, Beschreibung, Bilder, Spielreihe und ähnliche Spiele gelten weiter für alle Plattformen

## 09.10.2026 – Hinzufügen: Plattformauswahl nach der Zuordnung des Servers
- Beim Hinzufügen eines Spiels aus dem Katalog stehen jetzt die Plattformen zur Wahl, die der Server dem Katalogeintrag fest zugeordnet hat (z. B. PS4 und Xbox One bei NBA 2K16) – vorher wurde aus den Plattformnamen geraten, wodurch z. B. die PS1 vorgeschlagen werden konnte und die richtige Konsole erst unter „Andere Plattform …“ stand
- `GET /api/katalog/:id` liefert dazu `plattform_ids`

## 09.10.2026 – Spieleseite: Plattform immer sichtbar
- Ist eine Plattform aus IGDB (z. B. „PlayStation VR2“) noch keiner festen Plattform zugeordnet, steht ihr Name trotzdem unter dem Titel – vorher stand dort dann gar keine Konsole

## 09.10.2026 – „Foto hinzufügen“ ohne eigenes Exemplar führt nicht mehr ins Leere
- Von der öffentlichen Spieleseite aus („Fotos gesucht … 📷 Foto hinzufügen“): ohne Anmeldung erscheint jetzt „Anmelden oder kostenlos registrieren, um Fotos beizutragen“ – nach der Anmeldung geht es automatisch zurück zum Spiel
- Angemeldet, aber ohne eigenes Exemplar: Knopf „Zur Sammlung hinzufügen und Foto beitragen“; nach dem Hinzufügen fragt ZockerDB wie gewohnt nach dem ersten fehlenden Foto

## 09.10.2026 – Katalog: Plattformnamen vollständig, Sammlung ohne Terminleiste
- Im Katalog werden lange Plattformnamen („Nintendo Entertainment System“) nicht mehr abgeschnitten, sondern vollständig umbrochen
- Die Leiste „Erscheint demnächst“ auf der Sammlungsseite entfällt – der Releasekalender bleibt unter „Mehr“ bzw. „Kalender“ erreichbar
- In der App springt der Cursor beim Öffnen von „Hinzufügen“ nicht mehr automatisch ins Suchfeld, die Tastatur verdeckt die Seite nicht mehr

## 09.10.2026 – Hinweis zur Quelloffenheit präzisiert
- In den Einstellungen heißt es jetzt: „Die Grundversion ZockerDB Basis ist quelloffen auf GitHub …“ – vorher klang es, als sei alles quelloffen

## 09.10.2026 – Fehlermeldungen mit Systemversion und Browser
- „Gemeldet aus“ nennt jetzt zusätzlich die Systemversion und den Browser, z. B. „App (iOS) · iPhone · iOS 18.6.2“, „Browser · Android 14 · Chrome“ oder „Browser · Windows 10/11 · Edge“
- Die Version stammt aus der Browser-Kennung; Safari meldet sie ab iOS 26 teils nicht mehr genau

## 09.10.2026 – „Ideen & Wünsche“ heißt jetzt „Ideen & Fehler melden“
- Menüpunkt, Seitentitel und Formular sprechen auch Fehlermeldungen an („Idee oder Fehler melden“); Ablauf, Abstimmung und GitHub-Issues bleiben gleich

## 09.10.2026 – Ideen & Fehlermeldungen: wo gemeldet wird automatisch mitgeschickt
- Beim Einreichen einer Idee oder eines Fehlers wird automatisch mitgeschickt, woher die Meldung kommt – z. B. „App (iOS) · iPhone“, „App (Android) · Android“, „Homescreen-App · iPhone“ oder „Browser · Windows“. Das Formular zeigt die Angabe vor dem Absenden an
- Sichtbar nur für Einreichende und die Administration; im GitHub-Issue steht sie als „Gemeldet aus: …“ (weiterhin ohne Namen)
- Datenbank: Migration 52 (`ideen.umgebung`)

## 08.10.2026 – Anmeldeseite in der App: Abstand zur Statusleiste, Tastatur bleibt zu
- Anmeldeseite und die Seiten aus Passwort-Links halten in der App und als Homescreen-App Abstand zu Statusleiste und Home-Balken – Titel und Fußzeile liegen nicht mehr darunter
- In der App klappt die Tastatur auf diesen Seiten nicht mehr von selbst auf; im Browser bleibt das Feld wie gewohnt vorausgewählt
- Die App startet schneller: Anmeldung und Sammlung erscheinen sofort aus dem Speicher des Geräts, der Stand vom Server folgt im Hintergrund

## 07.10.2026 – Sicherheitsprüfung: Uploads, Drosseln, Admin-Schutz
- Hochgeladene Bilder werden jetzt am Inhalt erkannt, nicht mehr am gemeldeten Dateityp – eine als „Bild“ getarnte andere Datei wird abgelehnt (Bibliothek sharp aktualisiert)
- Belegfotos zu eigenen Katalogvorschlägen zählen zum Speicherplatz
- Katalogsuche, Barcode-Abfrage und Releasekalender sind je Benutzer gedrosselt (120 bzw. 30 Anfragen je Minute); Leihen an andere Sammler höchstens 20 je Stunde
- Läuft die Sitzung ab, werden Zwischenspeicher und gemerkte Anmeldung im Browser geleert – wie beim Abmelden
<!-- für: admin -->
- Passwort setzen oder 2FA zurücksetzen bei einem anderen Administrator verlangt jetzt das eigene Passwort (und den 2FA-Code, falls aktiv)
- Fotos aus dem Sync mit zockerdb.de werden wie eigene Uploads geprüft und neu kodiert; Antworten sind auf 10 MB begrenzt

## 07.10.2026 – Sammlung: Ausgabe unter dem Titel, Produktnummer nicht mehr abgeschnitten
- Spiele, deren Katalogtitel eine Ausgabe enthält (z. B. „Horizon Zero Dawn: Complete Edition“), erscheinen in der Sammlung als „Horizon Zero Dawn“ mit „Complete Edition“ darunter – wie eine selbst erfasste Edition
- Edition, Farbe und Produktnummer (z. B. „DAY ONE Edition · CUSA-07408“) werden umbrochen statt abgeschnitten

## 07.10.2026 – Angemeldete Geräte im Konto
- Unter Konto → Sitzungen siehst du jetzt, auf welchen Geräten du angemeldet bist – mit Browser bzw. App, Anmeldedatum und letzter Nutzung. Ein verlorenes oder unbekanntes Gerät meldest du dort einzeln ab.

## 07.10.2026 – Rückfrage vor dem Verlassen ungespeicherter Eingaben
- Hast du im Formular zum Hinzufügen oder Bearbeiten etwas eingegeben (z. B. nach einem Barcode, der nicht gefunden wurde), fragt die App beim Zurück-Knopf, bei der Wischgeste, bei „Abbrechen“ und beim Neuladen nach, ob du die Seite wirklich ohne Speichern verlassen willst. Ohne Eingaben gibt es keine Rückfrage.

## 07.10.2026 – Leere Hüllen: Fotos beitragen ohne Sammlungseintrag
- Exemplare mit Vollständigkeit „Nur OVP“ gelten jetzt als leere Hülle bzw. Verpackung ohne Spiel. Sie zählen nicht mehr zur Sammlung, zum Sammlungswert, zu Statistiken und Erfolgen und erscheinen nicht in geteilten Sammlungen. Bestehende Einträge wurden umgestellt.
- Du findest sie in der Sammlung über den Filter „Leere Hüllen“. Fotos lassen sich dort wie gewohnt hochladen und mit der Community teilen.
- Neu auf der Spieleseite: „Nur eine leere Hülle? Fotos beitragen, ohne Sammlungseintrag“.
- Wird später doch das Spiel ergänzt (andere Vollständigkeit), wandert das Exemplar automatisch zurück in die Sammlung.

## 07.10.2026 – Erinnerung an fehlende Zustandsbewertungen
- Höchstens einmal pro Woche gibt es eine Mitteilung wie „5 Exemplare ohne Zustandsbewertung“, und nur, wenn seit der letzten Erinnerung welche dazugekommen sind. Wer „Zustand der Hülle / OVP“ im Konto ausgeblendet hat, wird dazu nicht erinnert.
- Neuer Filter in der Sammlung: „Nur ohne Zustandsbewertung“. Der Link in der Mitteilung führt direkt dorthin.
- Abschaltbar unter Konto → Benachrichtigungen, Kategorie „Sammlungspflege“.

## 07.10.2026 – Inlay, Schutzhülle und Steelbook
- Die Beilage „Inlay / Schutzhülle“ heißt jetzt passend zur Plattform: bei Disc-Spielen „Inlay / Cover-Einleger“, bei Modul-Spielen „Schutzhülle / Einsatz“. Bestehende Angaben bleiben erhalten.
- Neu bei Disc-Spielen: eigener „Zustand Inlay (Cover-Einleger)“ und typische Mängel zum Antippen (eingerissen, Wasserschaden, verblichen, beschriftet, Aufkleber, geknickt, Kopie). Die Bewertungshilfe erklärt auch die Stufen fürs Inlay. Das Feld lässt sich im Konto ausblenden.
- Neue Beilage „Steelbook“.

## 07.10.2026 – Fotos aus Apple Fotos, Early Access, Menüleiste auf dem iPhone
- Foto-Upload: Fotos werden vor dem Hochladen vollständig gelesen. Liegt ein Foto nur in iCloud oder bricht die Übertragung ab, erscheint eine verständliche Meldung statt „Interner Serverfehler“. HEIC-Fotos wandelt der Browser – wenn er es kann – vor dem Hochladen in JPEG um.
- Spiele im Early Access (z. B. Enshrouded) bekommen als Erscheinungsjahr das Jahr der Vollversion, sobald IGDB es kennt. In den Erscheinungsterminen ist der Early-Access-Termin gekennzeichnet.
- iPhone: Bleibt die Ansicht nach dem Schließen der Tastatur verschoben, repariert sie die nächste Berührung. Die Messanzeige zählt zusätzlich, wie oft repariert wurde.

## 06.10.2026 – Katalogsuche: Suchfeld bleibt beim Tippen aktiv
- Das Suchfeld im Katalog verlor nach jedem Buchstaben den Fokus, sobald neue Treffer geladen wurden. Jetzt bleibt es aktiv; die Seite springt beim Tippen auch nicht mehr nach oben.

## 04.10.2026 – Hilfe zur Zustandsbewertung
- Im Formular eines Exemplars gibt es unter den Zustandsfeldern „ⓘ Wie bewerte ich den Zustand?“. Aufgeklappt zeigt es für jede Stufe (Neu/OVP bis Defekt), woran man sie bei Disc/Modul bzw. Gerät und bei Hülle/OVP erkennt. Die gewählten Stufen sind hervorgehoben.

## 04.10.2026 – Suche: Serverfehler bei Titeln wie „Constructor“ behoben
<!-- für: admin|moderation -->
- Suchbegriffe, die zufällig wie interne JavaScript-Namen heißen (z. B. „Constructor“ beim Spiel „Constructor Plus“), führten bei der Suche und beim Barcode-Scan zu „Interner Serverfehler“. Sie werden jetzt wie normale Wörter behandelt.

## 04.10.2026 – Barcode: Produktnamen mit Versandfloskeln besser bereinigt
<!-- für: admin|moderation -->
- Händlernamen wie „Playstation 4 : Battlefield 4 [german Version] Videogames Free Shipping, Save £s“ werden jetzt zu „Battlefield 4“. Entfernt werden zusätzlich „Videogames“, „Free Shipping“, „Save £…“, Währungszeichen und übrig gebliebene Kommas.

## 04.10.2026 – Weniger E-Mails bei Foto-Freigaben
<!-- für: admin|moderation -->
- Für gesammelte Meldungen (z. B. „3 deiner Fotos wurden freigegeben“) gibt es höchstens eine E-Mail bzw. Push-Nachricht pro Tag, auch wenn die vorige Meldung schon gelesen wurde. In der App erscheinen weitere Freigaben trotzdem.

## 04.10.2026 – Keine Foto-Bitte „Beilagen“ wegen des Inlays
- „Inlay / Schutzhülle“ löst kein Foto „Beilagen“ mehr aus – das Inlay ist das Cover und steckt schon in den Fotos der Verpackung
- Andere Beilagen (Poster, Registrierkarte, Werbebeilagen …) fragen weiterhin nach einem Foto

## 04.10.2026 – Bessere Vorschläge nach dem Scannen
- Verkaufsfloskeln aus Händlertiteln werden entfernt („Brand New and Sealed“, „In Stock“, „Quick Dispatch“, „Free UK Delivery“ …)
- Ans Wort gehängte Zahlen werden getrennt („Xxl2“ → „XXL 2“), notfalls wird mit den ersten Wörtern des Titels gesucht – so gibt es auch bei ungewöhnlichen Händlertiteln Vorschläge

## 04.10.2026 – Beilage „gab es nicht“
- In der Beilagen-Liste gibt es einen vierten Zustand: Antippen wechselt zwischen vorhanden, fehlt, gab es nicht und keine Angabe
- Viele PlayStation-Spiele haben keine Anleitung – „Anleitung: gab es nicht“ zählt trotzdem als komplett (CIB) und es wird kein Foto der Anleitung erbeten
- Am Exemplar steht dann „– Anleitung (nicht beigelegt)“

## 04.10.2026 – Menüleiste: hängengebliebene Tastatur-Ansicht
- Auf dem iPhone blieb die Ansicht nach einem Seitenwechsel manchmal so, als wäre die Tastatur noch offen – die Menüleiste stand dann mitten im Bild
- Die App erkennt diesen Zustand jetzt (verkleinerte Ansicht, aber kein Eingabefeld aktiv) und stellt die Ansicht nach einem Augenblick selbst wieder her

## 04.10.2026 – Vollständigkeit „Mit Schutzhülle (ohne Karton)“
- Neue Auswahl bei der Vollständigkeit – z. B. für Game-Boy-Module in der Plastik-Schutzhülle, deren Karton fehlt
- Für den geschätzten Wert zählt sie wie „Nur Gerät/Disc/Modul“
- Die Beilagen-Checkliste passt sich an (OVP fehlt, Inlay/Schutzhülle vorhanden) und umgekehrt
- Der CSV-Import erkennt Angaben wie „mit Schutzhülle“ oder „ohne Karton“

## 04.10.2026 – Plattform-Vorschläge nachträglich ändern
- Beim Vorschlagen einer Plattform stehen deine offenen Vorschläge darunter und lassen sich bearbeiten, bis sie angenommen oder abgelehnt sind
- Selbst gehostet geht die Änderung auch an zockerdb.de
- Eigene Katalogeinträge und Varianten ließen sich schon bisher bis zur Freigabe ändern

## 04.10.2026 – Ideen nachträglich bearbeiten
- Eigene Ideen unter „Ideen & Wünsche“ lassen sich jetzt bearbeiten (Titel, Beschreibung, Bereich) – solange sie noch nicht umgesetzt oder abgelehnt sind
- Selbst gehostet geht die Änderung auch an zockerdb.de; ist die Idee als GitHub-Issue veröffentlicht, werden Titel und Text dort mit angepasst

## 03.10.2026 – Fußleiste bleibt unten
- In der installierten App auf dem iPhone rutschte die Menüleiste manchmal in die Bildmitte und die Kopfleiste verschwand – etwa nach dem Tippen in ein Feld, nach dem Schließen einer Bildansicht oder beim Zurückkehren in die App
- Die Ansicht wird in diesen Fällen jetzt zuverlässig zurückgesetzt; kleine Auswahl- und Eingabefelder lösen kein automatisches Hineinzoomen mehr aus

## 03.10.2026 – Genauere europäische Fassungen
- Neben „PAL (DE)“ und „PAL (EU)“ gibt es jetzt: Österreich/Schweiz, UK, Frankreich, Benelux, Spanien/Portugal, Italien und Skandinavien – Fassungen unterscheiden sich oft bei Sprachen, Cover und Alterskennzeichen
- Der Filter „PAL (EU)“ findet weiterhin alle europäischen Fassungen, auch die genaueren
- Beim CSV-Import werden Angaben wie „UK“, „Benelux“ oder „Österreich“ erkannt
- Belegte Sprachen gelten je Fassung – die Benelux- und die UK-Fassung eines Spiels stehen getrennt

## 03.10.2026 – Fotos in der App ansehen
- Ein Tipp auf ein Foto oder einen Scan öffnet jetzt eine Bildansicht innerhalb der App – vorher landete man in der installierten App auf der nackten Bilddatei und kam ohne Neustart nicht mehr zurück
- Schließen mit ✕, Tippen neben das Bild oder der Zurück-Geste; mehrere Fotos lassen sich mit ‹ › oder Wischen durchblättern

## 03.10.2026 – Vom Exemplar zur Katalogseite
- Ein Tipp auf das Bild eines Exemplars öffnet die Katalogseite des Spiels (Infos, Sprachen, Fotos, Preise)

## 03.10.2026 – Drucknummer auf dem Cover
- Neues Feld „Drucknummer (Cover)“ bei Spielen – die kleine Nummer auf dem Cover-Rücken, meist unter der CUSA-/SLES-Nummer (z. B. „8826161“); sie unterscheidet Nachdrucke
- Die Modellnummer schlägt bei Spielen jetzt passende Beispiele vor (z. B. „CUSA-03067“)
- Seriennummer und Seriennummer der OVP erscheinen bei Spielen nur noch, wenn schon etwas drinsteht – die gibt es praktisch nur bei Geräten
- Die Drucknummer ist durchsuchbar, im Export enthalten und lässt sich im Konto ausblenden

## 03.10.2026 – „Zurück“ führt zur vorherigen Seite
- Beim Foto-Hochladen lässt sich die Seite jetzt auch über der Bildvorschau scrollen – nur der Zuschnitt-Rahmen reagiert aufs Ziehen
- Der Zurück-Pfeil oben links bringt dich jetzt dorthin, wo du vorher warst – z. B. von einem Spiel zurück zu „Fotos gesucht“ statt zur Sammlung
- Nach dem Speichern eines Artikels landest du mit „Zurück“ nicht wieder im Formular
- Hast du die Seite direkt über einen Link geöffnet, geht es wie bisher zur Sammlung

## 03.10.2026 – Fotos standardmäßig öffentlich zeigen
- Unter „Konto“ → „Fotos beitragen“ lässt sich einschalten, dass neue Fotos standardmäßig auch öffentlich gezeigt werden dürfen (Spieleseite, Google-Bildersuche)
- Beim Hochladen ist das Häkchen dann schon gesetzt – je Foto lässt es sich abwählen; gezeigt wird jedes Foto erst nach der Prüfung
- Die Einstellung ist zunächst aus und gilt auf allen Geräten

## 03.10.2026 – Fotos gesucht: Anleitung statt „Alles zusammen“
- „Alles zusammen (CIB)“ steht nicht mehr in „Fotos gesucht“ – Disc, Verpackung und Beilagen zeigen schon alles (hochladen lässt es sich weiterhin)
- Neu: ein eigenes Foto der Anleitung – gefragt wird nur, wenn bei „Was ist dabei?“ die Anleitung angehakt ist
- Nach einem Beilagen-Foto wird weiterhin nur gefragt, wenn etwas außer Hülle und Anleitung angehakt ist (z. B. Poster, Werbebeilagen)

## 03.10.2026 – Verständlichere Foto-Bezeichnungen
- Das Foto „Komplett (CIB)“ heißt jetzt „Alles zusammen (CIB)“: gemeint ist ein Foto von Hülle, Disc bzw. Modul und Anleitung zusammen
- Beim Foto „Beilagen“ schlägt die Bezeichnung jetzt vor, je Beilage ein eigenes Foto zu machen (z. B. „Club-Nintendo-Katalog 1998“)

## 03.10.2026 – Sprachen der Spiele
- Auf der Seite eines Spiels steht jetzt, in welchen Sprachen es Sprachausgabe, Untertitel und Menüs gibt – Deutsch und Englisch zuerst
- Im Katalog und in der Sammlung (Filter) lässt sich nach „Deutsche Sprachausgabe“, „Deutsche Texte/Untertitel“ oder „Irgendetwas auf Deutsch“ filtern
- Am Exemplar steht kurz, was auf Deutsch dabei ist
- Die Angaben stammen von IGDB und gelten fürs Spiel insgesamt – einzelne Fassungen (z. B. PAL/NTSC) können abweichen

## 03.10.2026 – Preisgeschichte am Exemplar
- Neu beim Kauf: „Gekauft bei/auf“ (Laden, Online-Shop, eBay, Kleinanzeigen, Flohmarkt …)
- Neu: „Erstkauf laut Beleg“ – z. B. vom Kassenbon des Vorbesitzers: Neupreis, Datum und Händler
- Auf der Detailseite zeigt die „Preisgeschichte“ alles als Zeitstrahl: neu gekauft, von dir gekauft, verkauft, heutige Schätzung – mit Veränderung in Prozent
- Alles bleibt privat: nicht für Freunde, nicht im geteilten Link; im Datenexport enthalten
- Bei den Beilagen lässt sich jetzt aufschreiben, welche es genau sind (z. B. „Club-Nintendo-Katalog 1998, Poster“)

## 03.10.2026 – Zustand von Disc und Hülle getrennt, Felder ausblenden
- Neben dem Zustand von Disc, Modul bzw. Gerät lässt sich jetzt der Zustand der Hülle bzw. OVP getrennt angeben – oft ist die Disc gut, die Hülle nicht
- Unter „Konto“ → „Zusätzliche Felder“ → „Felder beim Eintragen ausblenden“ lassen sich Felder abschalten, die man nie braucht (z. B. Seriennummer, Modellnummer, Barcode)
- Ein ausgeblendetes Feld erscheint trotzdem, wenn bei einem Exemplar schon etwas darin steht

## 03.10.2026 – Vollständigkeit und Beilagen hängen zusammen
- Die Beilagen-Liste steht jetzt direkt unter „Vollständigkeit“ (wenn das Zusatzfeld eingeschaltet ist)
- „CIB“ hakt OVP und Anleitung gleich mit an, „Fehlt Anleitung“ markiert die Anleitung als fehlend usw. – nur noch ergänzen, was sonst dabei ist
- Umgekehrt stellt die Beilagen-Liste die Vollständigkeit passend ein (OVP + Anleitung = CIB)

## 03.10.2026 – Fehlertolerante Suche
- Die Suche findet Titel jetzt auch mit fehlendem Apostroph, in anderer Wortreihenfolge und mit Ziffern statt römischer Zahlen: „assassins black flag“ findet „Assassin's Creed IV Black Flag“, „final fantasy 7“ auch „Final Fantasy VII“
- Gilt für den eigenen Katalog und die Online-Suche (findet IGDB nichts, wird wortweise nachgesehen)

## 03.10.2026 – Fotos: Zuschnitt, eingeschweißte Spiele, Beilagen
- Nach der Fotoauswahl lässt sich das Format wählen (Original, 1:1, 4:3, 3:4) und der Ausschnitt mit dem Finger verschieben – für Discs ist 1:1 voreingestellt
- Eingeschweißte Spiele (Zustand „Neu/OVP“): Es wird nur noch nach Fotos der Verpackung gefragt, nicht nach Disc, Modul oder Inhalt
- Beilagen lassen sich zählen (+ / −), z. B. „3× Werbebeilagen“; mit zusätzlichen Beilagen wird ein Foto „Beilagen (was drin ist)“ vorgeschlagen
- „Nicht mehr fragen“ bei der Foto-Nachfrage nach dem Hinzufügen gilt jetzt fürs ganze Konto und lässt sich unter „Konto“ → „Fotos beitragen“ wieder einschalten

## 03.10.2026 – Menü „Weitere Aktionen“ im Bild
- Auf schmalen Handys ragte das Menü „Weitere Aktionen“ auf der Detailseite eines Exemplars links aus dem Bildschirm – es klappt jetzt in die Richtung auf, in der Platz ist

## 03.10.2026 – Barcode-Scanner deutlich schneller
- Neue Erkennung: auf Android die eingebaute des Browsers, auf dem iPhone und in anderen Browsern ein schneller Decoder (ZXing) – statt des bisherigen, langsamen
- Höhere Kameraauflösung, Dauer-Autofokus (wo das Gerät es kann) und gelesen wird nur der Bereich im Rahmen
- Neuer Knopf „Licht an“ für dunkle Ecken, sofern das Handy eine Taschenlampe hat
- Jeder gelesene Code wird anhand der Prüfziffer kontrolliert – Fehllesungen werden verworfen

## 03.10.2026 – Neu seit deinem letzten Besuch
- Nach einem Update zeigt ZockerDB beim nächsten Öffnen kurz, was sich für dich geändert hat – nur Punkte, die Sammler betreffen
- „Alles klar“ blendet die Hinweise aus, „Später“ zeigt sie beim nächsten Mal wieder

## 03.10.2026 – Exemplare als privat markieren
- Beim Bearbeiten eines Exemplars gibt es den Schalter „Privat – nur für mich sichtbar“
- Private Exemplare erscheinen nicht im geteilten Sammlungslink (auch nicht im angezeigten Wert) und zählen nicht in der anonymen Datenspende an zockerdb.de
- In der eigenen Sammlung und auf der Detailseite zeigt ein Schloss, was privat ist
- Die Markierung wird beim Abgleich mit dem zockerdb.de-Konto mit übertragen und ist im Datenexport enthalten

## 02.10.2026 – Kopfleiste am Desktop aufgeräumt
- Bei mittleren Fensterbreiten schob sich die Menüleiste über den Schriftzug oben links – jetzt stehen die Menüpunkte erst ab ausreichender Breite mit Text, sonst als Symbole

## 02.10.2026 – Benachrichtigungen selbst auswählen
- Unter „Konto“ → „Benachrichtigungen“ legst du je Bereich fest, ob du in der App, per E-Mail oder per Push informiert wirst – z. B. Verleih-Erinnerungen nur in der App, geprüfte Beiträge auch per E-Mail
- Wichtige Hinweise zu Konto und Sicherheit bleiben in der App immer an
- Der E-Mail-Schalter bei der E-Mail-Adresse bleibt der Hauptschalter; voreingestellt ist wie bisher alles an

## 02.10.2026 – Gut zu wissen
- Unter „Mehr“ steht bei „Hilfe & Touren“ jetzt kurz, warum alle Texte im generischen Maskulinum geschrieben sind

## 02.10.2026 – Fotografen bleiben anonym
- An geteilten Fotos (Modul, Disc, Verpackung …) steht der Name des Fotografen nur noch, wenn er beim Hochladen „Namen nennen“ gewählt hat – bei Scans wie bisher

## 02.10.2026 – Kurzlink /mitmachen für Flyer und QR-Codes
<!-- für: admin -->
- Neue Adresse `/mitmachen`: führt zur Registrierung, solange sie offen ist – sonst direkt zum Formular „Zugang anfragen“ (ist auch das abgeschaltet, zur Anmeldung)
- Ideal für Flyer: der QR-Code bleibt gültig, egal ob die Registrierung gerade offen oder geschlossen ist

## 02.10.2026 – Unbekannter Barcode: direkt suchen und zuordnen
- Kennt ZockerDB einen gescannten Barcode noch nicht, steht das Suchfeld jetzt direkt in der Barcode-Karte – die Treffer erscheinen gleich darunter, ohne nach oben zu scrollen
- Hat der Barcode-Dienst einen Produktnamen geliefert, aber nichts Passendes gefunden, steht der Name schon im Suchfeld zum Nachbessern
- „Eigenen Eintrag anlegen“, „Titel vorschlagen“ und „Plattform fehlt?“ sind darunter als kleine Links erreichbar

## 02.10.2026 – Betreiber in der Fußzeile jeder E-Mail
<!-- für: admin -->
- Unten in jeder E-Mail stehen jetzt der Betreiber (Name, Anschrift, Kontakt-E-Mail) und Links zu Impressum und Datenschutz
- Die Angaben kommen automatisch aus dem Impressum (Abschnitt „Angaben gemäß § 5 DDG“ und die E-Mail unter „Kontakt“); solange dort noch Platzhalter in [eckigen Klammern] stehen, bleibt die Zeile weg
- Eigene Fassung möglich unter Einstellungen → E-Mail (SMTP) → „Betreiber in der Fußzeile“
- Die Links brauchen die öffentliche Adresse (PUBLIC_URL)

## 01.10.2026 – Zugang anfragen bei geschlossener Registrierung
<!-- für: admin -->
- Ist die Registrierung geschlossen, zeigt die Anmeldeseite kurz, was dich erwartet (Barcode-Scanner, Varianten, Fotos & Scans, Erfolge …), und darunter „Zugang anfragen“: E-Mail-Adresse, optional Name und Nachricht – mit Spam-Schutz
- Administratoren bekommen eine Benachrichtigung und finden die Anfragen unter Administration → Benutzer; „Einladen“ verschickt einen Einladungslink an die Adresse (ohne E-Mail-Versand gibt es den Link zum Weitergeben)
- Anfragen werden nach 90 Tagen automatisch gelöscht; die Datenschutz-Vorlage erklärt das
- Abschaltbar unter Einstellungen → Konten & Sicherheit („Zugang anfragen bei geschlossener Registrierung“)

## 01.10.2026 – Fotos als WebP, Scans in voller Auflösung
- Fotos (Artikelfoto, Modul, Disc, Verpackung …) werden als WebP gespeichert und auf höchstens 2.560 Pixel an der langen Seite verkleinert – ein Handyfoto braucht meist unter 1 MB statt 4–8 MB, am Bildschirm ohne sichtbaren Unterschied
- Scans von Cover und Anleitung bleiben unverändert in Originalformat und voller Auflösung (nur ohne Metadaten) – zum Drucken und Archivieren
- Neue Einstellung unter Uploads & Speicher: „Fotos verkleinern auf (Pixel, lange Seite)“ – 0 = Originalgröße (trotzdem WebP)
- Beim Herunterladen passt die Dateiendung zum gespeicherten Format

## 01.10.2026 – Fassungen der Nutzungsbedingungen
- Jede gespeicherte Änderung der rechtlichen Seiten wird als eigene Fassung aufbewahrt
- Eingereichte Katalogeinträge, Varianten und zur Freigabe eingereichte oder öffentlich erlaubte Dateien merken sich, unter welcher Fassung der Nutzungsbedingungen sie eingereicht wurden
- Kurze Hinweise beim Einreichen: Scans nur teilen, wenn du darfst – es bleibt deine Datei; Fotos bleiben deine Fotos

## 01.10.2026 – E-Mails im dunklen Modus
- Das Logo erscheint klein neben dem Namen statt riesig (verkleinert mitgeschickt, feste Größe auch für Outlook)
- Eigene Farben für den dunklen Modus: Der Knopf bleibt weiß beschriftet und gut lesbar, Mailprogramme färben nicht mehr selbst um
- Der Ersatzlink unter dem Knopf ist anklickbar

## 01.10.2026 – Logo in E-Mails
- E-Mails (Einladung, Passwort vergessen, Bestätigung, Benachrichtigungen) zeigen oben das ZockerDB-Logo – direkt in der Mail eingebettet, damit es auch erscheint, wenn das Mailprogramm externe Bilder blockiert

## 01.10.2026 – Einladungen: gelöschte Konten verschwinden aus der Liste
<!-- für: admin -->
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
<!-- für: admin -->
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
<!-- für: admin -->
- Ist ein Update verfügbar, zeigt Administration → Übersicht, was der neue Stand mitbringt – im Vergleich zu deiner installierten Version
- Die Versionshinweise deines installierten Stands lassen sich jederzeit aufklappen

## 29.09.2026 – Einstellungen übersichtlicher, IGDB-Verbindung testen
<!-- für: admin -->
- Die Gruppen unter Administration → Einstellungen lassen sich einklappen; dein Browser merkt sich, welche offen sind
- Das Änderungsprotokoll ist standardmäßig eingeklappt
- Neuer Knopf „IGDB-Verbindung testen“: prüft Client-ID und Secret mit einer Beispielsuche
- Neuer Katalogstatus „Ausgeblendet“ für Einträge, die die Datenquelle entfernt hat

## 29.09.2026 – Update-Prüfung
<!-- für: admin -->
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
<!-- für: admin -->
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
<!-- für: admin -->
- Gemeinsamer Katalog über zockerdb.de: Suche, gelernte Barcodes, Einreichungen und freiwillige, anonyme Datenspende mit Vorschau
- Sync der Sammlung mit einem zockerdb.de-Konto in beide Richtungen (auch Varianten und gelöschte Fotos)
- Titel vorschlagen und korrigieren, Duplikate erkennen, deutsche Konsolennamen
- Land und Sprache der Spieltexte im Konto

## 27.09.2026 – Bessere Suche
- Erst der eigene Katalog, IGDB nur bei wenigen Treffern oder auf Wunsch seitenweise
- Eine eingetippte EAN wird als Barcode gesucht
- Echte deutsche Titel statt Übersetzungen, Originaltitel bleibt suchbar
