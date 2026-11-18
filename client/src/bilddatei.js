// Fotos vor dem Hochladen vorbereiten. Apple-Fotos liegen oft nur in iCloud oder als HEIC vor: Wird die Datei erst
// während der Übertragung nachgeladen und bricht das ab, kommt beim Server nur ein halbes Formular an. Deshalb die
// Datei erst vollständig lesen; HEIC/HEIF (und andere Formate, die der Browser anzeigen kann) als JPEG umwandeln.

const ERLAUBT = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'application/pdf']);
const HEIC = /\.(heic|heif)$/i;

export class BilddateiFehler extends Error {}

async function alsJpeg(datei) {
  let bild;
  try {
    bild = await createImageBitmap(datei);
  } catch {
    throw new BilddateiFehler('Dieses Bildformat (z. B. HEIC) kann dein Browser nicht umwandeln. Bitte das Foto als JPEG exportieren – in Apple Fotos: Ablage → Exportieren → JPEG.');
  }
  const leinwand = document.createElement('canvas');
  leinwand.width = bild.width;
  leinwand.height = bild.height;
  leinwand.getContext('2d').drawImage(bild, 0, 0);
  bild.close?.();
  const blob = await new Promise((ok) => leinwand.toBlob(ok, 'image/jpeg', 0.92));
  if (!blob) throw new BilddateiFehler('Das Foto konnte nicht umgewandelt werden. Bitte als JPEG exportieren und erneut versuchen.');
  return new File([blob], `${datei.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`, { type: 'image/jpeg' });
}

/** Liefert eine vollständig gelesene, hochladbare Datei oder wirft einen BilddateiFehler mit verständlicher Meldung. */
export async function bereiteDateiVor(datei) {
  if (!datei) return datei;
  if (!ERLAUBT.has(datei.type) && (datei.type.startsWith('image/') || HEIC.test(datei.name))) return alsJpeg(datei);
  let inhalt;
  try {
    inhalt = await datei.arrayBuffer();
  } catch {
    throw new BilddateiFehler('Die Datei konnte nicht gelesen werden. Liegt das Foto nur in iCloud? Bitte erst vollständig laden (in Fotos öffnen) oder exportieren und dann erneut auswählen.');
  }
  return new File([inhalt], datei.name, { type: datei.type });
}

/**
 * Foto vor dem Hochladen verkleinern (längste Kante höchstens `kante` Pixel, JPEG, ohne Metadaten wie GPS) – spart bei
 * Handyfotos (oft 3–8 MB) viel Zeit im Mobilfunk. Klappt das Umrechnen nicht, wird die Datei wie bisher vorbereitet.
 */
export async function verkleinereBild(datei, { kante = 2000, qualitaet = 0.85 } = {}) {
  let bild;
  try {
    bild = await createImageBitmap(datei, { imageOrientation: 'from-image' });
  } catch {
    return bereiteDateiVor(datei);
  }
  const faktor = Math.min(1, kante / Math.max(bild.width, bild.height));
  const leinwand = document.createElement('canvas');
  leinwand.width = Math.round(bild.width * faktor);
  leinwand.height = Math.round(bild.height * faktor);
  leinwand.getContext('2d').drawImage(bild, 0, 0, leinwand.width, leinwand.height);
  bild.close?.();
  const blob = await new Promise((ok) => leinwand.toBlob(ok, 'image/jpeg', qualitaet));
  if (!blob) return bereiteDateiVor(datei);
  return new File([blob], `${datei.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`, { type: 'image/jpeg' });
}
