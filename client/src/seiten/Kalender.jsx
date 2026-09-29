// Releasekalender „Erscheint demnächst“: Termine nach Monat, Filter Plattform / nur Wunschliste,
// standardmäßig für „Meine Systeme“ (bzw. die Standardsysteme).
import { useEffect, useState } from 'react';
import { KATALOG_REGIONEN } from '../../../shared/konstanten.js';
import { api } from '../api.js';
import { navigiere } from '../router.js';
import { usePlattformen, nachHersteller } from '../plattformen.js';
import { Andockpunkt } from '../erweiterungen.jsx';
import Layout from '../komponenten/Layout.jsx';
import Cover from '../komponenten/Cover.jsx';

const MONAT = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const TAG = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const datum = (iso) => new Date(`${iso}T00:00:00Z`);
const heute = () => new Date().toISOString().slice(0, 10);
const plusTage = (iso, n) => new Date(datum(iso).getTime() + n * 86400000).toISOString().slice(0, 10);

/** Termin als Kachel – auch für die Vorschau auf der Sammlungsseite. */
export function TerminKachel({ t, onGeaendert, klein = false }) {
  return (
    <div className={`karte flex flex-col overflow-hidden ${klein ? 'w-32 shrink-0' : ''}`}>
      <a href={`#/katalog/${t.katalog.id}`} className="hover:opacity-90">
        <Cover url={t.katalog.cover_url} typ={t.katalog.typ} alt={t.katalog.titel} className="aspect-[3/4] w-full" />
      </a>
      <div className="flex flex-1 flex-col gap-0.5 p-2">
        <p className="text-xs font-semibold text-akzent-hell">{TAG.format(datum(t.datum))}</p>
        <a href={`#/katalog/${t.katalog.id}`} className="line-clamp-2 text-sm font-semibold hover:underline">{t.katalog.titel}</a>
        <p className="text-xs text-leise">{[t.plattform_kurz || t.plattform, t.region && t.region !== 'Europa' ? t.region : null].filter(Boolean).join(' · ')}</p>
        {t.im_besitz && <p className="text-xs text-erfolg">In deiner Sammlung</p>}
        {!klein && <div className="mt-auto pt-1"><Andockpunkt name="kalender.termin" termin={t} onGeaendert={onGeaendert} /></div>}
      </div>
    </div>
  );
}

export default function Kalender({ route }) {
  const p = route.parameter;
  const plattformen = usePlattformen();
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState(null);
  const vergangen = p.ansicht === 'erschienen';
  const von = vergangen ? plusTage(heute(), -60) : heute();
  const bis = vergangen ? plusTage(heute(), -1) : plusTage(heute(), Number(p.tage) || 120);

  const laden = () => api.kalender({ von, bis, plattform: p.plattform, alle: p.alle, wunschliste: p.wunschliste, region: p.region })
    .then((d) => { setDaten(d); setFehler(null); }).catch((e) => setFehler(e.message));
  useEffect(() => { setDaten(null); laden(); }, [p.plattform, p.alle, p.wunschliste, p.ansicht, p.tage, p.region]); // eslint-disable-line react-hooks/exhaustive-deps

  const setze = (neu) => navigiere('/kalender', Object.fromEntries(Object.entries({ ...p, ...neu }).filter(([, w]) => w)));
  const termine = daten ? (vergangen ? [...daten.termine].reverse() : daten.termine) : [];
  const monate = [];
  for (const t of termine) {
    const m = MONAT.format(datum(t.datum));
    if (monate.at(-1)?.name !== m) monate.push({ name: m, termine: [] });
    monate.at(-1).termine.push(t);
  }

  return (
    <Layout route={route} titel={vergangen ? 'Kürzlich erschienen' : 'Erscheint demnächst'}>
      <div className="space-y-4">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button type="button" className={!vergangen ? 'chip-aktiv' : 'chip'} onClick={() => setze({ ansicht: null })}>Demnächst</button>
          <button type="button" className={vergangen ? 'chip-aktiv' : 'chip'} onClick={() => setze({ ansicht: 'erschienen' })}>Kürzlich erschienen</button>
          {daten?.wunschlisteVerfuegbar && (
            <button type="button" className={p.wunschliste ? 'chip-aktiv' : 'chip'} onClick={() => setze({ wunschliste: p.wunschliste ? null : '1' })}>Nur Wunschliste</button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="sr-only" htmlFor="kalender-plattform">Plattform</label>
          <select id="kalender-plattform" className="eingabe w-auto" value={p.plattform ?? (p.alle ? 'alle' : '')}
            onChange={(e) => setze(e.target.value === 'alle' ? { alle: '1', plattform: null } : { plattform: e.target.value || null, alle: null })}>
            <option value="">Meine Systeme</option>
            <option value="alle">Alle Plattformen</option>
            {nachHersteller(plattformen).map(([hersteller, liste]) => (
              <optgroup key={hersteller} label={hersteller}>
                {liste.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </optgroup>
            ))}
          </select>
          <select className="eingabe w-auto" value={p.region ?? 'pal'} onChange={(e) => setze({ region: e.target.value === 'pal' ? null : e.target.value })} aria-label="Region">
            {KATALOG_REGIONEN.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {!vergangen && (
            <select className="eingabe w-auto" value={p.tage ?? '120'} onChange={(e) => setze({ tage: e.target.value === '120' ? null : e.target.value })} aria-label="Zeitraum">
              <option value="30">nächste 30 Tage</option>
              <option value="120">nächste 4 Monate</option>
              <option value="365">nächstes Jahr</option>
            </select>
          )}
        </div>

        {fehler && <p className="text-gefahr" role="alert">{fehler}</p>}
        {daten?.fehler && <p className="karte p-4 text-sm text-leise">{daten.fehler}</p>}
        {!daten && !fehler && <p className="text-leise">Wird geladen …</p>}
        {daten && !daten.quelle && !daten.fehler && (
          <p className="karte p-4 text-sm text-leise">
            Für den Releasekalender braucht es Erscheinungstermine – die kommen von zockerdb.de. Schalte in der Administration die
            Verbindung zu zockerdb.de ein, dann erscheinen hier die Termine.
          </p>
        )}
        {daten?.quelle && termine.length === 0 && (
          <p className="karte p-4 text-sm text-leise">
            Keine Termine gefunden{daten.gefiltert ? ' – probiere „Alle Plattformen“ oder wähle unter Katalog → „Systeme auswählen“ weitere Systeme aus' : ''}.
          </p>
        )}
        {monate.map((m) => (
          <section key={m.name} className="space-y-2">
            <h2 className="font-semibold">{m.name} <span className="text-sm font-normal text-leise">· {m.termine.length}</span></h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {m.termine.map((t) => <TerminKachel key={`${t.katalog.id}-${t.plattform}`} t={t} onGeaendert={laden} />)}
            </div>
          </section>
        ))}
        {daten?.mehr && <p className="text-center text-sm text-leise">Es gibt weitere Termine – wähle eine Plattform oder einen kürzeren Zeitraum.</p>}
        {daten?.quelle && <p className="text-xs text-leise">Termine: IGDB.com (europäische bzw. weltweite Termine bevorzugt). Angaben ohne Gewähr.</p>}
      </div>
    </Layout>
  );
}

/** Kompakte Vorschau für die Sammlungsseite – erscheint nur, wenn es Termine gibt. */
export function DemnaechstVorschau() {
  const [daten, setDaten] = useState(null);
  const [zu, setZu] = useState(() => { try { return localStorage.getItem('demnaechst-zu') === '1'; } catch { return false; } });
  useEffect(() => {
    api.kalender({ von: heute(), bis: plusTage(heute(), 60), grenze: 20 }).then(setDaten).catch(() => {});
  }, []);
  if (!daten?.termine?.length) return null;
  const umschalten = () => {
    setZu(!zu);
    try { localStorage.setItem('demnaechst-zu', zu ? '0' : '1'); } catch { /* egal */ }
  };
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="font-semibold" onClick={umschalten} aria-expanded={!zu}>{zu ? '▸' : '▾'} Erscheint demnächst</button>
        <a href="#/kalender" className="text-sm text-akzent-hell hover:underline">Kalender →</a>
      </div>
      {!zu && (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
          {daten.termine.map((t) => <TerminKachel key={`${t.katalog.id}-${t.plattform}`} t={t} klein />)}
        </div>
      )}
    </section>
  );
}
