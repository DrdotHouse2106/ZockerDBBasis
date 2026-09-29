// Barcode-Scanner im Browser (html5-qrcode). Erkennt EAN-13, EAN-8, UPC-A und UPC-E.
// Hinweis: Browser erlauben den Kamerazugriff nur über HTTPS oder auf localhost.
import { useEffect, useRef, useState } from 'react';
import Symbol from './Symbole.jsx';

const LESER_ID = 'barcode-leser';

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
  const erkanntRef = useRef(onErkannt);
  erkanntRef.current = onErkannt;

  useEffect(() => {
    let scanner;
    let beendet = false;
    let gemeldet = false;

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import('html5-qrcode');
        if (beendet) return;
        scanner = new Html5Qrcode(LESER_ID, {
          formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: (breite, hoehe) => ({ width: Math.floor(breite * 0.85), height: Math.floor(Math.min(hoehe * 0.5, breite * 0.45)) }),
            aspectRatio: 1.333,
          },
          (code) => {
            if (gemeldet) return;
            gemeldet = true;
            navigator.vibrate?.(80);
            erkanntRef.current(code);
          },
          () => {},
        );
        if (beendet) await scanner.stop().catch(() => {});
      } catch (e) {
        if (!beendet) setFehler(fehlerText(e));
      } finally {
        if (!beendet) setLaedt(false);
      }
    })();

    return () => {
      beendet = true;
      if (scanner?.isScanning) scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, []);

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
        <div className="relative w-full max-w-lg">
          <div id={LESER_ID} className="w-full overflow-hidden rounded-2xl bg-black" />
          {laedt && !fehler && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Kamera wird gestartet …</p>}
        </div>
        {fehler ? (
          <p className="max-w-lg rounded-xl bg-gefahr/15 p-3 text-center text-sm text-white" role="alert">{fehler}</p>
        ) : (
          <p className="max-w-lg text-center text-sm text-white/70">Halte den Barcode (EAN/UPC) auf der Rückseite der Verpackung in den Rahmen.</p>
        )}
        <IosHinweis />
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
