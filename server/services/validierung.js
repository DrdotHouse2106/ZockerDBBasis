import { ALLE_WERTE, BEILAGEN } from '../../shared/konstanten.js';

const BEILAGEN_SCHLUESSEL = new Set(Object.values(BEILAGEN).flat().map((b) => b.value));

export class ValidierungsFehler extends Error {
  constructor(fehler) {
    super('Die Eingaben sind unvollständig oder fehlerhaft.');
    this.fehler = fehler; // { feldname: 'Meldung' }
  }
}

const TEXTFELDER = {
  titel: 200,
  plattform: 100,
  barcode: 20,
  cover_url: 1000,
  farbe: 100,
  edition: 200,
  modellnummer: 100,
  drucknummer: 40,
  seriennummer: 100,
  seriennummer_ovp: 100,
  lagerort_ort: 80,
  lagerort_regal: 80,
  lagerort_fach: 80,
  notizen: 5000,
  erstkauf_quelle: 100,
  beilagen_notiz: 500,
};

const AUSWAHLFELDER = ['zustand', 'zustand_ovp', 'vollstaendigkeit', 'region', 'herkunft', 'spielstatus', 'kauf_quelle'];

/** Datum TT.MM.JJJJ-frei: JJJJ-MM-TT, plausibel. */
const gueltigerTag = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && Number(d.slice(0, 4)) >= 1950 && Number(d.slice(0, 4)) <= 2100;

export function leerZuNull(wert) {
  if (wert === undefined || wert === null) return null;
  const s = String(wert).trim();
  return s === '' ? null : s;
}

/** Liest Beträge in deutscher oder englischer Schreibweise: "1.299,90", "49,99", "49.99". */
export function leseEuro(roh) {
  if (typeof roh === 'number') return Number.isFinite(roh) && roh >= 0 && roh <= 1_000_000 ? Math.round(roh * 100) / 100 : null;
  const text = String(roh).replace(/[€\s]/g, '');
  const zahl = Number(/,/.test(text) ? text.replace(/\./g, '').replace(',', '.') : text);
  if (!Number.isFinite(zahl) || zahl < 0 || zahl > 1_000_000) return null;
  return Math.round(zahl * 100) / 100;
}

/**
 * Prüft und normalisiert einen Sammlungsartikel.
 * @param {object} eingabe  Rohdaten aus dem Request
 * @param {boolean} teilweise  true bei PATCH-artigen Aktualisierungen
 */
export function pruefeArtikel(eingabe, teilweise = false) {
  const fehler = {};
  const daten = {};
  const hat = (feld) => Object.hasOwn(eingabe ?? {}, feld);
  eingabe ??= {};

  if (!teilweise || hat('typ')) {
    if (!ALLE_WERTE.typ.includes(eingabe.typ)) fehler.typ = 'Bitte einen Artikeltyp wählen (Spiel, Konsole oder Zubehör).';
    else daten.typ = eingabe.typ;
  }

  for (const [feld, maxLaenge] of Object.entries(TEXTFELDER)) {
    if (teilweise && !hat(feld)) continue;
    const wert = leerZuNull(eingabe[feld]);
    if (wert && wert.length > maxLaenge) fehler[feld] = `Maximal ${maxLaenge} Zeichen erlaubt.`;
    daten[feld] = wert;
  }
  if ((!teilweise || hat('titel')) && !daten.titel) fehler.titel = 'Bitte einen Titel bzw. eine Bezeichnung angeben.';

  if (daten.cover_url && !/^(https?:\/\/|\/uploads\/)/i.test(daten.cover_url)) {
    fehler.cover_url = 'Die Bildadresse muss mit http:// oder https:// beginnen.';
  }

  if (daten.barcode) {
    daten.barcode = daten.barcode.replace(/\D/g, '');
    if (![8, 12, 13, 14].includes(daten.barcode.length)) fehler.barcode = 'Ungültiger Barcode (EAN-8, UPC-A, EAN-13 oder GTIN-14).';
  }

  for (const feld of AUSWAHLFELDER) {
    if (teilweise && !hat(feld)) continue;
    const wert = leerZuNull(eingabe[feld]);
    if (wert && !ALLE_WERTE[feld].includes(wert)) fehler[feld] = 'Ungültige Auswahl.';
    daten[feld] = wert;
  }

  for (const feld of ['kaufpreis', 'marktwert', 'verkaufspreis', 'neupreis']) {
    if (teilweise && !hat(feld)) continue;
    const roh = leerZuNull(eingabe[feld]);
    if (roh === null) daten[feld] = null;
    else {
      const zahl = leseEuro(roh);
      if (zahl === null) fehler[feld] = 'Bitte einen gültigen Betrag angeben (z. B. 49,99).';
      else daten[feld] = zahl;
    }
  }

  // Kaufdatum und Erstkaufdatum (laut Beleg): auch ungefähr – nur Jahr (1995) oder Monat und Jahr (1995-03)
  for (const feld of ['kaufdatum', 'erstkauf_datum']) {
    if (teilweise && !hat(feld)) continue;
    const datum = leerZuNull(eingabe[feld]);
    if (datum && (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(datum) || Number.isNaN(Date.parse(datum.length === 4 ? `${datum}-01-01` : datum.length === 7 ? `${datum}-01` : datum))
      || Number(datum.slice(0, 4)) < 1950 || Number(datum.slice(0, 4)) > 2100)) {
      fehler[feld] = 'Bitte ein gültiges Datum angeben (auch nur Jahr oder Monat.Jahr).';
    }
    daten[feld] = datum;
  }

  // Bestand: im Besitz, verkauft oder abgegeben (mit Datum); Verkaufspreis nur bei „verkauft“
  if (!teilweise || hat('bestand')) {
    const bestand = leerZuNull(eingabe.bestand) ?? 'besitz';
    if (!ALLE_WERTE.bestand.includes(bestand)) fehler.bestand = 'Ungültige Auswahl.';
    else daten.bestand = bestand;
  }
  if (!teilweise || hat('durchgespielt_am')) {
    const datum = leerZuNull(eingabe.durchgespielt_am);
    if (datum && !gueltigerTag(datum)) fehler.durchgespielt_am = 'Bitte ein gültiges Datum angeben.';
    daten.durchgespielt_am = datum;
  }
  if (!teilweise || hat('spielzeit_minuten')) {
    const roh = leerZuNull(eingabe.spielzeit_minuten);
    const n = roh === null ? null : Number(roh);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 10_000_000)) fehler.spielzeit_minuten = 'Bitte eine Spielzeit in Minuten angeben.';
    else daten.spielzeit_minuten = n;
  }
  if (!teilweise || hat('abgang_am')) {
    const datum = leerZuNull(eingabe.abgang_am);
    if (datum && !gueltigerTag(datum)) fehler.abgang_am = 'Bitte ein gültiges Datum angeben.';
    daten.abgang_am = datum;
  }
  if (daten.bestand === 'besitz') Object.assign(daten, { abgang_am: null, verkaufspreis: null });
  // Store eines digitalen Spiels (nur bei Bestand „digital“)
  if (hat('digital_quelle') || daten.bestand) {
    const quelle = daten.bestand && daten.bestand !== 'digital' ? null : leerZuNull(eingabe.digital_quelle);
    if (quelle && !ALLE_WERTE.digital_quelle.includes(quelle)) fehler.digital_quelle = 'Ungültige Auswahl.';
    else if (hat('digital_quelle') || daten.bestand !== undefined) daten.digital_quelle = quelle;
  }
  if (daten.bestand === 'abgegeben' && hat('verkaufspreis')) daten.verkaufspreis = null;

  // Beilagen-Checkliste: { anleitung: true, poster: false, … } – nur bekannte Schlüssel, leer = null
  if (!teilweise || hat('beilagen')) {
    let roh = eingabe.beilagen ?? null;
    if (typeof roh === 'string') { try { roh = roh ? JSON.parse(roh) : null; } catch { roh = undefined; } }
    if (roh !== null && (typeof roh !== 'object' || Array.isArray(roh))) fehler.beilagen = 'Ungültige Beilagen-Liste.';
    else {
      // Werte: true/false, „ohne“ (gab es nicht) oder Anzahl (1 = vorhanden, bis 99 – z. B. drei Werbebeilagen)
      const liste = Object.fromEntries(Object.entries(roh ?? {})
        .filter(([k, v]) => BEILAGEN_SCHLUESSEL.has(k) && (typeof v === 'boolean' || v === 'ohne' || (Number.isInteger(v) && v >= 1 && v <= 99)))
        .map(([k, v]) => [k, v === 1 ? true : v]));
      daten.beilagen = Object.keys(liste).length ? JSON.stringify(liste) : null;
    }
  }

  // Privat: nur für den Besitzer sichtbar (auch aus Formularen als „true“/„1“/„on“)
  if (!teilweise || hat('privat')) daten.privat = [true, 1, '1', 'true', 'on'].includes(eingabe.privat) ? 1 : 0;

  if (!teilweise || hat('anzahl')) {
    const anzahl = eingabe.anzahl === undefined || eingabe.anzahl === '' || eingabe.anzahl === null ? 1 : Number(eingabe.anzahl);
    if (!Number.isInteger(anzahl) || anzahl < 1 || anzahl > 9999) fehler.anzahl = 'Die Anzahl muss eine ganze Zahl ab 1 sein.';
    else daten.anzahl = anzahl;
  }

  for (const feld of ['plattform_id', 'variante_id', 'konvolut_id']) {
    if (teilweise && !hat(feld)) continue;
    const id = eingabe[feld] === '' || eingabe[feld] == null ? null : Number(eingabe[feld]);
    if (id !== null && !Number.isInteger(id)) fehler[feld] = 'Ungültige Auswahl.';
    else daten[feld] = id;
  }

  if (!teilweise || hat('katalog_id')) {
    const id = eingabe.katalog_id === '' || eingabe.katalog_id == null ? null : Number(eingabe.katalog_id);
    if (id !== null && !Number.isInteger(id)) fehler.katalog_id = 'Ungültiger Katalogeintrag.';
    else daten.katalog_id = id;
  }

  if (Object.keys(fehler).length) throw new ValidierungsFehler(fehler);
  return daten;
}

/** Prüft einen eigenen Katalogeintrag (z. B. seltene Hardware). */
export function pruefeKatalogEintrag(eingabe = {}) {
  const fehler = {};
  const titel = leerZuNull(eingabe.titel);
  if (!titel) fehler.titel = 'Bitte eine Bezeichnung angeben.';
  else if (titel.length > 200) fehler.titel = 'Maximal 200 Zeichen erlaubt.';
  if (!ALLE_WERTE.typ.includes(eingabe.typ)) fehler.typ = 'Bitte einen Artikeltyp wählen.';
  let jahr = leerZuNull(eingabe.erscheinungsjahr);
  if (jahr !== null) {
    jahr = Number(jahr);
    if (!Number.isInteger(jahr) || jahr < 1950 || jahr > 2100) fehler.erscheinungsjahr = 'Ungültiges Jahr.';
  }
  const plattformen = Array.isArray(eingabe.plattformen)
    ? eingabe.plattformen.map(leerZuNull).filter(Boolean).slice(0, 20)
    : [leerZuNull(eingabe.plattformen)].filter(Boolean);
  if (Object.keys(fehler).length) throw new ValidierungsFehler(fehler);
  return {
    typ: eingabe.typ,
    titel,
    plattformen,
    erscheinungsjahr: jahr,
    hersteller: leerZuNull(eingabe.hersteller)?.slice(0, 200) ?? null,
    cover_url: /^https?:\/\//i.test(eingabe.cover_url ?? '') ? String(eingabe.cover_url).trim().slice(0, 1000) : null,
    beschreibung: leerZuNull(eingabe.beschreibung)?.slice(0, 5000) ?? null,
    // Markdown: Varianten, PAL-Besonderheiten, Lieferumfang, Fälschungsmerkmale …
    sammlerhinweise: leerZuNull(eingabe.sammlerhinweise)?.slice(0, 10000) ?? null,
    // Optionale Überschreibungen für Suchmaschinen (nur Moderatoren, siehe Route)
    seo_titel: leerZuNull(eingabe.seo_titel)?.replace(/\s+/g, ' ').slice(0, 120) ?? null,
    seo_beschreibung: leerZuNull(eingabe.seo_beschreibung)?.replace(/\s+/g, ' ').slice(0, 300) ?? null,
  };
}

/** Prüft eine Variante/Revision eines Katalogeintrags. */
export function pruefeVariante(eingabe = {}) {
  const fehler = {};
  const text = (f, max) => leerZuNull(eingabe[f])?.slice(0, max) ?? null;
  const daten = {
    bezeichnung: text('bezeichnung', 200),
    modellnummer: text('modellnummer', 100),
    farbe: text('farbe', 100),
    edition: text('edition', 200),
    region: leerZuNull(eingabe.region),
    beschreibung: text('beschreibung', 2000),
    erscheinungsjahr: leerZuNull(eingabe.erscheinungsjahr),
  };
  if (!daten.bezeichnung) {
    daten.bezeichnung = [daten.modellnummer, daten.farbe, daten.edition].filter(Boolean).join(' · ') || null;
  }
  if (!daten.bezeichnung) fehler.bezeichnung = 'Bitte eine Bezeichnung oder Modellnummer angeben.';
  if (daten.region && !ALLE_WERTE.region.includes(daten.region)) fehler.region = 'Ungültige Auswahl.';
  if (daten.erscheinungsjahr !== null) {
    daten.erscheinungsjahr = Number(daten.erscheinungsjahr);
    if (!Number.isInteger(daten.erscheinungsjahr) || daten.erscheinungsjahr < 1950 || daten.erscheinungsjahr > 2100) {
      fehler.erscheinungsjahr = 'Ungültiges Jahr.';
    }
  }
  if (Object.keys(fehler).length) throw new ValidierungsFehler(fehler);
  return daten;
}


export function pruefeKommentar(eingabe = {}) {
  const text = leerZuNull(eingabe.text);
  if (!text) throw new ValidierungsFehler({ text: 'Bitte einen Text eingeben.' });
  if (text.length > 5000) throw new ValidierungsFehler({ text: 'Maximal 5000 Zeichen erlaubt.' });
  return text;
}
