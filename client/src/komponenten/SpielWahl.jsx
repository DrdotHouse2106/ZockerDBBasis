// „Gehört zu (Spiel)“: Merch optional mit einem Spiel aus dem Katalog verknüpfen (z. B. Amiibo → Zelda).
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function SpielWahl({ id, katalogId, titel, onChange }) {
  const [text, setText] = useState('');
  const [treffer, setTreffer] = useState([]);
  useEffect(() => {
    const suche = text.trim();
    if (suche.length < 2) { setTreffer([]); return undefined; }
    const abbruch = new AbortController();
    const t = setTimeout(() => {
      api.katalogSuche(suche, 'spiel', abbruch.signal).then((r) => setTreffer((r.lokal ?? []).slice(0, 6))).catch(() => {});
    }, 300);
    return () => { clearTimeout(t); abbruch.abort(); };
  }, [text]);

  if (katalogId) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="spiel-wahl-gewaehlt">
        <span>gehört zu <strong>{titel || `Spiel #${katalogId}`}</strong></span>
        <button type="button" className="text-xs text-akzent-hell underline" onClick={() => { onChange(null, ''); setText(''); }}>Entfernen</button>
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <input id={id} type="search" className="eingabe" value={text} onChange={(e) => setText(e.target.value)} placeholder="Spiel suchen, z. B. The Legend of Zelda" autoComplete="off" />
      {treffer.length > 0 && (
        <ul className="divide-y divide-rand rounded-xl border border-rand text-sm" role="listbox" aria-label="Spiele">
          {treffer.map((e) => (
            <li key={e.id}>
              <button type="button" role="option" className="w-full px-3 py-2 text-left hover:bg-karte-hover" onClick={() => { onChange(e.id, e.titel); setText(''); setTreffer([]); }}>
                {e.titel}{e.erscheinungsjahr ? <span className="text-leise"> · {e.erscheinungsjahr}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
