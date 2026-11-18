// Kameradaten (EXIF-Tags Make/Model in IFD0) lesen – im Server und im Browser (vor dem Zuschneiden, das die Daten verwirft).
// Nur als Hinweis auf ein selbst gemachtes Foto; gespeichert wird lediglich, OB das Original Kameradaten hatte.

/** Hersteller und Modell aus einem EXIF-Block (mit oder ohne „Exif\0\0“ davor), z. B. „Apple iPhone 15“ – sonst null. */
export function kameraAusExif(exif) {
  if (!(exif instanceof Uint8Array)) return null;
  const start = exif.length >= 6 && String.fromCharCode(...exif.subarray(0, 4)) === 'Exif' && exif[4] === 0 && exif[5] === 0 ? 6 : 0;
  const t = exif.subarray(start);
  if (t.length < 8) return null;
  const kennung = String.fromCharCode(t[0], t[1]);
  if (kennung !== 'II' && kennung !== 'MM') return null;
  const ansicht = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const le = kennung === 'II';
  const u16 = (p) => ansicht.getUint16(p, le);
  const u32 = (p) => ansicht.getUint32(p, le);
  try {
    const ifd = u32(4);
    if (ifd + 2 > t.length) return null;
    const werte = {};
    for (let i = 0, n = Math.min(u16(ifd), 200); i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > t.length) break;
      const tag = u16(e);
      if ((tag !== 0x010f && tag !== 0x0110) || u16(e + 2) !== 2) continue; // nur Text (ASCII)
      const anzahl = u32(e + 4);
      const pos = anzahl <= 4 ? e + 8 : u32(e + 8);
      if (pos + anzahl > t.length) continue;
      let text = '';
      for (let j = pos; j < pos + anzahl && t[j] !== 0; j++) text += String.fromCharCode(t[j]);
      werte[tag] = text.trim().slice(0, 60);
    }
    return [werte[0x010f], werte[0x0110]].filter(Boolean).join(' ') || null;
  } catch {
    return null;
  }
}

/** EXIF-Block (APP1) aus den ersten Bytes einer JPEG-Datei – sonst null. */
export function exifAusJpeg(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let p = 2;
  while (p + 4 <= bytes.length && bytes[p] === 0xff) {
    const marker = bytes[p + 1];
    const laenge = (bytes[p + 2] << 8) | bytes[p + 3];
    if (marker === 0xe1 && p + 4 + laenge - 2 <= bytes.length) return bytes.subarray(p + 4, p + 2 + laenge);
    if (marker === 0xda) break; // Bilddaten beginnen
    p += 2 + laenge;
  }
  return null;
}
