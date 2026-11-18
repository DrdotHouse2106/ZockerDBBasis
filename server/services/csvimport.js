// Import von Sammlungen aus CSV-Dateien – z. B. aus CLZ Games, Tabellen (Excel/LibreOffice) oder dem eigenen CSV-Export.
// Die Spalten werden anhand ihrer Überschriften automatisch zugeordnet und lassen sich in der Oberfläche anpassen.

/** Liest CSV nach RFC 4180 (Anführungszeichen, Zeilenumbrüche in Feldern). Trennzeichen wird erkannt. */
export function leseCsv(text) {
  const roh = String(text ?? '').replace(/^﻿/, '');
  const ersteZeile = roh.split(/\r?\n/, 1)[0] ?? '';
  const trennzeichen = [';', ',', '\t'].map((t) => [t, ersteZeile.split(t).length]).sort((a, b) => b[1] - a[1])[0][0];
  const zeilen = [];
  let zeile = [];
  let feld = '';
  let inAnfuehrung = false;
  for (let i = 0; i < roh.length; i++) {
    const z = roh[i];
    if (inAnfuehrung) {
      if (z === '"' && roh[i + 1] === '"') { feld += '"'; i++; } else if (z === '"') inAnfuehrung = false;
      else feld += z;
    } else if (z === '"' && feld === '') inAnfuehrung = true;
    else if (z === trennzeichen) { zeile.push(feld); feld = ''; } else if (z === '\n' || z === '\r') {
      if (z === '\r' && roh[i + 1] === '\n') i++;
      zeile.push(feld);
      if (zeile.some((f) => f.trim() !== '')) zeilen.push(zeile);
      zeile = [];
      feld = '';
    } else feld += z;
  }
  zeile.push(feld);
  if (zeile.some((f) => f.trim() !== '')) zeilen.push(zeile);
  return { trennzeichen, kopf: (zeilen.shift() ?? []).map((k) => k.trim()), zeilen };
}

/** Zielfelder mit bekannten Spaltennamen (deutsch, englisch, CLZ Games, eigener Export). */
export const IMPORT_FELDER = [
  { feld: 'titel', titel: 'Titel', pflicht: true, namen: ['titel', 'title', 'name', 'spiel', 'game', 'bezeichnung', 'artikel'] },
  { feld: 'plattform', titel: 'Plattform', namen: ['plattform', 'platform', 'system', 'konsole', 'console'] },
  { feld: 'typ', titel: 'Artikeltyp', namen: ['artikeltyp', 'typ', 'type', 'kategorie', 'category', 'item type'] },
  // CLZ Games: „Hardware Type“ (Console, Controller …) – gilt, wenn „Type“ leer ist
  { feld: 'hardwaretyp', titel: 'Hardware-Typ', namen: ['hardware type', 'hardware-typ'] },
  // CLZ Games: „Format“ (DVD, Cartridge, Download …) – „Download“ wird zum digitalen Spiel
  { feld: 'format', titel: 'Format', namen: ['format', 'medium'] },
  { feld: 'merch_kategorie', titel: 'Merch-Kategorie', namen: ['merch-kategorie', 'merch kategorie', 'merchkategorie'] },
  { feld: 'region', titel: 'Region', namen: ['region', 'land', 'country'] },
  { feld: 'zustand', titel: 'Zustand', namen: ['zustand', 'condition', 'grade'] },
  // CLZ Games: „Collection Status“ (In Collection, Wish List, For Sale, Sold …) – vor „Vollständigkeit“, die sonst „status“ greifen würde
  { feld: 'sammlungsstatus', titel: 'Sammlungsstatus', namen: ['collection status', 'sammlungsstatus', 'bestand', 'owned status'] },
  { feld: 'vollstaendigkeit', titel: 'Vollständigkeit', namen: ['vollständigkeit', 'vollstaendigkeit', 'completeness', 'complete', 'status'] },
  // CLZ Games: Ja/Nein-Spalten „Box“ und „Manual“ – ergeben die Vollständigkeit, wenn keine eigene Spalte dafür da ist
  { feld: 'box', titel: 'OVP/Hülle vorhanden (Ja/Nein)', namen: ['box', 'ovp', 'case', 'hülle'] },
  { feld: 'anleitung', titel: 'Anleitung vorhanden (Ja/Nein)', namen: ['manual', 'anleitung', 'handbuch'] },
  { feld: 'edition', titel: 'Edition/Variante', namen: ['edition/variante', 'edition', 'variante', 'variant', 'version'] },
  { feld: 'farbe', titel: 'Farbe', namen: ['farbe', 'color', 'colour'] },
  { feld: 'modellnummer', titel: 'Modellnummer', namen: ['modellnummer', 'model', 'model number', 'modell'] },
  { feld: 'seriennummer', titel: 'Seriennummer', namen: ['seriennummer', 'serial', 'serial number', 'serial no.', 'serial no'] },
  { feld: 'barcode', titel: 'Barcode (EAN/UPC)', namen: ['barcode', 'ean', 'upc', 'gtin'] },
  { feld: 'anzahl', titel: 'Anzahl', namen: ['anzahl', 'quantity', 'qty', 'menge', 'copies'] },
  { feld: 'kaufpreis', titel: 'Kaufpreis', namen: ['kaufpreis (eur)', 'kaufpreis', 'purchase price', 'price paid', 'preis', 'price'] },
  { feld: 'kaufdatum', titel: 'Kaufdatum', namen: ['kaufdatum', 'purchase date', 'date purchased', 'gekauft am'] },
  // Nicht „Value“: in CLZ Games sind das Schätzwerte in US-Dollar (lässt sich bei Bedarf von Hand zuordnen)
  { feld: 'marktwert', titel: 'Marktwert', namen: ['marktwert (eur)', 'marktwert', 'wert'] },
  { feld: 'notizen', titel: 'Notizen', namen: ['eigene notizen', 'notizen', 'notes', 'note', 'comments', 'kommentar', 'bemerkung'] },
  // CLZ Games: Kaufort (wird an die Notizen gehängt), Lagerort, „Completed“ (durchgespielt)
  { feld: 'kaufort', titel: 'Gekauft bei', namen: ['purchase store', 'gekauft bei', 'kaufort', 'händler'] },
  { feld: 'lagerort_ort', titel: 'Lagerort', namen: ['lagerort', 'location', 'ort'] },
  { feld: 'lagerort_regal', titel: 'Regal/Box', namen: ['storage device', 'regal', 'box/regal'] },
  { feld: 'lagerort_fach', titel: 'Fach', namen: ['storage slot', 'fach'] },
  { feld: 'durchgespielt', titel: 'Durchgespielt (Ja/Nein)', namen: ['completed', 'durchgespielt'] },
  { feld: 'durchgespielt_am', titel: 'Durchgespielt am', namen: ['completed date', 'durchgespielt am'] },
];

// Nur bei genau gleicher Überschrift zuordnen – sonst griffe z. B. „complete“ auch „Completed Year“ und „box“ „Storage Box“
const NUR_GENAU = new Set(['complete', 'status', 'box', 'case', 'manual', 'value', 'ort', 'fach', 'regal', 'completed', 'durchgespielt']);

const norm = (t) => String(t ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Ordnet Überschriften automatisch den Feldern zu: { feld: spaltenIndex }. */
export function erkenneZuordnung(kopf, felder = IMPORT_FELDER) {
  const zuordnung = {};
  const vergeben = new Set();
  for (const f of felder) {
    for (const name of f.namen) {
      const index = kopf.findIndex((k, i) => !vergeben.has(i) && norm(k) === name);
      if (index >= 0) { zuordnung[f.feld] = index; vergeben.add(index); break; }
    }
  }
  // Zweiter Durchgang: Überschrift enthält den Namen (z. B. „Purchase Price (USD)“)
  for (const f of felder) {
    if (zuordnung[f.feld] !== undefined) continue;
    const index = kopf.findIndex((k, i) => !vergeben.has(i) && f.namen.some((n) => n.length > 3 && !NUR_GENAU.has(n) && norm(k).includes(n)));
    if (index >= 0) { zuordnung[f.feld] = index; vergeben.add(index); }
  }
  return zuordnung;
}

// ── Werte übersetzen ─────────────────────────────────────────────
const enthaelt = (text, ...muster) => muster.some((m) => text.includes(m));

function typVon(wert, standard) {
  const t = norm(wert);
  if (!t) return standard;
  if (enthaelt(t, 'merch', 'figur', 'funko', 'amiibo', 'sammlerst', 'statue', 'soundtrack')) return 'merch';
  if (enthaelt(t, 'zubeh', 'access', 'controller', 'peripher')) return 'zubehoer';
  if (enthaelt(t, 'konsole', 'console', 'hardware', 'system')) return 'konsole';
  if (enthaelt(t, 'spiel', 'game', 'software')) return 'spiel';
  return standard;
}

/** Merch-Kategorie aus Freitext (leer = keine Angabe). */
export function merchKategorieVon(wert) {
  const t = norm(wert);
  if (!t) return null;
  if (enthaelt(t, 'spielfigur', 'amiibo', 'skylander', 'infinity', 'dimensions', 'starlink')) return 'spielfigur';
  if (enthaelt(t, 'figur', 'statue', 'funko', 'pop')) return 'figur';
  if (enthaelt(t, 'buch', 'heft', 'book', 'magazin', 'lösung', 'loesung', 'artbook')) return 'buch';
  if (enthaelt(t, 'musik', 'music', 'soundtrack', 'vinyl', 'cd')) return 'musik';
  if (enthaelt(t, 'kleid', 'shirt', 'cloth', 'accessoire', 'mütze', 'tasche')) return 'kleidung';
  if (enthaelt(t, 'promo', 'werbung', 'poster', 'aufsteller')) return 'promo';
  return null;
}

export function regionVon(wert) {
  const t = norm(wert);
  if (!t) return null;
  const w = new Set(t.split(/[^a-z0-9äöü]+/).filter(Boolean));
  const hat = (...namen) => namen.some((n) => w.has(n));
  if (enthaelt(t, 'ntsc-j', 'ntsc j') || hat('jp', 'jpn', 'japan', 'j')) return 'ntsc_j';
  if (enthaelt(t, 'ntsc', 'north america', 'nordamerika') || hat('us', 'usa', 'na', 'canada', 'kanada')) return 'ntsc_u';
  if (enthaelt(t, 'pal-de', 'pal de') || hat('de', 'usk', 'deutschland', 'germany', 'deutsch', 'german')) return 'pal_de';
  if (hat('at', 'ch', 'österreich', 'austria', 'schweiz', 'switzerland')) return 'pal_at';
  if (hat('uk', 'gb', 'england', 'britain', 'großbritannien')) return 'pal_uk';
  if (hat('fr', 'france', 'frankreich')) return 'pal_fr';
  if (hat('benelux', 'nl', 'be', 'niederlande', 'netherlands', 'holland', 'belgien', 'belgium')) return 'pal_benelux';
  if (hat('es', 'pt', 'spanien', 'spain', 'portugal')) return 'pal_es';
  if (hat('it', 'italien', 'italy')) return 'pal_it';
  if (hat('nordic', 'skandinavien', 'scandinavia', 'se', 'dk', 'no', 'fi', 'schweden', 'dänemark', 'norwegen', 'finnland')) return 'pal_nordic';
  if (hat('pal', 'eu', 'europe', 'europa', 'au', 'australia', 'australien')) return 'pal_eu';
  return null;
}

export function vollstaendigkeitVon(wert) {
  const t = norm(wert);
  if (!t) return null;
  if (enthaelt(t, 'ohne anl', 'no manual', 'missing manual', 'fehlt anleitung', 'o. anl')) return 'fehlt_anleitung';
  if (enthaelt(t, 'ohne inlay', 'fehlt inlay', 'o. inlay', 'no cover', 'missing cover', 'no insert', 'missing insert')) return 'fehlt_inlay';
  if (enthaelt(t, 'nur ovp', 'box only', 'only box')) return 'nur_ovp';
  if (enthaelt(t, 'schutzhülle', 'schutzhuelle', 'mit hülle', 'mit huelle', 'ohne karton', 'with sleeve', 'dust cover', 'in case')) return 'mit_huelle';
  if (enthaelt(t, 'loose', 'lose', 'cart only', 'disc only', 'nur modul', 'nur disc', 'nur gerät', 'nur geraet')) return 'nur_geraet';
  if (enthaelt(t, 'cib', 'complete', 'komplett', 'new', 'neu', 'sealed')) return 'cib';
  return null;
}

export function zustandVon(wert, vollstaendigkeitRoh) {
  const t = norm(wert);
  const v = norm(vollstaendigkeitRoh);
  if (enthaelt(t, 'sealed', 'versiegelt', 'neu/ovp', 'new') || enthaelt(v, 'sealed', 'new', 'neu')) return 'neu_ovp';
  if (!t) return null;
  if (enthaelt(t, 'near mint', 'wie neu', 'like new', 'mint')) return 'wie_neu';
  if (enthaelt(t, 'very good', 'sehr gut', 'excellent')) return 'sehr_gut';
  if (enthaelt(t, 'good', 'gut')) return 'gut';
  if (enthaelt(t, 'fair', 'acceptable', 'akzeptabel', 'used')) return 'akzeptabel';
  if (enthaelt(t, 'poor', 'defekt', 'broken', 'defective')) return 'defekt';
  return null;
}

const MONATE = { jan: 1, feb: 2, mar: 3, mär: 3, maer: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12 };

/** „01.05.2023“, „2023-05-01“, „2023/05/01“, „May 01, 2023“ (CLZ Games), „1 May 2023“ → „2023-05-01“; andere Formate werden ignoriert. */
export function datumVon(wert) {
  const t = String(wert ?? '').trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const monat = (name) => MONATE[name.toLowerCase().slice(0, 3)] ?? MONATE[name.toLowerCase().slice(0, 4)];
  m = t.match(/^([A-Za-zäÄ]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && monat(m[1])) return `${m[3]}-${String(monat(m[1])).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})\.?\s+([A-Za-zäÄ]{3,})\.?\s+(\d{4})$/);
  if (m && monat(m[2])) return `${m[3]}-${String(monat(m[2])).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** Ja/Nein-Spalte: true, false oder null (leer/unbekannt). */
export function jaNeinVon(wert) {
  const t = norm(wert);
  if (['yes', 'ja', 'y', 'j', 'x', '1', 'true', 'wahr', '✓', 'vorhanden'].includes(t)) return true;
  if (['no', 'nein', 'n', '0', 'false', 'falsch', 'fehlt', 'missing'].includes(t)) return false;
  return null;
}

/** Vollständigkeit aus den CLZ-Spalten „Box“ und „Manual“: mit Box und Anleitung CIB, Box ohne Anleitung, ohne Box lose. */
export function vollstaendigkeitAusBoxAnleitung(box, anleitung) {
  if (box === false) return anleitung === true ? null : 'nur_geraet';
  if (box === true) return anleitung === false ? 'fehlt_anleitung' : anleitung === true ? 'cib' : null;
  return null;
}

/**
 * Sammlungsstatus (CLZ „Collection Status“ oder eigener Export „Bestand“): { bestand } oder { ueberspringen: Grund }.
 * Leer/unbekannt → null (Standard „Im Besitz“).
 */
export function sammlungsstatusVon(wert) {
  const t = norm(wert);
  if (!t) return null;
  if (enthaelt(t, 'wish', 'wunsch')) return { ueberspringen: 'Steht auf der Wunschliste – nicht importiert. Wunschliste bitte in der App anlegen.' };
  if (enthaelt(t, 'not in collection', 'nicht in der sammlung')) return { ueberspringen: 'Nicht in der Sammlung – nicht importiert.' };
  if (enthaelt(t, 'sold', 'verkauft')) return { bestand: 'verkauft' };
  if (enthaelt(t, 'verschenkt', 'getauscht', 'abgegeben', 'traded', 'given away')) return { bestand: 'abgegeben' };
  if (enthaelt(t, 'digital')) return { bestand: 'digital' };
  if (enthaelt(t, 'leere', 'verpackung')) return { bestand: 'verpackung' };
  return null;
}

export function betragVon(wert) {
  const t = String(wert ?? '').replace(/[^\d.,-]/g, '');
  if (!t) return null;
  // „1,234.56“ (englisch) → „1234.56“; „1.234,56“ (deutsch) bleibt für leseEuro
  if (/,\d{3}\./.test(t) || (/\.\d{1,2}$/.test(t) && t.includes(','))) return t.replace(/,/g, '');
  return t;
}

/** Wandelt eine CSV-Zeile anhand der Zuordnung in Artikeldaten um (noch ohne Prüfung). */
export function zeileZuArtikel(zeile, zuordnung, { standardTyp = 'spiel' } = {}) {
  const w = (feld) => (zuordnung[feld] === undefined || zuordnung[feld] === null ? '' : String(zeile[zuordnung[feld]] ?? '').trim());
  const anzahl = Number.parseInt(w('anzahl'), 10);
  return {
    titel: w('titel'),
    plattform: w('plattform') || null,
    typ: typVon(w('typ') || w('hardwaretyp'), standardTyp),
    merch_kategorie: merchKategorieVon(w('merch_kategorie')),
    region: regionVon(w('region')),
    zustand: zustandVon(w('zustand'), w('vollstaendigkeit')),
    vollstaendigkeit: vollstaendigkeitVon(w('vollstaendigkeit')) ?? vollstaendigkeitAusBoxAnleitung(jaNeinVon(w('box')), jaNeinVon(w('anleitung'))),
    edition: w('edition') || null,
    farbe: w('farbe') || null,
    modellnummer: w('modellnummer') || null,
    seriennummer: w('seriennummer') || null,
    barcode: w('barcode').replace(/\D/g, '') || null,
    anzahl: Number.isInteger(anzahl) && anzahl > 0 ? Math.min(anzahl, 9999) : 1,
    kaufpreis: betragVon(w('kaufpreis')),
    kaufdatum: datumVon(w('kaufdatum')),
    marktwert: betragVon(w('marktwert')),
    // Unbekannte Zustandsangaben (z. B. „Verkratzt“) und der Kaufort gehen nicht verloren, sondern landen in den Notizen
    notizen: [w('notizen'), w('zustand') && !zustandVon(w('zustand'), '') && `Zustand: ${w('zustand')}`, w('kaufort') && `Gekauft bei: ${w('kaufort')}`]
      .filter(Boolean).join('\n') || null,
    lagerort_ort: w('lagerort_ort') || null,
    lagerort_regal: w('lagerort_regal') || null,
    lagerort_fach: w('lagerort_fach') || null,
    ...(jaNeinVon(w('durchgespielt')) || datumVon(w('durchgespielt_am')) ? { spielstatus: 'durchgespielt', durchgespielt_am: datumVon(w('durchgespielt_am')) } : {}),
    ...(/^(download|digital)$/i.test(w('format')) ? { bestand: 'digital' } : {}),
    ...(sammlungsstatusVon(w('sammlungsstatus')) ?? {}),
  };
}
