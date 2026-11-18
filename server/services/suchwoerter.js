// Fehlertolerante Titelsuche: Wörter in beliebiger Reihenfolge, Apostrophe und Satzzeichen egal, Mehrzahl-„s“ egal,
// römische Zahlen wie Ziffern („Assassins Black Flag“ findet „Assassin's Creed IV Black Flag“, „Final Fantasy 7“ auch „VII“),
// zusammengeschriebene Buchstaben und Ziffern wie getrennte („FC25“ findet „EA Sports FC 25“).
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
  const grund = wort.length > 4 && wort.endsWith('s') ? wort.slice(0, -1) : wort;
  // Buchstaben und Ziffern zusammengeschrieben („fc25“, „ps5“): auch mit Leerzeichen dazwischen („EA Sports FC 25“)
  const getrennt = grund.replace(/(\p{L})(?=\p{N})|(\p{N})(?=\p{L})/gu, '$1$2 ');
  return { grenze: false, varianten: getrennt === grund ? [grund] : [grund, getrennt] };
}

/** SQL-Ausdruck: Spalte klein, ohne Apostrophe, Satzzeichen als Leerzeichen, mit Leerzeichen an beiden Enden. */
export function normSql(spalte) {
  let ausdruck = `lower(COALESCE(${spalte}, ''))`;
  for (const z of ["''", '’', '`', '´']) ausdruck = `replace(${ausdruck}, '${z}', '')`;
  for (const z of [':', '-', '.', ',', '!', '?', '&', '/', '(', ')', '+', '–', '"', '[', ']']) ausdruck = `replace(${ausdruck}, '${z}', ' ')`;
  return `(' ' || ${ausdruck} || ' ')`;
}

const escape = (t) => t.replace(/[\\%_]/g, (z) => `\\${z}`);

/**
 * WHERE-Bedingung für alle Wörter (jedes muss in einer der Spalten vorkommen) samt Parametern.
 * `praefix` trennt Parameternamen, wenn mehrere solcher Bedingungen in einer Abfrage stehen.
 * `normalisiert`: die Spalten sind schon wie normSql aufbereitet (z. B. katalog.suchtext) – deutlich schneller.
 */
export function woerterBedingung(woerter, spalten, praefix = 'w', { normalisiert = false } = {}) {
  const norm = (s) => (normalisiert ? s : normSql(s));
  const parameter = {};
  const teile = woerter.map((wort, i) => {
    const { grenze, varianten } = wortVarianten(wort);
    const oder = [];
    varianten.forEach((v, j) => {
      const name = `${praefix}${i}_${j}`;
      parameter[name] = grenze ? `% ${escape(v)} %` : `%${escape(v)}%`;
      for (const s of spalten) oder.push(`${norm(s)} LIKE @${name} ESCAPE '\\'`);
      // Zusammengeschrieben („watchdogs“ ↔ „Watch Dogs“): längere Wörter auch gegen den Titel ohne Leerzeichen
      if (!grenze && v.length >= 6) for (const s of spalten) oder.push(`replace(${norm(s)}, ' ', '') LIKE @${name} ESCAPE '\\'`);
    });
    return `(${oder.join(' OR ')})`;
  });
  return { sql: teile.length ? teile.join(' AND ') : '1', parameter };
}

/** Editierabstand mit Vertauschung benachbarter Buchstaben (Damerau, „Tetirs“ ↔ „Tetris“ = 1); Abbruch über `grenze`. */
export function abstand(a, b, grenze = 2) {
  if (Math.abs(a.length - b.length) > grenze) return grenze + 1;
  let vorvorher = null;
  let vorher = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const jetzt = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      jetzt[j] = Math.min(vorher[j] + 1, jetzt[j - 1] + 1, vorher[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (vorvorher && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) jetzt[j] = Math.min(jetzt[j], vorvorher[j - 2] + 1);
      if (jetzt[j] < min) min = jetzt[j];
    }
    if (min > grenze) return grenze + 1;
    vorvorher = vorher;
    vorher = jetzt;
  }
  return vorher[b.length];
}

/** Erlaubte Tippfehler je Wortlänge: bis 4 Zeichen keine, bis 7 einer, darüber zwei. */
export const erlaubteFehler = (wort) => (wort.length <= 4 ? 0 : wort.length <= 7 ? 1 : 2);

/**
 * Passt ein Titel unscharf zu den Suchwörtern? Jedes Wort muss als Teil eines Titelworts vorkommen oder sich mit wenigen
 * Tippfehlern von einem Titelwort unterscheiden. Liefert die Summe der Abstände (kleiner = besser) oder null.
 */
export function unscharfePassung(titel, woerter) {
  const einzeln = suchWoerter(titel).slice(0, 30);
  // Auch zwei Nachbarwörter zusammengezogen („Watch Dogs“ → „watchdogs“), falls zusammengeschrieben gesucht wird
  const teile = [...einzeln, ...einzeln.slice(1).map((w, i) => einzeln[i] + w)];
  let summe = 0;
  for (const w of woerter) {
    // Das Wort selbst und – wie bei der genauen Suche – ohne Mehrzahl-„s“; römische Zahlen bzw. Ziffern nur genau
    const varianten = [...new Set([w, ...wortVarianten(w).varianten])];
    const genau = wortVarianten(w).grenze || w.length <= 2;
    let best = null;
    for (const t of teile) {
      for (const v of varianten) {
        for (const tw of t.length > 4 && t.endsWith('s') ? [t, t.slice(0, -1)] : [t]) {
          // Erlaubte Fehler nach dem längeren der beiden Wörter („asasin“ ↔ „assassin“: 2)
          const grenze = genau ? 0 : erlaubteFehler(v.length >= tw.length ? v : tw);
          const d = (genau ? tw === v : tw.includes(v)) ? 0 : abstand(v, tw, grenze);
          if (d <= grenze && (best === null || d < best)) best = d;
        }
      }
    }
    if (best === null) return null;
    summe += best;
  }
  return summe;
}
