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
import { Component, Suspense } from 'react';
import modul from '@zockerdb/modul';

export const MODUL = modul ?? {};

/** Fängt Fehler eines Zusatzbausteins ab (z. B. offline nicht nachladbar) – die Seite selbst bleibt benutzbar. */
class Leise extends Component {
  constructor(props) { super(props); this.state = { fehler: false }; }
  static getDerivedStateFromError() { return { fehler: true }; }
  componentDidCatch(fehler) { console.warn('[andockpunkt]', fehler?.message); }
  render() { return this.state.fehler ? null : this.props.children; }
}

/** Rendert alle Komponenten, die Module für diesen Andockpunkt registriert haben (sonst nichts). */
export function Andockpunkt({ name, ...props }) {
  const liste = MODUL.andockpunkte?.[name] ?? [];
  if (!liste.length) return null;
  return liste.map((Komponente, i) => <Leise key={i}><Suspense fallback={null}><Komponente {...props} /></Suspense></Leise>);
}

export const hatAndockpunkt = (name) => Boolean(MODUL.andockpunkte?.[name]?.length);
