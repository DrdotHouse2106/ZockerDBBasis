// „Neu seit deinem letzten Besuch“: Einträge je Rolle, nichts von vor der Registrierung, „gelesen“ merkt sich den Stand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { oeffneDatenbank } from '../server/db.js';
import { erstelleNeuigkeitenDienst } from '../server/services/neuigkeiten.js';
import { leseNeuerungen } from '../server/services/aktualisierung.js';

test('Neuerungen: Zielgruppe aus „<!-- für: … -->“', () => {
  const e = leseNeuerungen('## 01.10.2026 – Für alle\n- a\n\n## 01.10.2026 – Nur Admin\n<!-- für: admin -->\n- b\n');
  assert.deepEqual(e.map((x) => [x.titel, x.fuer, x.punkte]), [['Für alle', null, ['a']], ['Nur Admin', 'admin', ['b']]]);
});

test('Neu seit dem letzten Besuch: je Rolle, ohne Rückblick für neue Konten, gelesen merkt sich den Stand', () => {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'neuigkeiten-'));
  const kern = path.join(ordner, 'kern.md');
  const modul = path.join(ordner, 'modul.md');
  fs.writeFileSync(kern, `# Neuerungen
## 10.10.2026 – Neue Sammlungsansicht
- Kacheln größer
## 09.10.2026 – Update-Knopf
<!-- für: admin -->
- nur für Admins
## 01.08.2026 – Uralt
- zu alt
`);
  fs.writeFileSync(modul, `## 10.10.2026 – Börse schneller
- schneller
## 08.10.2026 – Moderation: neue Liste
<!-- für: moderation -->
- für das Team
`);
  let jetzt = Date.parse('2026-10-11T12:00:00Z');
  const db = oeffneDatenbank(':memory:');
  const dienst = erstelleNeuigkeitenDienst(db, { quellen: [{ datei: kern }, { datei: modul }], jetzt: () => jetzt });
  const lege = (name, rolle, erstellt) => db.prepare("INSERT INTO benutzer (benutzername, passwort_hash, rolle, erstellt_am) VALUES (?, 'x', ?, ?) RETURNING *")
    .get(name, rolle, erstellt);
  const titel = (b) => dienst.offen(db.prepare('SELECT * FROM benutzer WHERE id = ?').get(b.id)).map((e) => e.titel);

  const alt = lege('alt', 'benutzer', '2026-01-01 10:00:00');
  const mod = lege('mod', 'moderator', '2026-01-01 10:00:00');
  const admin = lege('chef', 'admin', '2026-01-01 10:00:00');
  const neu = lege('neu', 'benutzer', '2026-10-10 09:00:00');
  // Ohne Stand: die letzten zwei Wochen, nur für die eigene Rolle, neueste zuerst (Kern vor Modul)
  assert.deepEqual(titel(alt), ['Neue Sammlungsansicht', 'Börse schneller']);
  assert.deepEqual(titel(mod), ['Neue Sammlungsansicht', 'Börse schneller', 'Moderation: neue Liste']);
  assert.deepEqual(titel(admin), ['Neue Sammlungsansicht', 'Börse schneller', 'Update-Knopf', 'Moderation: neue Liste']);
  // Am Registrierungstag erschienene Neuerungen kennt ein neues Konto schon
  assert.deepEqual(titel(neu), []);

  dienst.gelesen(alt.id);
  assert.deepEqual(titel(alt), []);
  // Neuer Stand mit einem weiteren Eintrag: nur der ist neu
  fs.writeFileSync(kern, `## 12.10.2026 – Dunkler Modus\n- schöner\n${fs.readFileSync(kern, 'utf8')}`);
  const dienst2 = erstelleNeuigkeitenDienst(db, { quellen: [{ datei: kern }, { datei: modul }], jetzt: () => (jetzt = Date.parse('2026-10-12T08:00:00Z')) });
  assert.deepEqual(dienst2.offen(db.prepare('SELECT * FROM benutzer WHERE id = ?').get(alt.id)).map((e) => e.titel), ['Dunkler Modus']);
  fs.rmSync(ordner, { recursive: true, force: true });
});
