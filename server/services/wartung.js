// Zustand & Wartung: Wartungsverlauf je Exemplar (Batterie, Recap, Laufwerk, Mods …), Wartungsmerkmale je Katalogeintrag
// (Standard je Plattform und Artikeltyp, vom Moderationsteam überschreibbar, von allen vorschlagbar) und der Hinweis zum Batteriealter.
import {
  WARTUNGSARTEN, WARTUNGSMERKMALE, standardWartungsmerkmale, passendeWartungsarten, istModerator,
} from '../../shared/konstanten.js';
import { ValidierungsFehler, leerZuNull } from './validierung.js';

const MERKMAL_SCHLUESSEL = WARTUNGSMERKMALE.map((m) => m.value);
const ARTEN = WARTUNGSARTEN.map((a) => a.value);
// Ab diesem Alter wird zum Batterietausch geraten (Knopfzellen halten meist 15–25 Jahre)
const BATTERIE_WARNUNG_JAHRE = 15;

/** Merkmale prüfen: { speicherbatterie: true | false | null, … } – unbekannte Schlüssel fallen weg. */
export function pruefeMerkmale(roh) {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) throw new ValidierungsFehler({ merkmale: 'Bitte die Merkmale angeben.' });
  const merkmale = {};
  for (const k of MERKMAL_SCHLUESSEL) {
    if (!(k in roh)) continue;
    if (![true, false, null].includes(roh[k])) throw new ValidierungsFehler({ merkmale: 'Ungültiger Wert.' });
    merkmale[k] = roh[k];
  }
  return merkmale;
}

const lies = (json) => { try { return json ? JSON.parse(json) : null; } catch { return null; } };

export function erstelleWartungDienst(db) {
  const kurzFuerName = db.prepare('SELECT kurz FROM plattformen WHERE name = ? COLLATE NOCASE');

  /** Wirksame Merkmale eines Katalogeintrags (gesetzt oder Standard der ersten passenden Plattform). */
  function merkmaleKatalog(katalogId, { plattformKurz = null, typ = null } = {}) {
    const k = katalogId ? db.prepare('SELECT typ, plattformen, wartungsmerkmale FROM katalog WHERE id = ?').get(katalogId) : null;
    const gesetzt = lies(k?.wartungsmerkmale);
    if (gesetzt) return { merkmale: gesetzt, quelle: 'katalog' };
    let kurz = plattformKurz;
    if (!kurz && k) for (const name of lies(k.plattformen) ?? []) { kurz = kurzFuerName.get(name)?.kurz; if (kurz) break; }
    return { merkmale: standardWartungsmerkmale(kurz, typ ?? k?.typ), quelle: 'standard' };
  }

  const merkmaleArtikel = (a) => merkmaleKatalog(a.katalog_id, { plattformKurz: a.plattform_kurz, typ: a.typ });

  const eintraege = (artikelId) => db.prepare('SELECT id, art, datum, notiz, erstellt_am FROM wartungen WHERE artikel_id = ? ORDER BY datum DESC, id DESC').all(artikelId);

  /** Hinweis zum Batteriealter: seit dem letzten Tausch oder – ohne Tausch – seit dem Erscheinen. */
  function batterie(artikel, merkmale, liste) {
    if (!('speicherbatterie' in merkmale) || merkmale.speicherbatterie === false) return null;
    const tausch = liste.find((e) => e.art === 'batterie');
    const jahr = db.prepare('SELECT erscheinungsjahr FROM katalog WHERE id = ?').pluck().get(artikel.katalog_id);
    const seit = tausch ? Number(tausch.datum.slice(0, 4)) : jahr;
    if (!seit) return null;
    const alter = new Date().getFullYear() - seit;
    const vielleicht = merkmale.speicherbatterie === null ? ' – falls das Modul eine Batterie hat' : '';
    return {
      alter_jahre: alter,
      seit_tausch: Boolean(tausch),
      warnung: alter >= BATTERIE_WARNUNG_JAHRE,
      text: tausch
        ? `Batterie vor ${alter} ${alter === 1 ? 'Jahr' : 'Jahren'} getauscht${alter >= BATTERIE_WARNUNG_JAHRE ? ' – bald wieder fällig' : ''}.`
        : `Originalbatterie ist vermutlich rund ${alter} Jahre alt${vielleicht}${alter >= BATTERIE_WARNUNG_JAHRE ? '. Spielstände sichern und einen Tausch einplanen.' : '.'}`,
    };
  }

  function info(artikel) {
    const { merkmale, quelle } = merkmaleArtikel(artikel);
    const liste = eintraege(artikel.id);
    return { merkmale, merkmale_quelle: quelle, arten: passendeWartungsarten(merkmale).map((a) => a.value), eintraege: liste, batterie: batterie(artikel, merkmale, liste) };
  }

  function fuegeHinzu(benutzerId, artikel, eingabe = {}) {
    const art = String(eingabe.art ?? '');
    if (!ARTEN.includes(art)) throw new ValidierungsFehler({ art: 'Bitte eine Wartungsart wählen.' });
    const datum = leerZuNull(eingabe.datum) ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(datum) || Number(datum.slice(0, 4)) < 1970 || Number(datum.slice(0, 4)) > 2100) {
      throw new ValidierungsFehler({ datum: 'Bitte ein gültiges Datum angeben (auch nur Jahr oder Monat).' });
    }
    const notiz = leerZuNull(eingabe.notiz);
    if (notiz && notiz.length > 1000) throw new ValidierungsFehler({ notiz: 'Maximal 1000 Zeichen.' });
    if (db.prepare('SELECT COUNT(*) FROM wartungen WHERE artikel_id = ?').pluck().get(artikel.id) >= 200) {
      throw new ValidierungsFehler({ art: 'Höchstens 200 Einträge je Exemplar.' });
    }
    db.prepare('INSERT INTO wartungen (artikel_id, benutzer_id, art, datum, notiz) VALUES (?, ?, ?, ?, ?)').run(artikel.id, benutzerId, art, datum, notiz);
    db.prepare("UPDATE artikel SET aktualisiert_am = datetime('now') WHERE id = ?").run(artikel.id);
  }

  function loesche(benutzerId, id) {
    const w = db.prepare('SELECT artikel_id FROM wartungen WHERE id = ? AND benutzer_id = ?').get(Number(id), benutzerId);
    if (!w) return false;
    db.prepare('DELETE FROM wartungen WHERE id = ?').run(Number(id));
    db.prepare("UPDATE artikel SET aktualisiert_am = datetime('now') WHERE id = ?").run(w.artikel_id);
    return true;
  }

  /** Mods eines Exemplars (für die Anzeige im Börsen-Angebot). */
  const mods = (artikelId) => db.prepare("SELECT art, datum, notiz FROM wartungen WHERE artikel_id = ? AND art IN ('mod', 'recap', 'batterie', 'laufwerk', 'retrobright', 'reparatur') ORDER BY datum DESC").all(artikelId);

  /** Merkmale ändern: Moderationsteam direkt, alle anderen als Vorschlag. */
  function aendereMerkmale(benutzer, katalogId, eingabe = {}) {
    const merkmale = pruefeMerkmale(eingabe.merkmale);
    if (istModerator(benutzer)) {
      db.prepare('UPDATE katalog SET wartungsmerkmale = ? WHERE id = ?').run(eingabe.zuruecksetzen ? null : JSON.stringify(merkmale), katalogId);
      return { gespeichert: true };
    }
    const offen = db.prepare("SELECT COUNT(*) FROM wartungsmerkmal_vorschlaege WHERE benutzer_id = ? AND status = 'offen'").pluck().get(benutzer.id);
    if (offen >= 50) throw new ValidierungsFehler({ merkmale: 'Du hast schon viele offene Vorschläge – bitte warte auf die Prüfung.' });
    const begruendung = leerZuNull(eingabe.begruendung)?.slice(0, 500) ?? null;
    db.prepare("DELETE FROM wartungsmerkmal_vorschlaege WHERE katalog_id = ? AND benutzer_id = ? AND status = 'offen'").run(katalogId, benutzer.id);
    db.prepare('INSERT INTO wartungsmerkmal_vorschlaege (katalog_id, benutzer_id, merkmale, begruendung) VALUES (?, ?, ?, ?)')
      .run(katalogId, benutzer.id, JSON.stringify(merkmale), begruendung);
    return { vorgeschlagen: true };
  }

  function offeneVorschlaege(katalogId = null) {
    return db.prepare(`SELECT v.id, v.katalog_id, v.merkmale, v.begruendung, v.erstellt_am, k.titel, k.wartungsmerkmale AS aktuell,
        COALESCE(b.anzeigename, b.benutzername) AS von
      FROM wartungsmerkmal_vorschlaege v JOIN katalog k ON k.id = v.katalog_id LEFT JOIN benutzer b ON b.id = v.benutzer_id
      WHERE v.status = 'offen' AND (@k IS NULL OR v.katalog_id = @k) ORDER BY v.id LIMIT 200`).all({ k: katalogId })
      .map((v) => ({ ...v, merkmale: lies(v.merkmale), aktuell: lies(v.aktuell) }));
  }

  function entscheide(id, uebernehmen) {
    const v = db.prepare("SELECT * FROM wartungsmerkmal_vorschlaege WHERE id = ? AND status = 'offen'").get(Number(id));
    if (!v) return null;
    db.transaction(() => {
      if (uebernehmen) db.prepare('UPDATE katalog SET wartungsmerkmale = ? WHERE id = ?').run(v.merkmale, v.katalog_id);
      db.prepare('UPDATE wartungsmerkmal_vorschlaege SET status = ? WHERE id = ?').run(uebernehmen ? 'uebernommen' : 'abgelehnt', v.id);
    })();
    return v;
  }

  return { merkmaleKatalog, info, fuegeHinzu, loesche, mods, aendereMerkmale, offeneVorschlaege, entscheide };
}
