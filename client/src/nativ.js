// Andockpunkte für native Funktionen der App (iOS/Android; gesetzt von einem Zusatzmodul). Im Browser bleiben
// sie leer – dann gilt der Web-Weg (z. B. Barcode-Erkennung über die Kamera der Seite).

let scanner = null;

/**
 * Nativen Barcode-Scanner setzen: `() => Promise<string|null>` – liefert den gelesenen Code, `null` bei Abbruch und
 * wirft einen Fehler mit verständlicher Meldung, wenn das Scannen nicht möglich ist.
 */
export function setzeNativenScanner(funktion) {
  scanner = funktion;
}

export const nativerScanner = () => scanner;

let upload = null;

/**
 * Nativen Hintergrund-Upload setzen: `(pfad, formular, onFortschritt) => Promise<{ status, text }>` – die Übertragung läuft
 * weiter, wenn die App in den Hintergrund geht. Wirft bei Verbindungsfehlern. Ohne Setzen (Browser, Android) gilt der Web-Weg.
 */
export function setzeNativenUpload(funktion) {
  upload = funktion;
}

export const nativerUpload = () => upload;

let freistellen = null;

/**
 * Natives Freistellen setzen: `{ maske(bild: Blob) => Promise<Blob|null>, bildschirmAn(an: boolean) => Promise }` – liefert die
 * Maske als Graustufen-PNG (weiß = Motiv) bzw. null, wenn kein Motiv erkannt wurde. Nur in der App (iOS ab 17).
 * Optional `hintergrund: { stand(), ein(), aus(), probe(anzahl) }` – Freistellen im Hintergrund am Ladegerät.
 */
export function setzeNativesFreistellen(funktionen) {
  freistellen = funktionen;
}

export const nativesFreistellen = () => freistellen;
