// Erinnerung an fehlende Zustandsbewertungen: Sammler bekommen höchstens einmal pro Woche eine Mitteilung, und nur,
// wenn seit der letzten Erinnerung weitere Exemplare ohne Zustand dazugekommen sind (nicht nerven). Wer „Zustand der
// Hülle / OVP“ im Konto ausgeblendet hat, wird dazu nicht erinnert. Abschaltbar über die Kategorie „Sammlungspflege“.
import { leseAusgeblendeteFelder } from '../../shared/konstanten.js';

const WOCHE = 7 * 24 * 60 * 60 * 1000;

/** SQL-Bedingung „Zustand fehlt“ (Alias a); `mitOvp`: auch die Hülle/OVP zählt, wo sie abgefragt wird. */
export const zustandFehltSql = (mitOvp = true) => `(a.zustand IS NULL${mitOvp
  ? " OR (a.zustand_ovp IS NULL AND COALESCE(a.vollstaendigkeit, '') <> 'nur_geraet')" : ''})`;

export function erstelleZustandserinnerung(db, { benachrichtigungen }) {
  const kandidaten = db.prepare(`SELECT id, ausgeblendete_felder, zustand_erinnerung FROM benutzer
    WHERE gesperrt = 0 AND EXISTS (SELECT 1 FROM artikel a WHERE a.benutzer_id = benutzer.id AND a.bestand = 'besitz')`);
  const merken = db.prepare('UPDATE benutzer SET zustand_erinnerung = ? WHERE id = ?');

  /** Anzahl eigener Exemplare (im Besitz, nicht digital) ohne Zustandsbewertung. */
  function fehlend(benutzerId, mitOvp) {
    return db.prepare(`SELECT COUNT(*) FROM artikel a WHERE a.benutzer_id = ? AND a.bestand = 'besitz' AND ${zustandFehltSql(mitOvp)}`)
      .pluck().get(benutzerId);
  }

  function erinnere({ jetzt = Date.now() } = {}) {
    let gesendet = 0;
    for (const b of kandidaten.all()) {
      let stand = {};
      try { stand = JSON.parse(b.zustand_erinnerung || '{}') ?? {}; } catch { /* neu anfangen */ }
      if (stand.zeit && jetzt - stand.zeit < WOCHE) continue;
      const mitOvp = !leseAusgeblendeteFelder(b.ausgeblendete_felder).includes('zustand_ovp');
      const n = fehlend(b.id, mitOvp);
      // Nur, wenn es mehr geworden sind als bei der letzten Erinnerung (weniger = der Sammler ist dran)
      if (n > (stand.anzahl ?? 0)) {
        benachrichtigungen.sende(b.id, {
          art: 'sammlung',
          titel: n === 1 ? '1 Exemplar ohne Zustandsbewertung' : `${n} Exemplare ohne Zustandsbewertung`,
          text: `Mit Zustand ${mitOvp ? '(Disc/Modul bzw. Gerät und Hülle/OVP) ' : ''}wird der Wert deiner Sammlung genauer. Die Bewertungshilfe im Formular erklärt die Stufen.`,
          link: '#/?einzeln=1&zustand_fehlt=1',
        });
        gesendet += 1;
      }
      merken.run(JSON.stringify({ zeit: jetzt, anzahl: n }), b.id);
    }
    return gesendet;
  }

  return { erinnere, fehlend };
}
