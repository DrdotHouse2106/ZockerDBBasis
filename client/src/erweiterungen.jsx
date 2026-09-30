// Andockpunkte der Oberfläche für Zusatzmodule.
//
// Vite bindet unter „@zockerdb/modul“ die Oberfläche eines Zusatzmoduls ein (siehe vite.config.js) – in der
// Basis-Version ist das ein leeres Objekt (modul-leer.js). Ein Modul kann liefern:
//   routen        – eigene Seiten: [{ pfad | muster, Komponente, props?(treffer) }]
//   navigation    – Einträge der Hauptnavigation (Desktop) und der Seite „Mehr“
//   andockpunkte  – Komponenten je Name, z. B. { 'katalog.ende': [Komponente] }
//   adminReiter   – zusätzliche Reiter der Administration
//   vorladen      – Ladefunktionen der Seiten, die im Leerlauf vorgeladen werden
//   touren        – weitere geführte Touren (Aufbau wie client/src/touren.js)
//   tourSchritte  – zusätzliche Schritte bestehender Touren: { tourId: [{ nach: schrittId, schritte: […] }] }
import { Suspense } from 'react';
import modul from '@zockerdb/modul';

export const MODUL = modul ?? {};

/** Rendert alle Komponenten, die Module für diesen Andockpunkt registriert haben (sonst nichts). */
export function Andockpunkt({ name, ...props }) {
  const liste = MODUL.andockpunkte?.[name] ?? [];
  if (!liste.length) return null;
  return <Suspense fallback={null}>{liste.map((Komponente, i) => <Komponente key={i} {...props} />)}</Suspense>;
}

export const hatAndockpunkt = (name) => Boolean(MODUL.andockpunkte?.[name]?.length);
