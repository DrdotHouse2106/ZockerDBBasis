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
