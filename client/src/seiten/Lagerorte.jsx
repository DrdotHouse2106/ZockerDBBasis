// Lagerorte: Übersicht je Ort → Regal/Schrank → Fach/Kiste mit Anzahl, und mehreren Exemplaren auf einmal einen Platz geben.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Layout from '../komponenten/Layout.jsx';
import Cover from '../komponenten/Cover.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import { LagerortFelder, lagerortText } from '../komponenten/ZusatzFelder.jsx';

const link = (o) => `#/?einzeln=1${[['lagerort_ort', o.ort], ['lagerort_regal', o.regal], ['lagerort_fach', o.fach]]
  .filter(([, w]) => w).map(([k, w]) => `&${k}=${encodeURIComponent(w)}`).join('')}`;

export default function Lagerorte({ route }) {
  const zeigeHinweis = useHinweis();
  const [orte, setOrte] = useState(null);
  const [ohne, setOhne] = useState(0);
  const laden = () => {
    api.lagerorte().then(setOrte).catch((e) => zeigeHinweis(e.message, 'fehler'));
    api.artikelListe({ ohne_lagerort: '1' }).then((l) => setOhne(l.length)).catch(() => {});
  };
  useEffect(() => { laden(); }, []);

  // Baum: Ort → Regal → Fächer
  const baum = new Map();
  for (const o of orte ?? []) {
    const ortSchluessel = o.ort.toLowerCase();
    if (!baum.has(ortSchluessel)) baum.set(ortSchluessel, { ort: o.ort, anzahl: 0, regale: new Map() });
    const ort = baum.get(ortSchluessel);
    ort.anzahl += o.anzahl;
    const regalSchluessel = (o.regal ?? '').toLowerCase();
    if (!ort.regale.has(regalSchluessel)) ort.regale.set(regalSchluessel, { regal: o.regal, anzahl: 0, faecher: [] });
    const regal = ort.regale.get(regalSchluessel);
    regal.anzahl += o.anzahl;
    if (o.fach) regal.faecher.push(o);
  }

  return (
    <Layout route={route} titel="Lagerorte" zurueck="/einstellungen">
      <div className="mx-auto max-w-3xl space-y-4">
        {!orte && <p className="text-leise">Wird geladen …</p>}
        {orte?.length === 0 && <p className="karte p-4 text-sm text-leise">Noch keine Lagerorte vergeben. Weise unten mehreren Exemplaren auf einmal einen Platz zu – oder beim Bearbeiten eines Exemplars.</p>}
        {[...baum.values()].map((ort) => (
          <section key={ort.ort} className="karte p-4">
            <a href={link({ ort: ort.ort })} className="flex items-center justify-between font-semibold hover:underline">
              <span>📍 {ort.ort}</span><span className="text-sm text-leise">{ort.anzahl}</span>
            </a>
            <ul className="mt-2 space-y-1 text-sm">
              {[...ort.regale.values()].filter((r) => r.regal).map((r) => (
                <li key={r.regal}>
                  <a href={link({ ort: ort.ort, regal: r.regal })} className="flex justify-between hover:underline"><span>🗄️ {r.regal}</span><span className="text-leise">{r.anzahl}</span></a>
                  {r.faecher.length > 0 && (
                    <ul className="ml-6 space-y-0.5">
                      {r.faecher.map((f) => (
                        <li key={f.fach}><a href={link(f)} className="flex justify-between text-leise hover:underline"><span>📦 {f.fach}</span><span>{f.anzahl}</span></a></li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {ohne > 0 && <a href="#/?einzeln=1&ohne_lagerort=1" className="block text-sm underline">{ohne} {ohne === 1 ? 'Exemplar' : 'Exemplare'} ohne Lagerort</a>}
        <Zuordnen onFertig={laden} />
      </div>
    </Layout>
  );
}

/** Mehreren Exemplaren auf einmal einen Lagerort geben. */
function Zuordnen({ onFertig }) {
  const zeigeHinweis = useHinweis();
  const [ziel, setZiel] = useState({ lagerort_ort: '', lagerort_regal: '', lagerort_fach: '' });
  const [suche, setSuche] = useState('');
  const [nurOhne, setNurOhne] = useState(true);
  const [liste, setListe] = useState([]);
  const [gewaehlt, setGewaehlt] = useState(new Set());
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api.artikelListe({ q: suche || undefined, ohne_lagerort: nurOhne ? '1' : undefined, sortierung: 'titel' }).then(setListe).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [suche, nurOhne]);

  const umschalten = (id) => setGewaehlt((g) => { const n = new Set(g); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function zuordnen() {
    if (!ziel.lagerort_ort.trim()) return zeigeHinweis('Bitte mindestens den Ort angeben.', 'fehler');
    setSpeichert(true);
    try {
      const r = await api.lagerortSetzen([...gewaehlt], { ort: ziel.lagerort_ort, regal: ziel.lagerort_regal, fach: ziel.lagerort_fach });
      zeigeHinweis(`${r.geaendert} ${r.geaendert === 1 ? 'Exemplar' : 'Exemplare'} zugeordnet.`);
      setGewaehlt(new Set());
      setListe((l) => (nurOhne ? l.filter((a) => !gewaehlt.has(a.id)) : l.map((a) => (gewaehlt.has(a.id) ? { ...a, ...ziel } : a))));
      onFertig?.();
    } catch (e) {
      zeigeHinweis(Object.values(e.felder ?? {})[0] ?? e.message, 'fehler');
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <section className="karte space-y-3 p-4">
      <h2 className="font-semibold">Mehrere Exemplare zuordnen</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <LagerortFelder werte={ziel} setze={(f) => (e) => setZiel((z) => ({ ...z, [f]: e.target.value }))} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" className="eingabe flex-1" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Exemplare suchen …" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={nurOhne} onChange={(e) => setNurOhne(e.target.checked)} />nur ohne Lagerort</label>
      </div>
      {liste.length > 0 && (
        <button type="button" className="text-xs underline" onClick={() => setGewaehlt(gewaehlt.size === liste.length ? new Set() : new Set(liste.map((a) => a.id)))}>
          {gewaehlt.size === liste.length ? 'Auswahl aufheben' : `Alle ${liste.length} auswählen`}
        </button>
      )}
      <ul className="max-h-96 divide-y divide-rand overflow-y-auto text-sm">
        {liste.map((a) => (
          <li key={a.id}>
            <label className="flex cursor-pointer items-center gap-3 py-2">
              <input type="checkbox" checked={gewaehlt.has(a.id)} onChange={() => umschalten(a.id)} />
              <Cover url={a.bild_url} alt={a.titel} typ={a.typ} className="h-10 w-8 shrink-0 rounded" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{a.titel}</span>
                <span className="block truncate text-xs text-leise">{[a.plattform, lagerortText(a)].filter(Boolean).join(' · ')}</span>
              </span>
            </label>
          </li>
        ))}
        {liste.length === 0 && <li className="py-2 text-leise">Keine Exemplare gefunden.</li>}
      </ul>
      <button type="button" className="knopf-primaer" disabled={!gewaehlt.size || speichert} onClick={zuordnen}>
        {gewaehlt.size ? `${gewaehlt.size} ${gewaehlt.size === 1 ? 'Exemplar' : 'Exemplare'} zuordnen` : 'Exemplare auswählen'}
      </button>
    </section>
  );
}
