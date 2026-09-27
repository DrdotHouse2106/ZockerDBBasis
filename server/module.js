// Lädt optionale Zusatzmodule.
//
// Die Basis-Version (öffentliches Repository) enthält keine Module. zockdb.de ergänzt über
// geschaeft/server/modul.js die Funktionen der offiziellen Seite.
// Ein Modul beschreibt sich selbst: Name, Konfiguration, Einstellungen, Migrationen, Dienste, Routen und Zeitpläne
// (siehe die Aufrufe in config.js, services/einstellungen.js, db.js, app.js und index.js).
// Mit ZOCKDB_MODULE=aus startet auch eine Installation mit Modulen nur den Kern – z. B. um die Basis-Version zu testen.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJEKT_WURZEL } from './pfade.js';

const MODUL_DATEIEN = [path.join(PROJEKT_WURZEL, 'geschaeft', 'server', 'modul.js')];

const abgeschaltet = ['aus', 'false', '0', 'nein'].includes(String(process.env.ZOCKDB_MODULE ?? '').trim().toLowerCase());

export const MODULE = abgeschaltet ? [] : await Promise.all(MODUL_DATEIEN.filter((datei) => fs.existsSync(datei))
  .map(async (datei) => (await import(pathToFileURL(datei).href)).default));

/** Ist ein Modul mit diesem Namen geladen? */
export const hatModul = (name) => MODULE.some((m) => m.name === name);
