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

/**
 * Kuratiert: nur Termine der `anzahl` gefragtesten Titel („beliebtheit“: Vorfreude bei IGDB + Wunschlisten), Reihenfolge bleibt.
 * Titel ohne Nachfrage fallen weg – außer `immer(t)` (z. B. eigene Wunschliste). Hat kein Termin Nachfragewerte
 * (ältere Datenquelle), bleibt die Liste unverändert.
 */
export function hoechsteNachfrage(termine, anzahl, { immer = () => false } = {}) {
  const punkte = new Map();
  for (const t of termine) punkte.set(t.katalog.id, Math.max(punkte.get(t.katalog.id) ?? 0, t.beliebtheit ?? 0));
  const bewertet = [...punkte].filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]);
  if (!bewertet.length) return [...termine];
  const auswahl = new Set(bewertet.slice(0, anzahl).map(([id]) => id));
  return termine.filter((t) => auswahl.has(t.katalog.id) || immer(t));
}
