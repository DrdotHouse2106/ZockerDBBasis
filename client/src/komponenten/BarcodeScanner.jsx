// Barcode-Scanner im Browser. Erkennt EAN-13, EAN-8, UPC-A und UPC-E – mit der eingebauten Erkennung des Browsers oder
// ZXing (WebAssembly), siehe ../barcode.js. Gelesen wird nur der Streifen im Rahmen, in hoher Auflösung.
// Hinweis: Browser erlauben den Kamerazugriff nur über HTTPS oder auf localhost.
import { useEffect, useRef, useState } from 'react';
import Symbol from './Symbole.jsx';
import { holeErkenner, pruefzifferOk } from '../barcode.js';
import { nativerScanner } from '../nativ.js';

// Ausschnitt, der gelesen wird (Anteil am Videobild) – entspricht dem sichtbaren Rahmen
const RAHMEN = { breite: 0.86, hoehe: 0.42 };
const MAX_BREITE = 1280; // größer bringt bei Strichcodes kaum mehr, kostet aber Rechenzeit
const PAUSE_MS = 60; // zwischen zwei Leseversuchen

// iPhone/iPad (auch iPad im Desktop-Modus): iOS merkt sich die Kamera-Freigabe nur für die laufende Sitzung.
const IST_IOS = typeof navigator !== 'undefined'
  && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const IST_APP = typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);

function IosHinweis() {
  const [offen, setOffen] = useState(false);
  if (!IST_IOS) return null;
  return (
    <div className="max-w-lg text-center text-xs text-white/60">
      <button type="button" className="underline" onClick={() => setOffen(!offen)}>Warum fragt das iPhone jedes Mal nach der Kamera?</button>
      {offen && (
        <p className="mt-2 text-left">
          {IST_APP
            ? 'iOS merkt sich die Kamera-Freigabe bei Apps vom Home-Bildschirm nur, solange die App geöffnet ist. Nach einem Neustart der App fragt das iPhone erneut – das lässt sich dort leider nicht dauerhaft einstellen. Innerhalb einer Sitzung wird nur einmal gefragt.'
            : 'In Safari kannst du die Kamera dauerhaft erlauben: In der Adressleiste auf „aA“ tippen → „Website-Einstellungen“ → „Kamera“ → „Erlauben“. Alternativ für alle Seiten unter Einstellungen → Apps → Safari → Kamera.'}
        </p>
      )}
    </div>
  );
}

function fehlerText(fehler) {
  const text = String(fehler?.name ?? fehler?.message ?? fehler ?? '');
  if (!window.isSecureContext) {
    return 'Die Kamera ist nur über eine sichere Verbindung (HTTPS) verfügbar. Bitte die App über HTTPS aufrufen oder den Barcode manuell eingeben.';
  }
  if (/NotAllowed|Permission/i.test(text)) return 'Der Zugriff auf die Kamera wurde verweigert. Bitte in den Browser-Einstellungen erlauben.';
  if (/NotFound|Requested device not found|no camera/i.test(text)) return 'Es wurde keine Kamera gefunden.';
  if (/NotReadable|in use/i.test(text)) return 'Die Kamera wird bereits von einer anderen App verwendet.';
  return 'Die Kamera konnte nicht gestartet werden. Du kannst den Barcode auch manuell eingeben.';
}

export default function BarcodeScanner({ onErkannt, onSchliessen }) {
  const [fehler, setFehler] = useState(null);
  const [laedt, setLaedt] = useState(true);
  const [manuell, setManuell] = useState('');
  const [licht, setLicht] = useState(null); // null = Taschenlampe nicht verfügbar
  // Bild spiegeln: Frontkameras (z. B. MacBook, Laptop) wie ein Spiegel anzeigen, sonst bewegt sich der Code „falsch herum“.
  // Nur die Anzeige wird gespiegelt, erkannt wird weiterhin das Originalbild. Eigene Wahl wird gemerkt.
  const [spiegeln, setSpiegeln] = useState(() => {
    try { const w = localStorage.getItem('scanner-spiegeln'); return w === null ? null : w === '1'; } catch { return null; }
  });
  const [frontkamera, setFrontkamera] = useState(false);
  const gespiegelt = spiegeln ?? frontkamera;
  const umschalten = () => {
    setSpiegeln(!gespiegelt);
    try { localStorage.setItem('scanner-spiegeln', gespiegelt ? '0' : '1'); } catch { /* egal */ }
  };
  const erkanntRef = useRef(onErkannt);
  erkanntRef.current = onErkannt;
  const videoRef = useRef(null);
  const spurRef = useRef(null);
  // App: nativer Scanner (eigene Kameraansicht des Systems); hier bleiben nur Fehlermeldung und manuelle Eingabe
  const nativ = nativerScanner();
  const [versuchNr, setVersuchNr] = useState(0);

  useEffect(() => {
    if (!nativ) return undefined;
    let beendet = false;
    setFehler(null);
    nativ().then((code) => {
      if (beendet) return;
      if (code === null) return onSchliessen();
      if (!pruefzifferOk(code)) {
        setFehler('Das war kein Strichcode einer Verpackung (EAN/UPC). Bitte erneut scannen oder den Barcode eingeben.');
        return;
      }
      erkanntRef.current(code);
    }).catch((e) => { if (!beendet) setFehler(e.message); });
    setLaedt(false);
    return () => { beendet = true; };
  }, [versuchNr]);

  useEffect(() => {
    if (nativ) return undefined;
    let beendet = false;
    let strom = null;
    let zeitgeber = null;
    const leinwand = document.createElement('canvas');
    const zeichnen = leinwand.getContext('2d', { willReadFrequently: true });

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('NotFound');
        // Erkenner (ggf. WASM) und Kamera parallel vorbereiten
        const erkennerBereit = holeErkenner();
        strom = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (beendet) return;
        const spur = strom.getVideoTracks()[0];
        spurRef.current = spur;
        // Dauer-Autofokus, wo möglich (vor allem Android); iOS fokussiert ohnehin selbst
        const faehig = spur.getCapabilities?.() ?? {};
        if (faehig.focusMode?.includes('continuous')) await spur.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
        if (faehig.torch) setLicht(false);
        setFrontkamera(spur.getSettings?.().facingMode !== 'environment');
        const video = videoRef.current;
        video.srcObject = strom;
        await video.play().catch(() => {});
        const { lies } = await erkennerBereit;
        if (beendet) return;
        setLaedt(false);

        const versuch = async () => {
          if (beendet) return;
          try {
            const vb = video.videoWidth;
            const vh = video.videoHeight;
            if (vb && vh) {
              const sb = Math.round(vb * RAHMEN.breite);
              const sh = Math.round(vh * RAHMEN.hoehe);
              const faktor = Math.min(1, MAX_BREITE / sb);
              leinwand.width = Math.round(sb * faktor);
              leinwand.height = Math.round(sh * faktor);
              zeichnen.drawImage(video, (vb - sb) / 2, (vh - sh) / 2, sb, sh, 0, 0, leinwand.width, leinwand.height);
              const code = await lies(zeichnen.getImageData(0, 0, leinwand.width, leinwand.height));
              if (code && !beendet) {
                beendet = true;
                navigator.vibrate?.(80);
                erkanntRef.current(code);
                return;
              }
            }
          } catch { /* einzelnes Bild nicht lesbar – weiter */ }
          zeitgeber = setTimeout(versuch, PAUSE_MS);
        };
        versuch();
      } catch (e) {
        if (!beendet) {
          setFehler(fehlerText(e));
          setLaedt(false);
        }
      }
    })();

    return () => {
      beendet = true;
      clearTimeout(zeitgeber);
      strom?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const lichtUmschalten = async () => {
    const an = !licht;
    try {
      await spurRef.current?.applyConstraints({ advanced: [{ torch: an }] });
      setLicht(an);
    } catch { setLicht(null); }
  };

  function absenden(e) {
    e.preventDefault();
    const code = manuell.replace(/\D/g, '');
    if (code.length >= 8) onErkannt(code);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Barcode scannen">
      <div className="flex items-center justify-between p-4 text-white" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <h2 className="text-lg font-bold">Barcode scannen</h2>
        <button type="button" onClick={onSchliessen} className="rounded-full p-2 hover:bg-white/10" aria-label="Scanner schließen">
          <Symbol name="schliessen" className="size-6" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        {nativ ? (
          <div className="flex max-w-lg flex-col items-center gap-3 text-center">
            {fehler
              ? <p className="rounded-xl bg-gefahr/15 p-3 text-sm text-white" role="alert">{fehler}</p>
              : <p className="text-sm text-white/70">Die Kamera ist geöffnet …</p>}
            {fehler && <button type="button" className="knopf-primaer" onClick={() => setVersuchNr((n) => n + 1)}>Erneut scannen</button>}
          </div>
        ) : (<>
        <div className="relative w-full max-w-lg">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} playsInline muted autoPlay className={`size-full object-cover ${gespiegelt ? '-scale-x-100' : ''}`} />
            {!laedt && !fehler && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <div className="relative rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                  style={{ width: `${RAHMEN.breite * 100}%`, height: `${RAHMEN.hoehe * 100}%` }}>
                  <div className="absolute inset-x-[5%] top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-gefahr/80" />
                </div>
              </div>
            )}
          </div>
          {!laedt && !fehler && (
            <div className="absolute right-2 bottom-2 flex gap-2">
              {licht !== null && (
                <button type="button" onClick={lichtUmschalten} className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/80" aria-pressed={licht}>
                  {licht ? 'Licht aus' : 'Licht an'}
                </button>
              )}
              <button type="button" onClick={umschalten} className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/80"
                aria-pressed={gespiegelt}>
                {gespiegelt ? 'Nicht spiegeln' : 'Bild spiegeln'}
              </button>
            </div>
          )}
          {laedt && !fehler && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Kamera wird gestartet …</p>}
        </div>
        {fehler ? (
          <p className="max-w-lg rounded-xl bg-gefahr/15 p-3 text-center text-sm text-white" role="alert">{fehler}</p>
        ) : (
          <p className="max-w-lg text-center text-sm text-white/70">Halte den Barcode (EAN/UPC) auf der Rückseite der Verpackung in den Rahmen.</p>
        )}
        <IosHinweis />
        </>)}
      </div>

      <form onSubmit={absenden} className="unten-sicher mx-auto flex w-full max-w-lg gap-2 p-4">
        <input
          value={manuell}
          onChange={(e) => setManuell(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Barcode manuell eingeben"
          className="eingabe flex-1"
          aria-label="Barcode manuell eingeben"
        />
        <button type="submit" className="knopf-primaer" disabled={manuell.replace(/\D/g, '').length < 8}>Suchen</button>
      </form>
    </div>
  );
}
