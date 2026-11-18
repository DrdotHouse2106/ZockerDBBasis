// Einfache Begrenzung von Fehlversuchen (z. B. Anmeldung, 2FA-Codes) im Arbeitsspeicher.
const MAX_EINTRAEGE = 100_000; // Obergrenze gegen Speicherfraß durch sehr viele Schlüssel (z. B. IPv6-Adressen) in einem Fenster

export function erstelleDrossel({ maxVersuche = 10, fensterMs = 15 * 60 * 1000 } = {}) {
  const eintraege = new Map();

  function aufraeumen(jetzt) {
    if (eintraege.size < 5000) return;
    for (const [k, e] of eintraege) if (e.bis < jetzt) eintraege.delete(k);
    // Immer noch zu viele: die ältesten Einträge verdrängen (Map behält die Einfügereihenfolge)
    while (eintraege.size >= MAX_EINTRAEGE) eintraege.delete(eintraege.keys().next().value);
  }

  return {
    /** true, wenn für diesen Schlüssel gerade keine weiteren Versuche erlaubt sind. */
    gesperrt(schluessel) {
      const e = eintraege.get(schluessel);
      return Boolean(e && e.bis > Date.now() && e.anzahl >= maxVersuche);
    },
    fehlschlag(schluessel) {
      const jetzt = Date.now();
      aufraeumen(jetzt);
      const e = eintraege.get(schluessel);
      if (!e || e.bis < jetzt) eintraege.set(schluessel, { anzahl: 1, bis: jetzt + fensterMs });
      else e.anzahl++;
    },
    zuruecksetzen(schluessel) {
      eintraege.delete(schluessel);
    },
  };
}
