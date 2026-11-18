// „Freistellen nachholen“ (nur in der App mit nativem Freistellen): Das Handy arbeitet als Helfer-Gerät die Warteschlange ab.
// Datenschutz: Fotos anderer werden nie angezeigt und nicht gespeichert – nur im Arbeitsspeicher an das Plugin gegeben und nach
// dem Senden der Maske verworfen. Die Seite zeigt nur Zähler und Fortschritt.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { nativesFreistellen } from '../nativ.js';
import Layout from '../komponenten/Layout.jsx';
import Symbol from '../komponenten/Symbole.jsx';

const PAECKCHEN = 20;
const LEER = { erledigt: 0, nicht: 0, fehler: 0 };

export default function FreistellenNachholen({ route }) {
  const nativ = nativesFreistellen();
  const [laeuft, setLaeuft] = useState(false);
  const [zaehler, setZaehler] = useState(LEER);
  const [rest, setRest] = useState(undefined);
  const [meldung, setMeldung] = useState(null);
  const aktiv = useRef(false);

  // Beim Verlassen der Seite anhalten und den Bildschirm wieder ausgehen lassen
  useEffect(() => () => { aktiv.current = false; nativ?.bildschirmAn(false); }, []);

  const zaehle = (feld) => setZaehler((z) => ({ ...z, [feld]: z[feld] + 1 }));

  async function bearbeite(auftrag) {
    let bild = await api.freistellenBild(auftrag.id);
    let maske;
    try {
      maske = await nativ.maske(bild);
    } finally {
      bild = null; // nur im Arbeitsspeicher, sofort verwerfen
    }
    if (!maske) {
      await api.freistellenFehler(auftrag.id);
      return zaehle('nicht');
    }
    try {
      await api.freistellenMaske(auftrag.id, maske);
      zaehle('erledigt');
    } catch (e) {
      if (e.status === 400 && e.felder?.maske) {
        await api.freistellenFehler(auftrag.id);
        return zaehle('nicht');
      }
      throw e;
    }
  }

  async function starten() {
    aktiv.current = true;
    setLaeuft(true);
    setMeldung(null);
    nativ.bildschirmAn(true);
    try {
      while (aktiv.current) {
        const paeckchen = await api.freistellenNaechste(PAECKCHEN);
        setRest(paeckchen.rest);
        if (!paeckchen.auftraege?.length) {
          setMeldung(paeckchen.rest === 0 ? 'Tageslimit erreicht – morgen geht es weiter.' : 'Alles erledigt – gerade gibt es nichts freizustellen.');
          break;
        }
        for (const auftrag of paeckchen.auftraege) {
          if (!aktiv.current) break;
          try {
            await bearbeite(auftrag);
          } catch (e) {
            if (e.status === 403) throw e;
            zaehle('fehler'); // z. B. 409: Reservierung abgelaufen – der Auftrag geht an ein anderes Gerät
            if (e.status === 0) throw e;
          }
        }
        if (paeckchen.rest === 0) {
          setMeldung('Tageslimit erreicht – morgen geht es weiter.');
          break;
        }
      }
    } catch (e) {
      setMeldung(e.status === 403 ? 'Dieses Konto darf (nicht mehr) beim Freistellen helfen.' : e.message);
    } finally {
      aktiv.current = false;
      setLaeuft(false);
      nativ.bildschirmAn(false);
    }
  }

  return (
    <Layout route={route} titel="Freistellen nachholen" zurueck="/konto">
      <div className="mx-auto max-w-xl space-y-3 pb-8">
        {!nativ ? (
          <p className="karte p-4 text-leise">Freistellen geht nur in der ZockerDB-App auf iPhone oder iPad ab iOS 17.</p>
        ) : (
          <section className="karte space-y-3 p-4" data-testid="freistellen-nachholen">
            <p className="text-sm text-leise">
              Dein Handy entfernt den Hintergrund von Fotos aus der Warteschlange. Die Fotos werden dabei nicht angezeigt und nicht auf dem Gerät gespeichert.
              Am besten am Ladegerät – der Bildschirm bleibt an, solange diese Seite arbeitet.
            </p>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div><dt className="text-xs text-leise">Freigestellt</dt><dd className="text-2xl font-semibold" data-testid="freistellen-erledigt">{zaehler.erledigt}</dd></div>
              <div><dt className="text-xs text-leise">Kein Motiv</dt><dd className="text-2xl font-semibold">{zaehler.nicht}</dd></div>
              <div><dt className="text-xs text-leise">Fehler</dt><dd className="text-2xl font-semibold">{zaehler.fehler}</dd></div>
            </dl>
            {rest !== undefined && rest !== null && <p className="text-sm text-leise">Heute noch {rest} Fotos laut deinem Tageslimit.</p>}
            {meldung && <p className="text-sm" role="status">{meldung}</p>}
            {laeuft ? (
              <button type="button" className="knopf-sekundaer w-full justify-center" onClick={() => { aktiv.current = false; }}>
                <span className="animate-pulse">Arbeitet …</span> Anhalten
              </button>
            ) : (
              <button type="button" className="knopf-primaer w-full justify-center" onClick={starten}>
                <Symbol name="kamera" className="size-4" />Freistellen nachholen
              </button>
            )}
          </section>
        )}
        {nativ?.hintergrund && <ImHintergrund hintergrund={nativ.hintergrund} />}
      </div>
    </Layout>
  );
}

/**
 * Freistellen im Hintergrund am Ladegerät: Das iPhone arbeitet die Warteschlange ab, wenn es am Strom hängt (meist nachts, auch
 * gesperrt) – wann genau, entscheidet iOS. Dafür bekommt die App ein eigenes Zugangs-Token, das nur das Freistellen darf.
 */
function ImHintergrund({ hintergrund }) {
  const [stand, setStand] = useState(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [meldung, setMeldung] = useState(null);
  const laden = () => hintergrund.stand().then(setStand).catch(() => setStand({ aktiv: false }));
  useEffect(() => { laden(); }, []);
  if (!stand) return null;

  async function umschalten() {
    setArbeitet(true);
    setMeldung(null);
    try {
      if (stand.aktiv) {
        await hintergrund.aus();
        setMeldung('Ausgeschaltet.');
      } else {
        await hintergrund.ein();
        // Kurzer Probelauf mit dem neuen Zugang – zeigt sofort, ob alles zusammenpasst
        const probe = await hintergrund.probe(3);
        setMeldung(probe.meldung ?? (probe.fehler && probe.fehler !== 'nicht_eingerichtet'
          ? 'Eingeschaltet – der Probelauf hat den Server gerade nicht erreicht, iOS versucht es später erneut.'
          : `Eingeschaltet. Probelauf: ${probe.erledigt} ${probe.erledigt === 1 ? 'Foto' : 'Fotos'} freigestellt.`));
      }
    } catch (e) {
      setMeldung(e.status === 403 ? 'Dieses Konto darf (nicht mehr) beim Freistellen helfen.' : e.message);
    } finally {
      setArbeitet(false);
      laden();
    }
  }

  return (
    <section className="karte space-y-3 p-4" data-testid="freistellen-hintergrund">
      <h2 className="font-semibold">Im Hintergrund am Ladegerät</h2>
      <p className="text-sm text-leise">
        Hängt dein iPhone am Strom (meist nachts, auch gesperrt), stellt es von selbst Fotos frei – wann genau, entscheidet iOS.
        Dafür bekommt die App einen eigenen Zugang, der nur das Freistellen darf. Er endet, wenn du hier ausschaltest oder dich in der
        App abmeldest, und steht unter „Konto → Angemeldete Geräte“. Es gilt dein Tageslimit.
      </p>
      {stand.aktiv && stand.zuletzt && (
        <p className="text-sm text-leise">
          Zuletzt am {new Date(stand.zuletzt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}: {stand.zuletztAnzahl} freigestellt
          · insgesamt {stand.gesamt}
        </p>
      )}
      {!stand.aktiv && stand.meldung && <p className="text-sm text-warnung">{stand.meldung}</p>}
      {meldung && <p className="text-sm" role="status">{meldung}</p>}
      <button type="button" className={`${stand.aktiv ? 'knopf-sekundaer' : 'knopf-primaer'} w-full justify-center`} disabled={arbeitet} onClick={umschalten}>
        {arbeitet ? 'Einen Moment …' : stand.aktiv ? 'Im Hintergrund ausschalten' : 'Im Hintergrund einschalten'}
      </button>
    </section>
  );
}
