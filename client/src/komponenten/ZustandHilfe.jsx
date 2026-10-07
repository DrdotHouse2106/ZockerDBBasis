import { useState } from 'react';
import { ZUSTAENDE, ZUSTAND_HILFE } from '../../../shared/konstanten.js';

/**
 * Bewertungshilfe für die Zustandsfelder: antippbares ⓘ (Tooltips gibt es auf dem Handy nicht), darunter eine Übersicht
 * aller Stufen für Datenträger bzw. Gerät und Hülle/OVP. Die gewählten Stufen sind hervorgehoben.
 */
export default function ZustandHilfe({ typ, zustand, zustandOvp, zustandInlay, mitOvp, mitInlay = false }) {
  const [offen, setOffen] = useState(false);
  const spiel = typ === 'spiel';
  const traeger = spiel ? 'Disc / Modul' : 'Gerät';
  return (
    <div className="sm:col-span-2">
      <button type="button" className="text-sm text-akzent-hell underline" aria-expanded={offen} onClick={() => setOffen((o) => !o)}>
        ⓘ Wie bewerte ich den Zustand?
      </button>
      {offen && (
        <div className="mt-2 space-y-2 rounded-lg bg-karte-hover/50 p-3 text-sm">
          <p className="text-leise">
            Im Zweifel die niedrigere Stufe wählen. {mitOvp ? `${traeger} und Hülle/OVP werden getrennt bewertet.` : ''}
          </p>
          <dl className="space-y-2">
            {ZUSTAENDE.map((z) => {
              const h = ZUSTAND_HILFE[z.value];
              const gewaehlt = z.value === zustand || (mitOvp && z.value === zustandOvp) || (mitInlay && z.value === zustandInlay);
              return (
                <div key={z.value} className={`rounded-md p-2 ${gewaehlt ? 'bg-akzent/10 ring-1 ring-akzent/40' : ''}`}>
                  <dt className="font-semibold">{z.label}</dt>
                  <dd><span className="text-leise">{traeger}:</span> {spiel ? h.traeger : h.geraet}</dd>
                  {mitOvp && <dd><span className="text-leise">{spiel ? 'Hülle / OVP' : 'OVP'}:</span> {h.ovp}</dd>}
                  {mitInlay && <dd><span className="text-leise">Inlay:</span> {h.inlay}</dd>}
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </div>
  );
}
