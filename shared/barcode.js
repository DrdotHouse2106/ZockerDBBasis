// Barcodes (EAN-8, UPC-A, EAN-13, GTIN-14) erkennen – gemeinsam für Oberfläche und Server.

/**
 * Liefert die Ziffern, wenn der Text ein vollständiger, gültiger Barcode ist (Länge und Prüfziffer), sonst null.
 * So wird eine im Suchfeld eingetippte EAN als Barcode gesucht – halb eingetippte Nummern dagegen nicht.
 */
export function gueltigerBarcode(text) {
  const ziffern = String(text ?? '').replace(/[\s-]/g, '');
  if (!/^\d+$/.test(ziffern) || ![8, 12, 13, 14].includes(ziffern.length)) return null;
  // Prüfziffer (Modulo 10): von rechts abwechselnd ×3 und ×1, ohne die Prüfziffer selbst
  let summe = 0;
  for (let i = ziffern.length - 2, faktor = 3; i >= 0; i -= 1, faktor = 4 - faktor) summe += Number(ziffern[i]) * faktor;
  return (10 - (summe % 10)) % 10 === Number(ziffern.at(-1)) ? ziffern : null;
}

/** Nur Ziffern (auch mit Leerzeichen/Bindestrichen) – als Titel sinnlos, bei IGDB nicht nachfragen. */
export const nurZiffern = (text) => /^[\d\s-]+$/.test(String(text ?? '').trim());
