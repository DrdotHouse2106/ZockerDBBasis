// Administration → Übersicht: installierter Stand und „Jetzt aktualisieren“ (über Watchtower, siehe README).
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const zeit = (iso) => (iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : null);
const standText = (b) => (b?.commit ? `Stand ${b.commit}${b.datum ? ` vom ${zeit(b.datum)}` : ''}` : 'ohne Docker-Image (selbst gebaut)');
const gleich = (a, b) => (a?.commit ?? null) === (b?.commit ?? null) && (a?.datum ?? null) === (b?.datum ?? null);

export default function AdminUpdate() {
  const [d, setD] = useState(null);
  // null | 'laeuft' | 'neustart' | 'fertig' | 'aktuell' | 'fehler'
  const [phase, setPhase] = useState(null);
  const [meldung, setMeldung] = useState('');
  const abbruch = useRef(null);

  useEffect(() => {
    api.adminAktualisierung().then(setD).catch(() => {});
    return () => clearTimeout(abbruch.current);
  }, []);

  if (!d) return null;

  /** Fragt alle 3 Sekunden nach: fertig, wenn der Server neu gestartet ist oder Watchtower „nichts zu tun“ meldet. */
  const beobachte = (vorher, start) => {
    abbruch.current = setTimeout(async () => {
      if (Date.now() - start > 10 * 60 * 1000) {
        setPhase('fehler');
        setMeldung('Nach 10 Minuten ist noch kein neuer Stand da. Bitte das Protokoll von Watchtower prüfen (docker logs watchtower).');
        return;
      }
      try {
        const neu = await api.adminAktualisierung();
        // Anderer Stand oder kein laufender Versuch mehr (= der Server wurde neu gestartet)
        if (!gleich(neu.build, vorher.build) || !neu.lauf) {
          setD(neu);
          setPhase('fertig');
          setMeldung(`Aktualisiert – ${standText(neu.build)}. Die Seite lädt gleich neu …`);
          setTimeout(() => window.location.reload(), 2500);
          return;
        }
        if (neu.lauf?.zustand === 'aktuell') {
          setPhase('aktuell');
          setMeldung('Es gibt keine neuere Version – du hast bereits den neuesten Stand.');
          return;
        }
        if (neu.lauf?.zustand === 'fehler') {
          setPhase('fehler');
          setMeldung(neu.lauf.fehler);
          return;
        }
      } catch {
        // Server gerade nicht erreichbar: Der Container wird neu gestartet
        setPhase('neustart');
      }
      beobachte(vorher, start);
    }, 3000);
  };

  const starten = async () => {
    if (!window.confirm('Jetzt nach einer neuen Version suchen und installieren?\n\nVorher wird die Datenbank gesichert. Gibt es ein Update, ist ZockerDB etwa eine Minute nicht erreichbar.')) return;
    setMeldung('');
    try {
      const antwort = await api.adminAktualisieren();
      setPhase('laeuft');
      beobachte(antwort, Date.now());
    } catch (e) {
      setPhase('fehler');
      setMeldung(e.message);
    }
  };

  const beschaeftigt = phase === 'laeuft' || phase === 'neustart';
  return (
    <section className="karte space-y-2 p-4 text-sm">
      <h2 className="font-semibold">Update</h2>
      <p>Installiert: <strong>{standText(d.build)}</strong></p>
      {d.eingerichtet ? (
        <>
          <button type="button" className="knopf-primaer px-3 py-1.5" disabled={beschaeftigt} onClick={starten}>
            {beschaeftigt ? 'Update läuft …' : 'Jetzt aktualisieren'}
          </button>
          {phase === 'laeuft' && <p className="text-leise" role="status">Sicherung erstellt, Watchtower sucht nach einer neuen Version …</p>}
          {phase === 'neustart' && <p className="text-leise" role="status">Neue Version wird installiert, ZockerDB startet neu …</p>}
          {meldung && <p className={phase === 'fehler' ? 'text-gefahr' : 'text-erfolg'} role="status">{meldung}</p>}
        </>
      ) : (
        <div className="space-y-1 text-leise">
          <p>
            Update per Knopf ist nicht eingerichtet. Mit einem Watchtower-Container geht es ohne Kommandozeile –
            Anleitung im README unter „Update per Knopf“.
          </p>
          <p>Bis dahin von Hand per SSH – mit docker-compose:</p>
          <code className="block overflow-x-auto rounded bg-flaeche p-2 text-xs whitespace-pre">docker compose pull && docker compose up -d</code>
          <p>Einzelner Container (z. B. Plesk, Portainer) – lädt das neue Image und übernimmt alle Einstellungen:</p>
          <code className="block overflow-x-auto rounded bg-flaeche p-2 text-xs whitespace-pre">{'docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \\\n  -v /root/.docker/config.json:/config.json:ro \\\n  nickfedor/watchtower --run-once --cleanup zockerdb'}</code>
        </div>
      )}
    </section>
  );
}
