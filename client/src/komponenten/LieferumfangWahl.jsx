// Lieferumfang einer Ausgabe wählen: Bestandteile antippen, bei Bedarf die Anzahl ändern.
import { LIEFERUMFANG_SCHLUESSEL, lieferumfangPosten } from '../../../shared/konstanten.js';

const NAMEN = Object.fromEntries(lieferumfangPosten(Object.fromEntries(LIEFERUMFANG_SCHLUESSEL.map((k) => [k, 1]))).map((p) => [p.schluessel, p.label]));
NAMEN.zweite_disc = 'Zweite Disc / Data Disc (zusätzlich)';

export default function LieferumfangWahl({ wert, onChange }) {
  const aktuell = wert && typeof wert === 'object' ? wert : {};
  const setze = (k, n) => {
    const neu = { ...aktuell };
    if (n) neu[k] = n; else delete neu[k];
    onChange(Object.keys(neu).length ? neu : null);
  };
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Lieferumfang" data-testid="lieferumfang-wahl">
      {LIEFERUMFANG_SCHLUESSEL.map((k) => {
        const n = aktuell[k] ?? 0;
        return (
          <span key={k} className="inline-flex items-center gap-1">
            <button type="button" aria-pressed={n > 0} className={n > 0 ? 'chip-aktiv' : 'chip'} onClick={() => setze(k, n > 0 ? 0 : 1)}>
              {n > 0 ? '✓ ' : ''}{n > 1 ? `${n}× ` : ''}{NAMEN[k]}
            </button>
            {n > 0 && (
              <span className="inline-flex items-center rounded-full border border-rand text-xs">
                <button type="button" className="px-2 py-1 disabled:opacity-40" disabled={n <= 1} onClick={() => setze(k, n - 1)} aria-label={`${NAMEN[k]}: eins weniger`}>−</button>
                <button type="button" className="px-2 py-1 disabled:opacity-40" disabled={n >= 9} onClick={() => setze(k, n + 1)} aria-label={`${NAMEN[k]}: eins mehr`}>+</button>
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
