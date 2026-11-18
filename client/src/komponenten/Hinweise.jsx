// Kurze Einblendungen („Toasts“) für Erfolgs- und Fehlermeldungen – optional mit einer Aktion wie „Rückgängig“:
// zeigeHinweis(text, 'erfolg', { aktion: { text: 'Rückgängig', fn: async () => … } })
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Symbol from './Symbole.jsx';

const HinweisKontext = createContext(() => {});

export function HinweisAnbieter({ children }) {
  const [hinweise, setHinweise] = useState([]);

  const entferne = useCallback((id) => setHinweise((liste) => liste.filter((h) => h.id !== id)), []);
  const zeige = useCallback((text, art = 'erfolg', { aktion = null } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setHinweise((liste) => [...liste, { id, text, art, aktion }]);
    // Mit Aktion länger stehen lassen, damit man sie noch erreicht
    setTimeout(() => entferne(id), aktion ? 8000 : art === 'fehler' ? 6000 : 3500);
  }, [entferne]);

  // Hinweise von außerhalb von React (z. B. native Bausteine der App): window-Ereignis „vss:hinweis“ { text, art }
  useEffect(() => {
    const ereignis = (e) => e.detail?.text && zeige(e.detail.text, e.detail.art);
    window.addEventListener('vss:hinweis', ereignis);
    return () => window.removeEventListener('vss:hinweis', ereignis);
  }, [zeige]);

  return (
    <HinweisKontext.Provider value={zeige}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {hinweise.map((h) => (
          <div
            key={h.id}
            role={h.art === 'fehler' ? 'alert' : 'status'}
            className="karte pointer-events-auto flex max-w-md items-center gap-2 px-4 py-3 text-sm shadow-xl"
          >
            <Symbol name={h.art === 'fehler' ? 'warnung' : 'haken'} className={`size-5 shrink-0 ${h.art === 'fehler' ? 'text-gefahr' : 'text-erfolg'}`} />
            <span>{h.text}</span>
            {h.aktion && (
              <button type="button" className="ml-1 shrink-0 font-semibold text-akzent-hell underline" data-testid="hinweis-aktion"
                onClick={() => { entferne(h.id); h.aktion.fn(); }}>{h.aktion.text}</button>
            )}
          </div>
        ))}
      </div>
    </HinweisKontext.Provider>
  );
}

export const useHinweis = () => useContext(HinweisKontext);
