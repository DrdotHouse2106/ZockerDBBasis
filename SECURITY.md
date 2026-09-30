# Sicherheitsrichtlinie

**Sicherheit hat in diesem Projekt einen sehr hohen Stellenwert.** Die Anwendung verwaltet private Sammlungen,
Benutzerkonten und hochgeladene Dateien – deshalb freue ich mich über **jeden Hinweis auf ein Sicherheitsproblem**,
egal wie klein er erscheint.

## Sicherheitslücke melden

Bitte melde Schwachstellen **vertraulich** und **nicht** als öffentliches Issue:

👉 **E-Mail an [security@zockerdb.de](mailto:security@zockerdb.de)**

Hilfreich sind:

- eine kurze Beschreibung der Schwachstelle und ihrer Auswirkungen,
- Schritte zum Nachvollziehen (ggf. mit Beispielanfragen),
- betroffene Version bzw. Commit,
- falls vorhanden: ein Vorschlag zur Behebung.

## Was dich erwartet

- Eine erste Rückmeldung innerhalb weniger Tage.
- Laufende Information über den Stand der Behebung.
- Nach der Veröffentlichung des Fixes nenne ich dich – wenn du möchtest – gern als Entdecker in den Release-Hinweisen.

## Spielregeln

- Teste nur mit eigenen Konten und eigenen Installationen.
- Greife nicht auf fremde Daten zu, verändere oder lösche keine Daten und beeinträchtige den Betrieb nicht (kein DoS, kein Spam).
- Gib Details erst frei, nachdem ein Fix veröffentlicht wurde.

Wer sich an diese Regeln hält, handelt aus meiner Sicht in gutem Glauben – danke für deine Hilfe!

## Unterstützte Versionen

Sicherheitskorrekturen erfolgen für den aktuellen Stand des `main`-Branches. Bitte halte deine Installation aktuell
(`docker compose pull && docker compose up -d`).

## Betreiber einer eigenen Installation

Wenn du die Software selbst betreibst, trage auf der Seite **„Sicherheit“** (Administration → Rechtliches) zusätzlich
eine Kontaktadresse für deine Installation ein und passe `client/public/.well-known/security.txt` an.

Empfehlungen für den Betrieb:

- **Erstes Konto zügig anlegen.** Das erste Konto wird Administrator. Erfolgt die Einrichtung über das Internet oder einen
  Reverse-Proxy, verlangt die App einen Einrichtungscode aus dem Server-Protokoll – trotzdem das Konto direkt nach dem Start anlegen.
- **Hinter einem Reverse-Proxy `TRUST_PROXY` setzen** (z. B. `1`), damit Anmeldeversuche, Sperren und Statistik die echte
  Besucher-IP sehen und Cookies als „secure“ gesetzt werden.
- **Port nur lokal freigeben**, wenn ein Reverse-Proxy davor sitzt (`127.0.0.1:3000:3000`), und HTTPS verwenden.
- **Zwei-Faktor-Anmeldung** für Administratoren nutzen (bei öffentlichem Betrieb für alle: `REQUIRE_2FA`).
- **`geheimnis.key` bzw. `APP_SECRET` sichern und geheim halten** – damit sind 2FA-Geheimnisse und API-Schlüssel verschlüsselt.
- **Aktuell bleiben** (`docker compose pull && docker compose up -d`). Der Container läuft ohne Root-Rechte (Benutzer `node`).

---

<sub>🇬🇧 Security is taken very seriously. Please report vulnerabilities privately via
e-mail to [security@zockerdb.de](mailto:security@zockerdb.de). Thank you!</sub>
