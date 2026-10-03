// Katalog: Zwischenspeicher für IGDB-Treffer und Heimat eigener Einträge
// (Hardware, Zubehör, deutsche Exoten, die in keiner Online-Datenbank stehen).
//
// Sichtbarkeit:
//  - „freigegeben“ (IGDB-Treffer oder vom Moderationsteam geprüft) → für alle sichtbar
//  - „privat“, „eingereicht“, „abgelehnt“ → nur für den Ersteller (und Moderatoren)

import { suchWoerter, wortVarianten, woerterBedingung } from './suchwoerter.js';
import crypto from 'node:crypto';
import { istModerator } from '../../shared/konstanten.js';
import { bereinigeProduktname, barcodeVarianten, suchbegriffe, plattformImNamen, rangiereTreffer, vergleichsTitel } from './titel.js';
import { nurZiffern } from '../../shared/barcode.js';
import { normSprachen } from '../../shared/sprachen.js';

export function katalogZeileZuObjekt(zeile) {
  if (!zeile) return null;
  const { daten: _daten, ...rest } = zeile;
  return { ...rest, plattformen: JSON.parse(zeile.plattformen || '[]'), ...('sprachen' in zeile ? { sprachen: normSprachen(zeile.sprachen) } : {}) };
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
  const artikelMitBarcode = db.prepare('SELECT id, titel, plattform, typ, bestand FROM artikel WHERE barcode = ? AND benutzer_id = ?');

  function speichere(eintrag) {
    const status = eintrag.status ?? (eintrag.quelle === 'igdb' ? 'freigegeben' : 'privat');
    const zeile = upsert.get({
      erstellt_von: null, titel_original: null, igdb_url: null, erscheinungsjahr: null, hersteller: null, cover_url: null, beschreibung: null, spieltyp: null,
      ...eintrag, status, plattformen: JSON.stringify(eintrag.plattformen ?? []),
    });
    const sprachen = normSprachen(eintrag.sprachen);
    if (sprachen) {
      sprachenSetzen.run({ sprachen: JSON.stringify(sprachen), quelle: eintrag.quelle, externe_id: eintrag.externe_id });
      if (zeile) zeile.sprachen = JSON.stringify(sprachen);
    }
    // Manuell bearbeitete Einträge werden von Importen (IGDB) nicht überschrieben
    if (!zeile) return katalogZeileZuObjekt(perQuelle.get(eintrag.quelle, eintrag.externe_id));
    plattformen?.verknuepfeKatalog(zeile.id, eintrag.plattformen);
    let objekt = katalogZeileZuObjekt(zeile);
    // Andockpunkt „katalog.importiert“: Zusatzmodule können importierte Einträge ergänzen (Rückgabe = neuer Stand)
    if (eintrag.quelle !== 'eigen') for (const fn of erweiterungen?.alle('katalog.importiert') ?? []) objekt = fn(objekt) ?? objekt;
    return objekt;
  }

  /** Bearbeitung eines Eintrags durch Ersteller oder Moderation (auch IGDB-Einträge). */
  function aktualisiere(id, daten, { plattformenNeu = false } = {}) {
    return db.transaction(() => {
      const zeile = db.prepare(`UPDATE katalog SET typ = @typ, titel = @titel, plattformen = @plattformen,
          erscheinungsjahr = @erscheinungsjahr, hersteller = @hersteller, cover_url = @cover_url, beschreibung = @beschreibung,
          sammlerhinweise = @sammlerhinweise, seo_titel = @seo_titel, seo_beschreibung = @seo_beschreibung,
          manuell_bearbeitet = CASE WHEN quelle = 'igdb' THEN 1 ELSE manuell_bearbeitet END, aktualisiert_am = datetime('now')
        WHERE id = @id RETURNING *`).get({ sammlerhinweise: null, seo_titel: null, seo_beschreibung: null, ...daten, plattformen: JSON.stringify(daten.plattformen ?? []), id });
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
  function sucheLokal(begriff, typ, benutzer) {
    const woerter = suchWoerter(begriff);
    if (!woerter.length) return [];
    const { sql, parameter } = woerterBedingung(woerter, ['k.titel', 'k.titel_original']);
    const schluessel = woerter.map((w) => (wortVarianten(w).grenze ? 'z' : 'w')).join('');
    if (!lokaleSucheJeAnzahl.has(schluessel)) {
      lokaleSucheJeAnzahl.set(schluessel, db.prepare(`
        SELECT k.* FROM katalog k
        WHERE ${sql} AND (@typ IS NULL OR k.typ = @typ) AND ${SICHTBAR_SQL}
        ORDER BY (k.erstellt_von = @benutzer) DESC, (k.quelle = 'eigen') DESC, (k.titel LIKE @anfang ESCAPE '\\') DESC,
          (COALESCE(k.spieltyp, '') IN (${NEBENTYPEN_SQL})), length(k.titel)
        LIMIT 15`));
    }
    const anfang = `${begriff.trim().replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
    return lokaleSucheJeAnzahl.get(schluessel)
      .all({ ...parameter, anfang, typ: typ ?? null, ...sichtbarParameter(benutzer) })
      .map(katalogZeileZuObjekt);
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
    if (!igdb.konfiguriert || typ === 'zubehoer') return [];
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
    const onlineMoeglich = !nurZiffern(text) && (zentral || (igdb.konfiguriert && typ !== 'zubehoer'));
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
    speichere, aktualisiere, legeEigenenAn, moderiert, holeEintrag, holeSichtbar, sucheLokal, suche, sucheBarcode, verknuepfeBarcode, stelleSicherFuerArtikel,
    deutscherKonsolenname,
  };
}
