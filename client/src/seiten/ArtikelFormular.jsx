import { useEffect, useId, useMemo, useState } from 'react';
import {
  ARTIKELTYPEN, ZUSTAENDE, VOLLSTAENDIGKEITEN, REGIONEN, HERKUNFT, DIGITAL_QUELLEN, istModerator,
  beilagenAusVollstaendigkeit, vollstaendigkeitAusBeilagen, zustandBeschriftung, KAUFQUELLEN,
} from '../../../shared/konstanten.js';
import { usePlattformen } from '../plattformen.js';
import { useSitzung } from '../sitzung.js';
import PlattformAuswahl from '../komponenten/PlattformAuswahl.jsx';
import StatusAbzeichen from '../komponenten/StatusAbzeichen.jsx';
import { api, ApiFehler } from '../api.js';
import { navigiere } from '../router.js';
import { preisFeld, datumFeld, leseDatum, euro } from '../format.js';
import Layout from '../komponenten/Layout.jsx';
import Cover from '../komponenten/Cover.jsx';
import Symbol from '../komponenten/Symbole.jsx';
import BarcodeScanner from '../komponenten/BarcodeScanner.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import { MODUL } from '../erweiterungen.jsx';
import { LagerortFelder, BeilagenCheckliste, SeriennummerAbgleich } from '../komponenten/ZusatzFelder.jsx';

const FARBVORSCHLAEGE = [
  'Schwarz', 'Weiß', 'Grau', 'Silber', 'Clear', 'Clear Red', 'Clear Blue', 'Clear Green', 'Atomic Purple',
  'Jungle Green', 'Fire Orange', 'Ice Blue', 'Indigo', 'Platinum', 'Orange', 'Pikachu Edition', 'Crystal', 'Neon Rot/Blau',
];

const LEER = {
  typ: 'spiel', titel: '', plattform: '', plattform_id: null, variante_id: null, katalog_id: null, barcode: '', cover_url: '', zustand: '', vollstaendigkeit: '',
  region: 'pal_de', farbe: '', edition: '', modellnummer: '', seriennummer: '', notizen: '', kaufpreis: '', kaufdatum: '', anzahl: 1,
  marktwert: '', herkunft: '', konvolut_id: null, bestand: 'besitz', digital_quelle: null,
  lagerort_ort: '', lagerort_regal: '', lagerort_fach: '', beilagen: null, seriennummer_ovp: '', privat: false, zustand_ovp: '',
  neupreis: '', erstkauf_datum: '', erstkauf_quelle: '', kauf_quelle: '', beilagen_notiz: '',
};

export default function ArtikelFormular({ route, artikelId }) {
  const p = route.parameter;
  const zeigeHinweis = useHinweis();
  const bearbeiten = Boolean(artikelId);
  const [werte, setWerte] = useState(null);
  const [katalogEintrag, setKatalogEintrag] = useState(null);
  const [katalogFreigabe, setKatalogFreigabe] = useState('privat'); // privat | einreichen | veroeffentlichen
  const [varianten, setVarianten] = useState([]);
  const plattformen = usePlattformen();
  const { benutzer, status } = useSitzung();
  const funktionen = benutzer?.funktionen ?? {};
  // Beilagen-Liste (Zusatzfeld) – steht direkt unter der Vollständigkeit, beide füllen sich gegenseitig vor
  const beilagenSichtbar = Boolean(funktionen.beilagen) && werte?.bestand !== 'digital';
  // Im Konto ausgeblendete Felder (bereits ausgefüllte bleiben sichtbar, damit nichts unbemerkt verloren geht)
  const ausgeblendet = new Set(benutzer?.ausgeblendete_felder ?? []);
  const zeige = (feld) => !ausgeblendet.has(feld) || Boolean(werte?.[feld]);
  const [fehler, setFehler] = useState({});
  const [allgemeinerFehler, setAllgemeinerFehler] = useState(null);
  const [speichert, setSpeichert] = useState(false);
  const [bildDatei, setBildDatei] = useState(null);
  const [scannerOffen, setScannerOffen] = useState(false);
  const [konvolute, setKonvolute] = useState([]);
  useEffect(() => { api.konvolute().then(setKonvolute).catch(() => {}); }, []);

  useEffect(() => {
    (async () => {
      try {
        if (bearbeiten) {
          const a = await api.artikel(artikelId);
          setWerte({
            ...LEER, ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v ?? ''])),
            kaufpreis: a.kaufpreis_anteilig ? '' : preisFeld(a.kaufpreis), marktwert: preisFeld(a.marktwert),
            kaufdatum: datumFeld(a.kaufdatum), konvolut_id: a.konvolut_id,
            neupreis: preisFeld(a.neupreis), erstkauf_datum: datumFeld(a.erstkauf_datum),
            katalog_id: a.katalog_id, plattform_id: a.plattform_id, variante_id: a.variante_id,
          });
          if (a.katalog_id) {
            setKatalogEintrag(await api.katalogEintrag(a.katalog_id).catch(() => null));
            setVarianten(await api.varianten(a.katalog_id).catch(() => []));
          }
          return;
        }
        const basis = { ...LEER, typ: p.typ ?? 'spiel', titel: p.titel ?? '', barcode: p.barcode ?? '' };
        // Aus einem Konvolut: nächsten Artikel direkt diesem Paket zuordnen
        if (p.konvolut) Object.assign(basis, { konvolut_id: Number(p.konvolut), herkunft: 'konvolut' });
        // „Weiteres Exemplar“: Grunddaten eines vorhandenen Artikels übernehmen
        if (p.von) {
          const vorlage = await api.artikel(p.von);
          Object.assign(basis, {
            typ: vorlage.typ, titel: vorlage.titel, katalog_id: vorlage.katalog_id, plattform: vorlage.plattform ?? '',
            plattform_id: vorlage.plattform_id, region: vorlage.region ?? '', cover_url: vorlage.cover_url ?? '',
          });
          if (vorlage.katalog_id) {
            setKatalogEintrag(await api.katalogEintrag(vorlage.katalog_id).catch(() => null));
            setVarianten(await api.varianten(vorlage.katalog_id).catch(() => []));
          }
        }
        if (p.katalog) {
          const eintrag = await api.katalogEintrag(p.katalog);
          setKatalogEintrag(eintrag);
          Object.assign(basis, {
            typ: eintrag.typ,
            titel: eintrag.titel,
            katalog_id: eintrag.id,
            cover_url: eintrag.cover_url ?? '',
            plattform: eintrag.plattformen.length === 1 ? eintrag.plattformen[0] : eintrag.typ === 'konsole' ? eintrag.titel : '',
          });
          // Plattform aus dem Barcode-Produktnamen (z. B. „Ps3“), falls es den Titel dafür gibt
          if (p.plattform_id) basis.plattform_id = Number(p.plattform_id);
          const liste = await api.varianten(eintrag.id).catch(() => []);
          setVarianten(liste);
          const gewaehlt = liste.find((v) => String(v.id) === p.variante);
          if (gewaehlt) {
            Object.assign(basis, {
              variante_id: gewaehlt.id, modellnummer: gewaehlt.modellnummer ?? '', farbe: gewaehlt.farbe ?? '',
              edition: gewaehlt.edition ?? '', region: gewaehlt.region ?? basis.region,
            });
          }
        }
        setWerte(basis);
      } catch (e) {
        setAllgemeinerFehler(e.message);
      }
    })();
  }, [artikelId, p.katalog, p.von]); // Formular nur beim Wechsel des Artikels neu laden

  // Freitext-Plattform (z. B. aus IGDB) der festen Plattformliste zuordnen
  const plattformZu = (name) => {
    const n = String(name ?? '').toLowerCase();
    return n ? plattformen.find((x) => x.name.toLowerCase() === n || x.kurz.toLowerCase() === n || x.aliase.some((a) => a.toLowerCase() === n)) : null;
  };
  useEffect(() => {
    if (!werte || werte.plattform_id || !werte.plattform || !plattformen.length) return;
    const treffer = plattformZu(werte.plattform);
    if (treffer) setWerte((w) => ({ ...w, plattform_id: treffer.id }));
  }, [werte?.plattform, plattformen.length]);
  // Barcodes sind je Plattform eindeutig: bekannte Plattform aus dem Scan steht fest (Ausnahmen über „Andere Plattform …“)
  const barcodePlattform = !bearbeiten && p.plattform_id ? Number(p.plattform_id) : null;
  // Plattformen, für die es den gewählten Katalogeintrag gibt – nur diese stehen zur Wahl
  const katalogPlattformIds = useMemo(() => [...new Set((katalogEintrag?.plattformen ?? []).map((n) => plattformZu(n)?.id).filter(Boolean))],
    [katalogEintrag?.id, plattformen.length]);
  // Genau eine passende Plattform: gleich vorauswählen
  useEffect(() => {
    if (werte && !werte.plattform_id && katalogPlattformIds.length === 1) {
      const pl = plattformen.find((x) => x.id === katalogPlattformIds[0]);
      setWerte((w) => ({ ...w, plattform_id: pl.id, plattform: pl.name }));
    }
  }, [katalogPlattformIds.join(','), Boolean(werte)]);

  const bildVorschau = useMemo(() => (bildDatei ? URL.createObjectURL(bildDatei) : null), [bildDatei]);
  useEffect(() => () => bildVorschau && URL.revokeObjectURL(bildVorschau), [bildVorschau]);

  if (!werte) {
    return (
      <Layout route={route} titel={bearbeiten ? 'Artikel bearbeiten' : 'Neuer Artikel'} zurueck>
        {allgemeinerFehler ? <p className="text-gefahr" role="alert">{allgemeinerFehler}</p> : <p className="text-leise">Wird geladen …</p>}
      </Layout>
    );
  }

  const setze = (feld) => (e) => {
    const wert = e?.target ? e.target.value : e;
    setWerte((w) => ({ ...w, [feld]: wert }));
    if (fehler[feld]) setFehler((f) => ({ ...f, [feld]: undefined }));
  };

  function waehleVariante(id) {
    const v = varianten.find((x) => x.id === Number(id));
    setWerte((w) => ({
      ...w,
      variante_id: v?.id ?? null,
      // Felder der Variante übernehmen, eigene Eingaben aber nicht überschreiben
      ...(v ? {
        modellnummer: w.modellnummer || v.modellnummer || '', farbe: w.farbe || v.farbe || '',
        edition: w.edition || v.edition || '', region: v.region || w.region,
      } : {}),
    }));
  }

  async function speichern(e) {
    e.preventDefault();
    if (!werte.titel.trim()) {
      setFehler({ titel: 'Bitte einen Titel bzw. eine Bezeichnung angeben.' });
      return;
    }
    setSpeichert(true);
    setAllgemeinerFehler(null);
    try {
      const daten = { ...werte };
      const felder = Object.keys(LEER);
      const nutzdaten = Object.fromEntries(felder.map((f) => [f, daten[f]]));
      nutzdaten.kaufdatum = leseDatum(daten.kaufdatum);
      nutzdaten.erstkauf_datum = leseDatum(daten.erstkauf_datum);
      if (daten.herkunft !== 'konvolut') nutzdaten.konvolut_id = null;
      // Ohne Katalogeintrag legt der Server einen eigenen an: privat, eingereicht oder (Moderation) veröffentlicht
      if (!bearbeiten && !daten.katalog_id) {
        nutzdaten.katalog_einreichen = katalogFreigabe === 'einreichen';
        nutzdaten.katalog_veroeffentlichen = katalogFreigabe === 'veroeffentlichen';
      }
      const beschreibung = `„${daten.titel}“ ${bearbeiten ? 'geändert' : 'angelegt'}`;
      let artikel = bearbeiten
        ? await api.artikelAendern(artikelId, nutzdaten, { basis: werte.aktualisiert_am || null, beschreibung })
        : await api.artikelAnlegen(nutzdaten, { beschreibung });
      if (artikel?.offline) {
        zeigeHinweis('Offline gespeichert – die Änderung wird übertragen, sobald du wieder online bist.');
        navigiere(bearbeiten ? `/artikel/${artikelId}` : '/');
        return;
      }
      if (bildDatei) {
        try {
          artikel = await api.bildHochladen(artikel.id, bildDatei);
        } catch (bildFehler) {
          zeigeHinweis(`Gespeichert, aber das Foto konnte nicht hochgeladen werden: ${bildFehler.message}`, 'fehler');
        }
      }
      zeigeHinweis(bearbeiten ? 'Änderungen gespeichert.' : artikel.bestand === 'digital' ? `„${artikel.titel}“ als digitales Spiel gespeichert.` : `„${artikel.titel}“ wurde zur Sammlung hinzugefügt.`);
      // Konvolut erfassen: gleich mit dem nächsten Artikel aus dem Paket weitermachen
      if (!bearbeiten && p.konvolut && artikel.konvolut_id) navigiere('/neu', { konvolut: artikel.konvolut_id });
      // Neu hinzugefügt: die Artikelseite fragt einmal nach einem fehlenden Foto
      else navigiere(`/artikel/${artikel.id}`, bearbeiten ? undefined : { neu: 1 });
    } catch (fehlerObjekt) {
      if (fehlerObjekt instanceof ApiFehler && Object.keys(fehlerObjekt.felder).length) setFehler(fehlerObjekt.felder);
      setAllgemeinerFehler(fehlerObjekt.message);
      setSpeichert(false);
    }
  }

  const vorschauUrl = bildVorschau ?? werte.bild_url ?? werte.cover_url;

  return (
    <Layout route={route} titel={bearbeiten ? 'Artikel bearbeiten' : 'Neuer Artikel'} zurueck>
      <form onSubmit={speichern} className="mx-auto max-w-3xl space-y-4 pb-8" noValidate>
        <div className="karte flex gap-4 p-4">
          <Cover url={vorschauUrl} typ={werte.typ} alt="" className="h-32 w-24 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {katalogEintrag ? (
              <>
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide text-leise uppercase">
                  {katalogEintrag.quelle === 'igdb' ? 'Aus IGDB übernommen' : 'Aus dem Katalog'}
                  {katalogEintrag.status !== 'freigegeben' && <StatusAbzeichen status={katalogEintrag.status} />}
                </p>
                <p className="line-clamp-2 font-semibold">{katalogEintrag.titel}</p>
                <p className="text-xs text-leise">{[katalogEintrag.erscheinungsjahr, katalogEintrag.hersteller].filter(Boolean).join(' · ')}</p>
              </>
            ) : (
              <p className="text-sm text-leise">Eigener Eintrag – alle Angaben frei wählbar.</p>
            )}
            <label className="knopf-sekundaer mt-auto w-fit cursor-pointer px-3 py-1.5">
              <Symbol name="kamera" className="size-4" />
              {bildDatei || werte.bild_datei ? 'Anderes Foto' : 'Eigenes Foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only"
                onChange={(e) => setBildDatei(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>

        <Abschnitt titel="Grunddaten">
          <Feld label="Artikeltyp" fehler={fehler.typ} breit>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Artikeltyp">
              {ARTIKELTYPEN.map((t) => (
                <button key={t.value} type="button" role="radio" aria-checked={werte.typ === t.value}
                  onClick={() => setze('typ')(t.value)}
                  className={`${werte.typ === t.value ? 'chip-aktiv' : 'chip'} justify-center rounded-xl py-2`}>
                  <Symbol name={t.value} className="size-4" />{t.label}
                </button>
              ))}
            </div>
          </Feld>
          <Feld label="Titel / Bezeichnung *" fehler={fehler.titel} breit>
            {(id) => <input id={id} className="eingabe" value={werte.titel} onChange={setze('titel')} required maxLength={200}
              placeholder={werte.typ === 'spiel' ? 'z. B. The Legend of Zelda: Ocarina of Time' : werte.typ === 'konsole' ? 'z. B. Nintendo 64' : 'z. B. Controller Pak'} />}
          </Feld>
          <Feld label="Plattform / System" fehler={fehler.plattform_id ?? fehler.plattform}>
            {(id) => (
              <>
                <PlattformAuswahl id={id} wert={werte.plattform_id} nur={barcodePlattform ? [barcodePlattform] : katalogPlattformIds}
                  onChange={(pid) => setWerte((w) => ({ ...w, plattform_id: pid, plattform: plattformen.find((x) => x.id === pid)?.name ?? '' }))} />
                {barcodePlattform && werte.plattform_id === barcodePlattform && <span className="mt-1 block text-xs text-leise">Aus dem Barcode erkannt</span>}
              </>
            )}
          </Feld>
          {varianten.length > 0 && (
            <Feld label="Variante / Revision" fehler={fehler.variante_id} breit>
              {(id) => (
                <select id={id} className="eingabe" value={werte.variante_id ?? ''} onChange={(e) => waehleVariante(e.target.value)}>
                  <option value="">– keine bestimmte Variante –</option>
                  {varianten.map((v) => (
                    <option key={v.id} value={v.id}>
                      {[v.bezeichnung, v.modellnummer !== v.bezeichnung && v.modellnummer, v.farbe].filter(Boolean).join(' · ')}
                      {v.status !== 'freigegeben' ? ' (privat)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </Feld>
          )}
          {/* Physische Exemplare sind der Normalfall – „digital“ nur als unauffällige Zeile, die Box erst nach dem Umschalten */}
          {werte.bestand === 'besitz' && werte.typ === 'spiel' && (
            <button type="button" className="-mt-1 w-fit text-left text-xs text-leise underline decoration-dotted sm:col-span-2"
              onClick={() => setWerte((w) => ({ ...w, bestand: 'digital', digital_quelle: w.digital_quelle || 'playstation' }))}>
              Nur digital gekauft (z. B. PlayStation Store)?
            </button>
          )}
          {werte.bestand === 'digital' && werte.typ === 'spiel' && (
            <div className="space-y-2 rounded-xl bg-karte-hover p-3 text-sm sm:col-span-2">
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 size-5 accent-akzent" checked={werte.bestand === 'digital'}
                  onChange={(e) => setWerte((w) => ({ ...w, bestand: e.target.checked ? 'digital' : 'besitz', digital_quelle: e.target.checked ? (w.digital_quelle ?? 'playstation') : null }))} />
                <span><strong>Digitale Version</strong> (kein physisches Exemplar)
                  <span className="block text-xs text-leise">Wird mit „DIGITAL“ über dem Cover gekennzeichnet und zählt nicht zu Sammlung und Sammlungswert.</span></span>
              </label>
              {werte.bestand === 'digital' && (
                <>
                  <select className="eingabe" value={werte.digital_quelle ?? ''} onChange={setze('digital_quelle')} aria-label="Store">
                    {DIGITAL_QUELLEN.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
                  </select>
                  <p className="text-xs text-leise">
                    Bitte nur <strong className="text-text">gekaufte</strong> Spiele eintragen – keine Spiele, die du nur über ein Abo spielen kannst
                    (PlayStation Plus, Game Pass, Nintendo Switch Online): Die verschwinden, sobald das Abo endet oder das Spiel aus dem Katalog fliegt.
                  </p>
                </>
              )}
            </div>
          )}
          {zeige('region') && (
            <Feld label="Region" fehler={fehler.region}>
              {(id) => <Auswahl id={id} wert={werte.region} onChange={setze('region')} optionen={REGIONEN} />}
            </Feld>
          )}
          <Feld label={zeige('zustand_ovp') && werte.bestand !== 'digital' && werte.vollstaendigkeit !== 'nur_geraet' ? zustandBeschriftung(werte.typ).traeger : 'Zustand'} fehler={fehler.zustand}>
            {(id) => <Auswahl id={id} wert={werte.zustand} onChange={setze('zustand')} optionen={ZUSTAENDE} />}
          </Feld>
          {zeige('zustand_ovp') && werte.bestand !== 'digital' && werte.vollstaendigkeit !== 'nur_geraet' && (
            <Feld label={zustandBeschriftung(werte.typ).ovp} fehler={fehler.zustand_ovp}>
              {(id) => <Auswahl id={id} wert={werte.zustand_ovp} onChange={setze('zustand_ovp')} optionen={ZUSTAENDE} />}
            </Feld>
          )}
          <Feld label="Vollständigkeit" fehler={fehler.vollstaendigkeit}>
            {(id) => (
              <Auswahl id={id} wert={werte.vollstaendigkeit} optionen={VOLLSTAENDIGKEITEN}
                onChange={(e) => {
                  const v = e.target.value;
                  // Mit Beilagen-Liste: OVP und Anleitung gleich mit ankreuzen (nur noch ergänzen, was sonst dabei ist)
                  setWerte((w) => ({ ...w, vollstaendigkeit: v, beilagen: beilagenSichtbar ? beilagenAusVollstaendigkeit(v, w.beilagen) : w.beilagen }));
                }} />
            )}
          </Feld>
          {werte.zustand && (
            <p className="-mt-1 text-xs text-leise sm:col-span-2">{ZUSTAENDE.find((z) => z.value === werte.zustand)?.beschreibung}</p>
          )}
          {beilagenSichtbar && (
            <>
              <BeilagenCheckliste typ={werte.typ} wert={werte.beilagen}
                onChange={(b) => setWerte((w) => ({ ...w, beilagen: b, vollstaendigkeit: vollstaendigkeitAusBeilagen(b) ?? w.vollstaendigkeit }))} />
              <Feld label="Welche Beilagen genau? (optional)" fehler={fehler.beilagen_notiz} breit>
                {(id) => <input id={id} className="eingabe" value={werte.beilagen_notiz} onChange={setze('beilagen_notiz')} maxLength={500}
                  placeholder="z. B. Club-Nintendo-Katalog 1998, Poster Ocarina of Time, Garantiekarte" />}
              </Feld>
            </>
          )}
        </Abschnitt>

        {(['farbe', 'edition', 'modellnummer', 'seriennummer'].some(zeige) || beilagenSichtbar) && (
        <Abschnitt titel="Variante" hinweis="Sonderfarben, Editionen und Modellrevisionen unterscheiden">
          {zeige('farbe') && (
            <Feld label="Farbe / Sonderfarbe" fehler={fehler.farbe}>
              {(id) => (
                <>
                  <input id={id} className="eingabe" value={werte.farbe} onChange={setze('farbe')} list="farben" placeholder="z. B. Atomic Purple" />
                  <datalist id="farben">{FARBVORSCHLAEGE.map((f) => <option key={f} value={f} />)}</datalist>
                </>
              )}
            </Feld>
          )}
          {zeige('edition') && (
            <Feld label="Edition / Variante" fehler={fehler.edition}>
              {(id) => <input id={id} className="eingabe" value={werte.edition} onChange={setze('edition')} placeholder="z. B. Zelda 25th Anniversary" />}
            </Feld>
          )}
          {zeige('modellnummer') && (
            <Feld label="Modellnummer" fehler={fehler.modellnummer}>
              {(id) => <input id={id} className="eingabe" value={werte.modellnummer} onChange={setze('modellnummer')} placeholder="z. B. SCPH-1002, HEG-001 (OLED)" />}
            </Feld>
          )}
          {zeige('seriennummer') && (
            <Feld label="Seriennummer" fehler={fehler.seriennummer}>
              {(id) => <input id={id} className="eingabe" value={werte.seriennummer} onChange={setze('seriennummer')} autoComplete="off" />}
            </Feld>
          )}
          {beilagenSichtbar && (
            <>
              <Feld label="Seriennummer der OVP" fehler={fehler.seriennummer_ovp}>
                {(id) => (
                  <>
                    <input id={id} className="eingabe" value={werte.seriennummer_ovp} onChange={setze('seriennummer_ovp')} autoComplete="off" placeholder="Aufkleber auf dem Karton" />
                    <SeriennummerAbgleich geraet={werte.seriennummer} ovp={werte.seriennummer_ovp} />
                  </>
                )}
              </Feld>
            </>
          )}
        </Abschnitt>
        )}

        {funktionen.lagerort && werte.bestand !== 'digital' && (
          <Abschnitt titel="Lagerort" hinweis="Wo steht das Exemplar? Bereits verwendete Orte werden vorgeschlagen.">
            <LagerortFelder werte={werte} setze={setze} fehler={fehler} />
          </Abschnitt>
        )}

        <Abschnitt titel="Kauf & Details">
          <Feld label="Herkunft" fehler={fehler.herkunft}>
            {(id) => (
              <select id={id} className="eingabe" value={werte.herkunft} onChange={setze('herkunft')}>
                <option value="">– keine Angabe –</option>
                {HERKUNFT.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            )}
          </Feld>
          {werte.herkunft === 'konvolut' ? (
            <KonvolutWahl konvolute={konvolute} wert={werte.konvolut_id} fehler={fehler.konvolut_id}
              onWahl={(id) => setWerte((w) => ({ ...w, konvolut_id: id }))} onNeu={(k) => { setKonvolute((l) => [k, ...l]); setWerte((w) => ({ ...w, konvolut_id: k.id })); }} />
          ) : <div className="hidden sm:block" />}
          <Feld label="Kaufpreis (€, je Stück)" fehler={fehler.kaufpreis}>
            {(id) => (
              <>
                <input id={id} className="eingabe" value={werte.kaufpreis} onChange={setze('kaufpreis')} inputMode="decimal"
                  placeholder={werte.konvolut_id ? 'leer = Anteil am Gesamtpreis' : ['geschenk', 'schon_immer', 'unbekannt'].includes(werte.herkunft) ? 'leer lassen, wenn unbekannt' : 'z. B. 49,99'} />
                {werte.konvolut_id && <span className="mt-1 block text-xs text-leise">Leer lassen: Der Gesamtpreis des Konvoluts wird automatisch verteilt.</span>}
              </>
            )}
          </Feld>
          {zeige('kaufdatum') && (
            <Feld label="Kaufdatum" fehler={fehler.kaufdatum}>
              {(id) => (
                <>
                  <input id={id} className="eingabe" value={werte.kaufdatum} onChange={setze('kaufdatum')} inputMode="numeric" placeholder="TT.MM.JJJJ, MM.JJJJ oder nur JJJJ" />
                  <span className="mt-1 block text-xs text-leise">Auch ungefähr – z. B. nur das Jahr.</span>
                </>
              )}
            </Feld>
          )}
          {zeige('kauf_quelle') && werte.bestand !== 'digital' && (
            <Feld label="Gekauft bei/auf" fehler={fehler.kauf_quelle}>
              {(id) => <Auswahl id={id} wert={werte.kauf_quelle} onChange={setze('kauf_quelle')} optionen={KAUFQUELLEN} />}
            </Feld>
          )}
          {(zeige('erstkauf') || werte.neupreis || werte.erstkauf_datum || werte.erstkauf_quelle) && werte.bestand !== 'digital' && (
            <details className="rounded-xl border border-rand p-3 sm:col-span-2" open={Boolean(werte.neupreis || werte.erstkauf_datum || werte.erstkauf_quelle)}>
              <summary className="cursor-pointer text-sm font-medium">Erstkauf laut Beleg (z. B. Kassenbon vom Vorbesitzer)</summary>
              <p className="mt-1 text-xs text-leise">Für die Preisgeschichte deines Exemplars – nur für dich sichtbar. Namen oder Kartennummern vom Beleg gehören nicht hierher.</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <Feld label="Neupreis (€)" fehler={fehler.neupreis}>
                  {(id) => <input id={id} className="eingabe" value={werte.neupreis} onChange={setze('neupreis')} inputMode="decimal" placeholder="z. B. 59,99" />}
                </Feld>
                <Feld label="Datum" fehler={fehler.erstkauf_datum}>
                  {(id) => <input id={id} className="eingabe" value={werte.erstkauf_datum} onChange={setze('erstkauf_datum')} inputMode="numeric" placeholder="TT.MM.JJJJ oder JJJJ" />}
                </Feld>
                <Feld label="Händler" fehler={fehler.erstkauf_quelle}>
                  {(id) => <input id={id} className="eingabe" value={werte.erstkauf_quelle} onChange={setze('erstkauf_quelle')} maxLength={100} placeholder="z. B. Media Markt" />}
                </Feld>
              </div>
            </details>
          )}
          {zeige('marktwert') && (
            <Feld label="Marktwert (€, eigene Schätzung)" fehler={fehler.marktwert}>
              {(id) => <input id={id} className="eingabe" value={werte.marktwert} onChange={setze('marktwert')} inputMode="decimal" placeholder="optional, pro Stück" />}
            </Feld>
          )}
          {zeige('barcode') && (
            <Feld label="Barcode (EAN/UPC)" fehler={fehler.barcode}>
              {(id) => (
                <div className="flex gap-2">
                  <input id={id} className="eingabe font-mono" value={werte.barcode} onChange={setze('barcode')} inputMode="numeric" autoComplete="off" />
                  <button type="button" className="knopf-sekundaer px-3" onClick={() => setScannerOffen(true)} aria-label="Barcode scannen">
                    <Symbol name="scan" />
                  </button>
                </div>
              )}
            </Feld>
          )}
          <Feld label="Anzahl" fehler={fehler.anzahl}>
            {(id) => <input id={id} type="number" min="1" max="9999" className="eingabe" value={werte.anzahl} onChange={setze('anzahl')} />}
          </Feld>
          {zeige('notizen') && (
            <Feld label="Eigene Notizen" fehler={fehler.notizen} breit>
              {(id) => <textarea id={id} rows={4} className="eingabe" value={werte.notizen} onChange={setze('notizen')}
                placeholder="z. B. Modul mit Aufkleber-Kratzer, gekauft auf dem Flohmarkt …" />}
            </Feld>
          )}
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-1 size-4 accent-akzent" checked={Boolean(werte.privat)}
              onChange={(e) => setWerte((w) => ({ ...w, privat: e.target.checked }))} />
            <span>
              <span className="flex items-center gap-1 font-medium"><Symbol name="schloss" className="size-4" />Privat – nur für mich sichtbar</span>
              <span className="block text-leise">Erscheint nicht in der geteilten oder öffentlichen Sammlung, nicht bei Freunden, in Trends oder Statistiken.</span>
            </span>
          </label>
          <details className="sm:col-span-2">
            <summary className="cursor-pointer text-sm text-leise">Coverbild-Adresse (optional)</summary>
            <input className="eingabe mt-2" value={werte.cover_url} onChange={setze('cover_url')} placeholder="https://…" inputMode="url" />
            {fehler.cover_url && <p className="mt-1 text-sm text-gefahr">{fehler.cover_url}</p>}
          </details>
        </Abschnitt>

        {!bearbeiten && !werte.katalog_id && (
          <fieldset className="space-y-2 rounded-xl border border-rand p-3 text-sm">
            <legend className="px-1 font-semibold">Katalogeintrag</legend>
            <p className="text-leise">Für eigene Einträge wird ein Katalogeintrag angelegt – so findest du ihn per Suche und Barcode wieder.</p>
            {[
              ['privat', 'Nur für mich (privat)', 'Niemand sonst sieht diesen Eintrag.'],
              ...(MODUL.moderation ? [['einreichen', 'Zur Aufnahme in die globale Datenbank einreichen', 'Das Moderationsteam prüft den Eintrag; danach können ihn alle finden.']] : []),
              ...(!MODUL.moderation && status?.zentrale ? [['einreichen', 'Zu ZockerDB freigeben', 'zockerdb.de prüft den Eintrag; danach steht er allen im gemeinsamen Katalog zur Verfügung.']] : []),
              ...(istModerator(benutzer) ? [['veroeffentlichen', 'Direkt veröffentlichen (Moderation)', 'Sofort für alle sichtbar.']] : []),
            ].map(([wert, titel, text]) => (
              <label key={wert} className="flex items-start gap-3">
                <input type="radio" name="katalogFreigabe" className="mt-1 accent-akzent" checked={katalogFreigabe === wert} onChange={() => setKatalogFreigabe(wert)} />
                <span><strong>{titel}</strong><span className="block text-leise">{text}</span></span>
              </label>
            ))}
          </fieldset>
        )}

        {allgemeinerFehler && <p className="rounded-xl bg-gefahr/10 p-3 text-sm text-gefahr" role="alert">{allgemeinerFehler}</p>}

        <div className="unten-sicher sticky bottom-16 z-20 -mx-4 flex gap-2 border-t border-rand/60 bg-flaeche/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
          <button type="button" className="knopf-sekundaer flex-1 md:flex-none" onClick={() => window.history.back()}>Abbrechen</button>
          <button type="submit" className="knopf-primaer flex-[2] md:flex-none" disabled={speichert}>
            <Symbol name="haken" className="size-4" />
            {speichert ? 'Wird gespeichert …' : bearbeiten ? 'Speichern' : 'Hinzufügen'}
          </button>
        </div>
      </form>

      {scannerOffen && (
        <BarcodeScanner
          onErkannt={(code) => { setze('barcode')(code); setScannerOffen(false); }}
          onSchliessen={() => setScannerOffen(false)}
        />
      )}
    </Layout>
  );
}

/** Konvolut wählen oder direkt ein neues anlegen (Name, Gesamtpreis, Datum). */
function KonvolutWahl({ konvolute, wert, fehler, onWahl, onNeu }) {
  const [neu, setNeu] = useState(null);
  const [fehlerNeu, setFehlerNeu] = useState(null);
  if (neu) {
    return (
      <div className="space-y-2 rounded-xl border border-rand p-3 sm:col-span-2">
        <p className="font-semibold">Neues Konvolut</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className="eingabe" value={neu.name} onChange={(e) => setNeu({ ...neu, name: e.target.value })} placeholder="Name, z. B. Flohmarkt-Kiste" aria-label="Name" />
          <input className="eingabe" value={neu.preis} onChange={(e) => setNeu({ ...neu, preis: e.target.value })} inputMode="decimal" placeholder="Gesamtpreis € (optional)" aria-label="Gesamtpreis" />
          <input className="eingabe" value={neu.kaufdatum} onChange={(e) => setNeu({ ...neu, kaufdatum: e.target.value })} placeholder="Datum oder Jahr (optional)" aria-label="Kaufdatum" />
        </div>
        {fehlerNeu && <p className="text-sm text-gefahr">{fehlerNeu}</p>}
        <div className="flex gap-2">
          <button type="button" className="knopf-primaer px-3 py-1.5" onClick={async () => {
            try {
              onNeu(await api.konvolutAnlegen({ ...neu, kaufdatum: leseDatum(neu.kaufdatum) }));
              setNeu(null);
            } catch (e) { setFehlerNeu(Object.values(e.felder ?? {})[0] ?? e.message); }
          }}>Anlegen</button>
          <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setNeu(null)}>Abbrechen</button>
        </div>
      </div>
    );
  }
  const gewaehlt = konvolute.find((k) => k.id === wert);
  return (
    <Feld label="Konvolut" fehler={fehler}>
      {(id) => (
        <>
          <select id={id} className="eingabe" value={wert ?? ''} onChange={(e) => (e.target.value === 'neu' ? setNeu({ name: '', preis: '', kaufdatum: '' }) : onWahl(e.target.value ? Number(e.target.value) : null))}>
            <option value="">– ohne Konvolut –</option>
            {konvolute.map((k) => <option key={k.id} value={k.id}>{k.name}{k.preis != null ? ` (${euro(k.preis)})` : ''}</option>)}
            <option value="neu">+ Neues Konvolut …</option>
          </select>
          {gewaehlt && <a className="mt-1 block text-xs text-akzent-hell underline" href={`#/konvolut/${gewaehlt.id}`}>Konvolut ansehen ({gewaehlt.artikel} Artikel)</a>}
        </>
      )}
    </Feld>
  );
}

function Abschnitt({ titel, hinweis, children }) {
  return (
    <fieldset className="karte grid gap-4 p-4 sm:grid-cols-2">
      <legend className="float-left mb-0 w-full sm:col-span-2">
        <span className="font-semibold">{titel}</span>
        {hinweis && <span className="block text-xs text-leise">{hinweis}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Feld({ label, fehler, breit, children }) {
  const id = useId();
  const inhalt = typeof children === 'function' ? children(id) : children;
  return (
    <div className={breit ? 'sm:col-span-2' : ''}>
      {typeof children === 'function' ? <label htmlFor={id} className="beschriftung">{label}</label> : <span className="beschriftung">{label}</span>}
      {inhalt}
      {fehler && <p className="mt-1 text-sm text-gefahr" role="alert">{fehler}</p>}
    </div>
  );
}

function Auswahl({ id, wert, onChange, optionen }) {
  return (
    <select id={id} className="eingabe" value={wert ?? ''} onChange={onChange}>
      <option value="">– keine Angabe –</option>
      {optionen.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
