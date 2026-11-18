// Zuschnitt vor dem Hochladen: Format wählen (Original, Frei, Rund, 1:1, 4:3, 3:4), Rahmen mit dem Finger verschieben, Größe per Regler
// (bei „Frei“ Breite und Höhe getrennt – z. B. um aus einem Foto der Hülle genau das Cover auszuschneiden).
// „Rund“ schneidet eine Disc kreisrund aus; außerhalb des Kreises bleibt das Bild durchsichtig (PNG).
import { useEffect, useRef, useState } from 'react';

export const FORMATE = [
  { value: 'original', label: 'Original', verhaeltnis: null },
  { value: 'frei', label: 'Frei', verhaeltnis: null },
  { value: 'rund', label: 'Rund (Disc)', verhaeltnis: 1, rund: true },
  { value: '1:1', label: '1:1', verhaeltnis: 1 },
  { value: '4:3', label: '4:3', verhaeltnis: 4 / 3 },
  { value: '3:4', label: '3:4', verhaeltnis: 3 / 4 },
];
/** Vorschlag je Fotoart: Disc rund, sonst Original. */
export const formatFuer = (art) => (art === 'foto_disc' ? 'rund' : 'original');

/** Rahmen in Bildpunkten aus Format, Größe (0,3–1; bei „Frei“ Breite/Höhe je für sich) und Mittelpunkt (0–1). */
function rahmen(bild, format, groesse, mitte, frei) {
  const r = FORMATE.find((f) => f.value === format)?.verhaeltnis;
  if ((!r && format !== 'frei') || !bild) return null;
  const { width: B, height: H } = bild;
  let bw = B;
  let bh = H;
  if (r) {
    bh = B / r;
    if (bh > H) { bh = H; bw = H * r; }
    bw *= groesse;
    bh *= groesse;
  } else {
    bw *= frei.b;
    bh *= frei.h;
  }
  const x = Math.min(Math.max(mitte.x * B - bw / 2, 0), B - bw);
  const y = Math.min(Math.max(mitte.y * H - bh / 2, 0), H - bh);
  return { x, y, b: bw, h: bh, ...(FORMATE.find((f) => f.value === format)?.rund ? { rund: true } : {}) };
}

/** Schneidet die Datei zu (JPEG, Qualität 0,92; rund als PNG mit durchsichtigem Rand); ohne Zuschnitt kommt die Originaldatei zurück. */
export async function zuschneiden(datei, bild, zuschnitt) {
  if (!zuschnitt || !bild) return datei;
  const leinwand = document.createElement('canvas');
  // Nicht größer als nötig – der Server verkleinert ohnehin auf seine Höchstmaße (rund: PNG, deshalb kleiner)
  const faktor = Math.min(1, (zuschnitt.rund ? 1600 : 3000) / Math.max(zuschnitt.b, zuschnitt.h));
  leinwand.width = Math.round(zuschnitt.b * faktor);
  leinwand.height = Math.round(zuschnitt.h * faktor);
  const ctx = leinwand.getContext('2d');
  if (zuschnitt.rund) {
    ctx.beginPath();
    ctx.arc(leinwand.width / 2, leinwand.height / 2, Math.min(leinwand.width, leinwand.height) / 2, 0, Math.PI * 2);
    ctx.clip();
  }
  ctx.drawImage(bild.element, zuschnitt.x, zuschnitt.y, zuschnitt.b, zuschnitt.h, 0, 0, leinwand.width, leinwand.height);
  const typ = zuschnitt.rund ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((fertig) => leinwand.toBlob(fertig, typ, 0.92));
  if (!blob) return datei;
  return new File([blob], `${datei.name.replace(/\.[^.]+$/, '') || 'foto'}.${zuschnitt.rund ? 'png' : 'jpg'}`, { type: typ });
}

/**
 * Vorschau mit Zuschnitt-Rahmen. `onAenderung({ bild, zuschnitt })` – zuschnitt ist null bei „Original“.
 */
export default function Zuschnitt({ datei, startFormat = 'original', onAenderung }) {
  const [bild, setBild] = useState(null); // { element, width, height, url }
  const [format, setFormat] = useState(startFormat);
  const [groesse, setGroesse] = useState(1);
  const [frei, setFrei] = useState({ b: 0.9, h: 0.9 });
  const [mitte, setMitte] = useState({ x: 0.5, y: 0.5 });
  const flaeche = useRef(null);
  const ziehen = useRef(null);

  useEffect(() => { setFormat(startFormat); }, [startFormat]);
  useEffect(() => {
    if (!datei) return undefined;
    const url = URL.createObjectURL(datei);
    const element = new Image();
    element.onload = () => setBild({ element, width: element.naturalWidth, height: element.naturalHeight, url });
    element.src = url;
    setMitte({ x: 0.5, y: 0.5 });
    setGroesse(1);
    setFrei({ b: 0.9, h: 0.9 });
    return () => URL.revokeObjectURL(url);
  }, [datei]);

  const z = rahmen(bild, format, groesse, mitte, frei);
  useEffect(() => { onAenderung?.({ bild, zuschnitt: z }); }, [bild, format, groesse, mitte.x, mitte.y, frei.b, frei.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const runter = (e) => {
    if (!z) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ziehen.current = { x: e.clientX, y: e.clientY, mitte };
  };
  const bewegen = (e) => {
    if (!ziehen.current || !flaeche.current || !bild) return;
    const r = flaeche.current.getBoundingClientRect();
    const dx = (e.clientX - ziehen.current.x) / r.width;
    const dy = (e.clientY - ziehen.current.y) / r.height;
    // Mittelpunkt so begrenzen, dass der Rahmen im Bild bleibt
    const hb = z.b / bild.width / 2;
    const hh = z.h / bild.height / 2;
    setMitte({
      x: Math.min(Math.max(ziehen.current.mitte.x + dx, hb), 1 - hb),
      y: Math.min(Math.max(ziehen.current.mitte.y + dy, hh), 1 - hh),
    });
  };
  const loslassen = () => { ziehen.current = null; };

  if (!bild) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Bildformat">
        <span className="text-xs text-leise">Format:</span>
        {FORMATE.map((f) => (
          <button key={f.value} type="button" className={format === f.value ? 'chip-aktiv' : 'chip'} aria-pressed={format === f.value}
            onClick={() => { setFormat(f.value); setGroesse(1); setFrei({ b: 0.9, h: 0.9 }); setMitte({ x: 0.5, y: 0.5 }); }}>{f.label}</button>
        ))}
      </div>
      {/* Wischen sperren nur auf dem Rahmen – sonst (und bei „Original“) lässt sich die Seite über dem Bild scrollen */}
      <div ref={flaeche} className="relative mx-auto w-full max-w-sm select-none overflow-hidden rounded-lg bg-black"
        onPointerMove={bewegen} onPointerUp={loslassen} onPointerCancel={loslassen}>
        <img src={bild.url} alt="Ausgewähltes Foto" className="block w-full" draggable={false} />
        {z && (
          <div className={`absolute cursor-move touch-none border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] ${z.rund ? 'rounded-full' : 'rounded-sm'}`}
            style={{ left: `${(z.x / bild.width) * 100}%`, top: `${(z.y / bild.height) * 100}%`, width: `${(z.b / bild.width) * 100}%`, height: `${(z.h / bild.height) * 100}%` }}
            onPointerDown={runter} aria-label="Ausschnitt – zum Verschieben ziehen" role="img" />
        )}
      </div>
      {z && format === 'frei' && (['b', 'h']).map((seite) => (
        <label key={seite} className="flex items-center gap-2 text-xs text-leise">
          <span className="w-10">{seite === 'b' ? 'Breite' : 'Höhe'}</span>
          <input type="range" min="0.2" max="1" step="0.01" value={frei[seite]} className="flex-1 accent-akzent"
            onChange={(e) => {
              const wert = Number(e.target.value);
              setFrei((f) => ({ ...f, [seite]: wert }));
              // Mittelpunkt nachführen, damit der größere Rahmen im Bild bleibt
              setMitte((m) => ({ ...m, [seite === 'b' ? 'x' : 'y']: Math.min(Math.max(m[seite === 'b' ? 'x' : 'y'], wert / 2), 1 - wert / 2) }));
            }} />
        </label>
      ))}
      {z && format !== 'frei' && (
        <label className="flex items-center gap-2 text-xs text-leise">
          Größe
          <input type="range" min="0.3" max="1" step="0.01" value={groesse} onChange={(e) => setGroesse(Number(e.target.value))} className="flex-1 accent-akzent" />
        </label>
      )}
    </div>
  );
}

/**
 * Dialog „Foto zuschneiden“ vor dem Speichern eines eigenen Fotos (z. B. als Cover des Exemplars).
 * `onFertig(datei)` erhält die zugeschnittene Datei (bei „Original“ die unveränderte).
 */
export function ZuschnittDialog({ datei, titel = 'Foto zuschneiden', hinweis, startFormat = 'original', onFertig, onAbbrechen }) {
  const stand = useRef(null);
  const [laeuft, setLaeuft] = useState(false);
  async function uebernehmen() {
    setLaeuft(true);
    try { onFertig(await zuschneiden(datei, stand.current?.bild, stand.current?.zuschnitt)); } finally { setLaeuft(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="zuschnitt-titel">
      <div className="karte max-h-full w-full max-w-md space-y-3 overflow-y-auto p-4" data-testid="zuschnitt-dialog">
        <h2 id="zuschnitt-titel" className="text-lg font-semibold">{titel}</h2>
        {hinweis && <p className="text-sm text-leise">{hinweis}</p>}
        <Zuschnitt datei={datei} startFormat={startFormat} onAenderung={(z) => { stand.current = z; }} />
        <div className="flex justify-end gap-2">
          <button type="button" className="knopf-sekundaer" onClick={onAbbrechen}>Abbrechen</button>
          <button type="button" className="knopf-primaer" onClick={uebernehmen} disabled={laeuft}>Übernehmen</button>
        </div>
      </div>
    </div>
  );
}
