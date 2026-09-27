// Andockpunkte für Zusatzmodule.
//
// Der Kern ruft an festen Stellen alle Funktionen auf, die ein Modul unter einem Namen registriert hat
// (z. B. „katalog.seite“, „konto.loeschen“, „benutzer.geaendert“ nach Änderungen an Sammlung oder Konto). Ohne Modul passiert dort nichts. Die Namen und ihre Parameter
// stehen jeweils an der Stelle im Kern, an der sie aufgerufen werden.
export function erstelleErweiterungen() {
  const haken = new Map();
  const alle = (name) => haken.get(name) ?? [];

  return {
    /** Registriert eine Funktion für einen Andockpunkt. */
    an(name, fn) {
      if (!haken.has(name)) haken.set(name, []);
      haken.get(name).push(fn);
    },
    alle,
    /** Ruft alle Funktionen auf und führt die zurückgegebenen Objekte zusammen. */
    sammle(name, ...args) {
      return Object.assign({}, ...alle(name).map((fn) => fn(...args) ?? {}));
    },
    /** Benachrichtigt alle Funktionen, ohne auf ein Ergebnis zu warten (z. B. „neue Einreichung“). */
    melde(name, ...args) {
      for (const fn of alle(name)) {
        try {
          const ergebnis = fn(...args);
          ergebnis?.catch?.((e) => console.warn(`[${name}]`, e.message));
        } catch (e) {
          console.warn(`[${name}]`, e.message);
        }
      }
    },
    /** Ruft alle Funktionen nacheinander auf (auch asynchrone) – z. B. vor dem Löschen eines Kontos. */
    async fuehreAus(name, ...args) {
      for (const fn of alle(name)) await fn(...args);
    },
    /** Summe der Rückgaben (z. B. zusätzlich belegter Speicher in Bytes). */
    summe(name, ...args) {
      return alle(name).reduce((summe, fn) => summe + (Number(fn(...args)) || 0), 0);
    },
    /** true, sobald eine Funktion true liefert (z. B. „darf diese Datei sehen“). */
    irgendeine(name, ...args) {
      return alle(name).some((fn) => fn(...args) === true);
    },
  };
}
