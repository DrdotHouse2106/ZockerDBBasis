// Ideen & Wünsche: Funktionen vorschlagen, abstimmen („Daumen hoch“) und sehen, was geplant oder umgesetzt ist.
// Selbst gehostet gehen Ideen an zockerdb.de – hier stehen dann nur die eigenen mit ihrem Stand.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { datumDe } from '../format.js';
import { useSitzung } from '../sitzung.js';
import Layout from '../komponenten/Layout.jsx';
import Symbol from '../komponenten/Symbole.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';

const FARBE = { neu: '', geplant: 'text-akzent-hell', in_arbeit: 'text-warnung', umgesetzt: 'text-erfolg', abgelehnt: 'text-leise' };

export default function Ideen({ route }) {
  const zeigeHinweis = useHinweis();
  const { benutzer } = useSitzung();
  const [d, setD] = useState(null);
  const [filter, setFilter] = useState('offen');
  const [bearbeitet, setBearbeitet] = useState(null);
  const laden = () => api.ideen().then(setD).catch((e) => zeigeHinweis(e.message, 'fehler'));
  useEffect(() => { laden(); }, []);

  const ersetze = (neu) => setD((alt) => ({ ...alt, ideen: alt.ideen.map((i) => (i.id === neu.id ? neu : i)) }));
  const aktion = async (fn) => {
    try { const neu = await fn(); if (neu) ersetze(neu); } catch (e) { zeigeHinweis(e.message, 'fehler'); }
  };

  const brett = d?.modus === 'brett';
  const statusText = Object.fromEntries(d?.status ?? []);
  const bereichText = Object.fromEntries(d?.bereiche ?? []);
  const gefiltert = (d?.ideen ?? []).filter((i) => (filter === 'offen' ? !['umgesetzt', 'abgelehnt'].includes(i.status) : filter === 'alle' || i.status === filter));

  return (
    <Layout route={route} titel="Ideen & Wünsche" zurueck="/einstellungen">
      <div className="mx-auto max-w-3xl space-y-4">
        {!d ? <p className="text-leise">Wird geladen …</p> : !d.modus ? (
          <p className="karte p-4 text-sm text-leise">Ideen lassen sich auf diesem Server nicht einreichen.</p>
        ) : (
          <>
            <p className="text-sm text-leise">
              {brett
                ? 'Was fehlt dir? Schlag eine Funktion vor oder unterstütze Ideen anderer mit 👍 – die beliebtesten kommen zuerst dran.'
                : 'Was fehlt dir? Deine Idee geht an zockerdb.de, wo ZockerDB weiterentwickelt wird. Hier siehst du ihren Stand.'}
            </p>
            <NeueIdee d={d} brett={brett} onNeu={(i) => { setD((alt) => ({ ...alt, ideen: [i, ...alt.ideen] })); setFilter('offen'); }} onStimme={(id) => aktion(() => api.ideeStimme(id))} />

            <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="tablist">
              {[['offen', 'Offen'], ...d.status.filter(([w]) => w !== 'neu'), ['alle', 'Alle']].map(([w, l]) => (
                <button key={w} type="button" role="tab" aria-selected={filter === w} className={filter === w ? 'chip-aktiv' : 'chip'} onClick={() => setFilter(w)}>
                  {l} <span className="opacity-70">{(d.ideen ?? []).filter((i) => (w === 'offen' ? !['umgesetzt', 'abgelehnt'].includes(i.status) : w === 'alle' || i.status === w)).length}</span>
                </button>
              ))}
            </div>

            {gefiltert.length === 0 && <p className="karte p-6 text-center text-sm text-leise">{brett ? 'Hier gibt es noch keine Ideen.' : 'Du hast noch keine Ideen eingereicht.'}</p>}
            <ul className="space-y-2">
              {gefiltert.map((i) => (
                <li key={i.id} className="karte flex gap-3 p-4">
                  {bearbeitet === i.id ? (
                    <IdeeFormular d={d} wert={i} titel="Idee bearbeiten" knopf="Speichern" className="min-w-0 flex-1 space-y-3"
                      onAbbrechen={() => setBearbeitet(null)}
                      onSenden={async (w) => { const neu = await api.ideeAendern(i.id, w); ersetze(neu); setBearbeitet(null); zeigeHinweis('Gespeichert.'); }} />
                  ) : (<>
                  {brett && (
                    <button type="button" disabled={i.eigene} onClick={() => aktion(() => api.ideeStimme(i.id))}
                      className={`flex h-fit w-14 shrink-0 flex-col items-center rounded-xl border py-2 text-sm font-semibold ${i.gestimmt || i.eigene ? 'border-akzent bg-akzent/10 text-akzent-hell' : 'border-rand hover:border-akzent/60'}`}
                      aria-pressed={i.gestimmt} aria-label={i.eigene ? `Deine Idee, ${i.stimmen} Stimmen` : `${i.gestimmt ? 'Stimme zurücknehmen' : 'Dafür stimmen'} (${i.stimmen} Stimmen)`}
                      title={i.eigene ? 'Deine eigene Idee zählt automatisch' : i.gestimmt ? 'Stimme zurücknehmen' : 'Dafür stimmen'}>
                      <span aria-hidden="true">👍</span>{i.stimmen}
                    </button>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="min-w-0">{i.titel}</strong>
                      <span className={`abzeichen ${FARBE[i.status]}`}>{statusText[i.status]}</span>
                      <span className="abzeichen">{bereichText[i.bereich]}</span>
                    </div>
                    {i.beschreibung && <p className="text-sm whitespace-pre-line">{i.beschreibung}</p>}
                    {i.antwort && <p className="rounded-lg bg-karte-hover p-2 text-sm"><strong>Antwort:</strong> {i.antwort}</p>}
                    {i.github && <a href={i.github.url} target="_blank" rel="noopener noreferrer" className="text-xs text-akzent-hell underline">Auf GitHub verfolgen (#{i.github.nummer}) ↗</a>}
                    {i.kommentare?.length > 0 && (
                      <details className="rounded-lg border border-rand p-2 text-sm" data-testid="idee-kommentare">
                        <summary className="cursor-pointer text-leise">{i.kommentare.length === 1 ? '1 Kommentar' : `${i.kommentare.length} Kommentare`} auf GitHub</summary>
                        <ul className="mt-2 space-y-2">
                          {i.kommentare.map((c) => (
                            <li key={c.id}>
                              <p className="text-xs text-leise">{c.autor ? `@${c.autor}` : 'GitHub'} · {datumDe(c.erstellt_am?.slice(0, 10))}</p>
                              <p className="whitespace-pre-line break-words">{c.text}</p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <p className="text-xs text-leise">{i.eigene ? 'Deine Idee' : i.von ? `von ${i.von}` : ''} · {datumDe(i.erstellt_am?.slice(0, 10))}</p>
                    {benutzer?.rolle === 'admin' && brett && <Entscheiden idee={i} status={d.status} onFertig={ersetze} />}
                    <div className="flex flex-wrap gap-3">
                      {(i.eigene && !['umgesetzt', 'abgelehnt'].includes(i.status)) || (benutzer?.rolle === 'admin' && brett) ? (
                        <button type="button" className="text-xs text-akzent-hell underline" onClick={() => setBearbeitet(i.id)}>Bearbeiten</button>
                      ) : null}
                      {(i.eigene && i.status === 'neu') || (benutzer?.rolle === 'admin' && brett) ? (
                        <button type="button" className="text-xs text-gefahr underline" onClick={async () => {
                          if (!window.confirm('Idee löschen?')) return;
                          try { await api.ideeLoeschen(i.id); setD((alt) => ({ ...alt, ideen: alt.ideen.filter((x) => x.id !== i.id) })); } catch (e) { zeigeHinweis(e.message, 'fehler'); }
                        }}>Löschen</button>
                      ) : null}
                    </div>
                  </div>
                  </>)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Layout>
  );
}

function NeueIdee({ d, brett, onNeu, onStimme }) {
  const zeigeHinweis = useHinweis();
  const leer = { titel: '', beschreibung: '', bereich: 'sonstiges' };
  const [w, setW] = useState(leer);
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState({});
  const [sendet, setSendet] = useState(false);
  const [aehnlich, setAehnlich] = useState([]);
  const setze = (f) => (e) => setW((x) => ({ ...x, [f]: e.target.value }));

  // Ähnliche Ideen beim Tippen zeigen – lieber dafür stimmen als doppelt einreichen
  useEffect(() => {
    if (!brett || w.titel.trim().length < 4) { setAehnlich([]); return undefined; }
    const t = setTimeout(() => api.ideenAehnliche(w.titel).then(setAehnlich).catch(() => {}), 350);
    return () => clearTimeout(t);
  }, [w.titel, brett]);

  async function absenden(e) {
    e.preventDefault();
    setSendet(true);
    setFehler({});
    try {
      const i = await api.ideeEinreichen(w);
      onNeu(i);
      zeigeHinweis(i.ziel === 'zockerdb.de' ? 'Danke! Deine Idee ist bei zockerdb.de angekommen.' : 'Danke für deine Idee!');
      setW(leer);
      setOffen(false);
    } catch (f) {
      setFehler(f.felder ?? { allgemein: f.message });
    } finally {
      setSendet(false);
    }
  }

  if (!offen) {
    return <button type="button" className="knopf-primaer" onClick={() => setOffen(true)}><Symbol name="plus" className="size-4" />Idee vorschlagen</button>;
  }
  return (
    <form onSubmit={absenden} className="karte space-y-3 p-4">
      <h2 className="font-semibold">Neue Idee</h2>
      <label className="block text-sm">
        <span className="mb-1 block text-leise">Was fehlt dir? (kurz) *</span>
        <input className="eingabe" value={w.titel} onChange={setze('titel')} maxLength={120} required autoFocus placeholder="z. B. Verkaufte Spiele in der Sammlung behalten" />
        {fehler.titel && <span className="text-gefahr">{fehler.titel}</span>}
      </label>
      {aehnlich.length > 0 && (
        <div className="space-y-1 rounded-lg border border-akzent/40 p-3 text-sm">
          <p className="text-leise">Gibt es schon? Dann stimm lieber dafür:</p>
          {aehnlich.map((i) => (
            <div key={i.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{i.titel}</span>
              <button type="button" disabled={i.eigene} className={i.gestimmt ? 'chip-aktiv' : 'chip'}
                onClick={async () => { await onStimme(i.id); setAehnlich((alt) => alt.map((x) => (x.id === i.id ? { ...x, gestimmt: !x.gestimmt, stimmen: x.stimmen + (x.gestimmt ? -1 : 1) } : x))); }}>
                👍 {i.stimmen}
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="block text-sm">
        <span className="mb-1 block text-leise">Beschreibung (optional)</span>
        <textarea className="eingabe min-h-24" value={w.beschreibung} onChange={setze('beschreibung')} maxLength={3000}
          placeholder="Wofür brauchst du das? Wie stellst du es dir vor?" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-leise">Bereich</span>
        <select className="eingabe" value={w.bereich} onChange={setze('bereich')}>
          {d.bereiche.map(([wert, label]) => <option key={wert} value={wert}>{label}</option>)}
        </select>
      </label>
      {d.github && (
        <p className="text-xs text-leise">
          Ideen werden auch als öffentliches Issue auf GitHub veröffentlicht (Titel, Beschreibung, Bereich, Stimmen – ohne deinen Namen).
          Bitte keine persönlichen Daten in den Text schreiben.
        </p>
      )}
      {fehler.allgemein && <p className="text-sm text-gefahr" role="alert">{fehler.allgemein}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="knopf-primaer" disabled={sendet}>{sendet ? 'Wird gesendet …' : 'Idee einreichen'}</button>
        <button type="button" className="knopf-sekundaer" onClick={() => setOffen(false)}>Abbrechen</button>
      </div>
    </form>
  );
}

/** Administration: Stand setzen und antworten. */
function Entscheiden({ idee, status, onFertig }) {
  const zeigeHinweis = useHinweis();
  const [offen, setOffen] = useState(false);
  const [w, setW] = useState({ status: idee.status, antwort: idee.antwort ?? '' });
  if (!offen) return <button type="button" className="text-xs text-akzent-hell underline" onClick={() => setOffen(true)}>Stand festlegen</button>;
  return (
    <div className="space-y-2 rounded-lg border border-rand p-2 text-sm">
      <select className="eingabe" value={w.status} onChange={(e) => setW((x) => ({ ...x, status: e.target.value }))}>
        {status.map(([wert, label]) => <option key={wert} value={wert}>{label}</option>)}
      </select>
      <textarea className="eingabe min-h-16" value={w.antwort} onChange={(e) => setW((x) => ({ ...x, antwort: e.target.value }))} maxLength={2000}
        placeholder="Antwort (optional) – wird angezeigt; Einreicher und Unterstützer werden benachrichtigt" />
      <div className="flex gap-2">
        <button type="button" className="knopf-primaer px-3 py-1.5" onClick={async () => {
          try { onFertig(await api.ideeEntscheiden(idee.id, w)); setOffen(false); zeigeHinweis('Gespeichert.'); } catch (e) { zeigeHinweis(e.message, 'fehler'); }
        }}>Speichern</button>
        <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setOffen(false)}>Abbrechen</button>
      </div>
    </div>
  );
}

/** Eigene Idee nachträglich ändern (Titel, Beschreibung, Bereich). */
function IdeeFormular({ d, wert, titel, knopf, className, onSenden, onAbbrechen }) {
  const [w, setW] = useState({ titel: wert.titel, beschreibung: wert.beschreibung ?? '', bereich: wert.bereich });
  const [fehler, setFehler] = useState({});
  const [sendet, setSendet] = useState(false);
  const setze = (f) => (e) => setW((x) => ({ ...x, [f]: e.target.value }));
  async function absenden(e) {
    e.preventDefault();
    setSendet(true);
    setFehler({});
    try { await onSenden(w); } catch (f) { setFehler(f.felder ?? { allgemein: f.message }); } finally { setSendet(false); }
  }
  return (
    <form onSubmit={absenden} className={className}>
      <h2 className="font-semibold">{titel}</h2>
      <label className="block text-sm">
        <span className="mb-1 block text-leise">Was fehlt dir? (kurz) *</span>
        <input className="eingabe" value={w.titel} onChange={setze('titel')} maxLength={120} required />
        {fehler.titel && <span className="text-gefahr">{fehler.titel}</span>}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-leise">Beschreibung (optional)</span>
        <textarea className="eingabe min-h-24" value={w.beschreibung} onChange={setze('beschreibung')} maxLength={3000} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-leise">Bereich</span>
        <select className="eingabe" value={w.bereich} onChange={setze('bereich')}>
          {d.bereiche.map(([wert2, label]) => <option key={wert2} value={wert2}>{label}</option>)}
        </select>
      </label>
      {fehler.allgemein && <p className="text-sm text-gefahr" role="alert">{fehler.allgemein}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="knopf-primaer" disabled={sendet}>{sendet ? 'Wird gespeichert …' : knopf}</button>
        <button type="button" className="knopf-sekundaer" onClick={onAbbrechen}>Abbrechen</button>
      </div>
    </form>
  );
}
