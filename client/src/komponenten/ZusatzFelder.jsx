// Zuschaltbare Zusatzfelder am Exemplar (Profil → Konto → „Zusätzliche Felder“): Lagerort, Beilagen & Seriennummer der OVP.
import { useEffect, useId, useState } from 'react';
import { BEILAGEN, seriennummerPasst } from '../../../shared/konstanten.js';
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

const ZUSTAENDE_BEILAGE = [undefined, true, false]; // keine Angabe → vorhanden → fehlt

/** Beilagen-Checkliste je Artikeltyp: Tippen wechselt zwischen „keine Angabe“, „vorhanden“ und „fehlt“. */
export function BeilagenCheckliste({ typ, wert, onChange }) {
  const liste = BEILAGEN[typ] ?? BEILAGEN.spiel;
  const aktuell = wert && typeof wert === 'object' ? wert : {};
  const weiter = (schluessel) => {
    const i = ZUSTAENDE_BEILAGE.indexOf(aktuell[schluessel]);
    const neu = { ...aktuell };
    const naechster = ZUSTAENDE_BEILAGE[(i + 1) % ZUSTAENDE_BEILAGE.length];
    if (naechster === undefined) delete neu[schluessel];
    else neu[schluessel] = naechster;
    onChange(Object.keys(neu).length ? neu : null);
  };
  return (
    <div className="sm:col-span-2">
      <span className="mb-1 block text-sm font-medium">Beilagen</span>
      <div className="flex flex-wrap gap-2">
        {liste.map((b) => {
          const w = aktuell[b.value];
          return (
            <button key={b.value} type="button" onClick={() => weiter(b.value)} aria-pressed={w === true}
              className={w === true ? 'chip-aktiv' : w === false ? 'chip border-gefahr/60 text-gefahr line-through' : 'chip'}>
              {w === true ? '✓ ' : w === false ? '✗ ' : ''}{b.label}
            </button>
          );
        })}
      </div>
      <span className="mt-1 block text-xs text-leise">Antippen: einmal = vorhanden, zweimal = fehlt, dreimal = keine Angabe.</span>
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
