// Zustand & Wartung am Exemplar: Verlauf (Batterie, Recap, Laufwerk, Mods …), nur passende Wartungsarten, Hinweis zum Batteriealter
// und die Wartungsmerkmale des Katalogeintrags (vorschlagen bzw. als Moderationsteam festlegen).
import { useEffect, useState } from 'react';
import { WARTUNGSARTEN, WARTUNGSMERKMALE, istModerator } from '../../../shared/konstanten.js';
import { api } from '../api.js';
import { datumDe, leseDatum } from '../format.js';
import { useSitzung } from '../sitzung.js';
import { useHinweis } from './Hinweise.jsx';

const art = (wert) => WARTUNGSARTEN.find((a) => a.value === wert) ?? { label: wert, icon: '📝' };
const datumAnzeige = (d) => (d?.length === 10 ? datumDe(d) : d?.length === 7 ? `${d.slice(5)}.${d.slice(0, 4)}` : d);

export default function Wartung({ artikel }) {
  const zeigeHinweis = useHinweis();
  const [info, setInfo] = useState(null);
  const [neu, setNeu] = useState(null);
  const laden = () => api.wartung(artikel.id).then(setInfo).catch(() => {});
  useEffect(() => { laden(); }, [artikel.id]);
  if (!info) return null;

  async function speichern(e) {
    e.preventDefault();
    try {
      setInfo(await api.wartungNeu(artikel.id, { art: neu.art, datum: neu.datum ? leseDatum(neu.datum) : null, notiz: neu.notiz }));
      setNeu(null);
      zeigeHinweis('Wartung eingetragen.');
    } catch (fehler) {
      zeigeHinweis(Object.values(fehler.felder ?? {})[0] ?? fehler.message, 'fehler');
    }
  }

  return (
    <section className="karte space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Zustand & Wartung</h3>
        {!neu && <button type="button" className="knopf-sekundaer text-sm" onClick={() => setNeu({ art: info.arten[0], datum: '', notiz: '' })}>+ Eintrag</button>}
      </div>
      {info.batterie && (
        <p className={`rounded-lg p-2 text-sm ${info.batterie.warnung ? 'bg-warnung/10 text-warnung' : 'text-leise'}`}>🔋 {info.batterie.text}</p>
      )}
      {neu && (
        <form onSubmit={speichern} className="grid gap-2 rounded-lg border border-rand p-3 sm:grid-cols-3">
          <select className="eingabe" value={neu.art} onChange={(e) => setNeu({ ...neu, art: e.target.value })} aria-label="Wartungsart">
            {info.arten.map((a) => <option key={a} value={a}>{art(a).icon} {art(a).label}</option>)}
          </select>
          <input className="eingabe" value={neu.datum} onChange={(e) => setNeu({ ...neu, datum: e.target.value })} placeholder="Datum (leer = heute)" inputMode="numeric" aria-label="Datum" />
          <input className="eingabe" value={neu.notiz} onChange={(e) => setNeu({ ...neu, notiz: e.target.value })} placeholder="z. B. CR2032, Region-Mod" maxLength={1000} aria-label="Notiz" />
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" className="knopf-primaer text-sm">Speichern</button>
            <button type="button" className="knopf-sekundaer text-sm" onClick={() => setNeu(null)}>Abbrechen</button>
          </div>
        </form>
      )}
      {info.eintraege.length === 0 && !neu && <p className="text-sm text-leise">Noch keine Wartung eingetragen.</p>}
      {info.eintraege.length > 0 && (
        <ul className="divide-y divide-rand text-sm">
          {info.eintraege.map((w) => (
            <li key={w.id} className="flex items-start justify-between gap-2 py-2">
              <span>{art(w.art).icon} <strong>{art(w.art).label}</strong> · {datumAnzeige(w.datum)}{w.notiz && <span className="block text-leise">{w.notiz}</span>}</span>
              <button type="button" className="text-xs text-leise underline" onClick={async () => {
                if (!window.confirm('Eintrag löschen?')) return;
                await api.wartungLoeschen(w.id).catch(() => {});
                laden();
              }}>Löschen</button>
            </li>
          ))}
        </ul>
      )}
      {artikel.katalog_id && <Merkmale katalogId={artikel.katalog_id} gesetzt={info.merkmale} quelle={info.merkmale_quelle} onGeaendert={laden} />}
    </section>
  );
}

/** Wartungsmerkmale des Katalogeintrags anzeigen und korrigieren (Vorschlag bzw. direkt durch das Moderationsteam). */
export function Merkmale({ katalogId, gesetzt, quelle, onGeaendert }) {
  const { benutzer } = useSitzung();
  const zeigeHinweis = useHinweis();
  const [bearbeiten, setBearbeiten] = useState(null);
  const moderator = istModerator(benutzer);
  const wertText = (w) => (w === true ? 'ja' : w === null ? 'je nach Titel' : 'nein');

  async function senden(e) {
    e.preventDefault();
    try {
      const r = await api.wartungsmerkmaleSetzen(katalogId, { merkmale: bearbeiten.merkmale, begruendung: bearbeiten.begruendung });
      zeigeHinweis(r.vorgeschlagen ? 'Danke! Das Moderationsteam prüft deinen Vorschlag.' : 'Merkmale gespeichert.');
      setBearbeiten(null);
      onGeaendert?.();
    } catch (fehler) {
      zeigeHinweis(fehler.message, 'fehler');
    }
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-leise">Wartungsmerkmale ({quelle === 'katalog' ? 'geprüft' : 'Standard der Plattform'})</summary>
      {!bearbeiten ? (
        <div className="mt-2 space-y-2">
          <ul className="space-y-1">
            {WARTUNGSMERKMALE.map((m) => <li key={m.value}><span className="text-leise">{m.label}:</span> {wertText(gesetzt?.[m.value] ?? false)}</li>)}
          </ul>
          <button type="button" className="text-xs underline" onClick={() => setBearbeiten({ merkmale: Object.fromEntries(WARTUNGSMERKMALE.map((m) => [m.value, gesetzt?.[m.value] ?? false])), begruendung: '' })}>
            {moderator ? 'Merkmale festlegen' : 'Stimmt nicht? Korrektur vorschlagen'}
          </button>
        </div>
      ) : (
        <form onSubmit={senden} className="mt-2 space-y-2">
          {WARTUNGSMERKMALE.map((m) => (
            <label key={m.value} className="flex items-center justify-between gap-2">
              <span>{m.label}<span className="block text-xs text-leise">{m.hinweis}</span></span>
              <select className="eingabe w-40" value={String(bearbeiten.merkmale[m.value])}
                onChange={(e) => setBearbeiten({ ...bearbeiten, merkmale: { ...bearbeiten.merkmale, [m.value]: e.target.value === 'null' ? null : e.target.value === 'true' } })}>
                <option value="true">ja</option>
                <option value="false">nein</option>
                <option value="null">je nach Titel</option>
              </select>
            </label>
          ))}
          {!moderator && <input className="eingabe" value={bearbeiten.begruendung} onChange={(e) => setBearbeiten({ ...bearbeiten, begruendung: e.target.value })} maxLength={500} placeholder="Kurze Begründung (optional)" />}
          <div className="flex gap-2">
            <button type="submit" className="knopf-primaer text-sm">{moderator ? 'Speichern' : 'Vorschlag senden'}</button>
            <button type="button" className="knopf-sekundaer text-sm" onClick={() => setBearbeiten(null)}>Abbrechen</button>
          </div>
        </form>
      )}
    </details>
  );
}

/** Katalogseite: Wartungsmerkmale des Eintrags (für Sammler mit „Zustand & Wartung“ und das Moderationsteam). */
export function KatalogMerkmale({ katalogId }) {
  const [d, setD] = useState(null);
  const laden = () => api.wartungsmerkmale(katalogId).then(setD).catch(() => {});
  useEffect(() => { laden(); }, [katalogId]);
  if (!d) return null;
  return (
    <section className="karte space-y-2 p-4">
      <h3 className="font-semibold">Zustand & Wartung</h3>
      <Merkmale katalogId={katalogId} gesetzt={d.merkmale} quelle={d.quelle} onGeaendert={laden} />
      {d.vorschlaege?.length > 0 && <MerkmalVorschlaege liste={d.vorschlaege} onGeaendert={laden} />}
    </section>
  );
}

/** Moderation: offene Vorschläge zu Wartungsmerkmalen übernehmen oder ablehnen. */
export function MerkmalVorschlaege({ liste: vorgegeben, onGeaendert }) {
  const [geladen, setListe] = useState(null);
  const laden = () => (vorgegeben ? onGeaendert?.() : api.merkmalVorschlaege().then(setListe).catch(() => setListe([])));
  useEffect(() => { if (!vorgegeben) laden(); }, []);
  const liste = vorgegeben ?? geladen;
  if (!liste?.length) return null;
  const text = (m) => WARTUNGSMERKMALE.filter((x) => x.value in (m ?? {})).map((x) => `${x.label}: ${m[x.value] === true ? 'ja' : m[x.value] === null ? 'je nach Titel' : 'nein'}`).join(' · ');
  return (
    <section className="karte space-y-2 p-4">
      <h2 className="font-semibold">Vorschläge zu Wartungsmerkmalen ({liste.length})</h2>
      <ul className="divide-y divide-rand text-sm">
        {liste.map((v) => (
          <li key={v.id} className="space-y-1 py-2">
            <a href={`#/katalog/${v.katalog_id}`} className="font-medium underline">{v.titel}</a>
            <span className="text-leise"> · von {v.von ?? 'gelöschtem Konto'}</span>
            <p>{text(v.merkmale)}</p>
            {v.begruendung && <p className="text-leise">„{v.begruendung}“</p>}
            <div className="flex gap-2">
              <button type="button" className="knopf-primaer text-xs" onClick={() => api.merkmalEntscheiden(v.id, true).then(laden)}>Übernehmen</button>
              <button type="button" className="knopf-sekundaer text-xs" onClick={() => api.merkmalEntscheiden(v.id, false).then(laden)}>Ablehnen</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
