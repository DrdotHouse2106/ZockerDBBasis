// Hilfsfunktionen, um Produktnamen aus Barcode-Datenbanken in brauchbare
// Suchbegriffe für IGDB umzuwandeln. Händlertitel sehen oft so aus:
// "Super Mario Odyssey - [Nintendo Switch] USK 6" → "Super Mario Odyssey"

const PLATTFORM_BEGRIFFE = [
  'nintendo switch 2', 'nintendo switch', 'switch 2', 'switch',
  'playstation 5', 'playstation 4', 'playstation 3', 'playstation 2', 'playstation vita', 'playstation portable', 'playstation',
  'ps5', 'ps4', 'ps3', 'ps2', 'ps1', 'psx', 'psp', 'ps vita', 'psvita',
  'xbox series x', 'xbox series s', 'xbox series x\\|s', 'xbox one', 'xbox 360', 'xbox',
  'nintendo 3ds', 'new 3ds', '3ds', 'nintendo ds', 'nds',
  'wii u', 'wiiu', 'wii', 'gamecube', 'game cube', 'ngc',
  'nintendo 64', 'n64', 'super nintendo', 'snes', 'nes',
  'game boy advance', 'gameboy advance', 'gba', 'game boy color', 'gameboy color', 'gbc', 'game boy', 'gameboy',
  'sega mega drive', 'mega drive', 'megadrive', 'sega saturn', 'saturn', 'dreamcast', 'master system', 'game gear',
  'pc dvd-rom', 'pc dvd', 'pc cd-rom', 'pc',
];

const FUELLWOERTER = [
  'usk\\s*(ab\\s*)?\\d+', 'pegi\\s*\\d+', 'fsk\\s*\\d+', 'ab \\d+ jahren?',
  'standard edition', 'standard', 'deutsche version', 'dt\\. version', 'uncut', 'at-pegi',
  'pal', 'ntsc', 'ntsc-u', 'ntsc-j', 'videospiel', 'computerspiel', 'spiel', 'game', 'software', 'neu', 'ovp', 'new', 'sealed',
  // Händler- und Auktionstitel („Ps3 Boxed + Instructions“, „komplett mit Anleitung“)
  'boxed', 'unboxed', 'instructions?', 'manual', 'complete', 'cib', 'loose', 'mit anleitung', 'ohne anleitung', 'anleitung', 'with manual',
  'in ovp', 'originalverpackt', 'gebraucht', 'used', 'sehr gut', 'guter zustand', 'top zustand', 'rar', 'selten', 'rare',
];

const plattformRegex = new RegExp(`\\b(${PLATTFORM_BEGRIFFE.map((b) => b.replace(/ /g, '\\s*')).join('|')})\\b`, 'gi');
const fuellRegex = new RegExp(`\\b(${FUELLWOERTER.join('|')})\\b`, 'gi');

export function bereinigeProduktname(name) {
  if (!name) return '';
  let t = String(name)
    .replace(/\[[^\]]*\]/g, ' ') // [PlayStation 4]
    .replace(/\([^)]*\)/g, ' ') // (PEGI)
    .replace(plattformRegex, ' ')
    .replace(fuellRegex, ' ')
    .replace(/[|/®™©+]+/g, ' ')
    // Artikelnummern von Händlern (B1393, SKU-12345) – nur Buchstaben+Ziffern-Kürzel, keine Jahres- oder Teilnummern wie „2“
    .replace(/\b[A-Z]{1,4}-?\d{3,}\b/g, ' ')
    .replace(/\s+[-–:]\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Übrig gebliebene Trenner am Anfang/Ende entfernen.
  t = t.replace(/^[\s\-–:,.]+|[\s\-–:,.]+$/g, '').trim();
  return t || String(name).trim();
}

/** Liefert nur Ziffern und prüft die Länge (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function normalisiereBarcode(code) {
  const ziffern = String(code ?? '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(ziffern.length)) return null;
  return ziffern;
}

/** Alle gleichwertigen Schreibweisen eines Codes (UPC-A ↔ EAN-13 mit führender 0). */
export function barcodeVarianten(code) {
  const varianten = new Set([code]);
  if (code.length === 12) varianten.add(`0${code}`);
  if (code.length === 13 && code.startsWith('0')) varianten.add(code.slice(1));
  return [...varianten];
}

const ROEMISCH = { 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII', 13: 'XIII' };
const ARABISCH = Object.fromEntries(Object.entries(ROEMISCH).map(([a, r]) => [r, a]));

/**
 * Suchbegriffe für einen Produktnamen aus einer Barcode-Datenbank – vom genauesten zum gröbsten:
 * bereinigt, ohne Zusätze hinter „ - “ (Editionen, Verpackung), und jeweils mit Zahl ↔ römischer Zahl („4“ ↔ „IV“).
 */
export function suchbegriffe(produktname, max = 6) {
  const bereinigt = bereinigeProduktname(produktname);
  const ohneZusatz = bereinigt.split(/\s+[-–]\s+/)[0].trim();
  const ohneEdition = ohneZusatz.replace(/\b(bonus|limited|special|collector'?s|deluxe|gold|goty|game of the year|complete|premium|day one|steelbook)\s+edition\b.*$/i, '').trim();
  const liste = [];
  for (const t of [bereinigt, ohneZusatz, ohneEdition]) {
    if (!t || t.length < 2) continue;
    liste.push(t);
    // Zahl ↔ römische Zahl (nur ganze Wörter, z. B. „Creed 4:“ → „Creed IV:“)
    const roemisch = t.replace(/\b(1[0-3]|[2-9])\b/g, (z) => ROEMISCH[z]);
    const arabisch = t.replace(/\b(XIII|XII|XI|IX|VIII|VII|VI|IV|V|III|II|X)\b/g, (z) => ARABISCH[z]);
    liste.push(roemisch, arabisch);
    // Ohne Doppelpunkt („Creed IV: Black Flag“ heißt bei IGDB „Creed IV Black Flag“)
    if (t.includes(':')) liste.push(roemisch.replace(/\s*:\s*/g, ' '));
  }
  return [...new Set(liste.map((t) => t.replace(/\s{2,}/g, ' ').trim()).filter((t) => t.length >= 2))].slice(0, max);
}

/** Plattform-Begriff im Produktnamen (z. B. „Ps3“) – zum Vorsortieren der Treffer. */
export function plattformImNamen(produktname) {
  const m = String(produktname ?? '').match(plattformRegex);
  return m ? m[0].trim() : null;
}
