// Seite eines Spiels/Geräts im Katalog – mit PUBLIC_CATALOG auch ohne Anmeldung erreichbar.
// Zusatzmodule ergänzen Abschnitte über Andockpunkte (katalog.*).
import { useEffect, useState } from 'react';
import {
  ARTIKELTYPEN, REGIONEN, VOLLSTAENDIGKEITEN, MEDIENARTEN, beschriftung, istModerator,
} from '../../../shared/konstanten.js';
import { nachHersteller, usePlattformen } from '../plattformen.js';
import Markdown from '../komponenten/Markdown.jsx';
import { api } from '../api.js';
import { navigiere } from '../router.js';
import { useSitzung } from '../sitzung.js';
import Layout from '../komponenten/Layout.jsx';
import Cover from '../komponenten/Cover.jsx';
import Symbol from '../komponenten/Symbole.jsx';
import StatusAbzeichen from '../komponenten/StatusAbzeichen.jsx';
import VariantenListe from '../komponenten/VariantenListe.jsx';
import Kommentare from '../komponenten/Kommentare.jsx';
import Erfahrungsberichte from '../komponenten/Erfahrungsberichte.jsx';
import Scans from '../komponenten/Scans.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import { Andockpunkt } from '../erweiterungen.jsx';
import { KatalogZockerdb } from '../komponenten/Zockerdb.jsx';

export default function KatalogSeite({ route, id }) {
  const { benutzer } = useSitzung();
  const zeigeHinweis = useHinweis();
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [bearbeiten, setBearbeiten] = useState(false);

  const laden = () => api.katalogSeite(id).then(setDaten).catch((e) => setFehler(e.message));
  useEffect(() => { laden(); }, [id]);

  if (!daten) {
    return (
      <Layout route={route} titel="Katalog" zurueck="/katalog">
        {fehler ? <p className="text-gefahr" role="alert">{fehler}</p> : <p className="text-leise">Wird geladen …</p>}
      </Layout>
    );
  }

  const { eintrag: e } = daten;
  // Gemeinsame Angaben für die Andockpunkte der Zusatzmodule
  const erweiterung = { daten, eintrag: e, benutzer, laden };
  const darfBearbeiten = istModerator(benutzer) || (e.eigener && e.status !== 'freigegeben');

  return (
    <Layout route={route} titel={e.titel} titelImInhalt={false} zurueck="/katalog"
      aktionen={darfBearbeiten && !bearbeiten && (
        <button type="button" className="rounded-lg p-2 text-leise hover:bg-karte hover:text-text" aria-label="Katalogeintrag bearbeiten" onClick={() => setBearbeiten(true)}>
          <Symbol name="stift" />
        </button>
      )}>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <Cover url={e.cover_url} typ={e.typ} alt={e.titel} className="mx-auto aspect-[3/4] w-1/2 rounded-2xl border border-rand md:w-full" />
          {benutzer ? (
            <button type="button" className="knopf-primaer w-full" onClick={() => navigiere('/neu/formular', { katalog: e.id, typ: e.typ })}>
              <Symbol name="plus" className="size-4" />{daten.meineExemplare.length ? 'Weiteres Exemplar hinzufügen' : 'Zur Sammlung hinzufügen'}
            </button>
          ) : (
            <a href="#/" className="knopf-primaer w-full">Anmelden, um es zu sammeln</a>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {bearbeiten && <KatalogBearbeiten eintrag={e} plattformIds={daten.plattformen.map((p) => p.id)} onFertig={(neu) => { setBearbeiten(false); if (neu) laden(); }} />}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{e.titel}</h2>
            {e.titel_original && <p className="text-sm text-leise">Originaltitel: <span lang="en">{e.titel_original}</span></p>}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="abzeichen">{beschriftung(ARTIKELTYPEN, e.typ)}</span>
              {daten.plattformen.map((p) => (
                <a key={p.id} href={`#/katalog?plattform=${p.id}`} className="abzeichen text-akzent-hell hover:underline" title={p.name}>{p.kurz}</a>
              ))}
              {e.erscheinungsjahr && <span className="abzeichen">{e.erscheinungsjahr}</span>}
              {e.status !== 'freigegeben' && <StatusAbzeichen status={e.status} />}
              {e.status === 'freigegeben' && e.automatisch_geprueft === 1 && (
                <span className="abzeichen" title="Dieser Eintrag wurde automatisch durch eine KI geprüft und freigegeben.">KI-geprüft</span>
              )}
            </div>
            {e.hersteller && <p className="text-sm text-leise">{e.hersteller}</p>}
            {/* Zusatzmodule können die Beschreibung in der Sprache des Benutzers liefern */}
            {(daten.beschreibungSprache?.text ?? e.beschreibung) && (
              <p className="text-sm whitespace-pre-line" lang={daten.beschreibungSprache?.sprache}>{daten.beschreibungSprache?.text ?? e.beschreibung}</p>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-leise">
              {/* Quellenangabe für IGDB (Bedingung der Partnerschaft): Link zur Seite des Spiels auf IGDB.com */}
              {(e.quelle === 'igdb' || e.igdb_url) && (
                <a href={e.igdb_url ?? 'https://www.igdb.com'} target="_blank" rel="noopener" className="underline hover:text-text">
                  Auf IGDB.com ansehen{e.manuell_bearbeitet ? ' (vom Moderationsteam überarbeitet)' : ''}
                </a>
              )}
              {e.quelle === 'zockerdb' && !e.igdb_url && <span>Daten: zockerdb.de und IGDB.com</span>}
              <Andockpunkt name="katalog.kopf" {...erweiterung} />
            </div>
            {e.quelle === 'zockerdb' && <KatalogZockerdb eintrag={e} laden={laden} />}
          </div>

          {e.sammlerhinweise ? (
            <section className="karte space-y-2 p-4">
              <h3 className="flex items-center gap-2 font-semibold"><Symbol name="dokument" className="size-5" />Sammlerhinweise</h3>
              <div className="text-sm"><Markdown text={e.sammlerhinweise} /></div>
              <Andockpunkt name="katalog.hinweisVorschlag" {...erweiterung} />
            </section>
          ) : <Andockpunkt name="katalog.ohneHinweise" {...erweiterung} />}

          {e.eigener && e.status !== 'freigegeben' && (
            <div className="rounded-xl border border-rand p-3 text-sm">
              {e.status === 'privat' && <p>Dieser Eintrag ist <strong>privat</strong> – nur du siehst ihn.</p>}
              <KatalogZockerdb eintrag={e} laden={laden} />
              <Andockpunkt name="katalog.einreichung" {...erweiterung} />
            </div>
          )}

          {daten.meineExemplare.length > 0 && (
            <section className="karte p-4">
              <h3 className="mb-2 font-semibold">In deiner Sammlung ({daten.meineExemplare.length})</h3>
              <ul className="divide-y divide-rand text-sm">
                {daten.meineExemplare.map((a) => (
                  <li key={a.id}>
                    <a href={`#/artikel/${a.id}`} className="flex items-center justify-between gap-2 py-2 hover:underline">
                      <span>{[a.modellnummer, a.farbe, a.edition].filter(Boolean).join(' · ') || a.titel}</span>
                      <span className="text-xs text-leise">{[beschriftung(REGIONEN, a.region, 'kurz'), beschriftung(VOLLSTAENDIGKEITEN, a.vollstaendigkeit, 'kurz')].filter(Boolean).join(' · ')}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Andockpunkt name="katalog.vorVarianten" {...erweiterung} />

          <VariantenListe katalogId={e.id} katalogTyp={e.typ} varianten={daten.varianten} onGeaendert={laden} />

          <Andockpunkt name="katalog.nachVarianten" {...erweiterung} />

          {benutzer && <Scans katalogId={e.id} nurLesen />}
          {!benutzer && daten.medienAnzahl > 0 && (
            <a href="#/" className="karte flex items-center gap-3 p-4 text-sm hover:bg-karte-hover">
              <Symbol name="dokument" className="size-6 shrink-0 text-akzent-hell" />
              <span className="flex-1">
                <strong className="block">Weitere Dateien zu diesem Spiel</strong>
                <span className="text-leise">
                  {daten.medienUebersicht.map((m) => `${m.anzahl}× ${beschriftung(MEDIENARTEN, m.art)}`).join(', ')} – nach der Anmeldung sichtbar.
                </span>
              </span>
              <span className="knopf-primaer shrink-0 px-3 py-1.5">Anmelden</span>
            </a>
          )}
          {benutzer && e.status === 'freigegeben' && (
            <Erfahrungsberichte key={e.id} katalogId={e.id} berichte={daten.berichte ?? []} darfSchreiben={(daten.meineExemplare ?? []).length > 0}
              moderator={['moderator', 'admin'].includes(benutzer.rolle)} onGeaendert={laden} />
          )}
          {benutzer && <Kommentare katalogId={e.id} />}
          <Andockpunkt name="katalog.ende" {...erweiterung} />
        </div>
      </div>
    </Layout>
  );
}

function KatalogBearbeiten({ eintrag, plattformIds, onFertig }) {
  const plattformen = usePlattformen();
  const zeigeHinweis = useHinweis();
  const [w, setW] = useState({
    titel: eintrag.titel, typ: eintrag.typ, erscheinungsjahr: eintrag.erscheinungsjahr ?? '', hersteller: eintrag.hersteller ?? '',
    cover_url: eintrag.cover_url ?? '', beschreibung: eintrag.beschreibung ?? '',
    sammlerhinweise: eintrag.sammlerhinweise ?? '', seo_titel: eintrag.seo_titel ?? '', seo_beschreibung: eintrag.seo_beschreibung ?? '',
  });
  const { benutzer } = useSitzung();
  const moderator = istModerator(benutzer);
  const [auswahl, setAuswahl] = useState(new Set(plattformIds));
  const setze = (f) => (e) => setW((x) => ({ ...x, [f]: e.target.value }));
  async function speichern(ev) {
    ev.preventDefault();
    try {
      const namen = plattformen.filter((p) => auswahl.has(p.id)).map((p) => p.name);
      await api.katalogAendern(eintrag.id, { ...w, plattformen: namen });
      zeigeHinweis('Katalogeintrag gespeichert.');
      onFertig(true);
    } catch (e) { zeigeHinweis(Object.values(e.felder ?? {})[0] ?? e.message, 'fehler'); }
  }
  return (
    <form onSubmit={speichern} className="karte space-y-3 border-akzent/40 p-4 text-sm">
      <h3 className="font-semibold">Katalogeintrag bearbeiten</h3>
      {eintrag.quelle === 'igdb' && <p className="text-xs text-leise">Aus IGDB übernommen – deine Änderungen werden bei späteren Importen nicht überschrieben.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="beschriftung">Titel</span><input className="eingabe" value={w.titel} onChange={setze('titel')} /></label>
        <label><span className="beschriftung">Artikeltyp</span>
          <select className="eingabe" value={w.typ} onChange={setze('typ')}>{ARTIKELTYPEN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </label>
        <label><span className="beschriftung">Erscheinungsjahr</span><input className="eingabe" inputMode="numeric" value={w.erscheinungsjahr} onChange={setze('erscheinungsjahr')} /></label>
        <label><span className="beschriftung">Hersteller / Publisher</span><input className="eingabe" value={w.hersteller} onChange={setze('hersteller')} /></label>
        <label><span className="beschriftung">Coverbild (https://…)</span><input className="eingabe" value={w.cover_url} onChange={setze('cover_url')} inputMode="url" /></label>
        <label className="sm:col-span-2"><span className="beschriftung">Beschreibung</span><textarea className="eingabe" rows={5} value={w.beschreibung} onChange={setze('beschreibung')} /></label>
        <label className="sm:col-span-2">
          <span className="beschriftung">Sammlerhinweise (Markdown)</span>
          <textarea className="eingabe font-mono text-xs" rows={6} value={w.sammlerhinweise} onChange={setze('sammlerhinweise')}
            placeholder={'## PAL-Versionen\n- **Erstauflage:** rotes USK-Logo, mehrsprachige Anleitung\n- **Players Choice:** …\n\n## Lieferumfang\n- Modul, Anleitung, Karton, Poster'} />
          <span className="text-xs text-leise">Eigene Worte statt kopierter Texte – z. B. Varianten, Lieferumfang, Revisionen, Fälschungsmerkmale. Erscheint auch auf der öffentlichen Seite.</span>
        </label>
      </div>
      {moderator && (
        <details className="rounded-xl border border-rand p-3">
          <summary className="cursor-pointer font-semibold">Suchmaschinen (optional)</summary>
          <p className="mt-2 text-xs text-leise">Leer lassen = automatisch aus Titel, Plattform, Jahr, Preisen und Sammleranzahl erzeugt.</p>
          <div className="mt-2 grid gap-3">
            <label><span className="beschriftung">Seitentitel ({w.seo_titel.length}/60 empfohlen)</span>
              <input className="eingabe" maxLength={120} value={w.seo_titel} onChange={setze('seo_titel')} placeholder="z. B. Super Mario 64 (N64) – Wert & PAL-Varianten" /></label>
            <label><span className="beschriftung">Beschreibung ({w.seo_beschreibung.length}/155 empfohlen)</span>
              <textarea className="eingabe" rows={3} maxLength={300} value={w.seo_beschreibung} onChange={setze('seo_beschreibung')} /></label>
          </div>
        </details>
      )}
      <fieldset>
        <legend className="beschriftung">Plattformen</legend>
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-rand p-2">
          {nachHersteller(plattformen).map(([hersteller, liste]) => (
            <div key={hersteller}>
              <p className="text-xs font-semibold text-leise">{hersteller}</p>
              <div className="flex flex-wrap gap-1.5 py-1">
                {liste.map((p) => {
                  const an = auswahl.has(p.id);
                  return (
                    <button key={p.id} type="button" aria-pressed={an} className={`${an ? 'chip-aktiv' : 'chip'} px-2.5 py-1 text-xs`}
                      onClick={() => setAuswahl((a) => { const n = new Set(a); if (an) n.delete(p.id); else n.add(p.id); return n; })}>{p.kurz}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button type="button" className="knopf-sekundaer" onClick={() => onFertig(false)}>Abbrechen</button>
        <button type="submit" className="knopf-primaer">Speichern</button>
      </div>
    </form>
  );
}
