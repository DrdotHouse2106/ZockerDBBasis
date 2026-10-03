// Zuschaltbare Zusatzfelder am Exemplar (Profil → Konto → „Zusätzliche Felder“): Lagerort, Beilagen & Seriennummer der OVP.
import { useEffect, useId, useState } from 'react';
import { BEILAGEN, beilageVorhanden, seriennummerPasst } from '../../../shared/konstanten.js';
import { api } from '../api.js';

/** Lagerort in drei Stufen mit Vorschlägen aus den bereits verwendeten Orten. */
export function LagerortFelder({ werte, setze, fehler = {} }) {
  const id = useId();
  const [orte, setOrte] = useState([]);
  useEffect(() => { api.lagerorte().then(setOrte).catch(() => {}); }, []);
  const eindeutig = (liste) => [...new Set(liste.filter(Boolean))];
  const gleich = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
  const regale = eindeutig(orte.filter((o) => !werte.lagerort_ort || gleich(o.ort, werte.lagerort_ort)).map((o) => o.regal));
  const faecher = eindeutig(orte.filter((o) => (!werte.lagerort_ort || gleich(o.ort, werte.lagerort_ort))
    && (!werte.lagerort_regal || gleich(o.regal, werte.lagerort_regal))).map((o) => o.fach));
  const feld = (name, label, liste, platzhalter) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input className="eingabe" value={werte[name] ?? ''} onChange={setze(name)} list={`${id}-${name}`} placeholder={platzhalter} autoComplete="off" />
      <datalist id={`${id}-${name}`}>{liste.map((w) => <option key={w} value={w} />)}</datalist>
      {fehler[name] && <span className="mt-1 block text-gefahr">{fehler[name]}</span>}
    </label>
  );
  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
      {feld('lagerort_ort', 'Ort', eindeutig(orte.map((o) => o.ort)), 'z. B. Wohnzimmer')}
      {feld('lagerort_regal', 'Regal / Schrank', regale, 'z. B. Kallax links')}
      {feld('lagerort_fach', 'Fach / Kiste', faecher, 'z. B. Fach 3')}
    </div>
  );
}


/** Beilagen-Checkliste je Artikeltyp: Tippen wechselt zwischen „keine Angabe“, „vorhanden“ und „fehlt“. */
export function BeilagenCheckliste({ typ, wert, onChange }) {
  const liste = BEILAGEN[typ] ?? BEILAGEN.spiel;
  const aktuell = wert && typeof wert === 'object' ? wert : {};
  const setze = (schluessel, w) => {
    const neu = { ...aktuell };
    if (w === undefined) delete neu[schluessel];
    else neu[schluessel] = w;
    onChange(Object.keys(neu).length ? neu : null);
  };
  // keine Angabe → vorhanden → fehlt → keine Angabe (eine Anzahl gilt als „vorhanden“)
  const weiter = (schluessel) => {
    const w = aktuell[schluessel];
    setze(schluessel, w === undefined ? true : beilageVorhanden(w) ? false : undefined);
  };
  // Anzahl (z. B. mehrere Werbebeilagen): 1 = einfach vorhanden
  const anzahl = (schluessel, delta) => {
    const n = Math.min(99, Math.max(1, (Number.isInteger(aktuell[schluessel]) ? aktuell[schluessel] : 1) + delta));
    setze(schluessel, n === 1 ? true : n);
  };
  return (
    <div className="sm:col-span-2">
      <span className="mb-1 block text-sm font-medium">Beilagen</span>
      <div className="flex flex-wrap gap-2">
        {liste.map((b) => {
          const w = aktuell[b.value];
          const da = beilageVorhanden(w);
          return (
            <span key={b.value} className="inline-flex items-center gap-1">
              <button type="button" onClick={() => weiter(b.value)} aria-pressed={da}
                className={da ? 'chip-aktiv' : w === false ? 'chip border-gefahr/60 text-gefahr line-through' : 'chip'}>
                {da ? '✓ ' : w === false ? '✗ ' : ''}{Number.isInteger(w) && w > 1 ? `${w}× ` : ''}{b.label}
              </button>
              {da && b.value !== 'ovp' && (
                <span className="inline-flex items-center rounded-full border border-rand text-xs">
                  <button type="button" className="px-2 py-1 disabled:opacity-40" onClick={() => anzahl(b.value, -1)} disabled={!(Number.isInteger(w) && w > 1)}
                    aria-label={`${b.label}: eins weniger`}>−</button>
                  <button type="button" className="px-2 py-1" onClick={() => anzahl(b.value, 1)} aria-label={`${b.label}: eins mehr`}>+</button>
                </span>
              )}
            </span>
          );
        })}
      </div>
      <span className="mt-1 block text-xs text-leise">Antippen: einmal = vorhanden, zweimal = fehlt, dreimal = keine Angabe. Mit + / − die Anzahl angeben, z. B. drei Werbebeilagen.</span>
    </div>
  );
}

/** „Passt“ / „passt nicht“ für Seriennummer von Gerät und OVP. */
export function SeriennummerAbgleich({ geraet, ovp }) {
  const passt = seriennummerPasst(geraet, ovp);
  if (passt === null) return null;
  return passt
    ? <span className="text-xs font-medium text-erfolg">✓ Seriennummer von Gerät und OVP passen zusammen</span>
    : <span className="text-xs font-medium text-warnung">⚠ Seriennummer von Gerät und OVP passen nicht zusammen</span>;
}

/** Lagerort als eine Zeile: „Wohnzimmer › Kallax › Fach 3“. */
export const lagerortText = (a) => [a?.lagerort_ort, a?.lagerort_regal, a?.lagerort_fach].filter(Boolean).join(' › ');
