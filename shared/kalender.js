// Releasekalender: gemeinsame Hilfen für App und Server.

/**
 * Termine desselben Spiels am selben Tag zu einer Kachel zusammenfassen (erscheint oft für mehrere Plattformen gleichzeitig).
 * Ergebnis: ein Termin mit `plattformen` (Kurznamen) statt je Plattform ein Eintrag.
 */
export function zusammenfassen(termine) {
  const gruppen = new Map();
  for (const t of termine) {
    const schluessel = `${t.katalog.id}|${t.datum}`;
    const name = t.plattform_kurz || t.plattform;
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, { ...t, plattformen: [], regionen: new Set() });
    const g = gruppen.get(schluessel);
    if (name && !g.plattformen.includes(name)) g.plattformen.push(name);
    if (t.region) g.regionen.add(t.region);
  }
  return [...gruppen.values()].map(({ regionen, ...g }) => ({ ...g, region: regionen.size === 1 ? [...regionen][0] : null }));
}
