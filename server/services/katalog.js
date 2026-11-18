// Katalog: Zwischenspeicher für IGDB-Treffer und Heimat eigener Einträge
// (Hardware, Zubehör, deutsche Exoten, die in keiner Online-Datenbank stehen).
//
// Sichtbarkeit:
//  - „freigegeben“ (IGDB-Treffer oder vom Moderationsteam geprüft) → für alle sichtbar
//  - „privat“, „eingereicht“, „abgelehnt“ → nur für den Ersteller (und Moderatoren)

import { suchWoerter, wortVarianten, woerterBedingung, unscharfePassung } from './suchwoerter.js';
import { bekannteSpieleVerknuepfen, istBekanntesSerienSpiel } from './serienspiele.js';
import crypto from 'node:crypto';
import { istModerator, REGIONEN, coverRegionKette } from '../../shared/konstanten.js';
import { bereinigeProduktname, barcodeVarianten, suchbegriffe, plattformImNamen, rangiereTreffer, vergleichsTitel } from './titel.js';
import { nurZiffern } from '../../shared/barcode.js';
import { normSprachen } from '../../shared/sprachen.js';

/** Frühere Titel (JSON-Liste in katalog.weitere_titel) als Array. */
export function weitereTitelLesen(json) {
  try { const w = json ? JSON.parse(json) : []; return Array.isArray(w) ? w.filter((t) => typeof t === 'string' && t) : []; } catch { return []; }
}
const MAX_WEITERE_TITEL = 10;

export function katalogZeileZuObjekt(zeile) {
  if (!zeile) return null;
  const { daten: _daten, ...rest } = zeile;
  return {
    ...rest, plattformen: JSON.parse(zeile.plattformen || '[]'), ...('sprachen' in zeile ? { sprachen: normSprachen(zeile.sprachen) } : {}),
    ...('weitere_titel' in zeile ? { weitere_titel: weitereTitelLesen(zeile.weitere_titel) } : {}),
  };
}

/**
 * Entfernt interne Moderationsangaben für Unbeteiligte: KI-Hinweise sieht nur das Moderationsteam,
 * Prüfnotizen nur Ersteller und Moderationsteam.
 */
export function fuerBenutzer(eintrag, benutzer) {
  if (!eintrag) return eintrag;
  const moderator = istModerator(benutzer);
  const eigener = Boolean(benutzer && eintrag.erstellt_von === benutzer.id);
  const { ki_hinweis: kiHinweis, pruefung_notiz: notiz, ...rest } = eintrag;
  return {
    ...rest,
    ...(moderator ? { ki_hinweis: kiHinweis } : {}),
    ...(moderator || eigener ? { pruefung_notiz: notiz } : {}),
  };
}

/** SQL-Bedingung: Katalogeintrag (Alias k) ist für @benutzer sichtbar. */
export const SICHTBAR_SQL = "(k.status = 'freigegeben' OR k.erstellt_von = @benutzer OR @moderator = 1)";
export const sichtbarParameter = (benutzer) => ({ benutzer: benutzer?.id ?? -1, moderator: istModerator(benutzer) ? 1 : 0 });

export function istSichtbar(eintrag, benutzer) {
  if (!eintrag) return false;
  return eintrag.status === 'freigegeben' || Boolean(benutzer && (eintrag.erstellt_von === benutzer.id || istModerator(benutzer)));
}

// Suche: ab so vielen Treffern im eigenen Katalog wird IGDB nicht automatisch gefragt
const MINDEST_TREFFER = 5;
const ONLINE_JE_SEITE = 20;

// Bundles, Pakete und Zusatzinhalte stehen in Suchergebnissen hinter Hauptspielen, Remakes, Remastern usw.
export const NEBENTYPEN = ['bundle', 'pack', 'dlc', 'dlc_addon', 'expansion', 'update', 'mod', 'episode', 'season', 'fork'];
const NEBENTYPEN_SQL = NEBENTYPEN.map((t) => `'${t}'`).join(', ');
// Zusatzinhalte, die nur im Kasten „DLCs & Erweiterungen“ auftauchen – nie in der allgemeinen Suche, in Trends oder im Feed
export const VERSTECKTE_TYPEN = ['dlc', 'dlc_addon', 'pack'];
export const VERSTECKT_SQL = `COALESCE(k.spieltyp, '') NOT IN (${VERSTECKTE_TYPEN.map((t) => `'${t}'`).join(', ')})`;

export function erstelleKatalogDienst(db, { igdb, barcode, cache, plattformen, erweiterungen, zentrale }) {
  const upsert = db.prepare(`
    INSERT INTO katalog (quelle, externe_id, typ, titel, titel_original, igdb_url, plattformen, erscheinungsjahr, hersteller, cover_url, beschreibung,
                         erstellt_von, status, eingereicht_am, spieltyp)
    VALUES (@quelle, @externe_id, @typ, @titel, @titel_original, @igdb_url, @plattformen, @erscheinungsjahr, @hersteller, @cover_url, @beschreibung,
            @erstellt_von, @status, CASE WHEN @status = 'eingereicht' THEN datetime('now') END, @spieltyp)
    ON CONFLICT (quelle, externe_id) DO UPDATE SET
      spieltyp = COALESCE(excluded.spieltyp, katalog.spieltyp),
      titel = excluded.titel, titel_original = excluded.titel_original, igdb_url = COALESCE(excluded.igdb_url, katalog.igdb_url), plattformen = excluded.plattformen, erscheinungsjahr = excluded.erscheinungsjahr,
      hersteller = excluded.hersteller, cover_url = excluded.cover_url, beschreibung = excluded.beschreibung,
      aktualisiert_am = datetime('now')
    WHERE katalog.manuell_bearbeitet = 0
    RETURNING *`);
  const perQuelle = db.prepare('SELECT * FROM katalog WHERE quelle = ? AND externe_id = ?');
  // Sprachen kommen immer aus der Quelle – auch bei von Hand bearbeiteten Einträgen (dort gibt es kein Eingabefeld dafür)
  // Cover je Region (z. B. die europäische Fassung bei IGDB); nur Bilder von IGDB, nur bekannte Regionen
  const REGION_WERTE = new Set(REGIONEN.map((r) => r.value));
  const IGDB_BILD = /^https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_cover_big\/[a-z0-9]+\.jpg$/;
  const coverLoeschen = db.prepare("DELETE FROM katalog_cover WHERE katalog_id = ? AND quelle = 'igdb'");
  const coverSetzen = db.prepare("INSERT OR REPLACE INTO katalog_cover (katalog_id, region, url, quelle) VALUES (?, ?, ?, 'igdb')");
  const coverVon = db.prepare('SELECT region, url, quelle FROM katalog_cover WHERE katalog_id = ? ORDER BY region');
  function regionalCoverSetzen(katalogId, liste) {
    if (!katalogId || !Array.isArray(liste)) return;
    const gueltig = liste.filter((c) => REGION_WERTE.has(c?.region) && IGDB_BILD.test(String(c?.url ?? '')));
    coverLoeschen.run(katalogId);
    for (const c of gueltig) coverSetzen.run(katalogId, c.region, c.url);
  }
  /** Cover je Region eines Eintrags: [{ region, url, quelle }] (ohne das allgemeine Katalog-Cover). */
  const regionalCover = (katalogId) => coverVon.all(katalogId);
  /** Passendstes Cover für eine Region (PAL-DE → PAL-DE, PAL-EU) – sonst null (dann gilt das Katalog-Cover). */
  function coverFuerRegion(katalogId, region) {
    const vorhanden = coverVon.all(katalogId);
    for (const r of coverRegionKette(region)) {
      const treffer = vorhanden.find((c) => c.region === r);
      if (treffer) return treffer.url;
    }
    return null;
  }
  const sprachenSetzen = db.prepare(`UPDATE katalog SET sprachen = @sprachen
    WHERE quelle = @quelle AND externe_id = @externe_id AND sprachen IS NOT @sprachen`);
  const perId = db.prepare('SELECT * FROM katalog WHERE id = ?');
  const barcodeLesen = db.prepare('SELECT * FROM barcodes WHERE code = ?');
  const barcodeSchreiben = db.prepare(`
    INSERT INTO barcodes (code, produktname, quelle) VALUES (@code, @produktname, @quelle)
    ON CONFLICT (code) DO UPDATE SET produktname = excluded.produktname, quelle = excluded.quelle, abgerufen_am = datetime('now')`);
  // Eigene Zuordnung zuerst, danach freigegebene Einträge nach Häufigkeit
  const barcodeZuordnung = db.prepare(`
    SELECT k.*, SUM(z.benutzer_id = @benutzer) AS eigene, COUNT(*) AS anzahl
    FROM barcode_zuordnungen z JOIN katalog k ON k.id = z.katalog_id
    WHERE z.code = @code AND (k.status = 'freigegeben' OR z.benutzer_id = @benutzer)
    GROUP BY k.id ORDER BY eigene DESC, (k.status = 'freigegeben') DESC, anzahl DESC LIMIT 5`);
  const zuordnungSchreiben = db.prepare(`INSERT INTO barcode_zuordnungen (code, katalog_id, benutzer_id, plattform_id) VALUES (?, ?, ?, ?)
    ON CONFLICT (code, katalog_id, benutzer_id) DO UPDATE SET plattform_id = COALESCE(excluded.plattform_id, plattform_id)`);
  // Plattform eines Barcodes: eigene Zuordnung zuerst, sonst die häufigste
  const barcodePlattform = db.prepare(`SELECT z.plattform_id, p.name FROM barcode_zuordnungen z JOIN plattformen p ON p.id = z.plattform_id
    JOIN katalog k ON k.id = z.katalog_id WHERE z.code = @code AND (k.status = 'freigegeben' OR z.benutzer_id = @benutzer)
    GROUP BY z.plattform_id ORDER BY SUM(z.benutzer_id = @benutzer) DESC, COUNT(*) DESC LIMIT 1`);
  // Eigene Exemplare mit diesem Barcode – das neueste zuerst; Ausgabe (Variante, Fassung, Region) dient als Vorauswahl beim nächsten Erfassen
  const artikelMitBarcode = db.prepare(`SELECT id, titel, plattform, typ, bestand, katalog_id, variante_id, edition, region, plattform_id
    FROM artikel WHERE barcode = ? AND benutzer_id = ? ORDER BY id DESC`);

  // Titel der Exemplare nachziehen, wenn sich der Katalogtitel ändert (z. B. deutscher Titel nachgetragen oder korrigiert) –
  // nur Exemplare, die noch den bisherigen Katalogtitel tragen; selbst umbenannte bleiben, wie sie sind
  const exemplarTitel = db.prepare('UPDATE artikel SET titel = @neu WHERE katalog_id = @id AND titel = @alt');
  // Wird ein Eintrag umbenannt, merkt er sich den bisherigen Titel („auch bekannt als …“, wird bei der Suche mitgesucht)
  const weitereSetzen = db.prepare('UPDATE katalog SET weitere_titel = ? WHERE id = ?');
  function titelMerken(id, alt, neu) {
    if (!id || !alt || !neu || alt === neu) return;
    const zeile = perId.get(id);
    if (!zeile) return;
    const liste = weitereTitelLesen(zeile.weitere_titel).filter((t) => t.toLowerCase() !== neu.toLowerCase());
    if (alt.toLowerCase() === neu.toLowerCase() || liste.some((t) => t.toLowerCase() === alt.toLowerCase())) { weitereSetzen.run(liste.length ? JSON.stringify(liste) : null, id); return; }
    weitereSetzen.run(JSON.stringify([alt, ...liste].slice(0, MAX_WEITERE_TITEL)), id);
  }
  function titelNachziehen(id, alt, neu) {
    if (!id || !alt || !neu || alt === neu) return 0;
    return exemplarTitel.run({ id, alt, neu }).changes;
  }

  function speichere(eintrag) {
    const status = eintrag.status ?? (eintrag.quelle === 'igdb' ? 'freigegeben' : 'privat');
    const vorher = perQuelle.get(eintrag.quelle, eintrag.externe_id);
    const zeile = upsert.get({
      erstellt_von: null, titel_original: null, igdb_url: null, erscheinungsjahr: null, hersteller: null, cover_url: null, beschreibung: null, spieltyp: null,
      ...eintrag, status, plattformen: JSON.stringify(eintrag.plattformen ?? []),
    });
    const sprachen = normSprachen(eintrag.sprachen);
    if (sprachen) {
      sprachenSetzen.run({ sprachen: JSON.stringify(sprachen), quelle: eintrag.quelle, externe_id: eintrag.externe_id });
      if (zeile) zeile.sprachen = JSON.stringify(sprachen);
    }
    if (zeile && vorher) { titelMerken(zeile.id, vorher.titel, zeile.titel); titelNachziehen(zeile.id, vorher.titel, zeile.titel); }
    // Regionale Cover auch bei von Hand bearbeiteten Einträgen nachziehen (eigene Daten, überschreiben nichts Gepflegtes)
    if (eintrag.quelle === 'igdb' && eintrag.cover_regionen) regionalCoverSetzen(zeile?.id ?? vorher?.id, eintrag.cover_regionen);
    // Manuell bearbeitete Einträge werden von Importen (IGDB) nicht überschrieben
    if (!zeile) return katalogZeileZuObjekt(perQuelle.get(eintrag.quelle, eintrag.externe_id));
    plattformen?.verknuepfeKatalog(zeile.id, eintrag.plattformen);
    // Spiel zu einer bekannten Figurenserie (z. B. Monster in my Pocket): gleich verknüpfen, nicht erst beim nächsten Start
    if (zeile.typ === 'spiel' && istBekanntesSerienSpiel(zeile.titel)) bekannteSpieleVerknuepfen(db);
    let objekt = katalogZeileZuObjekt(zeile);
    // Andockpunkt „katalog.importiert“: Zusatzmodule können importierte Einträge ergänzen (Rückgabe = neuer Stand)
    if (eintrag.quelle !== 'eigen') for (const fn of erweiterungen?.alle('katalog.importiert') ?? []) objekt = fn(objekt) ?? objekt;
    return objekt;
  }

  /** Bearbeitung eines Eintrags durch Ersteller oder Moderation (auch IGDB-Einträge). */
  function aktualisiere(id, daten, { plattformenNeu = false } = {}) {
    return db.transaction(() => {
      const vorher = perId.get(id);
      const zeile = db.prepare(`UPDATE katalog SET typ = @typ, titel = @titel, plattformen = @plattformen,
          erscheinungsjahr = @erscheinungsjahr, hersteller = @hersteller, cover_url = @cover_url, beschreibung = @beschreibung,
          sammlerhinweise = @sammlerhinweise, seo_titel = @seo_titel, seo_beschreibung = @seo_beschreibung,
          jugendschutz = @jugendschutz, jugendschutz_seit = @jugendschutz_seit, jugendschutz_bis = @jugendschutz_bis,
          manuell_bearbeitet = CASE WHEN quelle = 'igdb' THEN 1 ELSE manuell_bearbeitet END, aktualisiert_am = datetime('now')
        WHERE id = @id RETURNING *`).get({
          sammlerhinweise: null, seo_titel: null, seo_beschreibung: null,
          // Jugendschutz bleibt, wenn der Aufrufer ihn nicht mitgibt
          jugendschutz: vorher?.jugendschutz ?? null, jugendschutz_seit: vorher?.jugendschutz_seit ?? null, jugendschutz_bis: vorher?.jugendschutz_bis ?? null,
          ...daten, plattformen: JSON.stringify(daten.plattformen ?? []), id,
        });
      if (zeile && vorher) { titelMerken(id, vorher.titel, zeile.titel); titelNachziehen(id, vorher.titel, zeile.titel); }
      if (plattformenNeu) db.prepare('DELETE FROM katalog_plattformen WHERE katalog_id = ?').run(id);
      plattformen?.verknuepfeKatalog(id, daten.plattformen);
      return katalogZeileZuObjekt(zeile);
    })();
  }

  /** Legt einen eigenen Katalogeintrag an (Status je nach Rolle und Wunsch). */
  /** Gibt es hier eine Moderation für Einreichungen (Zusatzmodul)? Sonst gehen Einreichungen an zockerdb.de. */
  const moderiert = () => (erweiterungen?.alle('katalog.eingereicht').length ?? 0) > 0;

  function legeEigenenAn(daten, benutzer, { einreichen = false, veroeffentlichen = false } = {}) {
    let status = 'privat';
    if (istModerator(benutzer) && veroeffentlichen) status = 'freigegeben';
    else if (einreichen && moderiert()) status = 'eingereicht';
    return speichere({ ...daten, quelle: 'eigen', externe_id: crypto.randomUUID(), erstellt_von: benutzer.id, status });
  }

  const holeEintrag = (id) => katalogZeileZuObjekt(perId.get(id));

  function holeSichtbar(id, benutzer) {
    const eintrag = holeEintrag(Number(id));
    return istSichtbar(eintrag, benutzer) ? eintrag : null;
  }

  // Wortweise und fehlertolerant (siehe suchwoerter.js); Abfragen je Wortzahl zwischengespeichert
  const lokaleSucheJeAnzahl = new Map();
  /**
   * Produktnummer vom Rücken bzw. Modellnummer (z. B. „BLES-00909“, „SLES 52345“, „DMG-ZLA-NOE“): Einträge, bei denen sie an einer
   * Variante (Community) oder an einem eigenen Exemplar hinterlegt ist. Verglichen wird ohne Bindestriche, Leerzeichen und Groß-/Kleinschreibung.
   */
  function sucheNachNummer(begriff, typ, benutzer) {
    const nummer = String(begriff ?? '').toUpperCase().replace(/[\s.\-_/]/g, '');
    if (!/^[A-Z0-9]{5,20}$/.test(nummer) || !/[A-Z]{2}/.test(nummer) || !/\d{3}/.test(nummer)) return [];
    const norm = (spalte) => `REPLACE(REPLACE(REPLACE(UPPER(${spalte}), '-', ''), ' ', ''), '.', '')`;
    return db.prepare(`SELECT k.* FROM katalog k WHERE k.id IN (
        SELECT v.katalog_id FROM katalog_varianten v WHERE ${norm('v.modellnummer')} = @nummer
          AND (v.status = 'freigegeben' OR v.erstellt_von = @benutzer OR @moderator = 1)
        UNION SELECT a.katalog_id FROM artikel a WHERE a.benutzer_id = @benutzer AND ${norm('a.modellnummer')} = @nummer)
      AND (@typ IS NULL OR k.typ = @typ) AND ${SICHTBAR_SQL} LIMIT 10`).all({ nummer, typ: typ ?? null, ...sichtbarParameter(benutzer) });
  }

  function sucheLokal(begriff, typ, benutzer) {
    const woerter = suchWoerter(begriff);
    if (!woerter.length) return [];
    const perNummer = sucheNachNummer(begriff, typ, benutzer);
    if (perNummer.length) return perNummer.map(katalogZeileZuObjekt);
    const { sql, parameter } = woerterBedingung(woerter, ['k.suchtext'], 'w', { normalisiert: true });
    // Je Wort Art und Zahl der Varianten („fc25“ hat zwei) – sonst passt die zwischengespeicherte Abfrage nicht zu den Parametern
    const schluessel = woerter.map((w) => { const { grenze, varianten } = wortVarianten(w); return (grenze ? 'z' : 'w') + varianten.length; }).join('');
    if (!lokaleSucheJeAnzahl.has(schluessel)) {
      lokaleSucheJeAnzahl.set(schluessel, db.prepare(`
        SELECT k.* FROM katalog k
        WHERE ${sql} AND (@typ IS NULL OR k.typ = @typ) AND ${SICHTBAR_SQL} AND ${VERSTECKT_SQL}
        ORDER BY (k.erstellt_von = @benutzer) DESC, (k.quelle = 'eigen') DESC, (k.titel LIKE @anfang ESCAPE '\\') DESC,
          (COALESCE(k.spieltyp, '') IN (${NEBENTYPEN_SQL})), length(k.titel)
        LIMIT 15`));
    }
    const anfang = `${begriff.trim().replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
    let genau = lokaleSucheJeAnzahl.get(schluessel)
      .all({ ...parameter, anfang, typ: typ ?? null, ...sichtbarParameter(benutzer) });
    // Wenige Treffer: Zusatzmodule dürfen weitere Einträge beisteuern (z. B. über alternative Titel wie
    // „Tamriel Unlimited“ für „The Elder Scrolls Online“) – nur sichtbare Einträge, keine doppelten
    if (genau.length < 5) {
      const weitere = [...new Set((erweiterungen?.alle('katalog.suche.weitere') ?? []).flatMap((fn) => fn(woerter, typ) ?? []))]
        .filter((id) => !genau.some((z) => z.id === id)).slice(0, 10);
      if (weitere.length) {
        genau = [...genau, ...db.prepare(`SELECT k.* FROM katalog k WHERE k.id IN (SELECT value FROM json_each(@ids)) AND (@typ IS NULL OR k.typ = @typ)
          AND ${SICHTBAR_SQL} AND ${VERSTECKT_SQL}`).all({ ids: JSON.stringify(weitere), typ: typ ?? null, ...sichtbarParameter(benutzer) })];
      }
    }
    if (genau.length || !woerter.some((w) => w.length >= 5)) return genau.map(katalogZeileZuObjekt);
    // Nichts gefunden: Tippfehler zulassen (Vorauswahl über die ersten zwei Buchstaben je Wort, dann Editierabstand)
    const vorWoerter = woerter.filter((w) => w.length >= 3 && !wortVarianten(w).grenze);
    const p = Object.fromEntries(vorWoerter.flatMap((w, i) => {
      const anfang2 = w.slice(0, 2).replace(/[\\%_]/g, (z) => `\\${z}`);
      return [[`u${i}`, `% ${anfang2}%`]];
    }));
    // Vorauswahl über den vorab normalisierten Suchtext (Titel, Originaltitel, frühere Titel – je mit Wortgrenzen)
    const vorauswahl = vorWoerter.map((_, i) => `k.suchtext LIKE @u${i} ESCAPE '\\'`).join(' AND ') || '1';
    return db.prepare(`SELECT k.* FROM katalog k WHERE ${vorauswahl} AND (@typ IS NULL OR k.typ = @typ) AND ${SICHTBAR_SQL} AND ${VERSTECKT_SQL} LIMIT 3000`)
      .all({ ...p, typ: typ ?? null, ...sichtbarParameter(benutzer) })
      .map((z) => ({ z, d: Math.min(...[unscharfePassung(z.titel, woerter), z.titel_original ? unscharfePassung(z.titel_original, woerter) : null,
        ...weitereTitelLesen(z.weitere_titel).map((t) => unscharfePassung(t, woerter))].map((x) => x ?? Infinity)) }))
      .filter((x) => Number.isFinite(x.d))
      .sort((a, b) => a.d - b.d || a.z.titel.length - b.z.titel.length)
      .slice(0, 15)
      .map(({ z }) => katalogZeileZuObjekt(z));
  }

  /**
   * Konsolen heißen im Katalog wie in der festen Plattformliste (deutscher Markt, z. B. „Super Nintendo“ statt
   * „Super Nintendo Entertainment System“); der IGDB-Name bleibt als Originaltitel suchbar.
   */
  function deutscherKonsolenname(eintrag) {
    if (eintrag.typ !== 'konsole') return eintrag;
    const p = plattformen?.zuordnen(eintrag.titel);
    if (!p || p.name === eintrag.titel) return eintrag;
    return { ...eintrag, titel: p.name, titel_original: eintrag.titel_original ?? eintrag.titel };
  }

  /** Online bei IGDB suchen (mit Cache, seitenweise) und Treffer im lokalen Katalog ablegen. */
  async function sucheOnline(begriff, typ = 'spiel', seite = 0) {
    if (!igdb.konfiguriert || typ === 'zubehoer' || typ === 'merch') return [];
    const schluessel = `igdb2:${typ}:${begriff.toLowerCase()}:${seite}`; // „2“: mit wortweisem Rückfall (alte, leere Treffer nicht weiterverwenden)
    const offset = seite * ONLINE_JE_SEITE;
    const treffer = await cache.merke(schluessel, async () => {
      if (typ === 'konsole') return igdb.sucheKonsolen(begriff, ONLINE_JE_SEITE, offset);
      const gefunden = await igdb.sucheSpiele(begriff, ONLINE_JE_SEITE, offset);
      // Die Volltextsuche von IGDB verzeiht keine fehlenden Apostrophe („assassins black flag“) – dann wortweise nachsehen
      if (seite > 0 || gefunden.length >= 3 || suchWoerter(begriff).length < 2) return gefunden;
      const woertlich = await igdb.sucheSpieleWoerter(suchWoerter(begriff).map((w) => wortVarianten(w)), ONLINE_JE_SEITE).catch(() => []);
      const bekannt = new Set(gefunden.map((e) => e.externe_id));
      return [...gefunden, ...woertlich.filter((e) => !bekannt.has(e.externe_id))];
    });
    return db.transaction(() => treffer.map(deutscherKonsolenname).map(speichere))();
  }

  /**
   * Suche in Stufen, damit IGDB möglichst selten gefragt wird:
   *  1. Immer zuerst der eigene Katalog.
   *  2. Nur wenn er weniger als MINDEST_TREFFER Einträge liefert, automatisch bei IGDB nachsehen.
   *  3. Sonst meldet `mehrOnline`, dass der Benutzer bei Bedarf selbst „Weitere Ergebnisse“ laden kann
   *     (`online: true`, danach seitenweise mit `seite`).
   */
  async function suche(begriff, typ, benutzer, { online: onlineGewuenscht = false, seite = 0, mindestTreffer = MINDEST_TREFFER } = {}) {
    const text = String(begriff ?? '').trim();
    if (text.length < 2) return { lokal: [], online: [], fehler: null, mehrOnline: false };
    const lokal = sucheLokal(text, typ || null, benutzer);
    // Mit Verbindung zu zockerdb.de sucht die Zentrale (Katalog + IGDB), sonst IGDB mit eigenen Zugangsdaten.
    // Reine Nummern (z. B. eine eingetippte EAN) findet IGDB nie – dafür gibt es die Barcode-Suche.
    const zentral = Boolean(zentrale?.aktiv);
    const onlineMoeglich = !nurZiffern(text) && (zentral || (igdb.konfiguriert && typ !== 'zubehoer' && typ !== 'merch'));
    const fragen = onlineMoeglich && (onlineGewuenscht || lokal.length < mindestTreffer);
    let online = [];
    let fehler = null;
    let mehr = null;
    let seiteZentral = null;
    if (fragen) {
      try {
        if (zentral) {
          const r = await zentrale.suche(text, typ, { online: onlineGewuenscht, seite });
          online = db.transaction(() => r.treffer.map(speichere))();
          mehr = r.mehrOnline;
          seiteZentral = r.seite;
        } else {
          online = await sucheOnline(text, typ || 'spiel', seite);
        }
      } catch (e) {
        // zockerdb.de nicht erreichbar: verständlicher Hinweis, die eigenen Treffer bleiben sichtbar
        fehler = zentral && !e.status
          ? 'zockerdb.de ist gerade nicht erreichbar – angezeigt werden nur Einträge aus deinem Katalog. Bitte später erneut versuchen.'
          : e.message;
      }
    }
    const lokaleIds = new Set(lokal.map((e) => e.id));
    return {
      lokal,
      online: online.filter((e) => e && !lokaleIds.has(e.id) && istSichtbar(e, benutzer)),
      fehler,
      // Weitere Online-Ergebnisse: noch nicht gefragt, oder die letzte Seite war voll
      mehrOnline: onlineMoeglich && !fehler && (!fragen || (zentral ? mehr : online.length >= ONLINE_JE_SEITE)),
      seite: fragen ? (zentral ? seiteZentral : seite) : null,
    };
  }

  /**
   * Barcode auflösen:
   *  1. Bereits zugeordnet (eigene Zuordnung oder zu einem freigegebenen Eintrag)?
   *  2. Sonst Produktname über Barcode-Datenbanken ermitteln und bei IGDB suchen.
   */
  async function sucheBarcode(code, benutzer) {
    const varianten = barcodeVarianten(code);
    const vorhandeneArtikel = varianten.flatMap((v) => artikelMitBarcode.all(v, benutzer.id));
    const zugeordnet = varianten.flatMap((v) => barcodeZuordnung.all({ code: v, benutzer: benutzer.id })).map(katalogZeileZuObjekt);
    let bekannt = varianten.map((v) => barcodeLesen.get(v)).find(Boolean);
    const gelernt = varianten.map((v) => barcodePlattform.get({ code: v, benutzer: benutzer.id })).find(Boolean);
    if (zugeordnet.length) {
      return { code, produktname: bekannt?.produktname ?? null, quelle: 'lokal', suchbegriff: zugeordnet[0].titel,
        treffer: zugeordnet, vorhandeneArtikel, fehler: null, plattform_id: gelernt?.plattform_id ?? null, plattform: gelernt?.name ?? null };
    }

    // Mit Verbindung zu zockerdb.de: Barcode dort auflösen (gemeinsam gelernte Barcodes, Barcode-Datenbanken, IGDB)
    if (zentrale?.aktiv) {
      try {
        const r = await zentrale.barcode(code);
        if (r.produktname && !bekannt) barcodeSchreiben.run({ code, produktname: r.produktname, quelle: r.quelle });
        const treffer = db.transaction(() => r.treffer.map(speichere))().filter(Boolean);
        const p = r.plattform ? plattformen?.zuordnen(r.plattform) : null;
        return { code, produktname: r.produktname ?? bekannt?.produktname ?? null, quelle: r.quelle, suchbegriff: treffer[0]?.titel ?? null,
          treffer, vorhandeneArtikel, fehler: null, plattform_id: p?.id ?? null, plattform: p?.name ?? null };
      } catch (e) {
        return { code, produktname: bekannt?.produktname ?? null, quelle: null, suchbegriff: null, treffer: [], vorhandeneArtikel,
          fehler: e.status ? e.message : 'zockerdb.de ist gerade nicht erreichbar – der Barcode kann erst später erkannt werden. Du kannst den Titel auch per Suche finden.' };
      }
    }

    let fehler = null;
    if (!bekannt?.produktname) {
      try {
        const gefunden = await barcode.sucheProduktname(code);
        if (gefunden) {
          barcodeSchreiben.run({ code, produktname: gefunden.produktname, quelle: gefunden.quelle });
          bekannt = { code, ...gefunden };
        }
      } catch (e) {
        fehler = e.message;
      }
    }

    const produktname = bekannt?.produktname ?? null;
    let suchbegriff = produktname ? bereinigeProduktname(produktname) : null;
    let treffer = [];
    // Händlertitel („… - Bonus Edition - Ps3 Boxed + Instructions“) schrittweise vereinfachen, bis etwas passt.
    // Passt schon ein Eintrag im Katalog, wird IGDB nicht gefragt.
    // Treffer aller Begriffe sammeln, bis ein Titel genau passt (sonst stünde z. B. nur eine Edition zur Wahl).
    const begriffe = produktname ? suchbegriffe(produktname) : [];
    const ziele = new Set(begriffe.map(vergleichsTitel));
    const gesehen = new Set();
    for (const begriff of begriffe) {
      const ergebnis = await suche(begriff, 'spiel', benutzer, { mindestTreffer: 1 });
      const neu = [...ergebnis.lokal, ...ergebnis.online].filter((e) => !gesehen.has(e.id));
      neu.forEach((e) => gesehen.add(e.id));
      if (neu.length && !treffer.length) suchbegriff = begriff;
      treffer.push(...neu);
      fehler ??= ergebnis.fehler;
      if (treffer.some((e) => [e.titel, e.titel_original].some((t) => t && ziele.has(vergleichsTitel(t))))) break;
    }
    if (treffer.length) fehler = null;
    // Plattform aus dem Produktnamen (z. B. „Ps3“): passende Einträge zuerst
    const plattformName = produktname ? plattformImNamen(produktname) : null;
    const p = plattformName ? plattformen?.zuordnen(plattformName) : null;
    // Beste Übereinstimmung mit dem Produktnamen zuerst (Hauptspiel vor Editionen/Zusatzinhalten), dann passende Plattform
    if (produktname) treffer = rangiereTreffer(treffer, suchbegriffe(produktname, 20), p?.name ?? null, NEBENTYPEN);
    return { code, produktname, quelle: bekannt?.quelle ?? null, suchbegriff, treffer, vorhandeneArtikel, fehler, plattform_id: p?.id ?? null, plattform: p?.name ?? null };
  }

  /**
   * Entfernt die eigene Zuordnung „Barcode → Katalogeintrag“ (z. B. wenn ein Exemplar einem anderen Eintrag zugeordnet wird),
   * damit der nächste Scan nicht wieder zum alten Treffer führt. Zuordnungen anderer Benutzer bleiben.
   */
  const zuordnungLoeschen = db.prepare('DELETE FROM barcode_zuordnungen WHERE code = ? AND katalog_id = ? AND benutzer_id = ?');
  function entferneBarcodeZuordnung(code, katalogId, benutzerId) {
    if (!code || !katalogId) return 0;
    return zuordnungLoeschen.run(code, katalogId, benutzerId).changes;
  }

  /**
   * Löscht einen eigenen, privaten Katalogeintrag, den nichts mehr braucht (kein Exemplar, keine Wunschliste, keine Fotos/Scans, keine
   * Ausgaben, Kommentare, Angebote …). Liefert true, wenn gelöscht wurde. Fremde oder freigegebene Einträge bleiben immer.
   */
  const VERWENDUNG = [['artikel', 'katalog_id'], ['artikel', 'spiel_katalog_id'], ['wunschliste', 'katalog_id'], ['medien', 'katalog_id'], ['katalog_varianten', 'katalog_id'],
    ['kommentare', 'katalog_id'], ['angebote', 'katalog_id'], ['erfahrungsberichte', 'katalog_id'], ['externe_links', 'katalog_id'], ['spielhilfen', 'katalog_id'],
    ['beleg_beitraege', 'katalog_id'], ['instanz_einreichungen', 'katalog_id'], ['artikel_erweiterungen', 'katalog_id']];
  function loescheUngenutztenEigenen(id, benutzerId) {
    const e = perId.get(id);
    if (!e || e.quelle !== 'eigen' || e.status !== 'privat' || e.erstellt_von !== benutzerId) return false;
    for (const [tabelle, spalte] of VERWENDUNG) {
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tabelle)) continue;
      if (db.prepare(`SELECT 1 FROM ${tabelle} WHERE ${spalte} = ? LIMIT 1`).get(id)) return false;
    }
    db.prepare('DELETE FROM katalog WHERE id = ?').run(id);
    return true;
  }

  /** Merkt sich, zu welchem Katalogeintrag ein Barcode gehört (lernender Cache, je Benutzer). */
  function verknuepfeBarcode(code, katalogId, benutzerId, plattformId = null) {
    if (!code || !katalogId || !perId.get(katalogId)) return;
    zuordnungSchreiben.run(code, katalogId, benutzerId, plattformId ?? null);
  }

  /** Jeder Artikel braucht einen Katalogeintrag (für Scans, Kommentare, Varianten) – notfalls privat. */
  function stelleSicherFuerArtikel(artikel, benutzer) {
    if (artikel.katalog_id) return artikel.katalog_id;
    const eintrag = legeEigenenAn({
      typ: artikel.typ, titel: artikel.titel, plattformen: artikel.plattform ? [artikel.plattform] : [],
      cover_url: artikel.cover_url?.startsWith('http') ? artikel.cover_url : null,
    }, benutzer);
    db.prepare('UPDATE artikel SET katalog_id = ? WHERE id = ?').run(eintrag.id, artikel.id);
    return eintrag.id;
  }

  return {
    speichere, aktualisiere, legeEigenenAn, regionalCover, coverFuerRegion, regionalCoverSetzen, moderiert, holeEintrag, holeSichtbar, sucheLokal, suche, sucheBarcode, verknuepfeBarcode, entferneBarcodeZuordnung, loescheUngenutztenEigenen, stelleSicherFuerArtikel,
    deutscherKonsolenname, titelNachziehen,
  };
}
