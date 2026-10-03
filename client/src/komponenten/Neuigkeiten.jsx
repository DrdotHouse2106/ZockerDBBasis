// „Neu seit deinem letzten Besuch“: einmal je Sitzung anzeigen, wenn es Neuerungen gibt, die der Sammler noch nicht gesehen hat.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Symbol from './Symbole.jsx';

const SCHLUESSEL = 'neuigkeiten-spaeter';
const datumKurz = (iso) => iso.split('-').reverse().join('.');

export default function Neuigkeiten() {
  const [eintraege, setEintraege] = useState([]);
  useEffect(() => {
    try { if (sessionStorage.getItem(SCHLUESSEL) === '1') return; } catch { /* egal */ }
    if (!navigator.onLine) return;
    api.neuigkeiten().then((d) => setEintraege(d.eintraege ?? [])).catch(() => {});
  }, []);
  if (!eintraege.length) return null;

  const spaeter = () => {
    try { sessionStorage.setItem(SCHLUESSEL, '1'); } catch { /* egal */ }
    setEintraege([]);
  };
  const gelesen = () => {
    api.neuigkeitenGelesen().catch(() => {});
    setEintraege([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="neuigkeiten-titel">
      <div className="karte flex max-h-[85dvh] w-full max-w-lg flex-col p-4">
        <h2 id="neuigkeiten-titel" className="flex items-center gap-2 text-lg font-semibold">
          <Symbol name="glocke" className="size-5 text-akzent" />Neu seit deinem letzten Besuch
        </h2>
        <ul className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
          {eintraege.map((e, i) => (
            <li key={e.id}>
              <details open={i < 3} className="rounded-lg border border-rand p-2">
                <summary className="cursor-pointer text-sm font-medium">
                  {e.titel} <span className="text-xs font-normal text-leise">· {datumKurz(e.datum)}</span>
                </summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-leise">
                  {e.punkte.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </details>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" className="knopf-sekundaer" onClick={spaeter}>Später</button>
          <button type="button" className="knopf-primaer" onClick={gelesen} autoFocus>Alles klar</button>
        </div>
      </div>
    </div>
  );
}
