// Administration → Übersicht: installierter Stand und „Jetzt aktualisieren“ (über Watchtower, siehe README).
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const zeit = (iso) => (iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : null);
const standText = (b) => (b?.commit ? `Stand ${b.commit}${b.datum ? ` vom ${zeit(b.datum)}` : ''}` : 'ohne Docker-Image (selbst gebaut)');
const gleich = (a, b) => (a?.commit ?? null) === (b?.commit ?? null) && (a?.datum ?? null) === (b?.datum ?? null);
const datumKurz = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { dateStyle: 'medium' }) : null);

/** Liste von Versionshinweisen (Einträge aus NEUERUNGEN.md). */
function Neuerungen({ eintraege }) {
  return (
    <ul className="space-y-2">
      {eintraege.map((e) => (
        <li key={e.id}>
          <p className="font-medium">{e.titel}{e.datum && <span className="font-normal text-leise"> · {datumKurz(e.datum)}</span>}</p>
          {e.punkte.length > 0 && <ul className="list-disc pl-5 text-leise">{e.punkte.map((p) => <li key={p}>{p}</li>)}</ul>}
        </li>
      ))}
    </ul>
  );
}

export default function AdminUpdate() {
  const [d, setD] = useState(null);
  // null | 'laeuft' | 'neustart' | 'fertig' | 'aktuell' | 'fehler'
  const [phase, setPhase] = useState(null);
  const [meldung, setMeldung] = useState('');
  const [prueft, setPrueft] = useState(false);
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

  const jetztPruefen = async () => {
    setPrueft(true);
    try { setD(await api.adminAktualisierung(true)); } catch { /* bleibt beim alten Stand */ } finally { setPrueft(false); }
  };

  const beschaeftigt = phase === 'laeuft' || phase === 'neustart';
  const p = d.pruefung;
  return (
    <section className="karte space-y-2 p-4 text-sm">
      <h2 className="font-semibold">Update</h2>
      <p>Installiert: <strong>{standText(d.build)}</strong></p>
      {p && (
        <div className={`rounded-lg border p-2 ${p.neu ? 'border-akzent/60 bg-akzent/10' : 'border-rand'}`} role="status">
          {p.fehler ? <p className="text-warnung">Update-Prüfung nicht möglich: {p.fehler}</p>
            : p.neu ? (
              <>
                <p>🆕 <strong>Neue Version verfügbar:</strong> Stand {p.verfuegbar.commit} vom {zeit(p.verfuegbar.datum)}
                  <span className="block text-xs text-leise">
                    Installiert: {standText(d.build)}{p.aenderungen ? ` · ${p.aenderungen} Änderungen im Quellcode seitdem` : ''}
                  </span></p>
                {p.neuerungen?.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="font-semibold">Das ist neu gegenüber deiner Version:</p>
                    <Neuerungen eintraege={p.neuerungen} />
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-leise">
                    Keine Versionshinweise gefunden – vermutlich Fehlerbehebungen und Verbesserungen im Hintergrund
                    {p.verfuegbar.titel ? ` (zuletzt: „${p.verfuegbar.titel}“)` : ''}.
                  </p>
                )}
              </>
            ) : d.build?.commit ? <p className="text-erfolg">✓ Aktuell – das ist der neueste Stand.</p>
              : <p className="text-leise">Neuester Stand: {p.verfuegbar.commit} vom {zeit(p.verfuegbar.datum)} (installierter Stand unbekannt).</p>}
          <p className="text-xs text-leise">
            Geprüft {zeit(p.geprueft)} bei GitHub ({p.repo}) ·{' '}
            <button type="button" className="underline" disabled={prueft} onClick={jetztPruefen}>{prueft ? 'prüft …' : 'jetzt prüfen'}</button>
          </p>
        </div>
      )}
      {d.neuerungen?.length > 0 && (
        <details className="rounded-lg border border-rand p-2">
          <summary className="cursor-pointer">Versionshinweise deines installierten Stands</summary>
          <div className="mt-2"><Neuerungen eintraege={d.neuerungen} /></div>
        </details>
      )}
      <MessanzeigeSchalter />
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

/** Fehlersuche auf dem Handy: Maße der Ansicht einblenden (z. B. wenn die Fußleiste verrutscht) – nur auf diesem Gerät. */
function MessanzeigeSchalter() {
  let an = false;
  try { an = localStorage.getItem('ansicht-messen') === '1'; } catch { /* gesperrt */ }
  const umschalten = () => {
    try {
      if (an) localStorage.removeItem('ansicht-messen');
      else localStorage.setItem('ansicht-messen', '1');
    } catch { return; }
    window.location.reload();
  };
  return (
    <p className="text-xs text-leise">
      <button type="button" className="underline" onClick={umschalten}>
        {an ? 'Messanzeige ausblenden' : 'Messanzeige für die Bildschirmmaße einblenden'}
      </button>{' '}
      (Fehlersuche, nur auf diesem Gerät)
    </p>
  );
}
