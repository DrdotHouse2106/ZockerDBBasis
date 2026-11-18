// Eine Figurenserie: Angaben, Unterserien, Fortschritt und – je Unterserie – Karten je Figur mit Farbpunkten.
// Punkte: gefüllt mit ✓ = in deiner Sammlung · Ring = gibt es, fehlt dir. Standard ist „Ansehen“ – Antippen ändert nichts (kein Versehen beim Scrollen).
// „Sammeln“ (einschalten): Antippen übernimmt die Figur in dieser Farbe in die Sammlung – mit „Rückgängig“. „Farben pflegen / vorschlagen“:
// Antippen markiert nur (+ hinzufügen, − entfernen, nochmal tippen = zurück); erst „Speichern“ übernimmt, Entfernen mit Rückfrage.
// Serien ohne Farben (z. B. Funko Pop!): beim Sammeln je Figur „In die Sammlung“.
// Vorschläge von Sammlern brauchen ein Foto als Beleg, erst dann prüft die Moderation sie.
import { useEffect, useState } from 'react';
import { MERCH_KATEGORIEN, istModerator } from '../../../shared/konstanten.js';
import { api } from '../api.js';
import Layout from '../komponenten/Layout.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import { useSitzung } from '../sitzung.js';
import { navigiere } from '../router.js';
import { Fortschritt, STATUS_TEXT } from './Serien.jsx';
import { Andockpunkt } from '../erweiterungen.jsx';
import SpielWahl from '../komponenten/SpielWahl.jsx';

const schluessel = (katalogId, farbe) => `${katalogId}\u0000${farbe}`;

// Zuletzt geladene Serien und gewählte Ansicht (Filter): Nach „Zurück“ von einer Figur steht die Liste sofort wieder da – so kann
// der Router die Scrollposition wiederherstellen, statt dass man oben landet
const serienCache = new Map();
const ansichtSchluessel = (id) => `serie-ansicht-${id}`;
function gemerkteAnsicht(id) {
  try { return JSON.parse(sessionStorage.getItem(ansichtSchluessel(id)) ?? 'null') ?? {}; } catch { return {}; }
}

export default function SerieSeite({ route, id }) {
  const zeigeHinweis = useHinweis();
  const { benutzer } = useSitzung();
  const [s, setS] = useState(() => serienCache.get(String(id)) ?? null);
  const [fehler, setFehler] = useState(null);
  const [modus, setModusRoh] = useState(() => (['ansehen', 'sammeln'].includes(gemerkteAnsicht(id).modus) ? gemerkteAnsicht(id).modus : 'ansehen'));
  // Entwurf beim Farben pflegen: { schlüssel: { katalog_id, titel, farbe, ziel: 'ja' | 'nein' } } – erst „Speichern“ schreibt
  const [entwurf, setEntwurf] = useState({});
  const aenderungen = Object.values(entwurf);
  const setModus = (neu) => {
    if (neu !== 'pflegen' && aenderungen.length && !window.confirm(`${aenderungen.length} nicht gespeicherte Änderung(en) verwerfen?`)) return;
    if (neu !== 'pflegen') setEntwurf({});
    setModusRoh(neu);
  };
  const [bearbeiten, setBearbeiten] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [filter, setFilter] = useState(() => gemerkteAnsicht(id).filter ?? 'alle');
  const [farbFilter, setFarbFilter] = useState(() => gemerkteAnsicht(id).farbFilter ?? null);
  useEffect(() => {
    try { sessionStorage.setItem(ansichtSchluessel(id), JSON.stringify({ modus: modus === 'pflegen' ? 'ansehen' : modus, filter, farbFilter })); } catch { /* egal */ }
  }, [id, modus, filter, farbFilter]);
  const laden = () => api.serie(id).then((daten) => { serienCache.set(String(id), daten); setS(daten); }).catch((e) => setFehler(e.message));
  useEffect(() => { laden(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const melde = (err) => zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
  // Löschen: Figuren behalten ihren Katalogeintrag (und damit die Exemplare der Sammler), sie hängen danach nur an keiner Serie mehr
  async function serieLoeschen(serie) {
    if (!window.confirm(`„${serie.name}“ wirklich löschen?${serie.ueber ? '' : ' Ihre Unterserien werden mit gelöscht.'} Die Figuren bleiben im Katalog, gehören dann aber zu keiner Serie mehr.`)) return;
    try {
      await api.serieLoeschen(serie.id);
      zeigeHinweis('Serie gelöscht.');
      navigiere(serie.ueber ? `/serien/${serie.ueber.id}` : '/serien');
    } catch (err) {
      melde(err);
    }
  }

  async function los(fn) {
    if (laeuft) return;
    setLaeuft(true);
    try { await fn(); await laden(); } catch (err) { melde(err); } finally { setLaeuft(false); }
  }

  if (fehler) return <Layout route={route} titel="Serie" zurueck="/serien"><p className="text-gefahr" role="alert">{fehler}</p></Layout>;
  if (!s) return <Layout route={route} titel="Serie" zurueck="/serien"><p className="text-leise">Wird geladen …</p></Layout>;

  const praefix = s.nummer_praefix ?? '#';
  const zelle = (figur, spalte) => figur.farben.find((v) => v.farbe === spalte.name) ?? null;
  // Karten: je Figur eine, dazu leere Nummern (noch nicht erfasst); gefiltert nach „Fehlt mir / Habe ich / Selten“ und Farbe
  const fehltMir = (f) => (f.farben.length ? f.farben.some((v) => !v.besitz.length) : !f.besitz.length);
  const passt = (f) => {
    const farben = farbFilter ? f.farben.filter((v) => v.farbe === farbFilter) : f.farben;
    if (farbFilter && !farben.length) return false;
    if (filter === 'fehlt') return farbFilter ? farben.some((v) => !v.besitz.length) : fehltMir(f);
    if (filter === 'habe') return farbFilter ? farben.some((v) => v.besitz.length) : f.besitz.length > 0;
    return true;
  };
  const karten = s.zeilen.flatMap((z) => (z.figuren.length
    ? z.figuren.filter(passt).map((f) => ({ nummer: z.nummer, figur: f }))
    : (['alle', 'fehlt'].includes(filter) && !farbFilter ? [{ nummer: z.nummer, figur: null }] : [])));

  function tippe(figur, spalte) {
    const v = zelle(figur, spalte);
    if (modus === 'ansehen') return undefined;
    if (modus === 'pflegen') {
      const k = schluessel(figur.katalog_id, spalte.name);
      // Schon markiert: Markierung zurücknehmen
      if (entwurf[k]) return setEntwurf(({ [k]: _weg, ...rest }) => rest);
      if (v && !figur.bearbeitbar && !v.eigener_vorschlag) return zeigeHinweis('Diese Farbe ist schon erfasst – Änderungen daran pflegt die Moderation. Stimmt sie nicht, nutze „Weißt du mehr?“.');
      if (v?.besitz.length) return zeigeHinweis('Diese Farbe steht in deiner Sammlung und kann nicht entfernt werden.', 'fehler');
      return setEntwurf((e) => ({ ...e, [k]: { katalog_id: figur.katalog_id, titel: figur.titel, farbe: spalte.name, ziel: v ? 'nein' : 'ja' } }));
    }
    if (!v) return undefined;
    if (v.besitz.length) return navigiere(`/artikel/${v.besitz[0]}`);
    return los(async () => {
      const a = await api.artikelAnlegen({ typ: 'merch', titel: figur.titel, katalog_id: figur.katalog_id, variante_id: v.variante_id, farbe: v.farbe, merch_kategorie: s.merch_kategorie ?? 'figur' });
      zeigeHinweis(`${figur.titel} (${v.farbe}) ist jetzt in deiner Sammlung.`, 'erfolg', rueckgaengig(a));
    });
  }

  /** „Rückgängig“ für ein gerade übernommenes Exemplar (versehentlich angetippt). */
  const rueckgaengig = (a) => (a?.id ? {
    aktion: {
      text: 'Rückgängig',
      fn: () => los(async () => { await api.artikelLoeschen(a.id); zeigeHinweis('Rückgängig gemacht.'); }),
    },
  } : {});

  /** Entwurf speichern: hinzufügen bzw. entfernen – Entfernen nach Rückfrage. */
  async function speichern() {
    const weg = aenderungen.filter((x) => x.ziel === 'nein');
    if (weg.length && !window.confirm(`Wirklich entfernen?\n\n${weg.map((x) => `– ${x.titel}: ${x.farbe}`).join('\n')}`)) return;
    await los(async () => {
      let beleg = false;
      const fehler = [];
      for (const x of aenderungen) {
        try {
          const r = await api.figurFarbe(x.katalog_id, x.farbe, x.ziel);
          if (r?.beleg_noetig) beleg = true;
        } catch (err) {
          fehler.push(`${x.titel} (${x.farbe}): ${Object.values(err.felder ?? {})[0] ?? err.message}`);
        }
      }
      setEntwurf({});
      if (fehler.length) zeigeHinweis(`Nicht alles gespeichert – ${fehler.join(' · ')}`, 'fehler');
      else zeigeHinweis(beleg ? BELEG_HINWEIS : 'Gespeichert.');
    });
  }

  return (
    <Layout route={route} titel={s.ueber ? `${s.ueber.name} · ${s.name}` : s.name} zurueck={s.ueber ? `/serien/${s.ueber.id}` : '/serien'}>
      <div className="space-y-4 pb-8">
        <section className="karte space-y-2 p-4 text-sm" data-testid="serie-kopf" data-tour="serie-kopf">
          <p className="text-leise">
            {[s.nummer_von != null && `${praefix}${s.nummer_von}–${praefix}${s.nummer_bis}`, s.hersteller, s.jahr].filter(Boolean).join(' · ')}
            {STATUS_TEXT[s.status] && <span className="abzeichen ml-2 text-xs">{STATUS_TEXT[s.status]}</span>}
          </p>
          {s.nicht_erschienen && <p className="text-xs text-leise">Nie erschienen: {s.nicht_erschienen} (zählt nicht zum Fortschritt)</p>}
          <SpieleZurSerie serie={s} onGeaendert={setS} />
          {s.hinweis && <p>{s.hinweis}</p>}
          <Fortschritt f={s.fortschritt} />
          <div className="flex flex-wrap gap-2 pt-1">
            <a className="knopf-sekundaer px-3 py-1.5" href={`#/sammlung?serie_id=${s.id}`}>In meiner Sammlung</a>
            {s.bearbeitbar && <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setBearbeiten((b) => !b)}>Angaben bearbeiten</button>}
            {s.bearbeitbar && <button type="button" className="knopf-sekundaer px-3 py-1.5 text-gefahr" onClick={() => serieLoeschen(s)} data-testid="serie-loeschen">{s.ueber ? 'Unterserie löschen' : 'Serie löschen'}</button>}
            {s.eigene && s.status === 'privat' && (
              <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => los(() => api.serieAendern(s.id, { status: 'eingereicht' }))}>Zur Freigabe einreichen</button>
            )}
            {istModerator(benutzer) && s.status !== 'freigegeben' && (
              <button type="button" className="knopf-primaer px-3 py-1.5" onClick={() => los(() => api.serieAendern(s.id, { status: 'freigegeben' }))}>Freigeben</button>
            )}
          </div>
        </section>

        {bearbeiten && <SerieFormular serie={s} onFertig={() => { setBearbeiten(false); laden(); }} />}

        {(s.kinder.length > 0 || !s.ueber) && (
          <section className="karte space-y-2 p-4" data-tour="serie-unterserien">
            <h2 className="font-semibold">Unterserien</h2>
            {s.kinder.length > 0 && (
              <ul className="divide-y divide-rand rounded-xl border border-rand">
                {s.kinder.map((k) => (
                  <li key={k.id}>
                    <a href={`#/serien/${k.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-karte-hover" data-testid="unterserie">
                      <span className="text-sm">{k.name}<span className="block text-xs text-leise">{[k.nummer_von != null && `${k.nummer_praefix ?? '#'}${k.nummer_von}–${k.nummer_bis}`, k.hersteller, k.jahr].filter(Boolean).join(' · ')}</span></span>
                      <Fortschritt f={k.fortschritt} klein />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {!s.ueber && <NeueUnterserie ueber={s} />}
          </section>
        )}

        {(s.ueber || s.kinder.length === 0) && (
          <section className="karte space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Figuren</h2>
              {/* Standard „Ansehen“ – Sammeln und Pflegen schaltet man bewusst ein */}
              <div className="flex flex-wrap gap-1" role="group" aria-label="Modus" data-testid="serien-modus" data-tour="serien-modus">
                <button type="button" className={modus === 'ansehen' ? 'chip-aktiv' : 'chip'} aria-pressed={modus === 'ansehen'} onClick={() => setModus('ansehen')}>Ansehen</button>
                <button type="button" className={modus === 'sammeln' ? 'chip-aktiv' : 'chip'} aria-pressed={modus === 'sammeln'} onClick={() => setModus('sammeln')} data-testid="modus-sammeln">Sammeln</button>
                {s.mit_farben && <button type="button" className={modus === 'pflegen' ? 'chip-aktiv' : 'chip'} aria-pressed={modus === 'pflegen'} onClick={() => setModus('pflegen')} data-testid="modus-pflegen">Farben pflegen / vorschlagen</button>}
              </div>
            </div>
            {s.mit_farben && s.spalten.length === 0 && <p className="text-sm text-leise">Für diese Serie sind noch keine Farben hinterlegt{s.bearbeitbar ? ' – unter „Angaben bearbeiten“ ergänzen.' : '.'}</p>}
            <Filterleiste spalten={s.spalten} filter={filter} setFilter={setFilter} farbFilter={farbFilter} setFarbFilter={setFarbFilter} />
            <p className="text-xs text-leise">
              {modus === 'ansehen'
                ? (s.mit_farben ? 'Gefüllter Punkt mit ✓: hast du · heller Ring: fehlt dir. Zum Abhaken „Sammeln“ einschalten – so ändert sich beim Scrollen nichts aus Versehen.'
                  : 'Zum Übernehmen in deine Sammlung „Sammeln“ einschalten – so ändert sich beim Scrollen nichts aus Versehen.')
                : modus === 'sammeln'
                  ? (s.mit_farben ? 'Tippe auf einen Ring, um die Figur in dieser Farbe in deine Sammlung zu übernehmen.'
                    : 'Tippe auf „In die Sammlung“, um eine Figur zu übernehmen.')
                  : 'Tippe auf einen Punkt, um ihn zu markieren: + = Farbe gab es (hinzufügen), − = gab es nicht (entfernen). Nochmal tippen nimmt die Markierung zurück. Erst „Speichern“ unten übernimmt die Änderungen. Fehlt eine Farbe ganz, nutze „+ Farbe“. Bei freigegebenen Figuren wird daraus ein Vorschlag (?), den die Moderation mit einem Foto als Beleg prüft.'}
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="figuren">
              {karten.map(({ nummer, figur: f }, i) => (f ? (
                <li key={`f${f.katalog_id}`} className={`karte flex flex-col overflow-hidden ${f.besitz.length ? 'border-erfolg/60' : ''}`} data-testid="figur-karte">
                  <FigurBild figur={f} spalten={s.spalten} nummer={nummer} praefix={praefix} />
                  <div className="flex flex-1 flex-col gap-2 p-2.5">
                    <p className="text-sm leading-tight font-semibold">
                      <a href={`#/katalog/${f.katalog_id}`} className="underline-offset-2 hover:underline" data-testid="figur-name">{f.titel}</a>
                      {f.status !== 'freigegeben' && <span className="ml-1 text-xs font-normal text-leise">({f.status === 'eingereicht' ? 'vorgeschlagen' : f.beleg_fehlt ? 'Beleg fehlt' : 'privat'})</span>}
                    </p>
                    {!s.mit_farben && (f.besitz.length
                      ? <a href={`#/artikel/${f.besitz[0]}`} className="mt-auto text-xs font-semibold text-erfolg underline" data-testid="figur-besitz">✓ In deiner Sammlung</a>
                      : modus === 'sammeln' && <button type="button" className="knopf-sekundaer mt-auto px-2 py-1 text-xs" disabled={laeuft} data-testid="figur-sammeln"
                        onClick={() => los(async () => {
                          const a = await api.artikelAnlegen({ typ: 'merch', titel: f.titel, katalog_id: f.katalog_id, merch_kategorie: s.merch_kategorie ?? 'figur' });
                          zeigeHinweis(`${f.titel} ist jetzt in deiner Sammlung.`, 'erfolg', rueckgaengig(a));
                        })}>+ In die Sammlung</button>)}
                    {s.mit_farben && <div className="flex flex-wrap gap-1.5">
                      {(modus === 'pflegen' ? s.spalten.map((sp) => ({ sp, v: zelle(f, sp) }))
                        .concat(f.farben.filter((v) => !s.spalten.some((sp) => sp.name === v.farbe)).map((v) => ({ sp: { name: v.farbe }, v })))
                        // über „+ Farbe“ markierte, noch nicht gespeicherte Farben
                        .concat(aenderungen.filter((x) => x.katalog_id === f.katalog_id && !s.spalten.some((sp) => sp.name === x.farbe) && !f.farben.some((v) => v.farbe === x.farbe))
                          .map((x) => ({ sp: { name: x.farbe }, v: null })))
                        : f.farben.map((v) => ({ sp: s.spalten.find((sp) => sp.name === v.farbe) ?? { name: v.farbe }, v })))
                        .map(({ sp, v }) => <Farbpunkt key={sp.name} figur={f} spalte={sp} v={v} figurFreigegeben={f.status === 'freigegeben'} disabled={laeuft}
                          aenderung={modus === 'pflegen' ? entwurf[schluessel(f.katalog_id, sp.name)]?.ziel : undefined}
                          onClick={modus === 'ansehen' ? null : () => tippe(f, sp)} />)}
                      {modus !== 'pflegen' && f.farben.length === 0 && <span className="text-xs text-leise">Noch keine Farben erfasst</span>}
                    </div>}
                    {(f.beleg_fehlt || f.farben.some((v) => v.beleg_fehlt)) && (
                      <div className="space-y-1 rounded-lg bg-warnung/10 p-1.5 text-xs" data-testid="beleg-fehlt">
                        <p className="text-leise">Foto als Beleg fehlt – ohne Foto prüft die Moderation den Vorschlag nicht.</p>
                        {f.beleg_fehlt && <BelegKnopf katalogId={f.katalog_id} text="📷 Foto der Figur" onFertig={laden} />}
                        {f.farben.filter((v) => v.beleg_fehlt).map((v) => (
                          <BelegKnopf key={v.variante_id} katalogId={f.katalog_id} varianteId={v.variante_id} text={`📷 Foto in ${v.farbe}`} onFertig={laden} />
                        ))}
                      </div>
                    )}
                    {f.status === 'freigegeben' && <div className="mt-auto"><Andockpunkt name="melden" bereich="katalog" zielId={f.katalog_id} figur /></div>}
                    {modus === 'pflegen' && (
                      <button type="button" className="mt-auto self-start text-xs text-akzent-hell underline" data-testid="farbe-plus" onClick={() => {
                        const name = window.prompt(`Weitere Farbe für „${f.titel}“:`)?.trim();
                        if (name) setEntwurf((e) => ({ ...e, [schluessel(f.katalog_id, name)]: { katalog_id: f.katalog_id, titel: f.titel, farbe: name, ziel: 'ja' } }));
                      }}>+ Farbe</button>
                    )}
                  </div>
                </li>
              ) : (
                <li key={`leer${nummer}-${i}`} className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-rand p-3 text-center" data-testid="figur-leer" data-tour={karten.findIndex((x) => !x.figur) === i ? 'figur-anlegen' : undefined}>
                  <span className="text-lg font-bold text-leise/50">{praefix}{nummer}</span>
                  <span className="text-xs text-leise">noch nicht erfasst</span>
                  <NeueFigur serie={s} nummer={nummer} onFertig={laden} />
                </li>
              )))}
            </ul>
            {karten.length === 0 && <p className="text-sm text-leise">Keine Figuren für diesen Filter.</p>}
            {modus === 'pflegen' && aenderungen.length > 0 && (
              <div className="karte sticky bottom-24 z-30 flex flex-wrap items-center gap-2 border-akzent/60 p-3 shadow-xl md:bottom-4" data-testid="entwurf-leiste">
                <p className="min-w-0 flex-1 text-sm">
                  <strong>{aenderungen.length} {aenderungen.length === 1 ? 'Änderung' : 'Änderungen'}</strong> noch nicht gespeichert
                  <span className="block text-xs text-leise">
                    {[aenderungen.filter((x) => x.ziel === 'ja').length && `${aenderungen.filter((x) => x.ziel === 'ja').length} hinzufügen`,
                      aenderungen.filter((x) => x.ziel === 'nein').length && `${aenderungen.filter((x) => x.ziel === 'nein').length} entfernen`].filter(Boolean).join(' · ')}
                  </span>
                </p>
                <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setEntwurf({})}>Verwerfen</button>
                <button type="button" className="knopf-primaer px-3 py-1.5" disabled={laeuft} onClick={speichern} data-testid="entwurf-speichern">Speichern</button>
              </div>
            )}
            {/* Ziel des Tour-Schritts „Fehlt eine Figur?“, wenn alle Nummern erfasst sind */}
            <div data-tour={karten.some((x) => !x.figur) ? undefined : 'figur-anlegen'}><NeueFigur serie={s} onFertig={laden} frei /></div>
            {s.bearbeitbar && <ListeEinfuegen serie={s} onFertig={laden} />}
          </section>
        )}
      </div>
    </Layout>
  );
}

const BELEG_HINWEIS = 'Gespeichert – zählt vorerst nur für dich. Füge ein Foto als Beleg hinzu, dann prüft die Moderation deinen Vorschlag.';

/** Foto als Beleg zu einem eigenen Vorschlag hochladen – damit geht er an die Moderation. */
function BelegKnopf({ katalogId, varianteId = null, text, onFertig }) {
  const zeigeHinweis = useHinweis();
  const [laeuft, setLaeuft] = useState(false);
  async function hochladen(e) {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei) return;
    setLaeuft(true);
    try {
      await api.serienBeleg(katalogId, varianteId, datei);
      zeigeHinweis('Danke! Dein Vorschlag geht mit dem Foto an die Moderation. Das Foto sieht nur das Moderationsteam.');
      onFertig();
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    } finally {
      setLaeuft(false);
    }
  }
  return (
    <label className={`block cursor-pointer font-semibold text-akzent-hell underline ${laeuft ? 'opacity-50' : ''}`}>
      {laeuft ? 'Wird hochgeladen …' : text}
      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={laeuft} onChange={hochladen} data-testid="beleg-datei" />
    </label>
  );
}

/** Ersatzfarbe für Farben ohne Farbcode: aus dem Namen abgeleitet, damit jede Farbe einen eigenen Ton hat. */
function farbton(name, hex) {
  if (hex) return hex;
  let h = 0;
  for (const z of String(name)) h = (h * 31 + z.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 55%)`;
}

/** Ein Farbpunkt: gefüllt mit ✓ = in der Sammlung, Ring = gibt es (fehlt dir), gestrichelt = gab es nicht (nur beim Pflegen). */
function Farbpunkt({ figur, spalte, v, figurFreigegeben, disabled, onClick, aenderung }) {
  // Ohne onClick (Modus „Ansehen“) nur Anzeige, kein Knopf
  const farbe = farbton(spalte.name, spalte.hex);
  const besitz = Boolean(v?.besitz.length);
  const vorschlag = v && v.status !== 'freigegeben' && figurFreigegeben;
  const status = v ? (besitz ? 'in deiner Sammlung' : 'gibt es') : 'gab es nicht';
  // Markiert, aber noch nicht gespeichert: + (wird hinzugefügt) bzw. − (wird entfernt), deutlich umrandet
  const markiert = aenderung ? ` – wird ${aenderung === 'ja' ? 'hinzugefügt' : 'entfernt'} (nicht gespeichert)` : '';
  const text = `${spalte.name}: ${status}${vorschlag ? ' (vorgeschlagen)' : ''}${markiert}`;
  const aussehen = {
    className: `relative flex size-8 items-center justify-center rounded-full text-xs font-bold ${onClick ? 'transition active:scale-90' : ''} ${v && aenderung !== 'nein' ? '' : 'border-2 border-dashed border-rand'}`
      + (aenderung === 'ja' ? ' outline-2 outline-offset-2 outline-erfolg' : aenderung === 'nein' ? ' opacity-70 outline-2 outline-offset-2 outline-gefahr' : ''),
    style: aenderung === 'ja' ? { boxShadow: `inset 0 0 0 3px ${farbe}`, background: `color-mix(in srgb, ${farbe} 15%, transparent)` }
      : aenderung === 'nein' ? undefined
        : v ? (besitz ? { background: farbe, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.6)' } : { boxShadow: `inset 0 0 0 3px ${farbe}`, background: `color-mix(in srgb, ${farbe} 15%, transparent)` }) : undefined,
  };
  const inhalt = aenderung === 'ja' ? <span className="text-erfolg">+</span> : aenderung === 'nein' ? <span className="text-gefahr">−</span> : besitz ? '✓' : vorschlag ? '?' : '';
  if (!onClick) return <span role="img" title={text} aria-label={`${figur.titel}, ${text}`} {...aussehen}>{inhalt}</span>;
  return <button type="button" disabled={disabled} onClick={onClick} title={text} aria-label={`${figur.titel}, ${text}`} {...aussehen}>{inhalt}</button>;
}

/** Filter: Alle · Fehlt mir · Habe ich, dazu eine Farbe (die Farbchips sind zugleich die Legende). */
function Filterleiste({ spalten, filter, setFilter, farbFilter, setFarbFilter }) {
  return (
    <div className="space-y-2" data-testid="figuren-filter" data-tour="figuren-filter">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
        {[['alle', 'Alle'], ['fehlt', 'Fehlt mir'], ['habe', 'Habe ich']].map(([wert, text]) => (
          <button key={wert} type="button" className={filter === wert ? 'chip-aktiv' : 'chip'} aria-pressed={filter === wert} onClick={() => setFilter(wert)}>{text}</button>
        ))}
      </div>
      {spalten.length > 0 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label="Farbe">
          {spalten.map((sp) => (
            <button key={sp.name} type="button" className={`${farbFilter === sp.name ? 'chip-aktiv' : 'chip'} shrink-0`} aria-pressed={farbFilter === sp.name}
              onClick={() => setFarbFilter(farbFilter === sp.name ? null : sp.name)}>
              <span className="inline-block size-3 rounded-full" style={{ background: farbton(sp.name, sp.hex) }} aria-hidden="true" />{sp.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Liste einfügen: je Zeile „Nr; Name; Farben“ (Farben in Spaltenreihenfolge: x, R oder -). */
function ListeEinfuegen({ serie, onFertig }) {
  const zeigeHinweis = useHinweis();
  const [text, setText] = useState('');
  const [ergebnis, setErgebnis] = useState(null);
  async function einfuegen(e) {
    e.preventDefault();
    try {
      const r = await api.serieListe(serie.id, text);
      setErgebnis(r);
      if (!r.fehler.length) setText('');
      onFertig();
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    }
  }
  return (
    <details className="rounded-xl border border-rand p-3 text-sm" data-testid="liste-einfuegen">
      <summary className="cursor-pointer font-semibold">Liste einfügen</summary>
      <form onSubmit={einfuegen} className="mt-2 space-y-2">
        <p className="text-xs text-leise">
          {serie.mit_farben ? (
            <>
              Je Zeile eine Figur: <span className="font-mono">Nr; Name; Farben</span> – die Farben in der Reihenfolge der Spalten
              {serie.spalten.length ? ` (${serie.spalten.map((sp) => sp.name).join(', ')})` : ''}: <strong>x</strong> gibt es, <strong>-</strong> gab es nicht.
              Beispiel: <span className="font-mono">1; Great Beast; x - - x x x x x</span>.
            </>
          ) : <>Je Zeile eine Figur: <span className="font-mono">Nr; Name</span>, z. B. <span className="font-mono">123; Mario</span>.</>}
          {' '}Tabulatoren (aus einer Tabelle kopiert) gehen auch. Vorhandene Figuren werden ergänzt.
        </p>
        <textarea className="eingabe font-mono" rows={8} value={text} onChange={(e) => setText(e.target.value)} aria-label="Liste" required />
        <button type="submit" className="knopf-primaer">Einfügen</button>
        {ergebnis && (
          <p className="text-xs" role="status">
            {ergebnis.neu} neue Figuren, {ergebnis.ergaenzt} ergänzt, {ergebnis.farben} Farben gesetzt.
            {ergebnis.fehler.length > 0 && <span className="block text-gefahr">{ergebnis.fehler.slice(0, 10).join(' · ')}</span>}
          </p>
        )}
      </form>
    </details>
  );
}

/** Figur anlegen: Nummer (vorbelegt in leeren Zeilen) und Name. */
function NeueFigur({ serie, nummer = null, frei = false, onFertig }) {
  const zeigeHinweis = useHinweis();
  const [offen, setOffen] = useState(false);
  const [nr, setNr] = useState(nummer ?? '');
  const [titel, setTitel] = useState('');
  if (!offen) {
    return frei
      ? <button type="button" className="knopf-sekundaer px-3 py-1.5 text-sm" onClick={() => setOffen(true)}>+ Figur ohne Nummer im Bereich</button>
      : <button type="button" className="text-xs text-akzent-hell underline" onClick={() => setOffen(true)}>+ anlegen</button>;
  }
  async function speichern(e) {
    e.preventDefault();
    try {
      const r = await api.figurAnlegen(serie.id, { nummer: nr, titel });
      if (r.beleg_noetig) zeigeHinweis(BELEG_HINWEIS);
      setOffen(false); setTitel('');
      onFertig();
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    }
  }
  return (
    <form onSubmit={speichern} className="flex flex-wrap items-center gap-1" data-testid="neue-figur">
      <input className="eingabe w-16 py-1 text-sm" value={nr} onChange={(e) => setNr(e.target.value)} placeholder="Nr." aria-label="Nummer" />
      <input className="eingabe min-w-0 flex-1 py-1 text-sm" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Name der Figur" aria-label="Name der Figur" required autoFocus />
      <button type="submit" className="knopf-primaer px-2 py-1 text-sm">OK</button>
    </form>
  );
}

function NeueUnterserie({ ueber }) {
  const zeigeHinweis = useHinweis();
  const [name, setName] = useState('');
  async function anlegen(e) {
    e.preventDefault();
    try {
      const s = await api.serieAnlegen({ name, ueber_id: ueber.id, merch_kategorie: ueber.merch_kategorie });
      navigiere(`/serien/${s.id}`);
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    }
  }
  return (
    <form onSubmit={anlegen} className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1">
        <span className="beschriftung">Neue Unterserie</span>
        <input className="eingabe" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Serie 1 oder Welle 2" required maxLength={100} />
      </label>
      <button type="submit" className="knopf-sekundaer">Anlegen</button>
    </form>
  );
}

/**
 * Bild einer Figur: Foto der Figur (bzw. Katalog-Bild); gibt es Fotos einzelner Farben, lässt sich darunter umschalten.
 * Ohne Bild nur eine schmale Kopfzeile (Nummer und Besitz). Wer die Figur besitzt, kann ein Foto beitragen.
 */
function FigurBild({ figur: f, spalten, nummer, praefix }) {
  const [farbe, setFarbe] = useState(null);
  const mitFoto = f.farben.filter((v) => v.foto_url);
  const url = mitFoto.find((v) => v.variante_id === farbe)?.foto_url ?? f.foto_url ?? mitFoto[0]?.foto_url ?? null;
  return (
    <>
      <div className={`relative flex items-center justify-center bg-karte-hover ${url ? 'aspect-square' : 'h-10'}`}>
        {/* Bild führt wie der Name zum Eintrag */}
        {url && (
          <a href={`#/katalog/${f.katalog_id}`} className="block size-full" aria-label={`„${f.titel}“ öffnen`} data-testid="figur-bild-link">
            <img src={url} alt={f.titel} loading="lazy" className="size-full object-contain p-2" data-testid="figur-bild" />
          </a>
        )}
        {nummer && <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">{praefix}{nummer}</span>}
        {f.besitz.length > 0 && <span className="absolute top-2 right-2 rounded-full bg-erfolg px-2 py-0.5 text-xs font-bold text-white">✓ {f.besitz.length}</span>}
        {f.besitz.length > 0 && (
          <a href={`#/katalog/${f.katalog_id}?foto=foto_figur`} className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
            aria-label={`Foto von „${f.titel}“ beitragen`} title="Foto beitragen">📷</a>
        )}
      </div>
      {mitFoto.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2.5 pt-2" role="group" aria-label="Foto je Farbe" data-testid="figur-fotofarben">
          {mitFoto.map((v) => {
            const hex = spalten.find((sp) => sp.name === v.farbe)?.hex;
            const aktiv = url === v.foto_url;
            return (
              <button key={v.variante_id} type="button" aria-pressed={aktiv} onClick={() => setFarbe(v.variante_id)} title={`Foto in ${v.farbe}`}
                className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] ${aktiv ? 'border-akzent' : 'border-rand text-leise'}`}>
                <span className="size-2.5 rounded-full border border-rand" style={hex ? { backgroundColor: hex } : undefined} />{v.farbe}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Angaben einer Serie/Unterserie: Name, Hersteller, Jahr, Nummernbereich, nie erschienene Nummern, Hinweis, Farbpalette. */
function SerieFormular({ serie, onFertig }) {
  const zeigeHinweis = useHinweis();
  const [w, setW] = useState({
    name: serie.name ?? '', hersteller: serie.hersteller ?? '', jahr: serie.jahr ?? '', merch_kategorie: serie.merch_kategorie ?? 'figur',
    nummer_praefix: serie.nummer_praefix ?? '', nummer_von: serie.nummer_von ?? '', nummer_bis: serie.nummer_bis ?? '',
    nicht_erschienen: serie.nicht_erschienen ?? '', hinweis: serie.hinweis ?? '', mit_farben: Boolean(serie.mit_farben),
    farben: (serie.farben ?? []).map((f) => (f.hex ? `${f.name} ${f.hex}` : f.name)).join('\n'),
  });
  const setze = (feld) => (e) => setW((x) => ({ ...x, [feld]: e.target.value }));
  async function speichern(e) {
    e.preventDefault();
    // Farben: eine je Zeile, optional mit „#rrggbb“ am Ende
    const farben = w.farben.split('\n').map((z) => z.trim()).filter(Boolean).map((z) => {
      const m = z.match(/^(.*?)\s*(#[0-9a-f]{6})$/i);
      return m ? { name: m[1].trim(), hex: m[2] } : { name: z };
    });
    try {
      await api.serieAendern(serie.id, { ...w, farben });
      onFertig();
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    }
  }
  const feld = (name, titel, props = {}) => (
    <label className="block"><span className="beschriftung">{titel}</span><input className="eingabe" value={w[name]} onChange={setze(name)} {...props} /></label>
  );
  return (
    <form onSubmit={speichern} className="karte grid gap-3 p-4 sm:grid-cols-2" data-testid="serie-formular">
      {feld('name', 'Name', { required: true, maxLength: 100 })}
      <label className="block"><span className="beschriftung">Kategorie</span>
        <select className="eingabe" value={w.merch_kategorie} onChange={setze('merch_kategorie')}>{MERCH_KATEGORIEN.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
      </label>
      {feld('hersteller', 'Hersteller', { maxLength: 80 })}
      {feld('jahr', 'Jahr', { inputMode: 'numeric' })}
      {feld('nummer_praefix', 'Präfix der Nummer (z. B. # oder W)', { maxLength: 5 })}
      <div className="grid grid-cols-2 gap-2">{feld('nummer_von', 'Nummern von', { inputMode: 'numeric' })}{feld('nummer_bis', 'bis', { inputMode: 'numeric' })}</div>
      {feld('nicht_erschienen', 'Nie erschienen (z. B. 82-96)', { maxLength: 200 })}
      {feld('hinweis', 'Hinweis (Vertrieb, Besonderheiten)', { maxLength: 500 })}
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="mt-1 size-4 accent-akzent" checked={w.mit_farben} onChange={(e) => setW((x) => ({ ...x, mit_farben: e.target.checked }))} data-testid="mit-farben" />
        <span><strong>Figuren gibt es in verschiedenen Farben</strong><span className="block text-xs text-leise">Wie bei Monster in my Pocket: je Figur die Farben, in denen es sie gab. Bei Funko Pop! & Co. aus lassen.</span></span>
      </label>
      {w.mit_farben && <label className="block sm:col-span-2">
        <span className="beschriftung">Farben (eine je Zeile, optional mit Farbcode, z. B. „Neongrün #5fe03a“)</span>
        <textarea className="eingabe" rows={5} value={w.farben} onChange={setze('farben')} />
      </label>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className="knopf-primaer">Speichern</button>
        <button type="button" className="knopf-sekundaer" onClick={onFertig}>Abbrechen</button>
      </div>
    </form>
  );
}

/** „Zum Spiel“: verknüpfte Spiele der Serie (z. B. Monster in My Pocket → NES 1992); wer die Serie bearbeiten darf, pflegt sie hier. */
function SpieleZurSerie({ serie, onGeaendert }) {
  const [hinzu, setHinzu] = useState(false);
  const zeigeHinweis = useHinweis();
  const spiele = serie.spiele ?? [];
  const darf = serie.ueber ? serie.ueber.bearbeitbar : serie.bearbeitbar;
  if (!spiele.length && !darf) return null;
  const setzen = async (ids) => {
    try { onGeaendert(await api.serieSpiele(serie.id, ids)); setHinzu(false); } catch (e) { zeigeHinweis(Object.values(e.felder ?? {})[0] ?? e.message, 'fehler'); }
  };
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="serie-spiele">
      {spiele.length > 0 && <span className="text-leise">Zum Spiel:</span>}
      {spiele.map((g) => (
        <span key={g.id} className="inline-flex items-center gap-1">
          <a href={`#/katalog/${g.id}`} className="text-akzent-hell underline">{g.titel}</a>
          <span className="text-xs text-leise">{[g.plattformen?.slice(0, 2).join(', '), g.erscheinungsjahr].filter(Boolean).join(' · ')}</span>
          {darf && <button type="button" className="text-xs text-leise" aria-label={`Verknüpfung mit ${g.titel} entfernen`}
            onClick={() => setzen(spiele.filter((x) => x.id !== g.id).map((x) => x.id))}>✕</button>}
        </span>
      ))}
      {darf && !hinzu && <button type="button" className="text-xs text-akzent-hell underline" onClick={() => setHinzu(true)}>{spiele.length ? '+ weiteres Spiel' : 'Mit einem Spiel verknüpfen'}</button>}
      {darf && hinzu && (
        <div className="w-full max-w-md">
          <SpielWahl id="serie-spiel" onChange={(kid) => kid && setzen([...spiele.map((x) => x.id), kid])} />
        </div>
      )}
    </div>
  );
}
