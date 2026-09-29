import { useEffect, useState } from 'react';
import {
  ARTIKELTYPEN, ZUSTAENDE, VOLLSTAENDIGKEITEN, REGIONEN, HERKUNFT, BESTAND, SPIELSTATUS, BEILAGEN, beschriftung,
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
    ['Zustand', beschriftung(ZUSTAENDE, artikel.zustand)],
    ['Vollständigkeit', beschriftung(VOLLSTAENDIGKEITEN, artikel.vollstaendigkeit)],
    ['Farbe', artikel.farbe],
    ['Edition/Variante', artikel.edition],
    ['Modellnummer', artikel.modellnummer],
    ['Seriennummer', artikel.seriennummer],
    ['Seriennummer OVP', artikel.seriennummer_ovp ? <>{artikel.seriennummer_ovp} <SeriennummerAbgleich geraet={artikel.seriennummer} ovp={artikel.seriennummer_ovp} /></> : null],
    ['Beilagen', beilagenText(artikel)],
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
        <a href={`#/artikel/${id}/bearbeiten`} className="rounded-lg p-2 text-leise hover:bg-karte hover:text-text" aria-label="Bearbeiten">
          <Symbol name="stift" />
        </a>
      )}
    >
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <Cover url={artikel.bild_url} typ={artikel.typ} alt={artikel.titel} className="mx-auto aspect-[3/4] w-2/3 rounded-2xl border border-rand md:w-full" band={digitalBand(artikel)} />
          {eigener && <div className="flex justify-center gap-2">
            <label className={`knopf-sekundaer cursor-pointer px-3 py-1.5 ${laedtBild ? 'opacity-50' : ''}`}>
              <Symbol name="kamera" className="size-4" />
              {laedtBild ? 'Lädt hoch …' : artikel.bild_datei ? 'Foto ersetzen' : 'Foto hinzufügen'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={bildWaehlen} disabled={laedtBild} />
            </label>
            {artikel.bild_datei && (
              <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={bildEntfernen}>Foto entfernen</button>
            )}
          </div>}
          {eigener && <ArtikelFotoSync artikel={artikel} onGeaendert={setArtikel} />}
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            {sammler && (
              <p className="mb-1 text-sm text-leise">
                Aus der Sammlung von <a className="text-akzent-hell underline" href={`#${zurueckPfad}`}>{sammler.anzeigename}</a>
              </p>
            )}
            <h2 className="text-2xl font-bold">{artikel.titel}</h2>
            <p className="flex flex-wrap items-center gap-1.5 text-leise">
              {artikel.plattform_kurz && <span className="abzeichen text-akzent-hell" title={artikel.plattform}>{artikel.plattform_kurz}</span>}
              {artikel.plattform}
              {artikel.variante_bezeichnung && <span className="abzeichen">Variante: {artikel.variante_bezeichnung}</span>}
            </p>
            <div className="mt-2"><Abzeichen artikel={artikel} mitZustand /></div>
          </div>

          {eigener && exemplare.length > 1 && (
            <nav className="karte p-3" aria-label="Deine Exemplare">
              <p className="mb-2 text-xs font-semibold tracking-wide text-leise uppercase">Deine Exemplare ({exemplare.length})</p>
              <div className="flex flex-wrap gap-2">
                {exemplare.map((x, i) => (
                  <a key={x.id} href={`#/artikel/${x.id}`} className={String(x.id) === String(id) ? 'chip-aktiv' : 'chip'}>
                    {[x.modellnummer, x.farbe, x.edition].filter(Boolean).join(' · ') || `Exemplar ${i + 1}`}
                  </a>
                ))}
              </div>
            </nav>
          )}

          {eigener && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => navigiere('/neu/formular', { von: artikel.id })}>
                <Symbol name="plus" className="size-4" />Weiteres Exemplar / Variante
              </button>
              {artikel.katalog_id && (
                <a href={`#/katalog/${artikel.katalog_id}`} className="knopf-sekundaer px-3 py-1.5">Katalogseite</a>
              )}
              {artikel.katalog_status && artikel.katalog_status !== 'freigegeben' && <StatusAbzeichen status={artikel.katalog_status} />}
              <Andockpunkt name="artikel.aktionen" artikel={artikel} katalogDaten={katalogDaten} />
              {artikel.bestand === 'besitz' && !artikel.verleih_id && <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setVerleihOffen(true)}>Verleihen …</button>}
              {artikel.bestand === 'besitz' && !artikel.verleih_id && <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setAbgangOffen(true)}>Verkauft / abgegeben …</button>}
              {['verkauft', 'abgegeben'].includes(artikel.bestand) && <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={zurueckInSammlung}>Zurück in die Sammlung</button>}
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
          {eigener && artikel.typ === 'spiel' && ['besitz', 'digital'].includes(artikel.bestand) && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Spielstatus">
              <span className="text-xs text-leise">Spielstatus:</span>
              {SPIELSTATUS.map((s) => (
                <button key={s.value} type="button" onClick={() => setzeSpielstatus(s.value)} aria-pressed={artikel.spielstatus === s.value}
                  className={`${artikel.spielstatus === s.value ? 'chip-aktiv' : 'chip'} px-2.5 py-1 text-xs`}>
                  <span aria-hidden="true">{s.icon}</span>{s.label}
                </button>
              ))}
            </div>
          )}
          {abgangOffen && (
            <AbgangDialog artikel={artikel} onFertig={(r) => {
              setAbgangOffen(false);
              if (!r) return;
              if (String(r.artikel.id) !== String(id)) navigiere(`/artikel/${r.artikel.id}`);
              else setArtikel(r.artikel);
            }} />
          )}

          <dl className="karte divide-y divide-rand">
            {angaben.map(([label, wert]) => (
              <div key={label} className="grid grid-cols-[9rem_1fr] gap-2 px-4 py-2.5 text-sm">
                <dt className="text-leise">{label}</dt>
                <dd className={`break-words ${label === 'Barcode' || label === 'Seriennummer' ? 'font-mono' : ''}`}>{wert}</dd>
              </div>
            ))}
          </dl>

          {artikel.notizen && (
            <section className="karte p-4">
              <h3 className="mb-1 text-sm font-semibold text-leise">Eigene Notizen</h3>
              <p className="text-sm whitespace-pre-wrap">{artikel.notizen}</p>
            </section>
          )}

          {eigener && benutzer?.funktionen?.wartung && artikel.bestand !== 'digital' && <Wartung artikel={artikel} />}
          <Andockpunkt name="artikel.details" artikel={artikel} eigenerArtikel={eigener} />

          <Andockpunkt name="artikel.wert" artikel={artikel} eigenerArtikel={eigener} />

          <Kommentare katalogId={artikel.katalog_id} />

          <Andockpunkt name="artikel.links" artikel={artikel} eigenerArtikel={eigener} />

          <Scans
            katalogId={artikel.katalog_id}
            artikelId={eigener ? artikel.id : null}
            nurLesen={!eigener}
            onKatalogVerknuepft={() => laden()}
          />

          {eigener && <p className="text-xs text-leise">
            Erfasst am {datumDe(artikel.erstellt_am)}
            {artikel.aktualisiert_am !== artikel.erstellt_am && ` · zuletzt geändert am ${datumDe(artikel.aktualisiert_am)}`}
            {artikel.katalog_quelle === 'igdb' && ' · Daten: IGDB.com'}
          </p>}

          {eigener && <div className="flex flex-wrap gap-2">
            <a href={`#/artikel/${id}/bearbeiten`} className="knopf-primaer"><Symbol name="stift" className="size-4" />Bearbeiten</a>
            <button type="button" className="knopf-gefahr" onClick={loeschen}><Symbol name="muell" className="size-4" />Löschen</button>
          </div>}
        </div>
      </div>
    </Layout>
  );
}

/** Beilagen als Text: „✓ Anleitung, ✓ OVP, ✗ Poster“. */
function beilagenText(a) {
  if (!a.beilagen || typeof a.beilagen !== 'object') return null;
  const liste = BEILAGEN[a.typ] ?? BEILAGEN.spiel;
  const teile = liste.filter((b) => b.value in a.beilagen).map((b) => `${a.beilagen[b.value] ? '✓' : '✗'} ${b.label}`);
  if (!teile.length) return null;
  // Automatisch: vollständig (CIB), wenn OVP und Anleitung da sind und nichts als fehlend markiert ist
  const werte = Object.values(a.beilagen);
  const cib = a.beilagen.ovp === true && a.beilagen.anleitung === true && !werte.includes(false);
  return `${cib ? 'Vollständig (CIB) – ' : werte.includes(false) ? 'Unvollständig – ' : ''}${teile.join(', ')}`;
}
