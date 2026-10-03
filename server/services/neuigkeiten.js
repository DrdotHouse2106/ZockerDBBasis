// „Neu seit deinem letzten Besuch“: die Versionshinweise (NEUERUNGEN.md des Kerns und der Zusatzmodule), die ein
// Sammler noch nicht gesehen hat – nur Einträge für seine Rolle (siehe „<!-- für: … -->“ in leseNeuerungen).
import fs from 'node:fs';
import { leseNeuerungen } from './aktualisierung.js';
import { istModerator } from '../../shared/konstanten.js';

const TAG = 24 * 60 * 60 * 1000;
const ZEITRAUM_TAGE = 90; // ältere Einträge werden nie mehr nachgereicht
const OHNE_STAND_TAGE = 14; // Konten von vor dieser Funktion: nur die letzten zwei Wochen
const HOECHSTENS = 15;

const tag = (ms) => new Date(ms).toISOString().slice(0, 10);

export function erstelleNeuigkeitenDienst(db, { quellen = [], jetzt = () => Date.now() } = {}) {
  let alle = null;
  // Einmal lesen – die Dateien ändern sich nur mit einem neuen Stand (Neustart)
  function eintraege() {
    if (alle) return alle;
    alle = quellen.flatMap((q, nr) => {
      let text = '';
      try { text = fs.readFileSync(q.datei, 'utf8'); } catch { /* Modul ohne Hinweise */ }
      return leseNeuerungen(text).filter((e) => e.datum).map((e, reihenfolge) => ({ ...e, quelle: nr, reihenfolge }));
    });
    // Neueste zuerst; am selben Tag Kern vor Modul und die Reihenfolge der Datei
    alle.sort((a, b) => b.datum.localeCompare(a.datum) || a.quelle - b.quelle || a.reihenfolge - b.reihenfolge);
    return alle;
  }
  const fuerRolle = (b, e) => !e.fuer || b.rolle === 'admin' || (e.fuer === 'moderation' && istModerator(b));
  function gesehen(b) {
    try {
      const liste = JSON.parse(b.neuigkeiten_gesehen ?? 'null');
      return Array.isArray(liste) ? new Set(liste) : null;
    } catch { return null; }
  }

  /** Noch nicht gesehene Einträge (neueste zuerst). */
  function offen(b) {
    if (!b) return [];
    const schon = gesehen(b);
    let ab = tag(jetzt() - (schon ? ZEITRAUM_TAGE : OHNE_STAND_TAGE) * TAG);
    // Ohne Stand: nichts von vor der Registrierung (neue Konten bekommen keinen Rückblick)
    if (!schon && b.erstellt_am) {
      const erstellt = String(b.erstellt_am).slice(0, 10);
      if (erstellt >= ab) ab = `${erstellt}~`; // „~“ sortiert nach jeder Ziffer: nur Einträge nach dem Registrierungstag
    }
    const heute = tag(jetzt());
    return eintraege().filter((e) => e.datum >= ab && e.datum <= heute && fuerRolle(b, e) && !schon?.has(e.id)).slice(0, HOECHSTENS)
      .map(({ id, datum, titel, punkte }) => ({ id, datum, titel, punkte }));
  }

  /** Alles bis jetzt als gesehen merken (nur Kennungen der letzten Monate – die Liste bleibt klein). */
  function gelesen(benutzerId) {
    const ab = tag(jetzt() - (ZEITRAUM_TAGE + 30) * TAG);
    const ids = eintraege().filter((e) => e.datum >= ab).map((e) => e.id);
    db.prepare('UPDATE benutzer SET neuigkeiten_gesehen = ? WHERE id = ?').run(JSON.stringify(ids), benutzerId);
  }

  return { offen, gelesen };
}
