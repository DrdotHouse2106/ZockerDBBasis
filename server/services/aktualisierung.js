// Update per Knopf in der Administration: Die App bittet einen Watchtower-Container (HTTP-API) darum,
// das neueste Image zu laden und den ZockerDB-Container damit neu zu starten.
// Die App selbst bekommt keinen Zugriff auf Docker – den hat nur Watchtower. Vorher wird die Datenbank gesichert.
import { ValidierungsFehler } from './validierung.js';

/** Stand des laufenden Images (Build-Argumente aus dem Dockerfile, siehe CI). */
export function leseBuild(env = process.env) {
  const commit = /^[0-9a-f]{7,40}$/i.test(env.ZOCKERDB_BUILD ?? '') ? env.ZOCKERDB_BUILD.slice(0, 7) : null;
  const datum = Number.isNaN(Date.parse(env.ZOCKERDB_BUILD_DATE ?? '')) ? null : new Date(env.ZOCKERDB_BUILD_DATE).toISOString();
  return { commit, datum };
}

export function erstelleAktualisierung({ konfiguration, sicherung, build, fetchFn = fetch }) {
  const k = () => konfiguration.aktualisierung ?? {};
  // Zustand des letzten Versuchs; nach einem erfolgreichen Update startet der Server neu und der Zustand ist wieder leer
  let lauf = null;

  function status() {
    return { eingerichtet: Boolean(k().url && k().token), build, lauf };
  }

  async function starte() {
    if (!k().url || !k().token) {
      throw new ValidierungsFehler({ aktualisierung: 'Das Update per Knopf ist nicht eingerichtet (UPDATE_URL und UPDATE_TOKEN, siehe README).' });
    }
    if (lauf?.zustand === 'laeuft') return status();
    lauf = { zustand: 'laeuft', seit: new Date().toISOString() };
    // Sicherheitshalber vorher eine frische Sicherung der Datenbank
    await sicherung.lauf({ erzwingen: true }).catch(() => null);
    const gestartet = lauf.seit;
    const ende = (werte) => { if (lauf?.seit === gestartet) lauf = { ...lauf, ...werte, beendet: new Date().toISOString() }; };

    // Watchtower antwortet erst, wenn es fertig ist. Gibt es ein neues Image, beendet es vorher diesen
    // Container – dann kommt keine Antwort mehr an. Kommt eine Antwort, war nichts zu tun.
    fetchFn(k().url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${k().token}` },
      signal: AbortSignal.timeout(15 * 60 * 1000),
    }).then((r) => {
      if (r.status === 401 || r.status === 403) ende({ zustand: 'fehler', fehler: 'Watchtower hat den Token abgelehnt – UPDATE_TOKEN prüfen.' });
      else if (!r.ok) ende({ zustand: 'fehler', fehler: `Watchtower meldet einen Fehler (HTTP ${r.status}).` });
      else ende({ zustand: 'aktuell' });
    }).catch((fehler) => {
      const ursache = fehler.cause?.code ?? fehler.code ?? fehler.name;
      // Verbindung abgerissen: Watchtower beendet gerade diesen Container für das Update
      if (['ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE'].includes(ursache)) return ende({ zustand: 'neustart' });
      const text = ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT', 'EAI_AGAIN'].includes(ursache)
        ? `Watchtower ist unter ${k().url} nicht erreichbar (${ursache}).`
        : `Update fehlgeschlagen: ${fehler.message}`;
      ende({ zustand: 'fehler', fehler: text });
    });
    return status();
  }

  return { status, starte };
}
