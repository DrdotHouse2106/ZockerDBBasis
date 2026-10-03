// Sprachen eines Spiels: Sprachausgabe, Untertitel und Menü/Texte je Sprache (laut IGDB, je Spiel – nicht je Fassung).
// Gespeichert als JSON am Katalogeintrag, z. B. {"de":["audio","untertitel","menue"],"en":["audio"]}.
// Von Sammlern belegt (je Fassung) zusätzlich „…_download“: nur per Sprachpaket aus dem Store nachladbar, nicht auf der Disc.

export const SPRACH_ARTEN = [
  ['audio', 'Sprachausgabe'],
  ['untertitel', 'Untertitel'],
  ['menue', 'Menü/Texte'],
];
const GRUNDARTEN = SPRACH_ARTEN.map(([a]) => a);
const ARTEN = [...GRUNDARTEN, ...GRUNDARTEN.map((a) => `${a}_download`)];
/** „audio_download“ → „Sprachausgabe (⬇ Download)“ */
export const artName = (art) => {
  const grund = String(art).replace(/_download$/, '');
  const name = Object.fromEntries(SPRACH_ARTEN)[grund] ?? grund;
  return art.endsWith('_download') ? `${name} (⬇ Download)` : name;
};
export const istDownload = (art) => String(art).endsWith('_download');
/** Kurz für Listen: „audio_download“ → „Sprachausgabe ⬇“ */
export const artKurz = (art) => `${Object.fromEntries(SPRACH_ARTEN)[String(art).replace(/_download$/, '')] ?? art}${istDownload(art) ? ' ⬇' : ''}`;

export const SPRACHNAMEN = {
  de: 'Deutsch', en: 'Englisch', fr: 'Französisch', es: 'Spanisch', it: 'Italienisch', nl: 'Niederländisch', pt: 'Portugiesisch',
  pl: 'Polnisch', cs: 'Tschechisch', sk: 'Slowakisch', hu: 'Ungarisch', ro: 'Rumänisch', bg: 'Bulgarisch', el: 'Griechisch',
  da: 'Dänisch', sv: 'Schwedisch', no: 'Norwegisch', nb: 'Norwegisch', fi: 'Finnisch', is: 'Isländisch', ru: 'Russisch', uk: 'Ukrainisch',
  tr: 'Türkisch', ar: 'Arabisch', he: 'Hebräisch', ja: 'Japanisch', ko: 'Koreanisch', zh: 'Chinesisch', th: 'Thai', vi: 'Vietnamesisch',
  id: 'Indonesisch', hi: 'Hindi', hr: 'Kroatisch', sr: 'Serbisch', sl: 'Slowenisch', et: 'Estnisch', lv: 'Lettisch', lt: 'Litauisch',
};
export const sprachName = (code) => SPRACHNAMEN[code] ?? String(code).toUpperCase();

// Filter in Katalog und Sammlung: „de_audio“ = deutsche Sprachausgabe, „de_text“ = deutsche Untertitel oder Menüs, „de“ = irgendetwas auf Deutsch
export const SPRACH_FILTER = [
  ['de_audio', 'Deutsche Sprachausgabe'],
  ['de_text', 'Deutsche Texte/Untertitel'],
  ['de', 'Irgendetwas auf Deutsch'],
];

/** IGDB-Typ → unsere Art (Name hat Vorrang, sonst die bekannten IDs 1 Audio, 2 Subtitles, 3 Interface). */
function igdbArt(typ) {
  const name = typeof typ === 'object' && typ ? typ.name : null;
  const id = typeof typ === 'object' && typ ? typ.id : typ;
  if (name) {
    if (/audio|voice/i.test(name)) return 'audio';
    if (/subtitle/i.test(name)) return 'untertitel';
    if (/interface|text|menu/i.test(name)) return 'menue';
    return null;
  }
  return { 1: 'audio', 2: 'untertitel', 3: 'menue' }[Number(id)] ?? null;
}

/** IGDB „language_supports“ → {de: ['audio', …]} oder null. */
export function igdbSprachen(liste) {
  if (!Array.isArray(liste) || !liste.length) return null;
  const ergebnis = {};
  for (const eintrag of liste) {
    const code = String(eintrag?.language?.locale ?? '').slice(0, 2).toLowerCase();
    const art = igdbArt(eintrag?.language_support_type);
    if (!/^[a-z]{2}$/.test(code) || !art) continue;
    (ergebnis[code] ??= new Set()).add(art);
  }
  return normSprachen(ergebnis);
}

/** Prüft und vereinheitlicht Sprachangaben (JSON-Text, Objekt oder Sets) – Ergebnis sortiert, leer → null. */
export function normSprachen(wert) {
  let obj = wert;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { return null; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const ergebnis = {};
  for (const code of Object.keys(obj).sort()) {
    if (!/^[a-z]{2}$/.test(code)) continue;
    const roh = new Set(obj[code] ?? []);
    // Auf der Disc schlägt „per Download“
    const arten = [...roh].filter((a) => ARTEN.includes(a) && !(istDownload(a) && roh.has(a.replace(/_download$/, ''))))
      .sort((a, b) => ARTEN.indexOf(a) - ARTEN.indexOf(b));
    if (arten.length) ergebnis[code] = arten;
  }
  return Object.keys(ergebnis).length ? ergebnis : null;
}

/** Für die Anzeige: Deutsch und Englisch zuerst, dann alphabetisch nach Namen. */
export function sprachListe(wert) {
  const s = normSprachen(wert);
  if (!s) return [];
  const rang = (c) => ({ de: 0, en: 1 })[c] ?? 2;
  return Object.entries(s)
    .map(([code, arten]) => ({ code, name: sprachName(code), arten }))
    .sort((a, b) => rang(a.code) - rang(b.code) || a.name.localeCompare(b.name, 'de'));
}

/**
 * SQL-Bedingung für einen Sprachfilter auf die Spalte `spalte` (z. B. „k.sprachen“). Ungültige Werte → null.
 * Nur geprüfte Kürzel landen im SQL-Text.
 */
export function sprachBedingung(filter, spalte = 'k.sprachen') {
  const m = /^([a-z]{2})(?:_(audio|text))?$/.exec(String(filter ?? ''));
  if (!m || !/^[a-z]\.[a-z_]+$|^[a-z_]+$/.test(spalte)) return null;
  const [, code, art] = m;
  const arten = art === 'audio' ? ["'audio'"] : art === 'text' ? ["'untertitel'", "'menue'"] : ["'audio'", "'untertitel'", "'menue'"];
  return `EXISTS (SELECT 1 FROM json_each(${spalte}, '$.${code}') WHERE value IN (${arten.join(', ')}))`;
}

/** Dieselbe Prüfung wie `sprachBedingung`, für Listen ohne Server (Offlinemodus). */
export function spracheTrifft(sprachen, filter) {
  const m = /^([a-z]{2})(?:_(audio|text))?$/.exec(String(filter ?? ''));
  if (!m) return true;
  const arten = normSprachen(sprachen)?.[m[1]] ?? [];
  // Wie im SQL-Filter zählt nur, was auf der Disc ist (nicht per Download)
  return m[2] === 'audio' ? arten.includes('audio') : m[2] === 'text' ? arten.some((a) => a === 'untertitel' || a === 'menue')
    : arten.some((a) => !istDownload(a));
}

/** Kurzangabe fürs Exemplar: „Deutsch: Sprachausgabe, Untertitel“ – null, wenn keine Sprachen bekannt sind. */
export function deutschKurz(sprachen) {
  const s = normSprachen(sprachen);
  if (!s) return null;
  if (!s.de) return 'Kein Deutsch (laut IGDB)';
  return `Deutsch: ${s.de.map(artName).join(', ')}`;
}
