// „Anderen Katalogeintrag wählen“ am eigenen Exemplar: Katalogsuche, die Auswahl ersetzt die Verknüpfung des Exemplars.
// Die Ausgabe (Variante) wird zurückgesetzt; ein dadurch ungenutzter eigener privater Eintrag wird gelöscht.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useHinweis } from './Hinweise.jsx';

export default function KatalogWechsel({ artikel, onGeaendert, onSchliessen }) {
  const zeigeHinweis = useHinweis();
  const [text, setText] = useState(artikel.titel ?? '');
  const [treffer, setTreffer] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => {
    const suche = text.trim();
    if (suche.length < 2) { setTreffer(null); return undefined; }
    const abbruch = new AbortController();
    const t = setTimeout(() => {
      api.katalogSuche(suche, artikel.typ, abbruch.signal).then((r) => setTreffer((r.lokal ?? []).slice(0, 8))).catch(() => {});
    }, 300);
    return () => { clearTimeout(t); abbruch.abort(); };
  }, [text, artikel.typ]);

  async function waehle(e) {
    setLaeuft(true);
    try {
      const r = await api.artikelKatalogWaehlen(artikel.id, e.id);
      zeigeHinweis(`Das Exemplar gehört jetzt zu „${e.titel}“.${r.eigener_eintrag_geloescht ? ' Dein bisheriger eigener Eintrag wurde entfernt.' : ''}`);
      onGeaendert(r.artikel);
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    } finally {
      setLaeuft(false);
    }
  }
  return (
    <section className="karte space-y-2 p-4 text-sm" data-testid="katalog-wechsel">
      <h3 className="font-semibold">Anderen Katalogeintrag wählen</h3>
      <p className="text-xs text-leise">Suche den passenden Eintrag im Katalog. Das Exemplar behält alle deine Angaben; nur die Verknüpfung (und die Ausgabe) ändert sich.</p>
      <input type="search" className="eingabe" value={text} onChange={(e) => setText(e.target.value)} aria-label="Katalog durchsuchen" autoComplete="off" />
      {treffer && !treffer.length && <p className="text-leise">Nichts gefunden.</p>}
      {treffer?.length > 0 && (
        <ul className="divide-y divide-rand rounded-xl border border-rand" role="listbox" aria-label="Katalogeinträge">
          {treffer.map((e) => (
            <li key={e.id}>
              <button type="button" role="option" aria-selected={e.id === artikel.katalog_id} disabled={laeuft || e.id === artikel.katalog_id}
                className="w-full px-3 py-2 text-left hover:bg-karte-hover disabled:opacity-60" onClick={() => waehle(e)}>
                {e.titel}{e.erscheinungsjahr ? <span className="text-leise"> · {e.erscheinungsjahr}</span> : null}{e.id === artikel.katalog_id ? <span className="text-leise"> (aktuell)</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={onSchliessen}>Abbrechen</button>
    </section>
  );
}
