// Verarbeitung hochgeladener Fotos und Scans: Metadaten (Auflösung, DPI) auslesen, Vorschaubilder erzeugen,
// nicht browsertaugliche Formate (TIFF) zusätzlich als Anzeigeversion umwandeln. Fotos werden verkleinert als WebP
// gespeichert; Scans bleiben in Originalformat und voller Auflösung (zum Drucken und Archivieren).
// Datenschutz: Fotos und Scans werden ohne Metadaten gespeichert – Handyfotos enthalten sonst oft die GPS-Position
// (z. B. der eigenen Wohnung), Kameradaten und Aufnahmezeit, die andere bei geteilten Scans oder öffentlichen Sammlungen sähen.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { kameraAusExif } from '../../shared/exif.js';

export { kameraAusExif };

export const MEDIEN_TYPEN = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/tiff': '.tif',
  'application/pdf': '.pdf',
};

const BROWSERTAUGLICH = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Bildformat an den ersten Bytes erkennen (JPEG, PNG, WebP, TIFF, GIF) – unabhängig vom Dateinamen und vom
 * Content-Type, den der Browser mitschickt. Liefert null für alles andere (z. B. SVG, HTML, PDF).
 */
export function erkenneBildformat(kopf) {
  const b = Buffer.isBuffer(kopf) ? kopf : Buffer.from(kopf ?? []);
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (b.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || b.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))) return 'tiff';
  if (['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1'))) return 'gif';
  return null;
}

/** Erste Bytes einer Datei oder eines Puffers lesen. */
async function bildkopf(quelle) {
  if (Buffer.isBuffer(quelle)) return quelle.subarray(0, 16);
  const handle = await fs.open(quelle);
  try {
    const kopf = Buffer.alloc(16);
    const { bytesRead } = await handle.read(kopf, 0, 16, 0);
    return kopf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * sharp nur mit echten Rasterbildern füttern: libvips kann auch SVG (librsvg) und weitere Formate lesen – der vom
 * Browser gemeldete Typ ist keine Prüfung, deshalb entscheiden die ersten Bytes. Wirft bei allem, was kein
 * JPEG, PNG, WebP, TIFF oder GIF ist.
 */
export async function sicheresBild(quelle, optionen = {}) {
  if (!erkenneBildformat(await bildkopf(quelle))) throw new Error('Keine unterstützte Bilddatei (erlaubt: JPEG, PNG, WebP, TIFF, GIF).');
  return sharp(quelle, optionen);
}

// ── Grenzen gegen Pixelbomben ──────────────────────────────────
// Ein einfarbiges JPEG mit 200 Millionen Pixeln ist nur ~1 MB groß, braucht beim Dekodieren aber rund 2 GB Arbeitsspeicher.
// Deshalb: Fotos bis 80 Mpx, alles, was voll dekodiert werden muss (Neu-Kodieren, TIFF → JPEG), bis 120 Mpx – und nur
// JPEG-Scans, die ohne Dekodieren verlustfrei bereinigt werden, bis 300 Mpx (A3 mit 1200 dpi).
export const MAX_PIXEL_FOTO = 80_000_000;
export const MAX_PIXEL_DEKODIEREN = 120_000_000;

// Höchstens zwei Bildverarbeitungen gleichzeitig: begrenzt den Spitzen-Speicherbedarf, parallele Uploads warten kurz
const MAX_GLEICHZEITIG = 2;
let laufendeBildarbeiten = 0;
const bildWarteschlange = [];
export async function mitBildSperre(fn) {
  if (laufendeBildarbeiten >= MAX_GLEICHZEITIG) await new Promise((weiter) => bildWarteschlange.push(weiter));
  laufendeBildarbeiten += 1;
  try {
    return await fn();
  } finally {
    laufendeBildarbeiten -= 1;
    bildWarteschlange.shift()?.();
  }
}

/**
 * Hochgeladenes Bild (Pfad oder Puffer) verarbeiten: Formatprüfung, Pixelgrenze für Fotos, Sperre gegen zu viele
 * gleichzeitige Verarbeitungen. `pipeline` bekommt die sharp-Instanz und liefert das Ergebnis (toFile/toBuffer).
 */
export function verarbeiteBild(quelle, pipeline, optionen = {}) {
  return mitBildSperre(async () => pipeline(await sicheresBild(quelle, { limitInputPixels: MAX_PIXEL_FOTO, failOn: 'error', ...optionen })));
}

/**
 * JPEG ohne Metadaten – EXIF (inkl. GPS), XMP, IPTC, Kommentare und angehängte Zusatzbilder (MPF) fallen weg,
 * die Bilddaten bleiben Byte für Byte erhalten (kein Qualitätsverlust). Behalten werden JFIF (Auflösung),
 * das ICC-Farbprofil und der Adobe-Farbraum. Liefert null, wenn die Datei nicht sauber gelesen werden kann.
 */
export function jpegOhneMetadaten(puffer) {
  if (puffer.length < 4 || puffer[0] !== 0xff || puffer[1] !== 0xd8) return null;
  const teile = [puffer.subarray(0, 2)];
  let i = 2;
  while (i < puffer.length - 1) {
    if (puffer[i] !== 0xff) return null;
    const marker = puffer[i + 1];
    if (marker === 0xff) { i += 1; continue; } // Füllbyte
    if (marker === 0xd9) { teile.push(puffer.subarray(i, i + 2)); return Buffer.concat(teile); } // Bildende – Angehängtes verwerfen
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { teile.push(puffer.subarray(i, i + 2)); i += 2; continue; }
    if (i + 4 > puffer.length) return null;
    const ende = i + 2 + puffer.readUInt16BE(i + 2);
    if (ende > puffer.length || ende <= i + 2) return null;
    const app = marker >= 0xe0 && marker <= 0xef;
    const icc = marker === 0xe2 && puffer.subarray(i + 4, i + 16).toString('latin1') === 'ICC_PROFILE\0';
    if (marker !== 0xfe && (!app || marker === 0xe0 || marker === 0xee || icc)) teile.push(puffer.subarray(i, ende));
    i = ende;
    if (marker === 0xda) {
      // Bilddaten bis zum nächsten echten Marker (FF 00 = maskiertes Byte, FF D0–D7 = Restart-Marker)
      let j = i;
      while (j < puffer.length - 1 && !(puffer[j] === 0xff && puffer[j + 1] !== 0x00 && !(puffer[j + 1] >= 0xd0 && puffer[j + 1] <= 0xd7))) j += 1;
      teile.push(puffer.subarray(i, j));
      i = j;
    }
  }
  return null;
}

/**
 * Bild im Upload-Ordner ohne Metadaten neu ablegen (gleiches Format). JPEG ohne Drehung verlustfrei, sonst neu
 * gespeichert (nach EXIF gedreht, Farbprofil bleibt). Liefert die neue Dateigröße; wirft bei unlesbaren/zu großen Bildern.
 */
export async function bereinigeBild(pfad, mime, { maxPixel = 100_000_000, qualitaet = 92 } = {}) {
  const meta = await (await sicheresBild(pfad, { limitInputPixels: maxPixel })).metadata();
  if (!meta.width || !meta.height || meta.width * meta.height > maxPixel) throw new Error('Das Bild ist zu groß oder unlesbar.');
  if (mime === 'image/jpeg' && (meta.orientation ?? 1) <= 1) {
    const sauber = jpegOhneMetadaten(await fs.readFile(pfad));
    if (sauber) {
      await fs.writeFile(pfad, sauber);
      return sauber.length;
    }
  }
  // Mehrseitige TIFF-Scans (z. B. ein ganzes Handbuch) unverändert lassen – beim Neuspeichern gingen sonst Seiten verloren;
  // sie stammen vom Scanner und enthalten keine Standortdaten
  if (mime === 'image/tiff' && (meta.pages ?? 1) > 1) return (await fs.stat(pfad)).size;
  // Ab hier wird voll dekodiert – engere Grenze (siehe MAX_PIXEL_DEKODIEREN)
  if (meta.width * meta.height > MAX_PIXEL_DEKODIEREN) throw new Error('Das Bild ist zu groß. JPEG-Scans ohne Drehung dürfen größer sein.');
  return mitBildSperre(() => bereinigeDekodiert(pfad, mime, meta, { maxPixel, qualitaet }));
}

async function bereinigeDekodiert(pfad, mime, meta, { maxPixel, qualitaet }) {
  const gif = mime === 'image/gif';
  const animiert = gif || (mime === 'image/webp' && (meta.pages ?? 1) > 1);
  let bild = sharp(pfad, { limitInputPixels: maxPixel, failOn: 'error', animated: animiert });
  if (!animiert) bild = bild.rotate().keepIccProfile();
  if (mime === 'image/jpeg') bild = bild.jpeg({ quality: qualitaet, chromaSubsampling: '4:4:4' });
  else if (mime === 'image/png') bild = bild.png();
  else if (mime === 'image/webp') bild = bild.webp({ quality: qualitaet });
  else if (mime === 'image/tiff') bild = bild.tiff({ compression: 'lzw' });
  else if (gif) bild = bild.gif();
  else throw new Error('Nicht unterstütztes Bildformat.');
  const temp = `${pfad}.${crypto.randomUUID()}.tmp`;
  try {
    await bild.toFile(temp);
    await fs.rename(temp, pfad);
  } finally {
    await fs.rm(temp, { force: true });
  }
  return (await fs.stat(pfad)).size;
}
const MAX_PIXEL = 300_000_000; // A3 mit 1200 dpi – nur für JPEG-Scans, die ohne Dekodieren bereinigt werden (siehe MAX_PIXEL_DEKODIEREN)
const FOTO_QUALITAET = 82; // WebP – sichtbar verlustfrei am Bildschirm, ein Bruchteil der JPEG-Größe

/**
 * Speichert ein hochgeladenes Bild ohne Metadaten (nach EXIF gedreht, Farbprofil bleibt). Fotos werden als WebP
 * gespeichert und auf `maxPx` an der langen Seite verkleinert; Scans bleiben unverändert in Format und Auflösung.
 * Liefert { datei, mime, groesse } – bei Fotos ändern sich Dateiname und Typ (alte Datei wird entfernt).
 * Animierte Bilder bleiben im Originalformat.
 */
export async function speichereEinheitlich(verzeichnis, datei, mime, { foto = false, maxPx = 2560, maxPixel = MAX_PIXEL } = {}) {
  const pfad = path.join(verzeichnis, datei);
  const meta = await (await sicheresBild(pfad, { limitInputPixels: maxPixel })).metadata();
  if (!meta.width || !meta.height || meta.width * meta.height > maxPixel) throw new Error('Das Bild ist zu groß oder unlesbar.');
  // Scans (und animierte Bilder): nur Metadaten entfernen – volle Auflösung, Originalformat (JPEG ohne Qualitätsverlust)
  if (!foto || (meta.pages ?? 1) > 1) return { datei, mime, groesse: await bereinigeBild(pfad, mime, { maxPixel, qualitaet: 95 }) };
  // Fotos werden voll dekodiert (PNG/WebP ohne Verkleinern beim Laden) – engere Grenze
  if (meta.width * meta.height > MAX_PIXEL_FOTO) throw new Error('Das Foto ist zu groß (höchstens 80 Megapixel).');
  return mitBildSperre(async () => {
    let bild = sharp(pfad, { limitInputPixels: MAX_PIXEL_FOTO, failOn: 'error' }).rotate().keepIccProfile();
    if (maxPx > 0) bild = bild.resize({ width: maxPx, height: maxPx, fit: 'inside', withoutEnlargement: true });
    // WebP kann höchstens 16.383 Pixel je Seite – riesige Fotos in Originalgröße (Einstellung 0) als JPEG
    const alsWebp = (maxPx > 0 ? Math.min(maxPx, Math.max(meta.width, meta.height)) : Math.max(meta.width, meta.height)) <= 16383;
    bild = alsWebp ? bild.webp({ quality: FOTO_QUALITAET }) : bild.flatten({ background: '#ffffff' }).jpeg({ quality: 90 });
    const neuMime = alsWebp ? 'image/webp' : 'image/jpeg';
    const neueDatei = `${datei.replace(/\.[^.]+$/, '')}${MEDIEN_TYPEN[neuMime]}`;
    const temp = path.join(verzeichnis, `${neueDatei}.${crypto.randomUUID()}.tmp`);
    try {
      await bild.toFile(temp);
      await fs.rename(temp, path.join(verzeichnis, neueDatei));
    } finally {
      await fs.rm(temp, { force: true });
    }
    if (neueDatei !== datei) await fs.rm(pfad, { force: true });
    return { datei: neueDatei, mime: neuMime, groesse: (await fs.stat(path.join(verzeichnis, neueDatei))).size };
  });
}

/** Beginnt die Datei mit „%PDF-“? Der vom Browser gemeldete Typ ist keine Prüfung. */
export async function istPdf(pfad) {
  return (await bildkopf(pfad)).subarray(0, 5).toString('latin1') === '%PDF-';
}

/** Ist die Datei ein Rasterbild (JPEG, PNG, WebP, TIFF, GIF)? */
export const istBilddatei = async (pfad) => Boolean(erkenneBildformat(await bildkopf(pfad)));

/**
 * Seiten einer PDF zählen („/Type /Page“-Objekte) – blockweise, damit eine 200-MB-Datei beim Upload nicht komplett
 * im Arbeitsspeicher landet. Ein kleiner Überhang am Blockende fängt Treffer über Blockgrenzen hinweg ab.
 */
async function pdfSeiten(pfad) {
  const BLOCK = 1024 * 1024;
  const UEBERHANG = 32; // länger als „/Type /Page“ samt Leerraum
  const muster = /\/Type\s*\/Page(?!s)/g;
  const handle = await fs.open(pfad);
  try {
    const puffer = Buffer.alloc(BLOCK + UEBERHANG);
    let rest = '';
    let anzahl = 0;
    let position = 0;
    for (;;) {
      const { bytesRead } = await handle.read(puffer, 0, BLOCK, position);
      if (!bytesRead) break;
      position += bytesRead;
      const text = rest + puffer.toString('latin1', 0, bytesRead);
      // Treffer zählen, die vollständig vor dem Überhang liegen; der Überhang wandert in den nächsten Block
      const grenze = bytesRead === BLOCK ? text.length - UEBERHANG : text.length;
      let m;
      muster.lastIndex = 0;
      while ((m = muster.exec(text)) && m.index < grenze) anzahl += 1;
      rest = bytesRead === BLOCK ? text.slice(grenze) : '';
    }
    return anzahl || null;
  } finally {
    await handle.close();
  }
}

/**
 * Verarbeitet eine hochgeladene Datei im Upload-Verzeichnis.
 * @returns {Promise<object>} Felder für die Tabelle „medien“
 */
export async function verarbeiteMedium({ verzeichnis, datei: hochgeladen, mime: hochgeladenMime, foto = false, maxPx = 2560 }) {
  let datei = hochgeladen;
  let mime = hochgeladenMime;
  let pfad = path.join(verzeichnis, datei);
  const stat = await fs.stat(pfad);
  const ergebnis = { datei, mime, groesse: stat.size, anzeige_datei: null, vorschau_datei: null, breite: null, hoehe: null, dpi: null, seiten: null };

  if (mime === 'application/pdf') {
    if (!(await istPdf(pfad))) throw new Error('Die Datei ist kein gültiges PDF.');
    ergebnis.seiten = await pdfSeiten(pfad);
    return ergebnis;
  }

  const bild = await sicheresBild(pfad, { limitInputPixels: MAX_PIXEL, failOn: 'error' });
  const meta = await bild.metadata();
  // TIFF/PNG/WebP-Scans werden für Anzeige und Vorschau voll dekodiert – nur JPEG darf bis MAX_PIXEL gehen
  if (meta.width && meta.height && meta.width * meta.height > MAX_PIXEL_DEKODIEREN && (foto || mime !== 'image/jpeg')) {
    throw new Error(`Das Bild ist zu groß (höchstens ${Math.round(MAX_PIXEL_DEKODIEREN / 1e6)} Megapixel; JPEG-Scans bis ${Math.round(MAX_PIXEL / 1e6)}).`);
  }
  // DPI nur übernehmen, wenn sie plausibel ist (72 dpi ist meist nur ein Standardwert).
  ergebnis.dpi = meta.density && meta.density > 72 ? Math.round(meta.density) : null;
  // Fotos: hatte das Original Kameradaten (Hersteller/Modell)? Starker Hinweis auf ein eigenes Foto – die Daten selbst werden entfernt
  if (foto) ergebnis.kamera_daten = kameraAusExif(meta.exif) ? 1 : 0;
  // Ohne Metadaten speichern (GPS, Kamera, Aufnahmezeit): Fotos verkleinert als WebP, Scans in voller Auflösung und Originalformat
  ({ datei, mime, groesse: ergebnis.groesse } = await speichereEinheitlich(verzeichnis, datei, mime, { foto, maxPx }));
  Object.assign(ergebnis, { datei, mime });
  pfad = path.join(verzeichnis, datei);
  const nachher = await sharp(pfad, { limitInputPixels: MAX_PIXEL }).metadata();
  ergebnis.breite = nachher.width ?? null;
  ergebnis.hoehe = nachher.height ?? null;
  const basis = datei.replace(/\.[^.]+$/, '');

  await mitBildSperre(async () => {
    if (!BROWSERTAUGLICH.has(mime)) {
      ergebnis.anzeige_datei = `${basis}-anzeige.jpg`;
      await sharp(pfad, { limitInputPixels: MAX_PIXEL_DEKODIEREN })
        .rotate()
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
        .keepIccProfile()
        .toFile(path.join(verzeichnis, ergebnis.anzeige_datei));
    }

    ergebnis.vorschau_datei = `${basis}-vorschau.webp`;
    await sharp(pfad, { limitInputPixels: MAX_PIXEL })
      .rotate()
      .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(verzeichnis, ergebnis.vorschau_datei));
  });

  return ergebnis;
}

export const neuerDateiname = (mime) => `m-${crypto.randomUUID()}${MEDIEN_TYPEN[mime]}`;

/** Web-Version eines öffentlichen Fotos (wird bei Bedarf erzeugt, siehe öffentliche Bildadressen). */
export const webDateiVon = (datei) => `${String(datei).replace(/\.[^.]+$/, '')}-web.webp`;
/** Alle Dateien eines Mediums – zum Löschen. */
export const medienDateien = (m) => [m.datei, m.anzeige_datei, m.vorschau_datei, m.frei_datei, m.datei ? webDateiVon(m.datei) : null,
  m.frei_datei ? webDateiVon(m.frei_datei) : null, m.datei ? `${String(m.datei).replace(/\.[^.]+$/, '')}-helfer.webp` : null].filter(Boolean);

const MIME_NACH_ENDUNG = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.tif': 'image/tiff' };

/**
 * Einmalig nach dem Update: bereits hochgeladene Artikelfotos und Scans (Original und Anzeige-Version) ohne Metadaten
 * neu ablegen. Läuft im Hintergrund Datei für Datei; bis „fertig“ vermerkt ist, beginnt ein Neustart von vorn
 * (unschädlich – bereinigte Dateien bleiben unverändert bzw. werden verlustfrei neu gespeichert).
 */
export async function bereinigeBestand(db, verzeichnis) {
  const erledigt = db.prepare("SELECT wert FROM einstellungen WHERE schluessel = 'metadaten_bereinigt'").pluck().get();
  if (erledigt === 'fertig') return 0;
  const aufgaben = [
    ...db.prepare('SELECT id, bild_datei AS datei FROM artikel WHERE bild_datei IS NOT NULL').all()
      .map((z) => ({ ...z, art: 'artikel', mime: MIME_NACH_ENDUNG[path.extname(z.datei).toLowerCase()] })),
    ...db.prepare("SELECT id, datei, mime FROM medien WHERE mime LIKE 'image/%'").all().map((z) => ({ ...z, art: 'medium' })),
    ...db.prepare('SELECT id, anzeige_datei AS datei FROM medien WHERE anzeige_datei IS NOT NULL').all().map((z) => ({ ...z, art: 'anzeige', mime: 'image/jpeg' })),
  ];
  const artikelGroesse = db.prepare('UPDATE artikel SET bild_groesse = ? WHERE id = ? AND bild_datei = ?');
  const mediumGroesse = db.prepare('UPDATE medien SET groesse = ?, groesse_gesamt = MAX(0, COALESCE(groesse_gesamt, 0) + ? - COALESCE(groesse, 0)) WHERE id = ? AND datei = ?');
  let bereinigt = 0;
  for (const a of aufgaben) {
    if (!a.mime) continue;
    const pfad = path.join(verzeichnis, path.basename(a.datei));
    try {
      const vorher = (await fs.stat(pfad)).size;
      const groesse = await bereinigeBild(pfad, a.mime, { maxPixel: MAX_PIXEL, qualitaet: 95 });
      if (a.art === 'artikel') artikelGroesse.run(groesse, a.id, a.datei);
      if (a.art === 'medium') mediumGroesse.run(groesse, groesse, a.id, a.datei);
      if (groesse !== vorher) bereinigt += 1;
    } catch {
      /* Datei fehlt oder ist unlesbar – überspringen */
    }
    await new Promise((weiter) => { setImmediate(weiter); }); // den Server zwischendurch arbeiten lassen
  }
  db.prepare(`INSERT INTO einstellungen (schluessel, wert) VALUES ('metadaten_bereinigt', 'fertig')
    ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`).run();
  return bereinigt;
}
