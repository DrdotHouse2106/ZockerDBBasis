import { useEffect, useState } from 'react';
import {
  ARTIKELTYPEN, ZUSTAENDE, VOLLSTAENDIGKEITEN, REGIONEN, HERKUNFT, BESTAND, SPIELSTATUS, BEILAGEN, beschriftung, beilageText, beilageVorhanden, zustandBeschriftung, KAUFQUELLEN,
} from '../../../shared/konstanten.js';
import { api } from '../api.js';
import { navigiere } from '../router.js';
import { euro, datumDe, euroMitVorzeichen } from '../format.js';
import Layout from '../komponenten/Layout.jsx';
import Cover from '../komponenten/Cover.jsx';
import Abzeichen from '../komponenten/Abzeichen.jsx';
import { digitalBand } from '../komponenten/ArtikelKarte.jsx';
import Symbol from '../komponenten/Symbole.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import Scans from '../komponenten/Scans.jsx';
import Fotos from '../komponenten/Fotos.jsx';
import Kommentare from '../komponenten/Kommentare.jsx';
import StatusAbzeichen from '../komponenten/StatusAbzeichen.jsx';
import { Andockpunkt } from '../erweiterungen.jsx';
import { ArtikelFotoSync } from '../komponenten/Zockerdb.jsx';
import { SeriennummerAbgleich, lagerortText } from '../komponenten/ZusatzFelder.jsx';
import Wartung from '../komponenten/Wartung.jsx';
import { useSitzung } from '../sitzung.js';

/** Exemplar als verkauft bzw. verschenkt/getauscht markieren – bei mehreren Stück wahlweise nur einen Teil. */
function AbgangDialog({ artikel, onFertig }) {
  const zeigeHinweis = useHinweis();
  const [bestand, setBestand] = useState('verkauft');
  const [anzahl, setAnzahl] = useState(artikel.anzahl);
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [preis, setPreis] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  async function speichern(e) {
    e.preventDefault();
    setLaeuft(true);
    try {
      const r = await api.artikelAbgang(artikel.id, { bestand, anzahl, datum, preis: bestand === 'verkauft' ? preis : null });
      zeigeHinweis(r.rest ? `${anzahl} von ${artikel.anzahl} Stück als ${bestand === 'verkauft' ? 'verkauft' : 'abgegeben'} markiert.` : 'Aus der Sammlung genommen – unter „Verkauft & abgegeben“ bleibt es sichtbar.');
      onFertig(r);
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    } finally {
      setLaeuft(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="abgang-titel">
      <form onSubmit={speichern} className="karte w-full max-w-md space-y-3 p-4">
        <h2 id="abgang-titel" className="text-lg font-semibold">Nicht mehr in der Sammlung</h2>
        <div className="flex gap-2">
          {BESTAND.filter((b) => ['verkauft', 'abgegeben'].includes(b.value)).map((b) => (
            <button key={b.value} type="button" className={bestand === b.value ? 'chip-aktiv' : 'chip'} onClick={() => setBestand(b.value)}>{b.label}</button>
          ))}
        </div>
        {artikel.anzahl > 1 && (
          <label className="block">
            <span className="beschriftung">Wie viele Stück?</span>
            <span className="flex items-center gap-2">
              <input type="number" min="1" max={artikel.anzahl} className="eingabe w-24" value={anzahl}
                onChange={(e) => setAnzahl(Math.min(artikel.anzahl, Math.max(1, Number(e.target.value) || 1)))} />
              <span className="text-sm text-leise">von {artikel.anzahl}</span>
            </span>
          </label>
        )}
        <label className="block">
          <span className="beschriftung">Datum</span>
          <input type="date" className="eingabe" value={datum} onChange={(e) => setDatum(e.target.value)} required />
        </label>
        {bestand === 'verkauft' && (
          <label className="block">
            <span className="beschriftung">Verkaufspreis gesamt (€, optional)</span>
            <input className="eingabe" inputMode="decimal" value={preis} onChange={(e) => setPreis(e.target.value)} placeholder="z. B. 45,00" />
            <span className="text-xs text-leise">Für Erlös und Gewinn/Verlust in der Statistik – bleibt privat.</span>
          </label>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="knopf-sekundaer" onClick={() => onFertig(null)}>Abbrechen</button>
          <button type="submit" className="knopf-primaer" disabled={laeuft}>{laeuft ? 'Wird gespeichert …' : 'Speichern'}</button>
        </div>
      </form>
    </div>
  );
}

/** Exemplar verleihen: an einen Namen oder an einen ZockerDB-Benutzer (der bekommt eine Benachrichtigung und bestätigt). */
function VerleihDialog({ artikel, onFertig }) {
  const zeigeHinweis = useHinweis();
  const [art, setArt] = useState('name');
  const [an, setAn] = useState('');
  const [seit, setSeit] = useState(new Date().toISOString().slice(0, 10));
  const [rueckgabe, setRueckgabe] = useState('');
  const [notiz, setNotiz] = useState('');
  async function speichern(e) {
    e.preventDefault();
    try {
      const r = await api.artikelVerleihen(artikel.id, { [art === 'name' ? 'an_name' : 'an_benutzername']: an, seit, rueckgabe, notiz });
      zeigeHinweis(art === 'name' ? 'Als verliehen eingetragen.' : 'Verliehen – der Benutzer wird um eine kurze Bestätigung gebeten.');
      onFertig(r);
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="verleih-titel">
      <form onSubmit={speichern} className="karte w-full max-w-md space-y-3 p-4">
        <h2 id="verleih-titel" className="text-lg font-semibold">„{artikel.titel}“ verleihen</h2>
        <div className="flex gap-2">
          <button type="button" className={art === 'name' ? 'chip-aktiv' : 'chip'} onClick={() => setArt('name')}>An einen Namen</button>
          <button type="button" className={art === 'benutzer' ? 'chip-aktiv' : 'chip'} onClick={() => setArt('benutzer')}>An einen ZockerDB-Benutzer</button>
        </div>
        <label className="block">
          <span className="beschriftung">{art === 'name' ? 'An wen?' : 'Benutzername'}</span>
          <input className="eingabe" value={an} onChange={(e) => setAn(e.target.value)} required autoFocus maxLength={100}
            placeholder={art === 'name' ? 'z. B. Max (Kollege)' : 'z. B. retrofan84'} />
          {art === 'benutzer' && <span className="text-xs text-leise">Er sieht das Spiel unter „Ausgeliehen von anderen“ – nur Titel und Plattform, keine Preise.</span>}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="beschriftung">Seit</span><input type="date" className="eingabe" value={seit} onChange={(e) => setSeit(e.target.value)} required /></label>
          <label className="block"><span className="beschriftung">Rückgabe geplant</span><input type="date" className="eingabe" value={rueckgabe} onChange={(e) => setRueckgabe(e.target.value)} /></label>
        </div>
        <label className="block"><span className="beschriftung">Notiz (privat, optional)</span><input className="eingabe" value={notiz} onChange={(e) => setNotiz(e.target.value)} maxLength={500} /></label>
        <p className="text-xs text-leise">Ist ein Rückgabetag eingetragen, erinnert dich die App, wenn er überschritten ist. Das Exemplar bleibt in deiner Sammlung und im Sammlungswert.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="knopf-sekundaer" onClick={() => onFertig(null)}>Abbrechen</button>
          <button type="submit" className="knopf-primaer">Verleihen</button>
        </div>
      </form>
    </div>
  );
}

/**
 * Detailansicht eines Artikels. Mit „sammlerName“ und „fremdLaden“ (von einem Zusatzmodul, z. B. Community)
 * wird ein Artikel aus einer fremden Sammlung schreibgeschützt angezeigt.
 */
export default function ArtikelDetail({ route, id, sammlerName, fremdLaden, zurueck = '/' }) {
  const zeigeHinweis = useHinweis();
  const eigener = !sammlerName;
  const { benutzer } = useSitzung();
  const [artikel, setArtikel] = useState(null);
  const [sammler, setSammler] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [laedtBild, setLaedtBild] = useState(false);
  const [abgangOffen, setAbgangOffen] = useState(false);
  const [verleihOffen, setVerleihOffen] = useState(false);

  const [exemplare, setExemplare] = useState([]);
  const [katalogDaten, setKatalogDaten] = useState(null);
  const laden = () => (eigener
    ? api.artikel(id).then((a) => {
      setArtikel(a);
      if (a.katalog_id) api.katalogSeite(a.katalog_id).then((d) => { setExemplare(d.meineExemplare); setKatalogDaten(d); }).catch(() => {});
    })
    : fremdLaden().then((d) => { setArtikel(d.artikel); setSammler(d.sammler); })
  ).catch((e) => setFehler(e.message));
  useEffect(() => { laden(); }, [id, sammlerName]);
  const zurueckPfad = zurueck;

  async function loeschen() {
    if (!window.confirm(`„${artikel.titel}“ wirklich aus der Sammlung löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    try {
      const r = await api.artikelLoeschen(id, { basis: artikel.aktualisiert_am, beschreibung: `„${artikel.titel}“ löschen` });
      zeigeHinweis(r?.offline ? 'Offline gemerkt – wird gelöscht, sobald du wieder online bist.' : 'Artikel gelöscht.');
      navigiere('/');
    } catch (e) {
      zeigeHinweis(e.message, 'fehler');
    }
  }

  async function bildWaehlen(e) {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei) return;
    setLaedtBild(true);
    try {
      setArtikel(await api.bildHochladen(id, datei));
      zeigeHinweis('Foto gespeichert.');
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    } finally {
      setLaedtBild(false);
    }
  }

  // Spielstatus mit einem Tipp setzen (erneutes Tippen entfernt ihn); „durchgespielt“ merkt sich das Datum
  async function zurueckbekommen() {
    try {
      await api.verleihZurueck(artikel.verleih_id);
      zeigeHinweis('Als zurückbekommen markiert.');
      setArtikel(await api.artikel(id));
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    }
  }

  async function setzeSpielstatus(wert) {
    const neu = artikel.spielstatus === wert ? null : wert;
    const daten = { spielstatus: neu };
    if (['durchgespielt', 'komplett'].includes(neu) && !artikel.durchgespielt_am) daten.durchgespielt_am = new Date().toISOString().slice(0, 10);
    try {
      const r = await api.artikelAendern(id, daten, { basis: artikel.aktualisiert_am, beschreibung: `Spielstatus „${artikel.titel}“` });
      setArtikel(r?.offline ? { ...artikel, ...daten } : r);
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    }
  }

  async function zurueckInSammlung() {
    try {
      setArtikel(await api.artikelZurueck(id));
      zeigeHinweis('Wieder in der Sammlung.');
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    }
  }

  async function bildEntfernen() {
    try {
      setArtikel(await api.bildEntfernen(id));
      zeigeHinweis('Eigenes Foto entfernt.');
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    }
  }

  if (!artikel) {
    return (
      <Layout route={route} titel="Artikel" zurueck={zurueckPfad}>
        {fehler ? <p className="text-gefahr" role="alert">{fehler}</p> : <p className="text-leise">Wird geladen …</p>}
      </Layout>
    );
  }

  const angaben = [
    ['Artikeltyp', beschriftung(ARTIKELTYPEN, artikel.typ)],
    ['Plattform', artikel.plattform],
    ['Region', beschriftung(REGIONEN, artikel.region)],
    [artikel.zustand_ovp ? zustandBeschriftung(artikel.typ).traeger : 'Zustand', beschriftung(ZUSTAENDE, artikel.zustand)],
    [zustandBeschriftung(artikel.typ).ovp, artikel.zustand_ovp ? beschriftung(ZUSTAENDE, artikel.zustand_ovp) : null],
    ['Vollständigkeit', beschriftung(VOLLSTAENDIGKEITEN, artikel.vollstaendigkeit)],
    ['Farbe', artikel.farbe],
    ['Edition/Variante', artikel.edition],
    ['Modellnummer', artikel.modellnummer],
    ['Seriennummer', artikel.seriennummer],
    ['Seriennummer OVP', artikel.seriennummer_ovp ? <>{artikel.seriennummer_ovp} <SeriennummerAbgleich geraet={artikel.seriennummer} ovp={artikel.seriennummer_ovp} /></> : null],
    ['Beilagen', beilagenText(artikel)],
    ['Beilagen genau', artikel.beilagen_notiz],
    ['Lagerort', eigener && lagerortText(artikel)
      ? <a className="underline" href={`#/?lagerort_ort=${encodeURIComponent(artikel.lagerort_ort)}${artikel.lagerort_regal ? `&lagerort_regal=${encodeURIComponent(artikel.lagerort_regal)}` : ''}`}>{lagerortText(artikel)}</a> : null],
    ['Barcode', artikel.barcode],
    ['Anzahl', artikel.anzahl > 1 ? `${artikel.anzahl} Stück` : null],
    ['Herkunft', beschriftung(HERKUNFT, artikel.herkunft)],
    ['Konvolut', artikel.konvolut_id ? <a href={`#/konvolut/${artikel.konvolut_id}`} className="underline">{artikel.konvolut_name}</a> : null],
    ['Kaufpreis', artikel.kaufpreis != null
      ? `${euro(artikel.kaufpreis)}${artikel.kaufpreis_anteilig ? ' (Anteil am Konvolut)' : ''}`
      : eigener && artikel.herkunft ? 'unbekannt' : null],
    ['Marktwert', artikel.marktwert != null ? `${euro(artikel.marktwert)} (eigene Schätzung)` : null],
    ['Kaufdatum', artikel.kaufdatum ? datumDe(artikel.kaufdatum) : null],
    ['Bestand', artikel.bestand === 'digital'
      ? `Digital${artikel.digital_quelle === 'steam' ? ' (Steam-Bibliothek)' : ''} – zählt nicht zur Sammlung`
      : artikel.bestand && artikel.bestand !== 'besitz'
        ? `${beschriftung(BESTAND, artikel.bestand)}${artikel.abgang_am ? ` am ${datumDe(artikel.abgang_am)}` : ''}` : null],
    ['Durchgespielt am', artikel.durchgespielt_am ? datumDe(artikel.durchgespielt_am) : null],
    ['Spielzeit', artikel.spielzeit_minuten ? `${Math.floor(artikel.spielzeit_minuten / 60)} Std. ${artikel.spielzeit_minuten % 60} Min.` : null],
    ['Verkaufspreis', artikel.verkaufspreis != null ? `${euro(artikel.verkaufspreis)}${artikel.anzahl > 1 ? ' je Stück' : ''}` : null],
    ['Gewinn/Verlust', artikel.verkaufspreis != null && artikel.kaufpreis != null
      ? euroMitVorzeichen((artikel.verkaufspreis - artikel.kaufpreis) * artikel.anzahl) : null],
    ['Erscheinungsjahr', artikel.erscheinungsjahr],
  ].filter(([, wert]) => wert);

  return (
    <Layout
      route={route}
      titel={artikel.titel}
      titelImInhalt={false}
      zurueck={zurueckPfad}
      aktionen={eigener && (
        <a href={`#/artikel/${id}/bearbeiten`} className="rounded-lg p-2 text-leise hover:bg-karte hover:text-text" aria-label="Bearbeiten" data-tour="artikel-bearbeiten">
          <Symbol name="stift" />
        </a>
      )}
    >
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="space-y-2">
          <Cover url={artikel.bild_url} typ={artikel.typ} alt={artikel.titel} className="mx-auto aspect-[3/4] w-40 rounded-2xl border border-rand md:w-full" band={digitalBand(artikel)} />
          {eigener && <ArtikelFotoSync artikel={artikel} onGeaendert={setArtikel} />}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5" data-tour="artikel-kopf">
            {sammler && (
              <p className="text-sm text-leise">
                Aus der Sammlung von <a className="text-akzent-hell underline" href={`#${zurueckPfad}`}>{sammler.anzeigename}</a>
              </p>
            )}
            <h2 className="text-2xl font-bold">{artikel.titel}</h2>
            {Boolean(artikel.privat) && (
              <p className="flex items-center gap-1 text-sm text-leise"><Symbol name="schloss" className="size-4" />Privat – nur für dich sichtbar</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              {artikel.plattform && <span className="abzeichen text-akzent-hell" title={artikel.plattform}>{artikel.plattform_kurz || artikel.plattform}</span>}
              {artikel.variante_bezeichnung && <span className="abzeichen">{artikel.variante_bezeichnung}</span>}
              <Abzeichen artikel={artikel} mitZustand />
              {artikel.katalog_status && artikel.katalog_status !== 'freigegeben' && <StatusAbzeichen status={artikel.katalog_status} />}
            </div>
          </div>

          {eigener && exemplare.length > 1 && (
            <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Deine Exemplare">
              <span className="text-xs text-leise">{exemplare.length} Exemplare:</span>
              {exemplare.map((x, i) => (
                <a key={x.id} href={`#/artikel/${x.id}`} className={`${String(x.id) === String(id) ? 'chip-aktiv' : 'chip'} px-2.5 py-1 text-xs`}>
                  {[x.modellnummer, x.farbe, x.edition].filter(Boolean).join(' · ') || `Nr. ${i + 1}`}
                </a>
              ))}
            </nav>
          )}

          {/* Aktionen: das Wichtigste sichtbar, der Rest im Menü */}
          {eigener && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {artikel.typ === 'spiel' && ['besitz', 'digital'].includes(artikel.bestand) && (
                <label className="flex items-center gap-1.5" data-tour="artikel-spielstatus">
                  <span className="sr-only">Spielstatus</span>
                  <select className="eingabe w-auto py-1.5 text-sm" value={artikel.spielstatus ?? ''} onChange={(e) => setzeSpielstatus(e.target.value || null)} aria-label="Spielstatus">
                    <option value="">🎮 Spielstatus …</option>
                    {SPIELSTATUS.map((st) => <option key={st.value} value={st.value}>{st.icon} {st.label}</option>)}
                  </select>
                </label>
              )}
              <Andockpunkt name="artikel.aktionen" artikel={artikel} katalogDaten={katalogDaten} />
              {['verkauft', 'abgegeben'].includes(artikel.bestand) && <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={zurueckInSammlung}>Zurück in die Sammlung</button>}
              <AktionenMenue>
                <button type="button" onClick={() => navigiere('/neu/formular', { von: artikel.id })}>Weiteres Exemplar / Variante</button>
                {artikel.katalog_id && <a href={`#/katalog/${artikel.katalog_id}`}>Zur Katalogseite</a>}
                {artikel.bestand === 'besitz' && !artikel.verleih_id && <button type="button" onClick={() => setVerleihOffen(true)}>Verleihen …</button>}
                {artikel.bestand === 'besitz' && !artikel.verleih_id && <button type="button" onClick={() => setAbgangOffen(true)}>Verkauft / abgegeben …</button>}
                <label className={`cursor-pointer ${laedtBild ? 'opacity-50' : ''}`}>
                  {laedtBild ? 'Foto lädt hoch …' : artikel.bild_datei ? 'Eigenes Foto ersetzen' : 'Eigenes Foto hinzufügen'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={bildWaehlen} disabled={laedtBild} />
                </label>
                {artikel.bild_datei && <button type="button" onClick={bildEntfernen}>Eigenes Foto entfernen</button>}
                <a href={`#/artikel/${id}/bearbeiten`}>Bearbeiten</a>
                <button type="button" className="text-gefahr" onClick={loeschen}>Löschen</button>
              </AktionenMenue>
            </div>
          )}
          {eigener && artikel.verleih_id && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/50 bg-sky-500/10 p-3 text-sm">
              <span>
                <strong>Verliehen an {artikel.verliehen_an}</strong> seit {datumDe(artikel.verliehen_seit)}
                {artikel.rueckgabe_geplant && <> · Rückgabe {datumDe(artikel.rueckgabe_geplant)}</>}
                {artikel.rueckgabe_geplant && artikel.rueckgabe_geplant < new Date().toISOString().slice(0, 10) && <strong className="text-warnung"> · überfällig</strong>}
                {artikel.verleih_bestaetigung === 'offen' && <span className="text-leise"> · noch nicht bestätigt</span>}
                {artikel.verleih_bestaetigung === 'abgelehnt' && <span className="text-warnung"> · vom Empfänger abgelehnt</span>}
              </span>
              <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={zurueckbekommen}>Zurückbekommen</button>
            </div>
          )}
          {verleihOffen && <VerleihDialog artikel={artikel} onFertig={(neu) => { setVerleihOffen(false); if (neu) setArtikel(neu); }} />}
          {abgangOffen && (
            <AbgangDialog artikel={artikel} onFertig={(r) => {
              setAbgangOffen(false);
              if (!r) return;
              if (String(r.artikel.id) !== String(id)) navigiere(`/artikel/${r.artikel.id}`);
              else setArtikel(r.artikel);
            }} />
          )}

          <dl className="karte divide-y divide-rand" data-tour="artikel-angaben">
            {angaben.map(([label, wert]) => (
              <div key={label} className="grid grid-cols-[8rem_1fr] gap-2 px-4 py-2 text-sm">
                <dt className="text-leise">{label}</dt>
                <dd className={`break-words ${label === 'Barcode' || label === 'Seriennummer' ? 'font-mono' : ''}`}>{wert}</dd>
              </div>
            ))}
          </dl>

          {eigener && <Preisgeschichte artikel={artikel} />}

          {artikel.notizen && (
            <section className="karte p-4">
              <h3 className="mb-1 text-sm font-semibold text-leise">Eigene Notizen</h3>
              <p className="text-sm whitespace-pre-wrap">{artikel.notizen}</p>
            </section>
          )}

          {artikel.bestand !== 'digital' && (eigener || (benutzer && artikel.katalog_id)) && (
            <Fotos katalogId={artikel.katalog_id} typ={artikel.typ} plattform={{ kurz: artikel.plattform_kurz, name: artikel.plattform }}
              artikelId={eigener && artikel.bestand === 'besitz' ? artikel.id : null} vorauswahl={route.parameter?.foto ?? null}
              hinscrollen={Boolean(route.parameter?.foto)}
              varianten={katalogDaten?.varianten ?? []} variante={artikel.variante_id ?? null}
              neu={eigener && route.parameter?.neu === '1'}
              versiegelt={artikel.zustand === 'neu_ovp'} beilagen={artikel.beilagen}
              onKatalogVerknuepft={() => laden()} />
          )}

          {eigener && benutzer?.funktionen?.wartung && artikel.bestand !== 'digital' && <Wartung artikel={artikel} />}
          <Andockpunkt name="artikel.details" artikel={artikel} eigenerArtikel={eigener} />

          <Andockpunkt name="artikel.wert" artikel={artikel} eigenerArtikel={eigener} />

          {/* Seltener Gebrauchtes zusammengeklappt */}
          <details className="group space-y-3" data-tour="artikel-mehr">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-rand px-4 py-3 text-sm font-semibold hover:bg-karte-hover">
              <span>Kommentare, Cover & Handbücher, Scans</span>
              <span className="text-leise transition group-open:rotate-90" aria-hidden="true">›</span>
            </summary>
            <div className="space-y-4 pt-3">
              <Kommentare katalogId={artikel.katalog_id} />
              <Andockpunkt name="artikel.links" artikel={artikel} eigenerArtikel={eigener} />
              <Scans
                katalogId={artikel.katalog_id}
                artikelId={eigener ? artikel.id : null}
                nurLesen={!eigener}
                onKatalogVerknuepft={() => laden()}
              />
            </div>
          </details>

          {eigener && <p className="text-xs text-leise">
            Erfasst am {datumDe(artikel.erstellt_am)}
            {artikel.aktualisiert_am !== artikel.erstellt_am && ` · zuletzt geändert am ${datumDe(artikel.aktualisiert_am)}`}
            {artikel.katalog_quelle === 'igdb' && ' · Daten: IGDB.com'}
          </p>}
        </div>
      </div>
    </Layout>
  );
}

/**
 * Preisgeschichte des eigenen Exemplars als Zeitstrahl: Erstkauf laut Beleg (Neupreis), eigener Kauf, Verkauf und
 * die eigene Wertschätzung von heute – mit Veränderung gegenüber dem ersten bekannten Preis. Nur für den Besitzer.
 */
function Preisgeschichte({ artikel: a }) {
  const schritte = [
    (a.neupreis != null || a.erstkauf_datum) && {
      datum: a.erstkauf_datum, preis: a.neupreis,
      text: `Neu gekauft${a.erstkauf_quelle ? ` bei ${a.erstkauf_quelle}` : ''}`, hinweis: 'laut Beleg',
    },
    (a.kaufpreis != null || a.kaufdatum) && a.herkunft !== 'schon_immer' && {
      datum: a.kaufdatum, preis: a.kaufpreis,
      text: a.herkunft === 'geschenk' ? 'Geschenkt bekommen' : a.herkunft === 'getauscht' ? 'Eingetauscht'
        : `Von dir gekauft${a.kauf_quelle ? ` – ${beschriftung(KAUFQUELLEN, a.kauf_quelle)}` : ''}`,
      hinweis: a.kaufpreis_anteilig ? 'Anteil am Konvolut' : null,
    },
    a.bestand !== 'besitz' && a.abgang_am && {
      datum: a.abgang_am, preis: a.verkaufspreis, text: a.bestand === 'verkauft' ? 'Verkauft' : 'Abgegeben',
    },
    a.bestand === 'besitz' && a.marktwert != null && { datum: null, preis: a.marktwert, text: 'Heute (deine Schätzung)', heute: true },
  ].filter(Boolean);
  // Erst ab zwei Stationen – sonst steht alles schon in den Angaben oben
  if (schritte.length < 2) return null;
  const sortiert = [...schritte].sort((x, y) => (x.heute ? 1 : y.heute ? -1 : (x.datum ?? '9999').localeCompare(y.datum ?? '9999')));
  const erster = sortiert.find((x) => x.preis != null)?.preis;
  return (
    <section className="karte space-y-2 p-4">
      <h3 className="flex items-center gap-2 font-semibold"><Symbol name="statistik" className="size-5" />Preisgeschichte</h3>
      <ol className="space-y-2 border-l-2 border-akzent/40 pl-4">
        {sortiert.map((x, i) => (
          <li key={i} className="relative text-sm">
            <span className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-akzent" aria-hidden="true" />
            <span className="text-leise">{x.heute ? 'Heute' : x.datum ? datumDe(x.datum) : 'Datum unbekannt'}</span>
            {' · '}{x.text}
            {x.preis != null && <> für <strong>{euro(x.preis)}</strong></>}
            {x.preis != null && erster && x.preis !== erster && (
              <span className={`ml-1 text-xs ${x.preis > erster ? 'text-erfolg' : 'text-leise'}`}>
                ({x.preis > erster ? '+' : ''}{Math.round(((x.preis - erster) / erster) * 100)} %)
              </span>
            )}
            {x.hinweis && <span className="ml-1 text-xs text-leise">({x.hinweis})</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Beilagen als Text: „✓ Anleitung, ✓ OVP, ✗ Poster“. */
function beilagenText(a) {
  if (!a.beilagen || typeof a.beilagen !== 'object') return null;
  const liste = BEILAGEN[a.typ] ?? BEILAGEN.spiel;
  const teile = liste.filter((b) => b.value in a.beilagen).map((b) => beilageText(b.label, a.beilagen[b.value]));
  if (!teile.length) return null;
  // Automatisch: vollständig (CIB), wenn OVP und Anleitung da sind und nichts als fehlend markiert ist
  const werte = Object.values(a.beilagen);
  const cib = beilageVorhanden(a.beilagen.ovp) && beilageVorhanden(a.beilagen.anleitung) && !werte.includes(false);
  return `${cib ? 'Vollständig (CIB) – ' : werte.includes(false) ? 'Unvollständig – ' : ''}${teile.join(', ')}`;
}

/** Menü „Weitere Aktionen“ – hält die Seite übersichtlich; schließt nach einer Auswahl. */
function AktionenMenue({ children }) {
  const [offen, setOffen] = useState(false);
  // Nach rechts aufklappen, wenn rechts vom Knopf genug Platz ist (Handy: Knopf steht links) – sonst nach links
  const [rechtsbuendig, setRechtsbuendig] = useState(false);
  const umschalten = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setRechtsbuendig(r.left + 256 > window.innerWidth - 8);
    setOffen(!offen);
  };
  return (
    <div className="relative">
      <button type="button" className="knopf-sekundaer px-3 py-1.5" aria-haspopup="menu" aria-expanded={offen} onClick={umschalten} data-tour="artikel-aktionen">
        Weitere Aktionen <span aria-hidden="true">▾</span>
      </button>
      {offen && (
        <>
          <button type="button" className="fixed inset-0 z-30 cursor-default" aria-label="Menü schließen" onClick={() => setOffen(false)} />
          <div role="menu" onClick={(e) => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') setOffen(false); }}
            className={`karte absolute ${rechtsbuendig ? 'right-0' : 'left-0'} z-40 mt-1 flex w-64 max-w-[calc(100vw-1rem)] flex-col overflow-hidden py-1 text-sm shadow-lg [&>*]:px-4 [&>*]:py-2.5 [&>*]:text-left [&>*:hover]:bg-karte-hover`}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}
