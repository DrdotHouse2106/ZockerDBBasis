// Seite eines Spiels/Geräts im Katalog – mit PUBLIC_CATALOG auch ohne Anmeldung erreichbar.
// Zusatzmodule ergänzen Abschnitte über Andockpunkte (katalog.*).
import { useEffect, useState } from 'react';
import {
  ARTIKELTYPEN, REGIONEN, VOLLSTAENDIGKEITEN, MEDIENARTEN, JUGENDSCHUTZ, beschriftung, istModerator, jugendschutzText,
} from '../../../shared/konstanten.js';
import { nachHersteller, usePlattformen } from '../plattformen.js';
import Markdown from '../komponenten/Markdown.jsx';
import { api } from '../api.js';
import { navigiere } from '../router.js';
import { useSitzung } from '../sitzung.js';
import { KatalogMerkmale } from '../komponenten/Wartung.jsx';
import Layout from '../komponenten/Layout.jsx';
import Cover from '../komponenten/Cover.jsx';
import Symbol from '../komponenten/Symbole.jsx';
import StatusAbzeichen from '../komponenten/StatusAbzeichen.jsx';
import VariantenListe from '../komponenten/VariantenListe.jsx';
import Kommentare from '../komponenten/Kommentare.jsx';
import Erfahrungsberichte from '../komponenten/Erfahrungsberichte.jsx';
import Scans from '../komponenten/Scans.jsx';
import Sprachen from '../komponenten/Sprachen.jsx';
import Fotos from '../komponenten/Fotos.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import { Andockpunkt } from '../erweiterungen.jsx';
import { KatalogZockerdb } from '../komponenten/Zockerdb.jsx';

/**
 * Cover mit Umschalter je Region (PAL-DE, PAL-EU, NTSC-U, NTSC-J …): Standard ist das passendste für den deutschen Markt
 * (Community-Foto der Fassung, sonst die EU-Fassung, sonst das allgemeine Cover).
 */
function CoverNachRegion({ eintrag: e, standard }) {
  const [region, setRegion] = useState(null);
  const liste = e.cover_regionen ?? [];
  const gewaehlt = liste.find((c) => c.region === region);
  const url = gewaehlt?.url ?? standard;
  const knoepfe = [...liste, ...(e.cover_url && !liste.some((c) => c.url === e.cover_url) ? [{ region: 'allgemein', url: e.cover_url }] : [])];
  return (
    <>
      <Cover url={url} typ={e.typ} alt={e.titel} className="mx-auto aspect-[3/4] w-1/2 rounded-2xl border border-rand md:w-full" />
      {knoepfe.length > 1 && (
        <div className="flex flex-wrap justify-center gap-1" role="group" aria-label="Cover nach Region" data-testid="cover-regionen">
          {knoepfe.map((c) => {
            const aktiv = (region ?? null) === c.region || (!region && c.url === url);
            return (
              <button key={c.region} type="button" aria-pressed={aktiv} onClick={() => setRegion(c.region === 'allgemein' ? null : c.region)}
                title={c.quelle === 'community' ? 'Foto aus der Community' : undefined}
                className={`rounded-full border px-2 py-0.5 text-xs ${aktiv ? 'border-akzent bg-akzent text-akzent-text' : 'border-rand text-leise hover:bg-karte-hover'}`}>
                {c.region === 'allgemein' ? 'Allgemein' : beschriftung(REGIONEN, c.region, 'kurz')}{c.quelle === 'community' ? ' 📷' : ''}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function KatalogSeite({ route, id }) {
  const { benutzer, status, auth } = useSitzung();
  const zeigeHinweis = useHinweis();
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [bearbeiten, setBearbeiten] = useState(false);

  // Plattform-Auswahl in der Adresse (#/katalog/:id?plattform=<id>); ohne Angabe wählt der Server den Standard
  const plattformWunsch = route.parameter?.plattform ?? null;
  const laden = () => api.katalogSeite(id, plattformWunsch || 'auto').then(setDaten).catch((e) => setFehler(e.message));
  useEffect(() => { laden(); }, [id, plattformWunsch]);

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
  // Fotos hängen am eigenen Exemplar (nur, was man wirklich besitzt, kann man fotografieren)
  // Für Fotos: eigenes Exemplar, sonst eine leere Verpackung (die es eigens für Fotos gibt)
  const fotoExemplar = daten.meineExemplare.find((a) => a.bestand === 'besitz') ?? daten.meineExemplare.find((a) => a.bestand === 'verpackung');
  const gewaehltePlattform = daten.plattformen.find((p) => p.id === daten.plattformWahl?.gewaehlt) ?? null;
  const plattformWechseln = (p) => {
    if (p.id === gewaehltePlattform?.id) return;
    navigiere(`/katalog/${e.id}`, { ...route.parameter, plattform: p.id, foto: undefined, fotos: undefined }, { ersetzen: true });
  };
  const oeffentlicheFotos = daten.oeffentlicheFotos ?? [];

  return (
    <Layout route={route} titel={e.titel} titelImInhalt={false} zurueck="/katalog"
      aktionen={darfBearbeiten && !bearbeiten && (
        <button type="button" className="rounded-lg p-2 text-leise hover:bg-karte hover:text-text" aria-label="Katalogeintrag bearbeiten" onClick={() => setBearbeiten(true)}>
          <Symbol name="stift" />
        </button>
      )}>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          {/* Ohne Katalog-Cover: das Bild des eigenen Exemplars (nur für dich sichtbar, nicht öffentlich) */}
          {(() => {
            const passend = e.cover_passend || e.cover_url;
            const eigenesBild = !passend ? daten.meineExemplare.find((a) => a.bild_url)?.bild_url : null;
            return (
              <>
                <CoverNachRegion eintrag={e} standard={passend || eigenesBild} />
                {eigenesBild && <p className="text-center text-xs text-leise" data-testid="cover-eigenes-exemplar">Bild deines Exemplars – im Katalog fehlt noch ein Cover</p>}
              </>
            );
          })()}
          {benutzer ? (
            <button type="button" className="knopf-primaer w-full" onClick={() => navigiere('/neu/formular', { katalog: e.id, typ: e.typ })}>
              <Symbol name="plus" className="size-4" />{daten.meineExemplare.length ? 'Weiteres Exemplar hinzufügen' : 'Zur Sammlung hinzufügen'}
            </button>
          ) : (
            <a href="#/" className="knopf-primaer w-full">Anmelden, um es zu sammeln</a>
          )}
          {benutzer && e.typ === 'spiel' && (
            <button type="button" className="w-full text-center text-sm text-akzent-hell underline"
              onClick={() => navigiere('/neu/formular', { katalog: e.id, typ: e.typ, vollstaendigkeit: 'nur_ovp' })}>
              Nur eine leere Hülle? Fotos beitragen, ohne Sammlungseintrag
            </button>
          )}
          <Andockpunkt name="katalog.aktionen" {...erweiterung} />
        </div>

        <div className="min-w-0 space-y-4">
          {bearbeiten && <KatalogBearbeiten eintrag={e} plattformIds={daten.plattformen.map((p) => p.id)} onFertig={(neu) => { setBearbeiten(false); if (neu) laden(); }} />}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold" lang={daten.titelSprache?.sprache}>{daten.titelSprache?.text ?? e.titel}</h2>
            {daten.titelSprache
              ? <p className="text-sm text-leise">Deutscher Titel: <span lang="de">{e.titel}</span></p>
              : e.titel_original && <p className="text-sm text-leise">Originaltitel: <span lang="en">{e.titel_original}</span></p>}
            {e.weitere_titel?.length > 0 && <p className="text-xs text-leise" data-testid="weitere-titel">auch bekannt als {e.weitere_titel.join(', ')}</p>}
            {daten.plattformen.length > 1 && (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Plattform wählen" data-testid="plattform-leiste">
                {daten.plattformen.map((p) => {
                  const aktiv = p.id === gewaehltePlattform?.id;
                  return (
                    <button key={p.id} type="button" title={p.name} aria-pressed={aktiv} onClick={() => plattformWechseln(p)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold ${aktiv ? 'border-akzent bg-akzent text-akzent-text' : 'border-rand text-akzent-hell hover:bg-karte-hover'}`}>
                      {p.kurz || p.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="abzeichen">{beschriftung(ARTIKELTYPEN, e.typ)}</span>
              {daten.plattformen.length === 1 && daten.plattformen.map((p) => (
                <a key={p.id} href={`#/katalog?plattform=${p.id}`} className="abzeichen text-akzent-hell hover:underline" title={p.name}>{p.kurz || p.name}</a>
              ))}
              {/* Plattformen, die (noch) keiner festen Plattform zugeordnet sind (z. B. „PlayStation VR2“ aus IGDB), trotzdem zeigen */}
              {daten.plattformen.length === 0 && (e.plattformen ?? []).map((name) => <span key={name} className="abzeichen text-akzent-hell">{name}</span>)}
              {e.erscheinungsjahr && <span className="abzeichen">{e.erscheinungsjahr}</span>}
              {jugendschutzText(e) && (
                <span className={`abzeichen ${e.jugendschutz === 'gestrichen' ? '' : 'border-gefahr/60 text-gefahr'}`} data-testid="katalog-jugendschutz"
                  title={JUGENDSCHUTZ.find((j) => j.value === e.jugendschutz)?.erklaerung}>{jugendschutzText(e)}</span>
              )}
              {e.status !== 'freigegeben' && <StatusAbzeichen status={e.status} />}
              {e.status === 'freigegeben' && e.automatisch_geprueft === 1 && (
                <span className="abzeichen" title="Dieser Eintrag wurde automatisch durch eine KI geprüft und freigegeben.">KI-geprüft</span>
              )}
            </div>
            {e.hersteller && <p className="text-sm text-leise">{e.hersteller}</p>}
            {e.serie && (
              <p className="text-sm" data-testid="katalog-serie">
                Figurenserie: <a href={`#/serien/${e.serie.id}`} className="text-akzent-hell underline">{[e.serie.ueber_name, e.serie.name].filter(Boolean).join(' · ')}</a>
                {e.serien_nummer && <span className="text-leise"> · {e.serie.nummer_praefix ?? '#'}{e.serien_nummer}</span>}
              </p>
            )}
            {e.figurenserien?.length > 0 && (
              <div className="space-y-1 rounded-xl border border-rand p-3 text-sm" data-testid="katalog-figurenserien">
                <p className="font-semibold">Figurenserie zum Spiel</p>
                {e.figurenserien.map((f) => (
                  <p key={f.id}>
                    <a href={`#/serien/${f.id}`} className="text-akzent-hell underline">{f.name}</a>
                    <span className="text-leise"> · {[f.hersteller, f.jahr].filter(Boolean).join(', ')}{f.figuren ? ` · ${f.figuren} Figuren` : ''}{f.besitz ? ` · ${f.besitz} davon in deiner Sammlung` : ''}</span>
                  </p>
                ))}
              </div>
            )}
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

          <Sprachen sprachen={e.sprachen} />

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

          {(benutzer || oeffentlicheFotos.length > 0 || ((status ?? auth)?.oeffentlicheFotos && e.status === 'freigegeben')) && (
            <Fotos katalogId={e.id} typ={e.typ} plattform={gewaehltePlattform ?? daten.plattformen[0] ?? null} artikelId={fotoExemplar?.id ?? null}
              oeffentliche={oeffentlicheFotos} vorauswahl={route.parameter.foto ?? null}
              hinscrollen={route.parameter.fotos === '1' || Boolean(route.parameter.foto)}
              varianten={daten.varianten ?? []} standardVariante={fotoExemplar?.variante_id ?? null} fassung={fotoExemplar?.edition || null} region={fotoExemplar?.region || null}
              nurVerpackung={fotoExemplar?.bestand === 'verpackung' || fotoExemplar?.vollstaendigkeit === 'nur_ovp'}
              versiegelt={fotoExemplar?.zustand === 'neu_ovp'} beilagen={fotoExemplar?.beilagen ?? null} />
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
          {benutzer && (benutzer.funktionen?.wartung || istModerator(benutzer)) && <KatalogMerkmale katalogId={e.id} />}
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
    jugendschutz: eintrag.jugendschutz ?? '', jugendschutz_seit: eintrag.jugendschutz_seit ?? '', jugendschutz_bis: eintrag.jugendschutz_bis ?? '',
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
        <details className="rounded-xl border border-rand p-3" open={Boolean(w.jugendschutz)} data-testid="jugendschutz-bearbeiten">
          <summary className="cursor-pointer font-semibold">Jugendschutz (Deutschland)</summary>
          <p className="mt-2 text-xs text-leise">Indizierung bzw. Beschlagnahme laut BzKJ-Liste oder Gerichtsbeschluss – bei Neuauflagen gilt oft nur die alte Fassung.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <label><span className="beschriftung">Status</span>
              <select className="eingabe" value={w.jugendschutz} onChange={setze('jugendschutz')}>
                <option value="">nicht betroffen / unbekannt</option>
                {JUGENDSCHUTZ.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
              </select>
            </label>
            {w.jugendschutz && <label><span className="beschriftung">{w.jugendschutz === 'beschlagnahmt' ? 'Beschlagnahmt seit (Jahr)' : 'Indiziert seit (Jahr)'}</span>
              <input className="eingabe" inputMode="numeric" value={w.jugendschutz_seit} onChange={setze('jugendschutz_seit')} placeholder="z. B. 1997" /></label>}
            {w.jugendschutz === 'gestrichen' && <label><span className="beschriftung">Gestrichen (Jahr)</span>
              <input className="eingabe" inputMode="numeric" value={w.jugendschutz_bis} onChange={setze('jugendschutz_bis')} placeholder="z. B. 2019" /></label>}
          </div>
        </details>
      )}
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
