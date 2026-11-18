import { useEffect, useId, useMemo, useState } from 'react';
import {
  ARTIKELTYPEN, MERCH_KATEGORIEN, MERCH_VERPACKUNGEN, merchVerpackung, merchVerpackungAnwenden, ZUSTAENDE, VOLLSTAENDIGKEITEN, REGIONEN, HERKUNFT, DIGITAL_QUELLEN, istModerator,
  beilagenAusVollstaendigkeit, datentraegerVon, neuauflagenFuer, vollstaendigkeitAusBeilagen, BEILAGE_OHNE, ohneAnleitungUeblich, zustandBeschriftung, KAUFQUELLEN, INLAY_MAENGEL, hatInlayZustand,
} from '../../../shared/konstanten.js';
import { nummernHilfe } from '../../../shared/nummernhilfe.js';
import { RegionHilfe, RegionAusNummer } from '../komponenten/RegionHilfe.jsx';
import { usePlattformen } from '../plattformen.js';
import { useSitzung } from '../sitzung.js';
import PlattformAuswahl from '../komponenten/PlattformAuswahl.jsx';
import SpielWahl from '../komponenten/SpielWahl.jsx';
import StatusAbzeichen from '../komponenten/StatusAbzeichen.jsx';
import ZustandHilfe from '../komponenten/ZustandHilfe.jsx';
import { api, ApiFehler } from '../api.js';
import { navigiere, zurueck, vorherigeSeite, useVerlassenSchutz } from '../router.js';
import { preisFeld, datumFeld, leseDatum, datumAnzeigen, euro } from '../format.js';
import Layout from '../komponenten/Layout.jsx';
import Cover from '../komponenten/Cover.jsx';
import { ZuschnittDialog } from '../komponenten/Zuschnitt.jsx';
import Symbol from '../komponenten/Symbole.jsx';
import BarcodeScanner from '../komponenten/BarcodeScanner.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import { MODUL } from '../erweiterungen.jsx';
import { LagerortFelder, BeilagenCheckliste, SeriennummerAbgleich } from '../komponenten/ZusatzFelder.jsx';

/** Katalogeintrag mit dem Vermerk „Handbuch laut Verpackung nur online“ (optionales Feld, das Zusatzmodule im Katalogeintrag mitliefern). */
const anleitungNurOnline = (eintrag, typ) => typ === 'spiel' && eintrag?.anleitung_online === 1;

const FARBVORSCHLAEGE = [
  'Schwarz', 'Weiß', 'Grau', 'Silber', 'Clear', 'Clear Red', 'Clear Blue', 'Clear Green', 'Atomic Purple',
  'Jungle Green', 'Fire Orange', 'Ice Blue', 'Indigo', 'Platinum', 'Orange', 'Pikachu Edition', 'Crystal', 'Neon Rot/Blau',
];

const LEER = {
  typ: 'spiel', titel: '', plattform: '', plattform_id: null, variante_id: null, katalog_id: null, barcode: '', cover_url: '', zustand: '', vollstaendigkeit: '',
  region: 'pal_de', farbe: '', edition: '', modellnummer: '', seriennummer: '', notizen: '', kaufpreis: '', kaufdatum: '', anzahl: 1,
  marktwert: '', herkunft: '', konvolut_id: null, bestand: 'besitz', digital_quelle: null,
  lagerort_ort: '', lagerort_regal: '', lagerort_fach: '', beilagen: null, seriennummer_ovp: '', privat: false, zustand_ovp: '', zustand_inlay: '', inlay_maengel: '',
  neupreis: '', erstkauf_datum: '', erstkauf_quelle: '', kauf_quelle: '', beilagen_notiz: '', drucknummer: '',
  merch_kategorie: '', spiel_katalog_id: null,
};

// Natives <select> unkontrolliert lassen (defaultValue statt value): React erzwingt einen kontrollierten Wert bei
// jedem Re-Render neu – rendert die Seite mitten in der nativen Auswahl (z. B. während eine Hintergrundabfrage noch
// läuft), setzt das die gerade offene Auswahl zurück, bevor die angetippte Option ankommt. Der Ref-Callback läuft bei
// jedem Render erneut und gleicht den Wert nur ab, wenn das Feld gerade nicht fokussiert/in Benutzung ist.
/** Ist die gewählte Variante eine Sonderausgabe (eigene Edition, keine Neuauflage wie Platinum)? Dann gibt es keine „Fassung“. */
const istSonderVariante = (varianten, varianteId, neuauflagen) => {
  const v = varianteId ? varianten.find((x) => x.id === Number(varianteId)) : null;
  if (!v) return false;
  if (v.edition) return !neuauflagen.includes(v.edition);
  // Ohne Feld „Edition“: an der Bezeichnung erkennen („Collector’s Edition“, „Limited“, „Steelbook“ …)
  return SONDERAUSGABE_NAME.test(v.bezeichnung ?? '') && !neuauflagen.includes(v.bezeichnung);
};
const SONDERAUSGABE_NAME = /\b(edition|collector|limited|special|deluxe|steelbook|goty|game of the year|complete|premium|bundle|sammler)/i;

const unkontrolliert = (wert) => (el) => {
  if (!el || document.activeElement === el) return;
  const soll = wert ?? '';
  if (el.value !== soll) el.value = soll;
};

/** „ⓘ“ an der Modellnummer: was die Buchstaben bedeuten und wo man die Nummer findet – je Plattform. */
function NummernInfo({ hilfe }) {
  const [offen, setOffen] = useState(false);
  return (
    <div className="mt-1 text-xs">
      <button type="button" className="font-medium text-akzent-hell underline" aria-expanded={offen} onClick={() => setOffen((o) => !o)} data-testid="nummern-info">
        ⓘ Was bedeuten die Nummern?
      </button>
      {offen && (
        <div className="mt-2 space-y-1 rounded-lg bg-karte-hover p-2" role="note" data-testid="nummern-hilfe">
          <p className="font-semibold">{hilfe.titel}</p>
          {hilfe.punkte.map((p) => <p key={p}>• {p}</p>)}
        </div>
      )}
    </div>
  );
}

export default function ArtikelFormular({ route, artikelId }) {
  const p = route.parameter;
  const zeigeHinweis = useHinweis();
  const bearbeiten = Boolean(artikelId);
  const [werte, setWerte] = useState(null);
  const [katalogEintrag, setKatalogEintrag] = useState(null);
  const [katalogFreigabe, setKatalogFreigabe] = useState('privat'); // privat | einreichen | veroeffentlichen
  // Selbst eingetragene Edition, die es im Katalog noch nicht gibt: beim Speichern als Variante anlegen ('' = nein)
  const [varianteAusEdition, setVarianteAusEdition] = useState('');
  const [varianten, setVarianten] = useState([]);
  const plattformen = usePlattformen();
  const { benutzer, status } = useSitzung();
  const funktionen = benutzer?.funktionen ?? {};
  // Beilagen-Liste (Zusatzfeld) – steht direkt unter der Vollständigkeit, beide füllen sich gegenseitig vor
  // Merch (Figuren, Funko Pops …): Sockel, Zertifikat und Karte/Code gehören zum Typ – die Checkliste ist hier immer da
  const merch = werte?.typ === 'merch';
  const beilagenSichtbar = (Boolean(funktionen.beilagen) || merch) && werte?.bestand !== 'digital';
  // Im Konto ausgeblendete Felder (bereits ausgefüllte bleiben sichtbar, damit nichts unbemerkt verloren geht)
  const ausgeblendet = new Set(benutzer?.ausgeblendete_felder ?? []);
  const zeige = (feld) => !ausgeblendet.has(feld) || Boolean(werte?.[feld]);
  // Spiele haben praktisch nie Seriennummern (die gibt es bei Geräten) – dafür eine Drucknummer auf dem Cover
  const spiel = werte?.typ === 'spiel';
  const [fehler, setFehler] = useState({});
  const [allgemeinerFehler, setAllgemeinerFehler] = useState(null);
  const [speichert, setSpeichert] = useState(false);
  // Etwas eingegeben? Dann vor dem Verlassen ohne Speichern nachfragen (Zurück-Knopf, Wischgeste, Abbrechen)
  const [beruehrt, setBeruehrt] = useState(false);
  const verlassenFreigeben = useVerlassenSchutz(beruehrt && !speichert);
  const [bildDatei, setBildDatei] = useState(null);
  const [bildZuschneiden, setBildZuschneiden] = useState(null);
  const [scannerOffen, setScannerOffen] = useState(false);
  const [konvolute, setKonvolute] = useState([]);
  // Erst laden, wenn tatsächlich gebraucht (Herkunft „Konvolut“): Ein unbeteiligter Ladevorgang kurz nach dem Öffnen des
  // Formulars re-rendert sonst das ganze Formular und kann dabei ein gerade offenes natives Auswahlmenü (z. B. Plattform)
  // zurücksetzen – iOS übernimmt die angetippte Option dann nicht.
  const [konvoluteGeladen, setKonvoluteGeladen] = useState(false);
  useEffect(() => {
    if (werte?.herkunft !== 'konvolut' || konvoluteGeladen) return;
    setKonvoluteGeladen(true);
    api.konvolute().then(setKonvolute).catch(() => {});
  }, [werte?.herkunft, konvoluteGeladen]);

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
            const eintrag = await api.katalogEintrag(a.katalog_id).catch(() => null);
            setKatalogEintrag(eintrag);
            setVarianten(await api.varianten(a.katalog_id).catch(() => []));
            // Handbuch laut Verpackung nur online und zur Anleitung nichts eingetragen: „gab es nicht“ vorschlagen (gespeichert wird erst mit „Speichern“)
            if (funktionen.beilagen && anleitungNurOnline(eintrag, a.typ) && !(a.beilagen && 'anleitung' in a.beilagen)) {
              setWerte((w) => ({ ...w, beilagen: { ...(w.beilagen ?? {}), anleitung: BEILAGE_OHNE } }));
            }
          }
          return;
        }
        const basis = { ...LEER, typ: p.typ ?? 'spiel', titel: p.titel ?? '', barcode: p.barcode ?? '' };
        // Aus einem Konvolut: nächsten Artikel direkt diesem Paket zuordnen
        if (p.konvolut) Object.assign(basis, { konvolut_id: Number(p.konvolut), herkunft: 'konvolut' });
        // „Leere Hülle fotografieren“ von der Spieleseite: nur die Verpackung, nicht in der Sammlung
        if (p.vollstaendigkeit === 'nur_ovp') Object.assign(basis, { vollstaendigkeit: 'nur_ovp', bestand: 'verpackung' });
        // „Weiteres Exemplar“: Grunddaten eines vorhandenen Artikels übernehmen
        if (p.von) {
          const vorlage = await api.artikel(p.von);
          Object.assign(basis, {
            typ: vorlage.typ, titel: vorlage.titel, katalog_id: vorlage.katalog_id, plattform: vorlage.plattform ?? '',
            plattform_id: vorlage.plattform_id, region: vorlage.region ?? '', cover_url: vorlage.cover_url ?? '',
          });
          if (vorlage.katalog_id) {
            const eintrag = await api.katalogEintrag(vorlage.katalog_id).catch(() => null);
            setKatalogEintrag(eintrag);
            setVarianten(await api.varianten(vorlage.katalog_id).catch(() => []));
            if (funktionen.beilagen && anleitungNurOnline(eintrag, vorlage.typ)) basis.beilagen = { anleitung: BEILAGE_OHNE };
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
          // Handbuch laut Verpackung nur online: Anleitung „gab es nicht“ vorbelegen
          if (funktionen.beilagen && anleitungNurOnline(eintrag, eintrag.typ)) basis.beilagen = { anleitung: BEILAGE_OHNE };
          // Plattform aus dem Barcode-Produktnamen (z. B. „Ps3“), falls es den Titel dafür gibt
          // – aber nur, wenn das Spiel für diese Plattform erschienen ist (der Produktname kann täuschen: „playstation 2k Games“)
          if (p.plattform_id && (!eintrag.plattform_ids?.length || eintrag.plattform_ids.map(Number).includes(Number(p.plattform_id)))) {
            basis.plattform_id = Number(p.plattform_id);
          }
          const liste = await api.varianten(eintrag.id).catch(() => []);
          setVarianten(liste);
          // Vorauswahl der Ausgabe (z. B. vom letzten Exemplar mit demselben Barcode): Region und Fassung, Variante geht vor
          if (p.region) basis.region = p.region;
          if (p.edition) basis.edition = p.edition;
          const gewaehlt = liste.find((v) => String(v.id) === String(p.variante));
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
  // Umgekehrt: Plattform nur als ID bekannt (z. B. aus dem Barcode-Scan „PS3“) – den Namen ergänzen, damit Vorgaben wie
  // Inlay bei CIB oder „Anleitung gab es nicht“ greifen
  useEffect(() => {
    if (!werte || !werte.plattform_id || werte.plattform || !plattformen.length) return;
    const pl = plattformen.find((x) => x.id === Number(werte.plattform_id));
    if (pl) setWerte((w) => ({ ...w, plattform: pl.name }));
  }, [werte?.plattform_id, plattformen.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Plattformen, für die es den gewählten Katalogeintrag gibt – nur diese stehen zur Wahl
  // (Server-Zuordnung bevorzugt; die Namen sind nur der Rückfall, z. B. bei älteren Servern)
  const katalogPlattformIds = useMemo(() => (katalogEintrag?.plattform_ids?.length
    ? [...new Set(katalogEintrag.plattform_ids.map(Number))]
    : [...new Set((katalogEintrag?.plattformen ?? []).map((n) => plattformZu(n)?.id).filter(Boolean))]),
  [katalogEintrag?.id, plattformen.length]);
  // Barcodes sind je Plattform eindeutig: bekannte Plattform aus dem Scan steht fest (Ausnahmen über „Andere Plattform …“) –
  // sofern es den Katalogeintrag für sie gibt; sonst war die Erkennung aus dem Produktnamen falsch und alle Plattformen des Spiels stehen zur Wahl
  const barcodePlattformRoh = !bearbeiten && p.plattform_id ? Number(p.plattform_id) : null;
  const barcodePlattform = barcodePlattformRoh && (!katalogPlattformIds.length || katalogPlattformIds.includes(barcodePlattformRoh)) ? barcodePlattformRoh : null;
  // Genau eine passende Plattform: gleich vorauswählen
  useEffect(() => {
    if (werte && !werte.plattform_id && katalogPlattformIds.length === 1) {
      const pl = plattformen.find((x) => x.id === katalogPlattformIds[0]);
      setWerte((w) => ({ ...w, plattform_id: pl.id, plattform: pl.name }));
    }
  }, [katalogPlattformIds.join(','), Boolean(werte)]);

  // Neues Spiel auf PS4, PS5, Xbox One/Series oder Switch: Anleitung „gab es nicht“ vorbelegen (dort meist keine gedruckte dabei)
  useEffect(() => {
    if (bearbeiten || !werte || werte.typ !== 'spiel' || !beilagenSichtbar || !ohneAnleitungUeblich(werte.plattform)) return;
    if (werte.beilagen && 'anleitung' in werte.beilagen) return;
    setWerte((w) => ({ ...w, beilagen: { ...(w.beilagen ?? {}), anleitung: BEILAGE_OHNE } }));
  }, [werte?.plattform, werte?.typ, beilagenSichtbar]); // eslint-disable-line react-hooks/exhaustive-deps

  // CIB bei Disc-Spielen (PS3, PS4 …) heißt: mit Inlay – auch wenn CIB vor der Plattform gewählt oder über die Beilagen
  // (OVP + Anleitung angekreuzt) entstanden ist. Nur solange zum Inlay noch nichts eingetragen ist.
  useEffect(() => {
    if (bearbeiten || !werte || werte.typ !== 'spiel' || !beilagenSichtbar || werte.vollstaendigkeit !== 'cib') return;
    if (!werte.plattform || datentraegerVon(werte.plattform) !== 'disc') return;
    if (werte.beilagen && 'inlay' in werte.beilagen) return;
    setWerte((w) => ({ ...w, beilagen: { ...(w.beilagen ?? {}), inlay: true } }));
  }, [werte?.plattform, werte?.typ, werte?.vollstaendigkeit, beilagenSichtbar]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Nach dem Speichern: zurück zur Artikelseite, von der man kam (statt sie ein zweites Mal in den Verlauf zu legen);
  // sonst das Formular im Verlauf ersetzen – „Zurück“ landet so nie wieder im Formular
  const nachSpeichern = (pfad, parameter) => {
    verlassenFreigeben();
    if (bearbeiten && vorherigeSeite() === pfad) zurueck(pfad);
    else navigiere(pfad, parameter, { ersetzen: true });
  };

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
      // App: für die Offline-Anzeige zwischengespeicherte Bilder stehen als „blob:“-Adresse im Formular – die gilt nur
      // lokal und darf nicht als neue Coverbild-Adresse gespeichert werden (unverändert lassen, wenn nur das betroffen ist)
      if (typeof nutzdaten.cover_url === 'string' && nutzdaten.cover_url.startsWith('blob:')) delete nutzdaten.cover_url;
      nutzdaten.kaufdatum = leseDatum(daten.kaufdatum);
      nutzdaten.erstkauf_datum = leseDatum(daten.erstkauf_datum);
      if (daten.herkunft !== 'konvolut') nutzdaten.konvolut_id = null;
      // Ohne Katalogeintrag legt der Server einen eigenen an: privat, eingereicht oder (Moderation) veröffentlicht
      if (!bearbeiten && !daten.katalog_id) {
        nutzdaten.katalog_einreichen = katalogFreigabe === 'einreichen';
        nutzdaten.katalog_veroeffentlichen = katalogFreigabe === 'veroeffentlichen';
      }
      // Edition als neue Variante des Katalogeintrags anlegen und das Exemplar gleich damit verknüpfen
      const neueVariante = daten.edition?.trim();
      if (varianteAusEdition && neueVariante && daten.katalog_id && !daten.variante_id) {
        try {
          const v = await api.varianteAnlegen(daten.katalog_id, {
            bezeichnung: neueVariante, edition: neueVariante,
            einreichen: varianteAusEdition === 'einreichen', veroeffentlichen: varianteAusEdition === 'veroeffentlichen',
          });
          nutzdaten.variante_id = v.id;
        } catch (e) {
          zeigeHinweis(`Die Variante konnte nicht angelegt werden: ${e.message}`, 'fehler');
        }
      }
      const beschreibung = `„${daten.titel}“ ${bearbeiten ? 'geändert' : 'angelegt'}`;
      let artikel = bearbeiten
        ? await api.artikelAendern(artikelId, nutzdaten, { basis: werte.aktualisiert_am || null, beschreibung })
        : await api.artikelAnlegen(nutzdaten, { beschreibung });
      if (artikel?.offline) {
        zeigeHinweis('Offline gespeichert – die Änderung wird übertragen, sobald du wieder online bist.');
        nachSpeichern(bearbeiten ? `/artikel/${artikelId}` : '/');
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
      if (!bearbeiten && p.konvolut && artikel.konvolut_id) { verlassenFreigeben(); navigiere('/neu', { konvolut: artikel.konvolut_id }); }
      // Neu hinzugefügt: die Artikelseite fragt einmal nach einem fehlenden Foto
      else nachSpeichern(`/artikel/${artikel.id}`, bearbeiten ? undefined : { neu: 1 });
    } catch (fehlerObjekt) {
      if (fehlerObjekt instanceof ApiFehler && Object.keys(fehlerObjekt.felder).length) setFehler(fehlerObjekt.felder);
      setAllgemeinerFehler(fehlerObjekt.message);
      setSpeichert(false);
    }
  }

  const vorschauUrl = bildVorschau ?? werte.bild_url ?? werte.cover_url;

  return (
    <Layout route={route} titel={bearbeiten ? 'Artikel bearbeiten' : 'Neuer Artikel'} zurueck>
      <form onSubmit={speichern} onInput={() => setBeruehrt(true)} className="mx-auto max-w-3xl space-y-4 pb-8" noValidate>
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
                onChange={(e) => { const d = e.target.files?.[0]; e.target.value = ''; if (d) setBildZuschneiden(d); }} />
            </label>
            {bildZuschneiden && (
              <ZuschnittDialog datei={bildZuschneiden} titel="Eigenes Foto zuschneiden"
                hinweis="Nur das Cover statt der ganzen Hülle? Wähle „Frei“ (Breite und Höhe einzeln) oder ein Format und zieh den Rahmen an die richtige Stelle. Mit „Original“ bleibt das ganze Foto."
                onFertig={(d) => { setBildDatei(d); setBildZuschneiden(null); }} onAbbrechen={() => setBildZuschneiden(null)} />
            )}
          </div>
        </div>

        <Abschnitt titel="Grunddaten">
          <Feld label="Artikeltyp" fehler={fehler.typ} breit>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Artikeltyp">
              {ARTIKELTYPEN.map((t) => (
                <button key={t.value} type="button" role="radio" aria-checked={werte.typ === t.value} title={t.beschreibung}
                  onClick={() => setze('typ')(t.value)}
                  className={`${werte.typ === t.value ? 'chip-aktiv' : 'chip'} justify-center rounded-xl py-2`}>
                  <Symbol name={t.value} className="size-4" />{t.label}
                </button>
              ))}
            </div>
          </Feld>
          <Feld label="Titel / Bezeichnung *" fehler={fehler.titel} breit>
            {(id) => <input id={id} className="eingabe" value={werte.titel} onChange={setze('titel')} required maxLength={200}
              placeholder={werte.typ === 'spiel' ? 'z. B. The Legend of Zelda: Ocarina of Time' : werte.typ === 'konsole' ? 'z. B. Nintendo 64' : merch ? 'z. B. Funko Pop Link #123, Amiibo Zelda' : 'z. B. Controller Pak'} />}
          </Feld>
          {merch && (
            <>
              <Feld label="Kategorie" fehler={fehler.merch_kategorie}>
                {(id) => (
                  <>
                    <Auswahl id={id} wert={werte.merch_kategorie} onChange={setze('merch_kategorie')} optionen={MERCH_KATEGORIEN} />
                    {werte.merch_kategorie && <span className="mt-1 block text-xs text-leise">{MERCH_KATEGORIEN.find((k) => k.value === werte.merch_kategorie)?.beschreibung}</span>}
                  </>
                )}
              </Feld>
              <Feld label="Gehört zu (Spiel, optional)" fehler={fehler.spiel_katalog_id}>
                {(id) => <SpielWahl id={id} katalogId={werte.spiel_katalog_id} titel={werte.spiel_titel} onChange={(kid, t) => setWerte((w) => ({ ...w, spiel_katalog_id: kid, spiel_titel: t }))} />}
              </Feld>
            </>
          )}
          {!merch && <Feld label="Plattform / System" fehler={fehler.plattform_id ?? fehler.plattform}>
            {(id) => (
              <>
                <PlattformAuswahl id={id} wert={werte.plattform_id} nur={barcodePlattform ? [barcodePlattform] : katalogPlattformIds}
                  onChange={(pid) => setWerte((w) => ({ ...w, plattform_id: pid, plattform: plattformen.find((x) => x.id === pid)?.name ?? '' }))} />
                {barcodePlattform && werte.plattform_id === barcodePlattform && <span className="mt-1 block text-xs text-leise">Aus dem Barcode erkannt</span>}
              </>
            )}
          </Feld>}
          {varianten.length > 0 && !merch && (
            <Feld label="Variante / Revision" fehler={fehler.variante_id} breit>
              {(id) => (
                <select id={id} className="eingabe" defaultValue={werte.variante_id ?? ''} ref={unkontrolliert(werte.variante_id)} onChange={(e) => waehleVariante(e.target.value)}>
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
          {/* Fassung: Erstauflage oder übliche Neuauflage (Platinum, Essentials, Classics …) – auch ohne gepflegte Varianten und bei
              Varianten wie „PAL-DE“ oder einer Revision; nur bei einer Sonderausgabe (Special, Collector's …) entfällt sie */}
          {werte.typ === 'spiel' && !merch && neuauflagenFuer(werte.plattform).length > 0 && !istSonderVariante(varianten, werte.variante_id, neuauflagenFuer(werte.plattform)) && (
            <Feld label="Fassung" fehler={fehler.edition}>
              {(id) => {
                const liste = neuauflagenFuer(werte.plattform);
                const eigene = werte.edition && !liste.includes(werte.edition);
                return (
                  <select id={id} className="eingabe" defaultValue={werte.edition ?? ''} ref={unkontrolliert(werte.edition)} onChange={(e) => setWerte((w) => ({ ...w, edition: e.target.value }))}>
                    <option value="">Erstauflage / Standard</option>
                    {liste.map((n) => <option key={n} value={n}>{n}</option>)}
                    {eigene && <option value={werte.edition}>{werte.edition}</option>}
                  </select>
                );
              }}
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
                  <select className="eingabe" defaultValue={werte.digital_quelle ?? ''} ref={unkontrolliert(werte.digital_quelle)} onChange={setze('digital_quelle')} aria-label="Store">
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
          {zeige('region') && !merch && (
            <Feld label="Region" fehler={fehler.region}>
              {(id) => (
                <>
                  <Auswahl id={id} wert={werte.region} onChange={setze('region')} optionen={REGIONEN} />
                  {spiel && <RegionAusNummer nummer={werte.modellnummer} region={werte.region} onUebernehmen={(region) => setWerte((w) => ({ ...w, region }))} />}
                  <RegionHilfe />
                </>
              )}
            </Feld>
          )}
          <Feld label={(zeige('zustand_ovp') && werte.bestand !== 'digital' && werte.vollstaendigkeit !== 'nur_geraet') || merch ? zustandBeschriftung(werte.typ).traeger : 'Zustand'} fehler={fehler.zustand}>
            {(id) => <Auswahl id={id} wert={werte.zustand} onChange={setze('zustand')} optionen={ZUSTAENDE} />}
          </Feld>
          {/* Merch: Verpackung (Box, Blister) nur bewerten, wenn sie geöffnet vorhanden ist – ungeöffnet ist sie „Neu/OVP“ */}
          {zeige('zustand_ovp') && werte.bestand !== 'digital' && werte.vollstaendigkeit !== 'nur_geraet' && (!merch || merchVerpackung(werte) === 'geoeffnet') && (
            <Feld label={zustandBeschriftung(werte.typ).ovp} fehler={fehler.zustand_ovp}>
              {(id) => <Auswahl id={id} wert={werte.zustand_ovp} onChange={setze('zustand_ovp')} optionen={ZUSTAENDE} />}
            </Feld>
          )}
          {zeige('zustand_inlay') && hatInlayZustand(werte) && (
            <>
              <Feld label="Zustand Inlay (Cover-Einleger)" fehler={fehler.zustand_inlay}>
                {(id) => <Auswahl id={id} wert={werte.zustand_inlay} onChange={setze('zustand_inlay')} optionen={ZUSTAENDE} />}
              </Feld>
              <fieldset className="sm:col-span-2">
                <legend className="mb-1 text-sm text-leise">Mängel am Inlay (optional)</legend>
                <div className="flex flex-wrap gap-2">
                  {INLAY_MAENGEL.map((m) => {
                    const liste = String(werte.inlay_maengel ?? '').split(',').filter(Boolean);
                    const an = liste.includes(m.value);
                    return (
                      <button key={m.value} type="button" aria-pressed={an}
                        className={`rounded-full border px-3 py-1 text-sm ${an ? 'border-akzent bg-akzent/15 text-text' : 'border-rand text-leise hover:bg-karte-hover'}`}
                        onClick={() => setWerte((w) => {
                          const alt = String(w.inlay_maengel ?? '').split(',').filter(Boolean);
                          const neu = an ? alt.filter((x) => x !== m.value) : [...alt, m.value];
                          return { ...w, inlay_maengel: INLAY_MAENGEL.map((x) => x.value).filter((x) => neu.includes(x)).join(',') };
                        })}>
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}
          {merch ? (
            <Feld label="Verpackung" fehler={fehler.vollstaendigkeit}>
              {(id) => (
                <select id={id} className="eingabe" defaultValue={merchVerpackung(werte) ?? ''} ref={unkontrolliert(merchVerpackung(werte))}
                  onChange={(e) => setWerte((w) => ({ ...w, ...merchVerpackungAnwenden(e.target.value, w) }))}>
                  <option value="">– keine Angabe –</option>
                  {MERCH_VERPACKUNGEN.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              )}
            </Feld>
          ) : (
          <Feld label="Vollständigkeit" fehler={fehler.vollstaendigkeit}>
            {(id) => (
              <Auswahl id={id} wert={werte.vollstaendigkeit} optionen={VOLLSTAENDIGKEITEN}
                onChange={(e) => {
                  const v = e.target.value;
                  // Mit Beilagen-Liste: OVP und Anleitung gleich mit ankreuzen (nur noch ergänzen, was sonst dabei ist)
                  setWerte((w) => ({ ...w, vollstaendigkeit: v, beilagen: beilagenSichtbar ? beilagenAusVollstaendigkeit(v, w.beilagen, w.plattform) : w.beilagen }));
                }} />
            )}
          </Feld>
          )}
          {werte.vollstaendigkeit === 'nur_ovp' && (
            <p className="rounded-lg bg-karte-hover p-2 text-xs text-leise sm:col-span-2" data-testid="hinweis-leere-huelle">
              Nur die Verpackung ohne Spiel? Dann ist das eine <strong className="text-text">leere Hülle</strong>: Sie zählt nicht zur Sammlung,
              zum Wert und zu Statistiken – ideal, um Fotos für die Datenbank beizutragen. Du findest sie in der Sammlung unter „Leere Hüllen“.
            </p>
          )}
          {werte.zustand && (
            <p className="-mt-1 text-xs text-leise sm:col-span-2">{ZUSTAENDE.find((z) => z.value === werte.zustand)?.beschreibung}</p>
          )}
          {werte.bestand !== 'digital' && (
            <ZustandHilfe typ={werte.typ} zustand={werte.zustand} zustandOvp={werte.zustand_ovp} zustandInlay={werte.zustand_inlay}
              mitOvp={zeige('zustand_ovp') && werte.vollstaendigkeit !== 'nur_geraet' && (!merch || merchVerpackung(werte) === 'geoeffnet')} mitInlay={zeige('zustand_inlay') && hatInlayZustand(werte)} />
          )}
          {beilagenSichtbar && (
            <>
              <BeilagenCheckliste typ={werte.typ} plattform={werte.plattform} wert={werte.beilagen} anleitungOnline={anleitungNurOnline(katalogEintrag, werte.typ)} lieferumfang={varianten.find((v) => v.id === werte.variante_id)?.lieferumfang ?? null}
                onChange={(b) => setWerte((w) => ({ ...w, beilagen: b, ...(merch ? {} : { vollstaendigkeit: vollstaendigkeitAusBeilagen(b, w.vollstaendigkeit) ?? w.vollstaendigkeit }) }))} />
              <Feld label="Welche Beilagen genau? (optional)" fehler={fehler.beilagen_notiz} breit>
                {(id) => <input id={id} className="eingabe" value={werte.beilagen_notiz} onChange={setze('beilagen_notiz')} maxLength={500}
                  placeholder={merch ? 'z. B. Amiibo-Karte Serie 1, Zertifikat Nr. 123/500' : 'z. B. Club-Nintendo-Katalog 1998, Poster Ocarina of Time, Garantiekarte'} />}
              </Feld>
            </>
          )}
        </Abschnitt>

        {(['farbe', 'edition', 'modellnummer', 'seriennummer', 'drucknummer'].some(zeige) || beilagenSichtbar) && (
        <Abschnitt titel="Variante" hinweis="Sonderfarben, Editionen und Modellrevisionen unterscheiden">
          {zeige('farbe') && !merch && (
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
            <Feld label={merch ? 'Edition (Exclusive, Chase, Glow, limitiert …)' : 'Edition / Variante'} fehler={fehler.edition}>
              {(id) => <input id={id} className="eingabe" value={werte.edition} onChange={setze('edition')} placeholder={merch ? 'z. B. Chase, Glow-in-the-Dark, Convention Exclusive' : 'z. B. Zelda 25th Anniversary'} />}
            </Feld>
          )}
          {zeige('edition') && <EditionAlsVariante werte={werte} varianten={varianten} merch={merch} wahl={varianteAusEdition} setWahl={setVarianteAusEdition}
            onWaehle={waehleVariante} moderator={istModerator(benutzer)} einreichenMoeglich={Boolean(MODUL.moderation)} neuauflagen={neuauflagenFuer(werte.plattform)} />}
          {zeige('modellnummer') && (
            <Feld label={merch ? 'Nummer (z. B. Funko #123)' : 'Modellnummer'} fehler={fehler.modellnummer}>
              {(id) => (
                <>
                  <input id={id} className="eingabe" value={werte.modellnummer} onChange={setze('modellnummer')} placeholder={spiel ? nummernHilfe(werte.plattform).beispiel : merch ? 'z. B. 123 oder #123' : 'z. B. SCPH-1002, HEG-001 (OLED)'} />
                  {spiel && (
                    <>
                      <span className="mt-1 block text-xs text-leise">Wie auf der Hülle bzw. der Disc oder dem Modul; mehrere Nummern mit Komma trennen. Bindestrich und Leerzeichen sind für die Suche egal.</span>
                      <NummernInfo hilfe={nummernHilfe(werte.plattform)} />
                    </>
                  )}
                </>
              )}
            </Feld>
          )}
          {spiel && zeige('drucknummer') && (
            <Feld label="Drucknummer (Cover)" fehler={fehler.drucknummer}>
              {(id) => (
                <>
                  <input id={id} className="eingabe" value={werte.drucknummer} onChange={setze('drucknummer')} maxLength={40} placeholder={nummernHilfe(werte.plattform).druck.beispiel} autoComplete="off" />
                  <p className="mt-1 text-xs text-leise">{nummernHilfe(werte.plattform).druck.text}</p>
                </>
              )}
            </Feld>
          )}
          {zeige('seriennummer') && !merch && (!spiel || werte.seriennummer) && (
            <Feld label="Seriennummer" fehler={fehler.seriennummer}>
              {(id) => <input id={id} className="eingabe" value={werte.seriennummer} onChange={setze('seriennummer')} autoComplete="off" />}
            </Feld>
          )}
          {beilagenSichtbar && !merch && (!spiel || werte.seriennummer_ovp) && (
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
              <select id={id} className="eingabe" defaultValue={werte.herkunft} ref={unkontrolliert(werte.herkunft)} onChange={setze('herkunft')}>
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
                  <input id={id} className="eingabe" value={werte.kaufdatum} onChange={setze('kaufdatum')} onBlur={(e) => setWerte((w) => ({ ...w, kaufdatum: datumAnzeigen(e.target.value) }))} inputMode="numeric" placeholder="TT.MM.JJJJ, MM.JJJJ oder JJJJ – Punkte optional" />
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
                  {(id) => <input id={id} className="eingabe" value={werte.erstkauf_datum} onChange={setze('erstkauf_datum')} onBlur={(e) => setWerte((w) => ({ ...w, erstkauf_datum: datumAnzeigen(e.target.value) }))} inputMode="numeric" placeholder="TT.MM.JJJJ, MM.JJJJ oder JJJJ – Punkte optional" />}
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
          <select id={id} className="eingabe" defaultValue={wert ?? ''} ref={unkontrolliert(wert)} onChange={(e) => (e.target.value === 'neu' ? setNeu({ name: '', preis: '', kaufdatum: '' }) : onWahl(e.target.value ? Number(e.target.value) : null))}>
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
    // min-w-0: Grid-Felder dürfen sonst nicht unter ihre Inhaltsbreite schrumpfen – ein <select> mit langer Option
    // (z. B. eine frei eingegebene, lange Fassungs-Bezeichnung) würde sonst die ganze Seite seitlich aufreißen.
    <div className={`min-w-0 ${breit ? 'sm:col-span-2' : ''}`}>
      {typeof children === 'function' ? <label htmlFor={id} className="beschriftung">{label}</label> : <span className="beschriftung">{label}</span>}
      {inhalt}
      {fehler && <p className="mt-1 text-sm text-gefahr" role="alert">{fehler}</p>}
    </div>
  );
}

function Auswahl({ id, wert, onChange, optionen }) {
  return (
    <select id={id} className="eingabe" defaultValue={wert ?? ''} ref={unkontrolliert(wert)} onChange={onChange}>
      <option value="">– keine Angabe –</option>
      {optionen.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/**
 * Unter „Edition / Variante“: Gibt es die eingetragene Edition im Katalog schon als Variante, zum Auswählen anbieten –
 * sonst anbieten, sie beim Speichern als neue Variante anzulegen (nur für mich, zur Aufnahme einreichen oder – Moderation – veröffentlichen).
 */
function EditionAlsVariante({ werte, varianten, merch, wahl, setWahl, onWaehle, moderator, einreichenMoeglich, neuauflagen }) {
  const name = String(werte.edition ?? '').trim();
  // Übliche Neuauflagen (Platinum, Essentials …) sind keine eigene Variante – die stehen unter „Fassung“
  if (merch || !name || !werte.katalog_id || werte.variante_id || neuauflagen.includes(name)) return null;
  const klein = name.toLowerCase();
  const vorhanden = varianten.find((v) => [v.bezeichnung, v.edition].some((t) => String(t ?? '').trim().toLowerCase() === klein));
  if (vorhanden) {
    return (
      <p className="-mt-1 text-xs text-leise sm:col-span-2" data-testid="edition-vorhanden">
        „{vorhanden.bezeichnung}“ gibt es im Katalog als Variante.{' '}
        <button type="button" className="text-akzent-hell underline" onClick={() => onWaehle(vorhanden.id)}>Diese Variante wählen</button>
      </p>
    );
  }
  const optionen = [
    ['privat', 'nur für mich'],
    ...(einreichenMoeglich ? [['einreichen', 'zur Aufnahme in den Katalog einreichen']] : []),
    ...(moderator ? [['veroeffentlichen', 'direkt veröffentlichen (Moderation)']] : []),
  ];
  return (
    <div className="-mt-1 space-y-1.5 rounded-xl bg-karte-hover p-3 text-sm sm:col-span-2" data-testid="edition-als-variante">
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-0.5 size-5 accent-akzent" checked={Boolean(wahl)}
          onChange={(e) => setWahl(e.target.checked ? (einreichenMoeglich ? 'einreichen' : 'privat') : '')} />
        <span>„{name}“ als <strong>Variante dieses Spiels</strong> anlegen
          <span className="block text-xs text-leise">Dann erscheint sie bei „Varianten &amp; Revisionen“, und dein Exemplar wird gleich damit verknüpft.</span></span>
      </label>
      {wahl && optionen.length > 1 && (
        <select className="eingabe" aria-label="Sichtbarkeit der neuen Variante" value={wahl} onChange={(e) => setWahl(e.target.value)}>
          {optionen.map(([wert, text]) => <option key={wert} value={wert}>{text[0].toUpperCase() + text.slice(1)}</option>)}
        </select>
      )}
    </div>
  );
}
