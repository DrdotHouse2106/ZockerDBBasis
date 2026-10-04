// Fehlertolerante Titelsuche: Wörter in beliebiger Reihenfolge, Apostrophe und Satzzeichen egal, Mehrzahl-„s“ egal,
// römische Zahlen wie Ziffern („Assassins Black Flag“ findet „Assassin's Creed IV Black Flag“, „Final Fantasy 7“ auch „VII“).
// Ohne Prototyp: Suchwörter wie „constructor“ dürfen keine geerbten Eigenschaften treffen
const ROEMISCH = { __proto__: null, ii: '2', iii: '3', iv: '4', vi: '6', vii: '7', viii: '8', ix: '9' };
const ZIFFERN = { __proto__: null, ...Object.fromEntries(Object.entries(ROEMISCH).map(([r, z]) => [z, r])) };

/** Suchtext → Wörter (klein, ohne Apostrophe und Satzzeichen), höchstens 8. */
export function suchWoerter(text) {
  return String(text ?? '').toLowerCase().replace(/['’`´]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().split(' ').filter(Boolean).slice(0, 8);
}

/** Je Wort die Varianten, von denen eine im Titel vorkommen muss (`grenze`: nur als ganzes Wort). */
export function wortVarianten(wort) {
  if (ROEMISCH[wort] || ZIFFERN[wort]) return { grenze: true, varianten: [wort, ROEMISCH[wort] ?? ZIFFERN[wort]] };
  // „assassins“ findet auch „Assassin's“, „zeldas“ auch „Zelda“
  return { grenze: false, varianten: [wort.length > 4 && wort.endsWith('s') ? wort.slice(0, -1) : wort] };
}

/** SQL-Ausdruck: Spalte klein, ohne Apostrophe, Satzzeichen als Leerzeichen, mit Leerzeichen an beiden Enden. */
export function normSql(spalte) {
  let ausdruck = `lower(COALESCE(${spalte}, ''))`;
  for (const z of ["''", '’', '`', '´']) ausdruck = `replace(${ausdruck}, '${z}', '')`;
  for (const z of [':', '-', '.', ',', '!', '?', '&', '/', '(', ')', '+', '–']) ausdruck = `replace(${ausdruck}, '${z}', ' ')`;
  return `(' ' || ${ausdruck} || ' ')`;
}

const escape = (t) => t.replace(/[\\%_]/g, (z) => `\\${z}`);

/**
 * WHERE-Bedingung für alle Wörter (jedes muss in einer der Spalten vorkommen) samt Parametern.
 * `praefix` trennt Parameternamen, wenn mehrere solcher Bedingungen in einer Abfrage stehen.
 */
export function woerterBedingung(woerter, spalten, praefix = 'w') {
  const parameter = {};
  const teile = woerter.map((wort, i) => {
    const { grenze, varianten } = wortVarianten(wort);
    const oder = [];
    varianten.forEach((v, j) => {
      const name = `${praefix}${i}_${j}`;
      parameter[name] = grenze ? `% ${escape(v)} %` : `%${escape(v)}%`;
      for (const s of spalten) oder.push(`${normSql(s)} LIKE @${name} ESCAPE '\\'`);
    });
    return `(${oder.join(' OR ')})`;
  });
  return { sql: teile.length ? teile.join(' AND ') : '1', parameter };
}
