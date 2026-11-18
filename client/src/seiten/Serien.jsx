// Figurenserien (Merch): Übersicht aller Serien mit Unterserien und Fortschritt; neue Serie anlegen.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Layout from '../komponenten/Layout.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import { navigiere } from '../router.js';
import { TourAngebot } from '../tour.jsx';

/** „32 von 48 Figuren · 95 von 210 Farben“ mit Balken. */
export function Fortschritt({ f, klein = false }) {
  if (!f) return null;
  const anteil = f.figuren.gesamt ? Math.min(100, Math.round((f.figuren.besitz / f.figuren.gesamt) * 100)) : 0;
  return (
    <div className="space-y-1" data-testid="serien-fortschritt">
      <div className={`h-1.5 overflow-hidden rounded-full bg-rand ${klein ? 'w-32' : ''}`} role="progressbar" aria-valuenow={f.figuren.besitz} aria-valuemax={f.figuren.gesamt}>
        <div className="h-full bg-akzent" style={{ width: `${anteil}%` }} />
      </div>
      <p className="text-xs text-leise">
        {f.figuren.besitz} von {f.figuren.gesamt} Figuren{f.farben.gesamt ? ` · ${f.farben.besitz} von ${f.farben.gesamt} Farben` : ''}
      </p>
    </div>
  );
}

export const STATUS_TEXT = { privat: 'Privat', eingereicht: 'Zur Freigabe eingereicht', freigegeben: null };

export default function Serien({ route }) {
  const zeigeHinweis = useHinweis();
  const [liste, setListe] = useState(null);
  const [name, setName] = useState('');
  const [offen, setOffen] = useState(false);
  const laden = () => api.serien().then(setListe).catch((e) => zeigeHinweis(e.message, 'fehler'));
  useEffect(() => { laden(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // „Meine Serien“ (folge ich, habe Figuren daraus, selbst angelegt) oben, der Rest eingeklappt darunter
  const meine = liste?.filter((x) => x.meine) ?? [];
  const weitere = liste?.filter((x) => !x.meine) ?? [];

  async function folgen(serie) {
    try {
      await api.serieFolgen(serie.id, !serie.folge);
      await laden();
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    }
  }

  async function anlegen(e) {
    e.preventDefault();
    try {
      const s = await api.serieAnlegen({ name });
      navigiere(`/serien/${s.id}`);
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    }
  }

  return (
    <Layout route={route} titel="Figurenserien" zurueck="/einstellungen">
      <div className="mx-auto max-w-3xl space-y-4 pb-8">
        <TourAngebot tour="figurenserien" titel="Neu bei den Figurenserien? Wir zeigen dir, wie es geht." />
        <p className="text-sm text-leise">
          Serien wie Monster in my Pocket oder Funko Pop!: Figuren mit Nummer und Namen, je Unterserie mit allen Farben, in denen es sie gab.
          Tippe eine Serie an, um zu sehen, was dir noch fehlt, und Figuren direkt in deine Sammlung zu übernehmen.
        </p>
        {!liste && <p className="text-leise">Wird geladen …</p>}
        {liste && meine.length > 0 && <h2 className="text-sm font-semibold tracking-wide text-leise uppercase">Meine Serien</h2>}
        <SerienListe liste={meine} onFolgen={folgen} tourZiel />
        {liste && weitere.length > 0 && (meine.length > 0
          ? (
            <details className="space-y-3" open={offen} onToggle={(e) => setOffen(e.currentTarget.open)} data-testid="weitere-serien">
              <summary className="cursor-pointer text-sm font-semibold tracking-wide text-leise uppercase">Weitere Serien ({weitere.length})</summary>
              <p className="mt-2 text-xs text-leise">Mit ☆ folgst du einer Serie – sie steht dann oben bei „Meine Serien“. Serien, aus denen du Figuren hast, stehen automatisch dort.</p>
              <div className="mt-3"><SerienListe liste={weitere} onFolgen={folgen} /></div>
            </details>
          )
          : (
            <>
              <p className="text-xs text-leise">Mit ☆ folgst du einer Serie – sie steht dann oben bei „Meine Serien“. Serien, aus denen du Figuren hast, kommen automatisch dazu.</p>
              <SerienListe liste={weitere} onFolgen={folgen} tourZiel />
            </>
          ))}
        <form onSubmit={anlegen} className="karte flex flex-wrap items-end gap-2 p-4" data-tour="serie-neu">
          <label className="min-w-0 flex-1">
            <span className="beschriftung">Neue Serie</span>
            <input className="eingabe" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Funko Pop! Games" required maxLength={100} />
          </label>
          <button type="submit" className="knopf-primaer">Anlegen</button>
          <p className="basis-full text-xs text-leise">Neue Serien sind zuerst nur für dich sichtbar. Reichst du sie ein, prüft die Moderation sie und gibt sie für alle frei.</p>
        </form>
      </div>
    </Layout>
  );
}

/** Hauptserien als Karten mit Unterserien; ☆/★ = folgen. tourZiel: die erste Karte ist das Ziel der Tour. */
function SerienListe({ liste, onFolgen, tourZiel = false }) {
  return (
    <div className="space-y-4">
      {liste.map((s, i) => (
        <section key={s.id} className="karte space-y-3 p-4" data-testid="serie" data-tour={tourZiel && i === 0 ? 'serien-liste' : undefined}>
          <div className="flex items-start gap-2">
            <a href={`#/serien/${s.id}`} className="block min-w-0 flex-1 space-y-1">
              <h2 className="font-semibold">{s.name} {STATUS_TEXT[s.status] && <span className="abzeichen ml-1 text-xs text-leise">{STATUS_TEXT[s.status]}</span>}</h2>
              <Fortschritt f={s.fortschritt} />
            </a>
            <button type="button" className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-warnung hover:bg-karte-hover" aria-pressed={s.folge}
              aria-label={s.folge ? `${s.name}: nicht mehr folgen` : `${s.name}: folgen`} title={s.folge ? 'Nicht mehr folgen' : 'Folgen – steht dann bei „Meine Serien“'}
              onClick={() => onFolgen(s)} data-testid="serie-folgen">{s.folge ? '★' : '☆'}</button>
          </div>
          {s.kinder.length > 0 && (
            <ul className="divide-y divide-rand rounded-xl border border-rand">
              {s.kinder.map((k) => (
                <li key={k.id}>
                  <a href={`#/serien/${k.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-karte-hover">
                    <span className="text-sm">
                      {k.name}
                      <span className="block text-xs text-leise">{[k.nummer_von != null && `${k.nummer_praefix ?? '#'}${k.nummer_von}–${k.nummer_bis}`, k.hersteller, k.jahr].filter(Boolean).join(' · ')}</span>
                    </span>
                    <Fortschritt f={k.fortschritt} klein />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
