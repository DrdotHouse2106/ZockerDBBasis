// Barcode-Erkennung: eingebaute Erkennung des Browsers (BarcodeDetector, z. B. Chrome auf Android) – sonst ZXing als
// WebAssembly (iPhone, Firefox …). Die WASM-Datei wird von uns selbst ausgeliefert (auch offline, kein CDN).
const FORMATE = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/** Prüfziffer von EAN-8/EAN-13/UPC-A (UPC-E wird nicht geprüft) – schützt vor Fehllesungen. */
export function pruefzifferOk(code) {
  const ziffern = String(code ?? '');
  if (!/^\d+$/.test(ziffern)) return false;
  if (ziffern.length === 6 || ziffern.length === 7) return true; // UPC-E (gekürzt)
  if (![8, 12, 13].includes(ziffern.length)) return false;
  const zahlen = [...ziffern].map(Number);
  const pruef = zahlen.pop();
  // Von rechts: abwechselnd ×3 und ×1
  const summe = zahlen.reverse().reduce((s, z, i) => s + z * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (summe % 10)) % 10 === pruef;
}

let erkenner = null;

/** Liefert eine Funktion `(bild) => Promise<string|null>` (bild: Canvas oder ImageData). Wird einmal erzeugt. */
export function holeErkenner() {
  erkenner ??= (async () => {
    const Nativ = globalThis.BarcodeDetector;
    if (Nativ) {
      try {
        const unterstuetzt = await Nativ.getSupportedFormats();
        if (FORMATE.every((f) => unterstuetzt.includes(f))) return { art: 'nativ', detektor: new Nativ({ formats: FORMATE }) };
      } catch { /* weiter mit ZXing */ }
    }
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ]);
    prepareZXingModule({
      overrides: { locateFile: (pfad, prefix) => (pfad.endsWith('.wasm') ? wasmUrl : prefix + pfad) },
      fireImmediately: true,
    });
    return { art: 'zxing', detektor: new BarcodeDetector({ formats: FORMATE }) };
  })().catch((e) => {
    erkenner = null; // beim nächsten Öffnen erneut versuchen
    throw e;
  });
  return erkenner.then(({ art, detektor }) => ({
    art,
    async lies(bild) {
      const treffer = await detektor.detect(bild);
      return treffer.map((t) => t.rawValue).find(pruefzifferOk) ?? null;
    },
  }));
}
