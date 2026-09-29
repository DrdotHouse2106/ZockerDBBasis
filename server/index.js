import { MARKE } from '../shared/marke.js';
import { ladeKonfiguration } from './config.js';
import { erstelleApp } from './app.js';
import { MODULE } from './module.js';

const konfiguration = ladeKonfiguration();
const { app, db, kontext } = erstelleApp(konfiguration);

const server = app.listen(konfiguration.port, konfiguration.host, () => {
  console.log(`🎮 ${MARKE.name} läuft auf http://localhost:${konfiguration.port}`);
  console.log(`   Datenbank: ${konfiguration.datenbankPfad}`);
  console.log(`   IGDB: ${kontext.igdb.konfiguriert ? 'aktiv' : 'nicht konfiguriert (nur eigene Einträge)'}`);
  console.log(`   Barcode-Dienste: ${kontext.barcode.aktiveAnbieter.join(', ') || 'keine'}`);
  console.log(`   Registrierung: ${konfiguration.konten.registrierungOffen ? 'offen' : 'geschlossen'}`
    + ` · 2FA-Pflicht: ${konfiguration.konten.zweiFaktorPflicht ? 'ja' : 'nein'}`);
  for (const modul of MODULE) console.log(`   Modul: ${modul.titel ?? modul.name}`);
  if (kontext.konten.istErsteinrichtung()) console.log('   ➜ Noch kein Konto vorhanden: Das erste registrierte Konto wird Administrator.');
});

// Abgelaufene Cache-Einträge und Sitzungen regelmäßig entfernen.
const aufraeumen = setInterval(() => {
  kontext.cache.raeumeAuf();
  kontext.konten.raeumeAuf();
  kontext.vorschlaege.aufraeumen(); // Fotos entschiedener Vorschläge
}, 6 * 60 * 60 * 1000);
aufraeumen.unref();

// Datenbank-Sicherung: kurz nach dem Start und danach stündlich prüfen, ob die Tagessicherung fehlt.
// Danach sind Zusatzmodule dran (z. B. externe, verschlüsselte Kopie).
const sichern = async () => {
  if (kontext.sicherung.status().aktiv) await kontext.sicherung.lauf().catch((e) => console.warn('[sicherung]', e.message));
  await kontext.erweiterungen.fuehreAus('nach.sicherung').catch((e) => console.warn('[sicherung]', e.message));
};
setTimeout(sichern, 60_000).unref();
setInterval(sichern, 60 * 60 * 1000).unref();

// Verbindung zu zockerdb.de: Katalog-Abgleich, Einreichungen, Datenspende (wöchentlich) und Sync der Sammlungen
const zentraleLauf = async () => {
  await kontext.zentrale.lauf().catch((e) => console.warn('[zockerdb.de]', e.message));
  if (kontext.zentrale.aktiv) await kontext.vorschlaege.pruefePlattformVorschlaege().catch((e) => console.warn('[zockerdb.de]', e.message));
  await kontext.sync.alle().catch((e) => console.warn('[sync]', e.message));
};
setTimeout(zentraleLauf, 2 * 60_000).unref();
setInterval(zentraleLauf, 15 * 60 * 1000).unref();
if (kontext.zentrale.aktiv) console.log(`   Zentraler Katalog: ${kontext.zentrale.url}`);

// Zeitgesteuerte Aufgaben der Zusatzmodule
for (const modul of MODULE) modul.zeitplan?.(kontext);

function beenden(signal) {
  console.log(`${signal} empfangen – Server wird beendet …`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', beenden);
process.on('SIGTERM', beenden);
