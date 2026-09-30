// Verarbeitung hochgeladener Scans: Metadaten (Auflösung, DPI) auslesen,
// Vorschaubilder erzeugen und nicht browsertaugliche Formate (TIFF) umwandeln.
// Datenschutz: Fotos und Scans werden ohne Metadaten gespeichert – Handyfotos enthalten sonst oft die GPS-Position
// (z. B. der eigenen Wohnung), Kameradaten und Aufnahmezeit, die andere bei geteilten Scans oder öffentlichen Sammlungen sähen.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

export const MEDIEN_TYPEN = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/tiff': '.tif',
  'application/pdf': '.pdf',
};

const BROWSERTAUGLICH = new Set(['image/jpeg', 'image/png', 'image/webp']);

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
  const meta = await sharp(pfad, { limitInputPixels: maxPixel }).metadata();
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
const MAX_PIXEL = 600_000_000; // reicht für A3 mit 1200 dpi

async function pdfSeiten(pfad) {
  const text = (await fs.readFile(pfad)).toString('latin1');
  const treffer = text.match(/\/Type\s*\/Page(?!s)/g);
  return treffer ? treffer.length : null;
}

/**
 * Verarbeitet eine hochgeladene Datei im Upload-Verzeichnis.
 * @returns {Promise<object>} Felder für die Tabelle „medien“
 */
export async function verarbeiteMedium({ verzeichnis, datei, mime }) {
  const pfad = path.join(verzeichnis, datei);
  const stat = await fs.stat(pfad);
  const ergebnis = { datei, mime, groesse: stat.size, anzeige_datei: null, vorschau_datei: null, breite: null, hoehe: null, dpi: null, seiten: null };

  if (mime === 'application/pdf') {
    const kopf = Buffer.alloc(5);
    const handle = await fs.open(pfad);
    await handle.read(kopf, 0, 5, 0);
    await handle.close();
    if (kopf.toString() !== '%PDF-') throw new Error('Die Datei ist kein gültiges PDF.');
    ergebnis.seiten = await pdfSeiten(pfad);
    return ergebnis;
  }

  const bild = sharp(pfad, { limitInputPixels: MAX_PIXEL, failOn: 'error' });
  const meta = await bild.metadata();
  // DPI nur übernehmen, wenn sie plausibel ist (72 dpi ist meist nur ein Standardwert).
  ergebnis.dpi = meta.density && meta.density > 72 ? Math.round(meta.density) : null;
  // Original ohne Metadaten (GPS, Kamera, Aufnahmezeit) – Scans bleiben dabei in voller Qualität
  ergebnis.groesse = await bereinigeBild(pfad, mime, { maxPixel: MAX_PIXEL, qualitaet: 95 });
  const nachher = await sharp(pfad, { limitInputPixels: MAX_PIXEL }).metadata();
  ergebnis.breite = nachher.width ?? null;
  ergebnis.hoehe = nachher.height ?? null;
  const basis = datei.replace(/\.[^.]+$/, '');

  if (!BROWSERTAUGLICH.has(mime)) {
    ergebnis.anzeige_datei = `${basis}-anzeige.jpg`;
    await sharp(pfad, { limitInputPixels: MAX_PIXEL })
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

  return ergebnis;
}

export const neuerDateiname = (mime) => `m-${crypto.randomUUID()}${MEDIEN_TYPEN[mime]}`;

/** Web-Version eines öffentlichen Fotos (wird bei Bedarf erzeugt, siehe öffentliche Bildadressen). */
export const webDateiVon = (datei) => `${String(datei).replace(/\.[^.]+$/, '')}-web.webp`;
/** Alle Dateien eines Mediums – zum Löschen. */
export const medienDateien = (m) => [m.datei, m.anzeige_datei, m.vorschau_datei, m.datei ? webDateiVon(m.datei) : null].filter(Boolean);

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
