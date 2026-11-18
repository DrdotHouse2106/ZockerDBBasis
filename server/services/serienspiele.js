// Figurenserien, deren Spiel bekannt ist (z. B. Monster in my Pocket → NES-Spiel „Monster in My Pocket“): verknüpfen, sobald das
// Spiel freigegeben im Katalog steht – beim Start und gleich nach dem Speichern eines Spiels (Suche, IGDB-Abzug). Je Serie nur
// einmal: danach steht ein Vermerk in „datenpakete“, eine bewusst gelöschte Verknüpfung bleibt also weg.
// Der Titel wird ohne Groß-/Kleinschreibung und Satzzeichen verglichen („Monster In My Pocket“, „Monster in my Pocket!“).

export const SPIELE_ZU_SERIEN = [['Monster in my Pocket', 'Monster in My Pocket']];

const norm = (t) => String(t ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Verknüpft fehlende bekannte Serien mit ihrem Spiel; liefert die Zahl neuer Verknüpfungen. */
export function bekannteSpieleVerknuepfen(db) {
  const erledigt = db.prepare('SELECT 1 FROM datenpakete WHERE name = ?');
  const merken = db.prepare("INSERT OR IGNORE INTO datenpakete (name, pruefsumme, eingespielt_am) VALUES (?, 'verknuepft', datetime('now'))");
  const serieVon = db.prepare('SELECT id FROM serien WHERE ueber_id IS NULL AND name = ? COLLATE NOCASE').pluck();
  const kandidaten = db.prepare("SELECT id, titel FROM katalog WHERE typ = 'spiel' AND status = 'freigegeben' AND titel LIKE ? ESCAPE '\\'");
  const verknuepfe = db.prepare('INSERT OR IGNORE INTO serien_spiele (serie_id, katalog_id) VALUES (?, ?)');
  let neu = 0;
  for (const [serie, spiel] of SPIELE_ZU_SERIEN) {
    const vermerk = `spiel-zu-serie:${serie}`;
    if (erledigt.get(vermerk)) continue;
    const serieId = serieVon.get(serie);
    if (!serieId) continue;
    // Vorauswahl über die Wörter (in Reihenfolge), dann genauer Vergleich ohne Satzzeichen
    const muster = `%${norm(spiel).split(' ').map((w) => w.replace(/[\\%_]/g, (z) => `\\${z}`)).join('%')}%`;
    const treffer = kandidaten.all(muster).filter((k) => norm(k.titel) === norm(spiel));
    for (const k of treffer) neu += verknuepfe.run(serieId, k.id).changes;
    if (treffer.length) merken.run(vermerk);
  }
  return neu;
}

/** Schnelle Vorprüfung beim Speichern: Kommt der Titel überhaupt als bekanntes Spiel infrage? */
export const istBekanntesSerienSpiel = (titel) => SPIELE_ZU_SERIEN.some(([, spiel]) => norm(spiel) === norm(titel));

/**
 * Fehlt das Spiel einer bekannten Serie noch im Katalog: einmal online suchen (IGDB bzw. zockerdb.de) – das Speichern der Treffer
 * verknüpft die Serie (siehe katalog.speichere). Ohne Online-Zugang oder Treffer passiert nichts; beim nächsten Start neuer Versuch.
 */
export async function bekannteSpieleHolen(db, katalog) {
  const erledigt = db.prepare('SELECT 1 FROM datenpakete WHERE name = ?');
  let neu = 0;
  for (const [serie, spiel] of SPIELE_ZU_SERIEN) {
    if (erledigt.get(`spiel-zu-serie:${serie}`)) continue;
    const vorher = db.prepare('SELECT COUNT(*) FROM serien_spiele').pluck().get();
    await katalog.suche(spiel, 'spiel', null, { online: true });
    bekannteSpieleVerknuepfen(db);
    neu += db.prepare('SELECT COUNT(*) FROM serien_spiele').pluck().get() - vorher;
  }
  return neu;
}
