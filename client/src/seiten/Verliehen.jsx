// Leihliste: was ich verliehen habe (mit Überfällig-Hinweis und Verlauf) und was mir andere geliehen haben.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { navigiere } from '../router.js';
import { datumDe } from '../format.js';
import Layout from '../komponenten/Layout.jsx';
import Cover from '../komponenten/Cover.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';

export default function Verliehen({ route }) {
  const zeigeHinweis = useHinweis();
  const geliehenAnsicht = route.parameter.ansicht === 'geliehen';
  const [d, setD] = useState(null);
  const laden = () => api.verleihungen().then(setD).catch((e) => zeigeHinweis(e.message, 'fehler'));
  useEffect(() => { laden(); }, []);
  const ausfuehren = async (fn, text) => {
    try { await fn(); zeigeHinweis(text); laden(); } catch (e) { zeigeHinweis(Object.values(e.felder ?? {})[0] ?? e.message, 'fehler'); }
  };
  const aktiv = d?.verliehen.filter((v) => !v.zurueck_am) ?? [];
  const frueher = d?.verliehen.filter((v) => v.zurueck_am) ?? [];

  return (
    <Layout route={route} titel="Leihliste" zurueck="/einstellungen">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex gap-2">
          <button type="button" className={!geliehenAnsicht ? 'chip-aktiv' : 'chip'} onClick={() => navigiere('/verliehen')}>Verliehen{aktiv.length ? ` (${aktiv.length})` : ''}</button>
          <button type="button" className={geliehenAnsicht ? 'chip-aktiv' : 'chip'} onClick={() => navigiere('/verliehen', { ansicht: 'geliehen' })}>
            Ausgeliehen von anderen{d?.geliehen.length ? ` (${d.geliehen.length})` : ''}</button>
        </div>
        {!d && <p className="text-leise">Wird geladen …</p>}
        {d && !geliehenAnsicht && (
          <>
            {aktiv.length === 0 && <p className="karte p-4 text-sm text-leise">Gerade ist nichts verliehen. Verleihen kannst du auf der Seite eines Exemplars („Verleihen …“).</p>}
            <ul className="space-y-2">
              {aktiv.map((v) => (
                <li key={v.id} className={`karte flex items-center gap-3 p-3 ${v.ueberfaellig ? 'border-warnung/60' : ''}`}>
                  <a href={`#/artikel/${v.artikel_id}`} className="shrink-0"><Cover url={v.bild_url} typ={v.typ} alt={v.titel} className="h-16 w-12 rounded" /></a>
                  <div className="min-w-0 flex-1 text-sm">
                    <a href={`#/artikel/${v.artikel_id}`} className="font-semibold hover:underline">{v.titel}</a>
                    <p className="text-leise">an <strong className="text-text">{v.an_name}</strong> seit {datumDe(v.seit)}
                      {v.rueckgabe_geplant && <> · Rückgabe {datumDe(v.rueckgabe_geplant)}</>}
                      {v.bestaetigung === 'offen' && ' · noch nicht bestätigt'}{v.bestaetigung === 'abgelehnt' && ' · vom Empfänger abgelehnt'}</p>
                    {v.ueberfaellig && <p className="text-xs font-semibold text-warnung">Rückgabe überfällig</p>}
                  </div>
                  <button type="button" className="knopf-sekundaer shrink-0 px-3 py-1.5" onClick={() => ausfuehren(() => api.verleihZurueck(v.id), 'Als zurückbekommen markiert.')}>Zurückbekommen</button>
                </li>
              ))}
            </ul>
            {frueher.length > 0 && (
              <details className="karte p-4 text-sm">
                <summary className="cursor-pointer font-semibold">Verlauf ({frueher.length})</summary>
                <ul className="mt-2 divide-y divide-rand">
                  {frueher.map((v) => (
                    <li key={v.id} className="py-1.5"><a href={`#/artikel/${v.artikel_id}`} className="hover:underline">{v.titel}</a>
                      <span className="text-leise"> · {v.an_name} · {datumDe(v.seit)} – {datumDe(v.zurueck_am)}</span></li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
        {d && geliehenAnsicht && (
          <>
            {d.geliehen.length === 0 && <p className="karte p-4 text-sm text-leise">Dir hat gerade niemand über ZockerDB etwas geliehen.</p>}
            <ul className="space-y-2">
              {d.geliehen.map((v) => (
                <li key={v.id} className="karte flex flex-wrap items-center gap-3 p-3">
                  <Cover url={v.bild_url} typ={v.typ} alt={v.titel} className="h-16 w-12 shrink-0 rounded" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">{v.titel}</p>
                    <p className="text-leise">{v.plattform ? `${v.plattform} · ` : ''}von <strong className="text-text">{v.verleiher}</strong> seit {datumDe(v.seit)}
                      {v.rueckgabe_geplant && <> · Rückgabe bis {datumDe(v.rueckgabe_geplant)}</>}</p>
                  </div>
                  {v.bestaetigung === 'offen' ? (
                    <span className="flex gap-2">
                      <button type="button" className="knopf-primaer px-3 py-1.5" onClick={() => ausfuehren(() => api.verleihAntwort(v.id, true), 'Danke – bestätigt.')}>Bestätigen</button>
                      <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => ausfuehren(() => api.verleihAntwort(v.id, false), 'Abgelehnt – der Verleiher wird informiert.')}>Kenne ich nicht</button>
                    </span>
                  ) : <span className="abzeichen text-erfolg">bestätigt</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Layout>
  );
}
