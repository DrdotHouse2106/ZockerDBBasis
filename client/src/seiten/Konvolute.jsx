// Konvolute: mehrere Artikel zu einem Gesamtpreis – Liste und Detailseite mit automatischer Preisverteilung.
import { useEffect, useState } from 'react';
import { KONVOLUT_AUFTEILUNG } from '../../../shared/konstanten.js';
import { api } from '../api.js';
import { navigiere } from '../router.js';
import { euro, datumDe, datumFeld, leseDatum, preisFeld, anzahl } from '../format.js';
import Layout from '../komponenten/Layout.jsx';
import Cover from '../komponenten/Cover.jsx';
import Symbol from '../komponenten/Symbole.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';

export function KonvoluteListe({ route }) {
  const [liste, setListe] = useState(null);
  useEffect(() => { api.konvolute().then(setListe).catch(() => setListe([])); }, []);
  return (
    <Layout route={route} titel="Konvolute" zurueck="/einstellungen">
      <div className="mx-auto max-w-2xl space-y-3">
        <p className="text-sm text-leise">
          Mehrere Artikel zu einem Gesamtpreis gekauft – Flohmarkt-Kiste, Paket aus Kleinanzeigen, Sammlungsauflösung? Der
          Gesamtpreis wird automatisch auf die Artikel verteilt (gleichmäßig oder nach Wert).
        </p>
        <NeuesKonvolut onAngelegt={(k) => navigiere(`/konvolut/${k.id}`)} />
        {liste?.length === 0 && <p className="text-sm text-leise">Noch keine Konvolute.</p>}
        {liste?.length > 0 && (
          <ul className="karte divide-y divide-rand overflow-hidden">
            {liste.map((k) => (
              <li key={k.id}>
                <a href={`#/konvolut/${k.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-karte-hover">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{k.name}</span>
                    <span className="block text-xs text-leise">{[k.kaufdatum && datumDe(k.kaufdatum), k.quelle, `${anzahl(k.stueck)} Stück`].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{k.preis != null ? euro(k.preis) : <span className="text-leise">Preis unbekannt</span>}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}

function NeuesKonvolut({ onAngelegt }) {
  const [w, setW] = useState(null);
  const [fehler, setFehler] = useState(null);
  if (!w) {
    return (
      <button type="button" className="knopf-primaer" onClick={() => setW({ name: '', preis: '', kaufdatum: '', quelle: '' })}>
        <Symbol name="plus" className="size-4" />Neues Konvolut
      </button>
    );
  }
  return (
    <form className="karte grid gap-2 p-3 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      try { onAngelegt(await api.konvolutAnlegen({ ...w, kaufdatum: leseDatum(w.kaufdatum) })); } catch (f) { setFehler(Object.values(f.felder ?? {})[0] ?? f.message); }
    }}>
      <input className="eingabe sm:col-span-2" value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} placeholder="Name, z. B. Flohmarkt-Kiste Mai 2024" aria-label="Name" required />
      <input className="eingabe" value={w.preis} onChange={(e) => setW({ ...w, preis: e.target.value })} inputMode="decimal" placeholder="Gesamtpreis € (optional)" aria-label="Gesamtpreis" />
      <input className="eingabe" value={w.kaufdatum} onChange={(e) => setW({ ...w, kaufdatum: e.target.value })} placeholder="Datum oder nur Jahr" aria-label="Kaufdatum" />
      <input className="eingabe sm:col-span-2" value={w.quelle} onChange={(e) => setW({ ...w, quelle: e.target.value })} placeholder="Woher? z. B. Flohmarkt, Kleinanzeigen (optional)" aria-label="Quelle" />
      {fehler && <p className="text-sm text-gefahr sm:col-span-2">{fehler}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="knopf-primaer">Anlegen</button>
        <button type="button" className="knopf-sekundaer" onClick={() => setW(null)}>Abbrechen</button>
      </div>
    </form>
  );
}

export function KonvolutSeite({ route, id }) {
  const zeigeHinweis = useHinweis();
  const [k, setK] = useState(null);
  const [w, setW] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [zuordnen, setZuordnen] = useState(false);
  const laden = () => api.konvolut(id).then((d) => {
    setK(d);
    setW({ name: d.name, preis: preisFeld(d.preis), kaufdatum: datumFeld(d.kaufdatum), quelle: d.quelle ?? '', notizen: d.notizen ?? '', aufteilung: d.aufteilung });
  }).catch((e) => setFehler(e.message));
  useEffect(() => { laden(); }, [id]);

  if (!k || !w) return <Layout route={route} titel="Konvolut" zurueck="/konvolute">{fehler ? <p className="text-gefahr">{fehler}</p> : <p className="text-leise">Wird geladen …</p>}</Layout>;

  const speichern = async (aenderung = {}) => {
    try {
      const neu = await api.konvolutAendern(k.id, { ...w, ...aenderung, kaufdatum: leseDatum(aenderung.kaufdatum ?? w.kaufdatum) });
      setK(neu);
      zeigeHinweis('Gespeichert – Preise neu verteilt.');
    } catch (e) { zeigeHinweis(Object.values(e.felder ?? {})[0] ?? e.message, 'fehler'); }
  };
  const summe = k.artikel.reduce((s, a) => s + (a.kaufpreis ?? 0) * a.anzahl, 0);
  const setze = (f) => (e) => setW({ ...w, [f]: e.target.value });

  return (
    <Layout route={route} titel={k.name} zurueck="/konvolute">
      <div className="mx-auto max-w-3xl space-y-4 pb-8">
        <form className="karte grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); speichern(); }}>
          <label className="text-sm sm:col-span-2"><span className="beschriftung">Name</span><input className="eingabe" value={w.name} onChange={setze('name')} /></label>
          <label className="text-sm"><span className="beschriftung">Gesamtpreis (€)</span><input className="eingabe" value={w.preis} onChange={setze('preis')} inputMode="decimal" placeholder="leer = unbekannt" /></label>
          <label className="text-sm"><span className="beschriftung">Kaufdatum</span><input className="eingabe" value={w.kaufdatum} onChange={setze('kaufdatum')} placeholder="TT.MM.JJJJ, MM.JJJJ oder JJJJ" /></label>
          <label className="text-sm"><span className="beschriftung">Woher?</span><input className="eingabe" value={w.quelle} onChange={setze('quelle')} placeholder="z. B. Flohmarkt" /></label>
          <label className="text-sm"><span className="beschriftung">Preis verteilen</span>
            <select className="eingabe" value={w.aufteilung} onChange={(e) => { setW({ ...w, aufteilung: e.target.value }); speichern({ aufteilung: e.target.value }); }}>
              {KONVOLUT_AUFTEILUNG.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          <label className="text-sm sm:col-span-2"><span className="beschriftung">Notizen</span><textarea className="eingabe" rows={2} value={w.notizen} onChange={setze('notizen')} /></label>
          <p className="text-xs text-leise sm:col-span-2">
            Artikel mit selbst eingetragenem Kaufpreis behalten ihn – verteilt wird nur der Rest. „Nach Wert“ nutzt die Wertschätzung
            {' '}(Marktpreis bzw. deine eigene Schätzung am Artikel).
          </p>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="knopf-primaer">Speichern</button>
            <button type="button" className="knopf-sekundaer" onClick={async () => {
              if (!window.confirm('Konvolut auflösen? Die Artikel bleiben mit ihrem bisherigen Anteil als Kaufpreis erhalten.')) return;
              await api.konvolutLoeschen(k.id);
              navigiere('/konvolute');
            }}>Auflösen</button>
          </div>
        </form>

        <section className="karte p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{anzahl(k.artikel.length)} Artikel · verteilt {euro(summe)}{k.preis != null ? ` von ${euro(k.preis)}` : ''}</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="knopf-primaer px-3 py-1.5" onClick={() => navigiere('/neu', { konvolut: k.id })}><Symbol name="plus" className="size-4" />Artikel erfassen</button>
              <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setZuordnen((z) => !z)}>Vorhandene zuordnen</button>
            </div>
          </div>
          {zuordnen && <Zuordnen konvolutId={k.id} onFertig={(neu) => { setK(neu); setZuordnen(false); }} />}
          <ul className="divide-y divide-rand">
            {k.artikel.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <Cover url={a.bild_url} typ={a.typ} alt="" className="h-14 w-10 shrink-0 rounded-md" />
                <a href={`#/artikel/${a.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate font-medium">{a.titel}</span>
                  <span className="block text-xs text-leise">{[a.plattform, a.anzahl > 1 && `${a.anzahl} Stück`, a.wert != null && `Wert ${euro(a.wert)}`].filter(Boolean).join(' · ')}</span>
                </a>
                <span className="shrink-0 text-right text-sm">
                  {a.kaufpreis != null ? euro(a.kaufpreis) : '–'}
                  <span className="block text-xs text-leise">{a.kaufpreis_anteilig ? 'Anteil' : a.kaufpreis != null ? 'fest' : ''}</span>
                </span>
                <button type="button" className="rounded-lg p-1.5 text-leise hover:bg-karte-hover" aria-label={`${a.titel} aus dem Konvolut entfernen`}
                  onClick={async () => setK(await api.konvolutEntfernen(k.id, a.id))}><Symbol name="schliessen" className="size-4" /></button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Layout>
  );
}

/** Vorhandene Artikel der eigenen Sammlung suchen und dem Konvolut zuordnen. */
function Zuordnen({ konvolutId, onFertig }) {
  const [q, setQ] = useState('');
  const [treffer, setTreffer] = useState([]);
  const [gewaehlt, setGewaehlt] = useState(new Set());
  useEffect(() => {
    const t = setTimeout(() => api.artikelListe({ q: q.trim() || undefined, sortierung: 'titel' })
      .then((r) => setTreffer((r.eintraege ?? r).filter((a) => a.konvolut_id !== konvolutId).slice(0, 50))).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  const umschalten = (id) => setGewaehlt((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="mb-3 space-y-2 rounded-xl border border-rand p-3">
      <input className="eingabe" value={q} onChange={(e) => setQ(e.target.value)} placeholder="In deiner Sammlung suchen" />
      <ul className="max-h-64 divide-y divide-rand overflow-y-auto text-sm">
        {treffer.map((a) => (
          <li key={a.id}>
            <label className="flex items-center gap-2 py-1.5">
              <input type="checkbox" checked={gewaehlt.has(a.id)} onChange={() => umschalten(a.id)} />
              <span className="min-w-0 flex-1 truncate">{a.titel} <span className="text-leise">{a.plattform}</span></span>
              {a.kaufpreis != null && <span className="text-xs text-leise">{euro(a.kaufpreis)}</span>}
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="knopf-primaer px-3 py-1.5" disabled={!gewaehlt.size} onClick={async () => onFertig(await api.konvolutZuordnen(konvolutId, [...gewaehlt]))}>
        {gewaehlt.size} Artikel zuordnen
      </button>
    </div>
  );
}
