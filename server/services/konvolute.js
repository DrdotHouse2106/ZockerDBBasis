// Konvolute: mehrere Artikel zu einem Gesamtpreis gekauft (Flohmarkt-Kiste, Kleinanzeigen-Paket …).
//
// Der Gesamtpreis wird automatisch auf die Artikel verteilt – gleichmäßig je Stück oder nach geschätztem Wert
// (Wertschätzung eines Zusatzmoduls, sonst die eigene Schätzung am Artikel). Artikel mit selbst eingetragenem
// Kaufpreis behalten ihn; verteilt wird nur der Rest. Die Summe der Anteile ergibt den Gesamtpreis auf den Cent.
import { ValidierungsFehler, leerZuNull, leseEuro } from './validierung.js';

const AUFTEILUNGEN = ['gleich', 'wert'];

export function pruefeKonvolut(eingabe = {}) {
  const fehler = {};
  const name = leerZuNull(eingabe.name);
  if (!name) fehler.name = 'Bitte einen Namen angeben, z. B. „Flohmarkt-Kiste Mai 2024“.';
  else if (name.length > 200) fehler.name = 'Maximal 200 Zeichen erlaubt.';
  let preis = null;
  if (leerZuNull(eingabe.preis) !== null) {
    preis = leseEuro(eingabe.preis);
    if (preis === null || preis < 0) fehler.preis = 'Bitte einen gültigen Betrag angeben (z. B. 25,00).';
  }
  const datum = leerZuNull(eingabe.kaufdatum);
  if (datum && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(datum)) fehler.kaufdatum = 'Bitte ein gültiges Datum angeben (auch nur Jahr).';
  const aufteilung = AUFTEILUNGEN.includes(eingabe.aufteilung) ? eingabe.aufteilung : 'gleich';
  if (Object.keys(fehler).length) throw new ValidierungsFehler(fehler);
  return {
    name, preis, kaufdatum: datum, aufteilung,
    quelle: leerZuNull(eingabe.quelle)?.slice(0, 200) ?? null,
    notizen: leerZuNull(eingabe.notizen)?.slice(0, 5000) ?? null,
  };
}

/**
 * Verteilt `restCent` auf Artikel mit Gewicht (je Stück) und Anzahl. Liefert Cent je Stück; Rundungsreste gehen
 * cent-weise an die Artikel mit dem größten Nachkommaanteil, damit die Summe möglichst genau stimmt.
 */
export function verteile(restCent, posten) {
  const gesamt = posten.reduce((s, p) => s + p.gewicht * p.anzahl, 0);
  if (!gesamt || restCent <= 0) return posten.map(() => 0);
  const roh = posten.map((p) => (restCent * p.gewicht) / gesamt);
  const cent = roh.map(Math.floor);
  let offen = restCent - cent.reduce((s, c, i) => s + c * posten[i].anzahl, 0);
  const reihenfolge = roh.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  for (let runde = 0; offen > 0 && runde < 3; runde += 1) {
    for (const i of reihenfolge) {
      if (posten[i].anzahl <= offen) {
        cent[i] += 1;
        offen -= posten[i].anzahl;
      }
    }
  }
  return cent;
}

export function erstelleKonvolutDienst(db, { erweiterungen }) {
  const perId = db.prepare('SELECT * FROM konvolute WHERE id = ?');
  const artikelVon = db.prepare('SELECT * FROM artikel WHERE konvolut_id = ? ORDER BY titel COLLATE NOCASE');

  /** Wert je Stück: Zusatzmodul (z. B. Marktpreis) oder eigene Schätzung. */
  const wertVon = (a) => {
    for (const fn of erweiterungen?.alle('wert.schaetzen') ?? []) {
      const w = fn(a);
      if (w?.wert > 0) return w.wert;
    }
    return a.marktwert > 0 ? a.marktwert : null;
  };

  /** Gesamtpreis neu verteilen – nur geänderte Artikel werden aktualisiert (wichtig für den Sync). */
  function aufteilen(konvolutId) {
    const k = perId.get(konvolutId);
    if (!k) return;
    const artikel = artikelVon.all(k.id);
    const anteilig = artikel.filter((a) => a.kaufpreis_anteilig || a.kaufpreis == null);
    const fest = artikel.filter((a) => !anteilig.includes(a));
    let neu;
    if (k.preis == null) {
      neu = anteilig.map(() => null);
    } else {
      const restCent = Math.max(0, Math.round(k.preis * 100) - fest.reduce((s, a) => s + Math.round(a.kaufpreis * 100) * a.anzahl, 0));
      const werte = anteilig.map((a) => (k.aufteilung === 'wert' ? wertVon(a) : 1));
      const bekannt = werte.filter((w) => w != null);
      const schnitt = bekannt.length ? bekannt.reduce((s, w) => s + w, 0) / bekannt.length : 1;
      neu = verteile(restCent, anteilig.map((a, i) => ({ gewicht: werte[i] ?? schnitt, anzahl: a.anzahl || 1 }))).map((c) => c / 100);
    }
    const setze = db.prepare(`UPDATE artikel SET kaufpreis = @preis, kaufpreis_anteilig = 1, herkunft = COALESCE(herkunft, 'konvolut'),
      kaufdatum = COALESCE(kaufdatum, @datum), aktualisiert_am = datetime('now') WHERE id = @id`);
    db.transaction(() => {
      anteilig.forEach((a, i) => {
        const aendern = a.kaufpreis !== neu[i] || !a.kaufpreis_anteilig || !a.herkunft || (!a.kaufdatum && k.kaufdatum);
        if (aendern) setze.run({ preis: neu[i], datum: k.kaufdatum, id: a.id });
      });
    })();
  }

  function liste(benutzerId) {
    return db.prepare(`SELECT k.*, COUNT(a.id) AS artikel, COALESCE(SUM(a.anzahl), 0) AS stueck
      FROM konvolute k LEFT JOIN artikel a ON a.konvolut_id = k.id WHERE k.benutzer_id = ?
      GROUP BY k.id ORDER BY COALESCE(k.kaufdatum, k.erstellt_am) DESC, k.id DESC`).all(benutzerId);
  }

  function hole(id, benutzerId) {
    const k = perId.get(Number(id));
    if (!k || k.benutzer_id !== benutzerId) return null;
    const artikel = db.prepare(`SELECT a.id, a.titel, a.plattform, a.typ, a.anzahl, a.kaufpreis, a.kaufpreis_anteilig, a.marktwert, a.katalog_id,
        a.bild_datei, a.cover_url, a.region, a.zustand, a.vollstaendigkeit, kk.cover_url AS katalog_cover_url
      FROM artikel a LEFT JOIN katalog kk ON kk.id = a.katalog_id WHERE a.konvolut_id = ? ORDER BY a.titel COLLATE NOCASE`).all(k.id)
      .map((a) => ({ ...a, wert: wertVon(a), bild_url: a.bild_datei ? `/api/dateien/${a.bild_datei}` : a.cover_url || a.katalog_cover_url || null }));
    return { ...k, artikel };
  }

  return { aufteilen, liste, hole, wertVon };
}
