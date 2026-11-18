// Nachträgliche Katalog-Zuordnung (z. B. nach einem Import aus CLZ Games): läuft auf dem Server im Hintergrund,
// hier nur Start und Fortschritt. Ohne Katalogeintrag fehlen Cover und Angaben – mit Treffer kommen sie automatisch dazu.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useHinweis } from './Hinweise.jsx';

export default function Nachzuordnung({ start = null, onFertig, knopf = true, zurListe = false }) {
  const zeigeHinweis = useHinweis();
  const [stand, setStand] = useState(start);

  // Solange es läuft, alle zwei Sekunden den Stand holen
  useEffect(() => {
    if (!stand?.laeuft) return undefined;
    const t = setTimeout(async () => {
      try {
        const neu = await api.zuordnungStand();
        setStand(neu);
        if (neu && !neu.laeuft) onFertig?.(neu);
      } catch { setStand((s) => ({ ...s })); }
    }, 2000);
    return () => clearTimeout(t);
  }, [stand]); // eslint-disable-line react-hooks/exhaustive-deps

  // Läuft schon (z. B. nach dem Import in einem anderen Tab)? Dann gleich den Fortschritt zeigen
  useEffect(() => {
    if (start) return;
    api.zuordnungStand().then((s) => { if (s?.laeuft) setStand(s); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function starten() {
    try {
      const s = await api.zuordnungStarten();
      setStand(s);
      if (!s.gesamt) zeigeHinweis('Alle Spiele haben schon einen Katalogeintrag.');
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    }
  }

  if (stand?.laeuft) {
    const anteil = stand.gesamt ? Math.round((stand.erledigt / stand.gesamt) * 100) : 0;
    return (
      <div className="space-y-1.5 rounded-xl bg-akzent/10 p-3 text-sm" role="status" data-testid="nachzuordnung">
        <p>Suche passende Katalogeinträge … {stand.erledigt} von {stand.gesamt} geprüft, {stand.verknuepft} zugeordnet.</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-rand"><div className="h-full bg-akzent transition-all" style={{ width: `${anteil}%` }} /></div>
        <p className="text-xs text-leise">Das läuft im Hintergrund weiter – du kannst die Seite verlassen und bekommst eine Benachrichtigung, wenn es fertig ist.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 rounded-xl bg-karte-hover p-3 text-sm" data-testid="nachzuordnung">
      {stand?.fertig_am && stand.gesamt > 0 && (
        <p role="status"><strong>{stand.verknuepft}</strong> von {stand.gesamt} zugeordnet{stand.gesamt > stand.verknuepft ? ` – ${stand.gesamt - stand.verknuepft} ohne eindeutigen Treffer, die ordnest du einzeln zu.` : '.'}</p>
      )}
      {knopf && (
        <>
          <p className="text-xs text-leise">Ohne Katalogeintrag fehlen Cover und Angaben. Die automatische Zuordnung sucht passende Einträge – auch bei abweichender Schreibweise und notfalls online – und ordnet nur zu, wenn Titel und Plattform eindeutig passen.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={starten} data-testid="nachzuordnung-starten">Automatisch zuordnen</button>
            {zurListe && <a href="#/zuordnen" className="knopf-sekundaer px-3 py-1.5" data-testid="zuordnen-link">Einzeln zuordnen (mit Vorschlägen)</a>}
          </div>
        </>
      )}
    </div>
  );
}
