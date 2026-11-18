// „Spiele zuordnen“: Exemplare ohne Katalogeintrag (z. B. nach einem Import) mit Vorschlägen aus dem Katalog – ein Tipp ordnet zu.
// Oben die automatische Zuordnung (eindeutige Treffer), darunter alles, wo der Sammler selbst entscheidet.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Layout from '../komponenten/Layout.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import Nachzuordnung from '../komponenten/Nachzuordnung.jsx';
import KatalogWechsel from '../komponenten/KatalogWechsel.jsx';

export default function Zuordnen({ route }) {
  const zeigeHinweis = useHinweis();
  const [daten, setDaten] = useState(null);
  const [weg, setWeg] = useState(() => new Set()); // zugeordnet oder „später“
  const [zugeordnet, setZugeordnet] = useState(0);
  const [basis, setBasis] = useState(0); // Zugeordnete beim letzten Laden (stecken schon in daten.gesamt)
  const [suche, setSuche] = useState(null); // Exemplar, für das gerade selbst gesucht wird
  const [laeuft, setLaeuft] = useState(null);

  // ab: wie viele noch offene schon geladen sind (Zugeordnete fallen auf dem Server aus der Liste)
  const laden = async (ab = 0) => {
    try {
      const r = await api.zuordnungListe(ab);
      setBasis(ab === 0 ? 0 : zugeordnet);
      setDaten((alt) => (ab === 0 || !alt ? r : { ...r, eintraege: [...alt.eintraege, ...r.eintraege.filter((e) => !alt.eintraege.some((x) => x.artikel.id === e.artikel.id))] }));
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    }
  };
  useEffect(() => { laden(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const entferne = (id) => setWeg((w) => new Set([...w, id]));
  async function waehle(artikel, eintrag) {
    setLaeuft(artikel.id);
    try {
      await api.artikelKatalogWaehlen(artikel.id, eintrag.id);
      entferne(artikel.id);
      setZugeordnet((n) => n + 1);
      zeigeHinweis(`„${artikel.titel}“ ist jetzt „${eintrag.titel}“ zugeordnet.`);
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    } finally {
      setLaeuft(null);
    }
  }

  const sichtbar = daten?.eintraege.filter((e) => !weg.has(e.artikel.id)) ?? [];
  const offen = daten ? Math.max(0, daten.gesamt - (zugeordnet - basis)) : null;

  return (
    <Layout route={route} titel="Spiele zuordnen" zurueck="/sammlung?ohne_katalog=1">
      <div className="mx-auto max-w-3xl space-y-4 pb-8">
        <p className="text-sm text-leise">
          Diese Exemplare haben noch keinen Katalogeintrag – deshalb fehlen Cover und Angaben. Wähle den passenden Vorschlag
          oder suche selbst. Die Vorschläge mit der gleichen Plattform stehen oben.
        </p>
        <Nachzuordnung onFertig={() => { setWeg(new Set()); setZugeordnet(0); laden(0); }} />
        {!daten && <p className="text-leise">Wird geladen …</p>}
        {daten && <p className="text-sm font-semibold" data-testid="zuordnen-offen">{offen === 0 ? 'Alles zugeordnet 🎉' : `${offen} ${offen === 1 ? 'Exemplar' : 'Exemplare'} ohne Katalogeintrag`}</p>}
        <ul className="space-y-3">
          {sichtbar.map(({ artikel, vorschlaege }) => (
            <li key={artikel.id} className="karte space-y-2 p-3" data-testid="zuordnen-eintrag">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <a href={`#/artikel/${artikel.id}`} className="font-semibold underline-offset-2 hover:underline">{artikel.titel}</a>
                  <p className="text-xs text-leise">{[artikel.plattform, artikel.barcode && `Barcode ${artikel.barcode}`].filter(Boolean).join(' · ') || 'ohne Plattform'}</p>
                </div>
                <button type="button" className="text-xs text-leise underline" onClick={() => entferne(artikel.id)}>Später</button>
              </div>
              {vorschlaege.length > 0 ? (
                <ul className="divide-y divide-rand rounded-xl border border-rand">
                  {vorschlaege.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 p-2">
                      {v.cover_url ? <img src={v.cover_url} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded object-cover" /> : <span className="h-14 w-10 shrink-0 rounded bg-karte-hover" aria-hidden="true" />}
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block font-medium">{v.titel}</span>
                        <span className="block text-xs text-leise">
                          {[v.titel_original && v.titel_original !== v.titel && v.titel_original, v.erscheinungsjahr, v.plattformen?.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
                        </span>
                        {!v.passende_plattform && <span className="text-xs text-warnung">andere Plattform</span>}
                      </span>
                      <button type="button" className="knopf-sekundaer shrink-0 px-2.5 py-1 text-sm" disabled={laeuft === artikel.id}
                        onClick={() => waehle(artikel, v)} data-testid="zuordnen-waehlen">Das ist es</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-leise">Kein Vorschlag im Katalog.</p>}
              {suche === artikel.id
                ? <KatalogWechsel artikel={artikel} onGeaendert={() => { setSuche(null); entferne(artikel.id); setZugeordnet((n) => n + 1); }} onSchliessen={() => setSuche(null)} />
                : <button type="button" className="text-sm text-akzent-hell underline" onClick={() => setSuche(artikel.id)}>Selbst suchen …</button>}
            </li>
          ))}
        </ul>
        {daten && daten.eintraege.length - zugeordnet < offen && (
          <button type="button" className="knopf-sekundaer w-full" onClick={() => laden(daten.eintraege.length - zugeordnet)}>Weitere laden</button>
        )}
      </div>
    </Layout>
  );
}
