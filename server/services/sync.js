// Sync der Sammlung zwischen einer selbst gehosteten Installation und dem eigenen Konto auf zockerdb.de.
//
// - Beide Richtungen: Änderungen von hier gehen zu zockerdb.de, Änderungen dort (z. B. unterwegs) kommen hierher.
// - Jeder Artikel hat auf beiden Seiten dieselbe Kennung (sync_uuid). Bei Konflikten gewinnt die jüngere Änderung
//   (aktualisiert_am); eine Löschung gewinnt, wenn sie nach der letzten Änderung passiert ist.
// - Katalogeinträge werden über die ZockerDB-ID verbunden; eigene, private Einträge werden auf der Gegenseite neu angelegt.
// - Scans und Handbücher bleiben immer zu Hause. Eigene Fotos gehen nur mit, wenn der Benutzer es je Artikel einschaltet
//   (verkleinerte Vorschau, zählt auf zockerdb.de zum Speicherplatz). Fotos von zockerdb.de werden zu Hause gespeichert.
// - Erfolge gibt es nur auf zockerdb.de – der Sync löst dort die Prüfung aus.
//
// Die Funktionen `aenderungenSeit` und `wendeAn` nutzen beide Seiten (die Gegenseite in ihrem Zusatzmodul).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { pruefeArtikel, ValidierungsFehler } from './validierung.js';
import { verschluessele, entschluessele } from './sicherheit.js';
import { zentralZuEintrag } from './zentrale.js';

const SEITE = 500;
const FELDER = ['typ', 'titel', 'plattform', 'barcode', 'cover_url', 'zustand', 'vollstaendigkeit', 'region', 'farbe', 'edition',
  'modellnummer', 'seriennummer', 'notizen', 'kaufpreis', 'kaufdatum', 'anzahl', 'marktwert', 'herkunft', 'bestand', 'abgang_am', 'verkaufspreis', 'digital_quelle', 'spielstatus', 'durchgespielt_am', 'spielzeit_minuten',
  'lagerort_ort', 'lagerort_regal', 'lagerort_fach', 'beilagen', 'seriennummer_ovp', 'privat', 'zustand_ovp',
  'neupreis', 'erstkauf_datum', 'erstkauf_quelle', 'kauf_quelle', 'beilagen_notiz', 'drucknummer', 'zustand_inlay', 'inlay_maengel'];
const ZEIT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const UUID = /^[0-9a-f]{32}$/;
const IMPORTARTEN = ['csv', 'sicherung', 'steam'];
const jetzt = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export const dateiHash = (puffer) => crypto.createHash('sha256').update(puffer).digest('hex');

/** Stand (Cursor) lesen – bewusst tolerant: unbekannt = von vorn. */
function leseStand(roh) {
  try {
    const s = typeof roh === 'string' ? JSON.parse(roh) : roh;
    return {
      a: [ZEIT.test(s?.a?.[0]) ? s.a[0] : '1970-01-01 00:00:00', Number.isInteger(s?.a?.[1]) ? s.a[1] : 0],
      g: [ZEIT.test(s?.g?.[0]) ? s.g[0] : '1970-01-01 00:00:00', typeof s?.g?.[1] === 'string' ? s.g[1] : ''],
    };
  } catch {
    return leseStand(null);
  }
}

/**
 * Änderungen eines Benutzers seit einem Stand – seitenweise. Die laufende Sekunde wird ausgelassen (kommt beim nächsten
 * Mal), damit keine Änderung durch gleiche Zeitstempel verloren geht.
 * `zockerdbId(zeile)` liefert die gemeinsame Katalog-ID (oder null).
 */
export function aenderungenSeit(db, benutzerId, stand, { zockerdbId, bildHash = () => null }) {
  const s = leseStand(stand);
  const grenze = jetzt();
  const zeilen = db.prepare(`SELECT a.*, k.quelle AS k_quelle, k.externe_id AS k_externe_id, k.status AS k_status,
      v.bezeichnung AS v_bezeichnung, v.modellnummer AS v_modellnummer, v.farbe AS v_farbe, v.edition AS v_edition,
      v.region AS v_region, v.erscheinungsjahr AS v_jahr
    FROM artikel a LEFT JOIN katalog k ON k.id = a.katalog_id LEFT JOIN katalog_varianten v ON v.id = a.variante_id
    WHERE a.benutzer_id = @b AND a.aktualisiert_am < @grenze
      AND (a.aktualisiert_am > @t OR (a.aktualisiert_am = @t AND a.id > @id))
    ORDER BY a.aktualisiert_am, a.id LIMIT ${SEITE}`).all({ b: benutzerId, grenze, t: s.a[0], id: s.a[1] });
  const geloescht = db.prepare(`SELECT sync_uuid, geloescht_am FROM artikel_geloescht
    WHERE benutzer_id = @b AND geloescht_am < @grenze AND (geloescht_am > @t OR (geloescht_am = @t AND sync_uuid > @u))
    ORDER BY geloescht_am, sync_uuid LIMIT ${SEITE}`).all({ b: benutzerId, grenze, t: s.g[0], u: s.g[1] });
  const letzte = zeilen.at(-1);
  const letzteG = geloescht.at(-1);
  return {
    artikel: zeilen.map((z) => ({
      sync_uuid: z.sync_uuid,
      ...Object.fromEntries(FELDER.map((f) => [f, z[f]])),
      zockerdb_id: zockerdbId(z),
      erstellt_am: z.erstellt_am,
      aktualisiert_am: z.aktualisiert_am,
      importiert_aus: z.importiert_aus ?? null,
      bild: z.bild_datei ? bildHash(z) : null,
      // Foto wurde entfernt – die Gegenseite entfernt ihre Kopie ebenfalls
      bild_entfernt: !z.bild_datei && z.sync_bild_hash === 'geloescht',
      // Variante/Revision über ihre Bezeichnung (IDs sind je Server verschieden)
      variante: z.v_bezeichnung ? {
        bezeichnung: z.v_bezeichnung, modellnummer: z.v_modellnummer, farbe: z.v_farbe, edition: z.v_edition, region: z.v_region,
        erscheinungsjahr: z.v_jahr,
      } : null,
    })),
    geloescht,
    stand: JSON.stringify({ a: letzte ? [letzte.aktualisiert_am, letzte.id] : s.a, g: letzteG ? [letzteG.geloescht_am, letzteG.sync_uuid] : s.g }),
    weitere: zeilen.length === SEITE || geloescht.length === SEITE,
  };
}

/**
 * Änderungen der Gegenseite übernehmen (jüngere Änderung gewinnt). Daten von außen werden wie Eingaben geprüft.
 * `katalogIdFuer(zockerdbId)` liefert die lokale Katalog-ID; ohne Treffer wird ein eigener, privater Eintrag angelegt.
 */
export function wendeAn(db, benutzer, { artikel = [], geloescht = [] }, { katalogIdFuer, katalog, plattformen, dateien, fotoEntfernen = () => true }) {
  const ergebnis = { neu: 0, geaendert: 0, geloescht: 0, uebersprungen: 0, fehler: [] };
  const lokal = db.prepare('SELECT * FROM artikel WHERE benutzer_id = ? AND sync_uuid = ?');
  const grab = db.prepare('SELECT geloescht_am FROM artikel_geloescht WHERE benutzer_id = ? AND sync_uuid = ?');
  const grabWeg = db.prepare('DELETE FROM artikel_geloescht WHERE benutzer_id = ? AND sync_uuid = ?');
  const varianteSuchen = db.prepare(`SELECT id FROM katalog_varianten WHERE katalog_id = @k AND lower(bezeichnung) = lower(@b)
      AND (status = 'freigegeben' OR erstellt_von = @benutzer) ORDER BY status = 'freigegeben' DESC, id LIMIT 1`);
  const varianteAnlegen = db.prepare(`INSERT INTO katalog_varianten (katalog_id, bezeichnung, modellnummer, farbe, edition, region, erscheinungsjahr,
      status, erstellt_von) VALUES (@katalog_id, @bezeichnung, @modellnummer, @farbe, @edition, @region, @erscheinungsjahr, 'privat', @benutzer) RETURNING id`);
  const text = (w, max) => (typeof w === 'string' && w.trim() ? w.trim().slice(0, max) : null);
  /** Variante der Gegenseite zuordnen – gibt es sie hier nicht, wird sie als private Variante angelegt. */
  function varianteFuer(katalogId, v) {
    const bezeichnung = text(v?.bezeichnung, 200);
    if (!katalogId || !bezeichnung) return null;
    const vorhanden = varianteSuchen.get({ k: katalogId, b: bezeichnung, benutzer: benutzer.id });
    if (vorhanden) return vorhanden.id;
    const jahr = Number(v.erscheinungsjahr);
    return varianteAnlegen.get({
      katalog_id: katalogId, bezeichnung, modellnummer: text(v.modellnummer, 100), farbe: text(v.farbe, 100), edition: text(v.edition, 100),
      region: text(v.region, 20), erscheinungsjahr: Number.isInteger(jahr) && jahr > 1950 && jahr < 2100 ? jahr : null, benutzer: benutzer.id,
    }).id;
  }
  const grenze = jetzt();
  const zeit = (w) => (ZEIT.test(w ?? '') ? (w > grenze ? grenze : w) : null); // Zeitstempel aus der Zukunft kappen

  db.transaction(() => {
    for (const roh of artikel.slice(0, SEITE)) {
      const uuid = String(roh?.sync_uuid ?? '');
      const geaendert = zeit(roh?.aktualisiert_am);
      if (!UUID.test(uuid) || !geaendert) {
        ergebnis.fehler.push({ sync_uuid: uuid, fehler: 'Ungültige Kennung oder Zeitangabe.' });
        continue;
      }
      const vorhanden = lokal.get(benutzer.id, uuid);
      const tot = grab.get(benutzer.id, uuid);
      if ((vorhanden && vorhanden.aktualisiert_am >= geaendert) || (!vorhanden && tot && tot.geloescht_am >= geaendert)) {
        ergebnis.uebersprungen += 1;
        continue;
      }
      let daten;
      try {
        // Ältere Gegenstellen kennen den Bestand noch nicht – dann bleibt er wie er ist
        const eingabe = Object.fromEntries(FELDER.map((f) => [f, roh[f]]));
        if (roh.bestand === undefined && vorhanden) Object.assign(eingabe, { bestand: vorhanden.bestand, abgang_am: vorhanden.abgang_am, verkaufspreis: vorhanden.verkaufspreis, digital_quelle: vorhanden.digital_quelle });
        // Ebenso Lagerort, Beilagen und Seriennummer der OVP (neuere Felder)
        if (vorhanden) for (const f of ['lagerort_ort', 'lagerort_regal', 'lagerort_fach', 'beilagen', 'seriennummer_ovp', 'privat', 'zustand_ovp',
          'neupreis', 'erstkauf_datum', 'erstkauf_quelle', 'kauf_quelle', 'beilagen_notiz', 'drucknummer', 'zustand_inlay', 'inlay_maengel']) if (roh[f] === undefined) eingabe[f] = vorhanden[f];
        daten = pruefeArtikel(eingabe);
      } catch (e) {
        ergebnis.fehler.push({ sync_uuid: uuid, fehler: e instanceof ValidierungsFehler ? Object.values(e.fehler ?? {}).join(' ') || e.message : e.message });
        continue;
      }
      const p = daten.plattform ? plattformen?.zuordnen(daten.plattform) : null;
      daten.plattform_id = p?.id ?? null;
      if (p) daten.plattform = p.name;
      const zid = Number(roh.zockerdb_id);
      daten.katalog_id = Number.isInteger(zid) && zid > 0 ? katalogIdFuer(zid) : null;
      // Eigene Zuordnung (privater Eintrag) behalten, wenn es keinen gemeinsamen Eintrag gibt
      if (!daten.katalog_id && vorhanden?.katalog_id) daten.katalog_id = vorhanden.katalog_id;
      daten.variante_id = varianteFuer(daten.katalog_id, roh.variante);
      const felder = [...FELDER, 'plattform_id', 'katalog_id', 'variante_id'];
      if (vorhanden) {
        db.prepare(`UPDATE artikel SET ${felder.map((f) => `${f} = @${f}`).join(', ')}, aktualisiert_am = @aktualisiert_am WHERE id = @id`)
          .run({ ...daten, aktualisiert_am: geaendert, id: vorhanden.id });
        if (roh.bild_entfernt === true && vorhanden.bild_datei && fotoEntfernen(vorhanden)) {
          db.prepare('UPDATE artikel SET bild_datei = NULL, bild_groesse = NULL, sync_bild_hash = NULL WHERE id = ?').run(vorhanden.id);
          dateien?.loesche(vorhanden.bild_datei);
        }
        ergebnis.geaendert += 1;
      } else {
        // Importierte Exemplare bleiben auch auf der Gegenseite als Import markiert (zählen nicht als Neuzugang)
        const importiertAus = IMPORTARTEN.includes(roh.importiert_aus) ? roh.importiert_aus : null;
        const neu = db.prepare(`INSERT INTO artikel (benutzer_id, sync_uuid, ${felder.join(', ')}, erstellt_am, aktualisiert_am, importiert_aus)
          VALUES (@benutzer_id, @sync_uuid, ${felder.map((f) => `@${f}`).join(', ')}, @erstellt_am, @aktualisiert_am, @importiert_aus) RETURNING id`)
          .get({ ...daten, benutzer_id: benutzer.id, sync_uuid: uuid, erstellt_am: zeit(roh.erstellt_am) ?? geaendert, aktualisiert_am: geaendert, importiert_aus: importiertAus });
        if (!daten.katalog_id) katalog.stelleSicherFuerArtikel({ ...daten, id: neu.id }, benutzer);
        // Das Anlegen des privaten Katalogeintrags ändert den Zeitstempel nicht
        db.prepare('UPDATE artikel SET aktualisiert_am = ? WHERE id = ?').run(geaendert, neu.id);
        grabWeg.run(benutzer.id, uuid);
        ergebnis.neu += 1;
      }
    }
    for (const g of geloescht.slice(0, SEITE)) {
      const uuid = String(g?.sync_uuid ?? '');
      const am = zeit(g?.geloescht_am);
      if (!UUID.test(uuid) || !am) continue;
      const vorhanden = lokal.get(benutzer.id, uuid);
      if (!vorhanden || vorhanden.aktualisiert_am > am) continue;
      db.prepare('DELETE FROM artikel WHERE id = ?').run(vorhanden.id);
      db.prepare('UPDATE artikel_geloescht SET geloescht_am = ? WHERE benutzer_id = ? AND sync_uuid = ?').run(am, benutzer.id, uuid);
      dateien?.loesche(vorhanden.bild_datei);
      ergebnis.geloescht += 1;
    }
  })();
  return ergebnis;
}

/** Verkleinerte Vorschau eines eigenen Fotos für zockerdb.de (ohne Metadaten wie GPS). */
export async function vorschauBild(pfad) {
  return sharp(pfad).rotate().resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
}

/** Selbst gehostete Seite: Verbindung je Benutzer und der eigentliche Abgleich mit zockerdb.de. */
export function erstelleSyncDienst(db, { zentrale, katalog, schluessel, dateien, speicher, plattformen, erweiterungen }) {
  const verbindung = db.prepare('SELECT * FROM sync_verbindungen WHERE benutzer_id = ?');
  const laufend = new Set();

  const token = (v) => entschluessele(v.token, schluessel);
  const syncAnfrage = (v, pfad, optionen = {}) => zentrale.roh(`/api/sync${pfad}`, { ...optionen, token: token(v), zeit: 60_000 });

  /** Verbindet ein Konto mit einem Sync-Schlüssel von zockerdb.de (Konto → „Selbst gehosteten Server verbinden“). */
  async function verbinden(benutzer, sync) {
    const t = String(sync ?? '').trim();
    if (!/^zs_[A-Za-z0-9_-]{20,100}$/.test(t)) throw new ValidierungsFehler({ token: 'Bitte den Sync-Schlüssel von zockerdb.de vollständig einfügen.' });
    if (!zentrale.aktiv) throw new ValidierungsFehler({ token: 'Die Verbindung zu zockerdb.de ist auf diesem Server ausgeschaltet.' });
    const info = await zentrale.roh('/api/sync/konto', { token: t });
    db.prepare(`INSERT INTO sync_verbindungen (benutzer_id, token, konto) VALUES (?, ?, ?)
      ON CONFLICT (benutzer_id) DO UPDATE SET token = excluded.token, konto = excluded.konto, stand_entfernt = NULL,
        stand_lokal = NULL, fehler = NULL`).run(benutzer.id, verschluessele(t, schluessel), String(info.benutzername ?? '').slice(0, 60));
    // Neues oder anderes Konto: ausgewählte Fotos dorthin erneut übertragen
    db.prepare("UPDATE artikel SET sync_bild_hash = NULL WHERE benutzer_id = ? AND sync_bild_hash <> 'geloescht'").run(benutzer.id);
    return lauf(benutzer.id);
  }

  function trennen(benutzerId) {
    db.prepare('DELETE FROM sync_verbindungen WHERE benutzer_id = ?').run(benutzerId);
  }

  function status(benutzerId) {
    const v = verbindung.get(benutzerId);
    return {
      moeglich: zentrale.aktiv,
      url: zentrale.url,
      verbunden: Boolean(v),
      konto: v?.konto ?? null,
      letzterLauf: v?.letzter_lauf ?? null,
      fehler: v?.fehler ?? null,
      laeuft: laufend.has(benutzerId),
      fotos: db.prepare('SELECT COUNT(*) AS n FROM artikel WHERE benutzer_id = ? AND sync_bild = 1 AND bild_datei IS NOT NULL').get(benutzerId).n,
    };
  }

  /** Lokale Katalog-ID zu einer ZockerDB-ID – fehlende Einträge vorher bei der Zentrale holen. */
  async function sorgeFuerKatalog(ids) {
    const fehlend = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0
      && !db.prepare("SELECT 1 FROM katalog WHERE quelle = 'zockerdb' AND externe_id = ?").get(String(id)));
    for (let i = 0; i < fehlend.length; i += 200) {
      const r = await zentrale.anfrage(`/api/zentral/eintraege?ids=${fehlend.slice(i, i + 200).join(',')}`);
      db.transaction(() => { for (const e of r.eintraege ?? []) { const d = zentralZuEintrag(e); if (d) katalog.speichere(d); } })();
    }
  }
  const katalogIdFuer = (id) => db.prepare("SELECT id FROM katalog WHERE quelle = 'zockerdb' AND externe_id = ?").get(String(id))?.id ?? null;

  async function holeFotos(v, benutzer, liste) {
    for (const a of liste) {
      if (!a.bild) continue;
      const z = db.prepare('SELECT * FROM artikel WHERE benutzer_id = ? AND sync_uuid = ?').get(benutzer.id, a.sync_uuid);
      if (!z || z.sync_bild_hash === a.bild || z.aktualisiert_am > a.aktualisiert_am) continue;
      const antwort = await zentrale.roh(`/api/sync/bild/${a.sync_uuid}`, { token: token(v), roh: true }).catch(() => null);
      if (!antwort?.puffer) continue;
      try {
        speicher.pruefe(benutzer.id, antwort.puffer.length, { abzueglich: z.bild_groesse ?? 0 });
      } catch {
        continue; // Speicher zu Hause voll – Foto bleibt nur auf zockerdb.de
      }
      const name = `${crypto.randomUUID()}.jpg`;
      fs.writeFileSync(path.join(dateien.verzeichnis, name), antwort.puffer);
      db.prepare('UPDATE artikel SET bild_datei = ?, bild_groesse = ?, sync_bild = 1, sync_bild_hash = ? WHERE id = ?')
        .run(name, antwort.puffer.length, a.bild, z.id);
      dateien.loesche(z.bild_datei);
    }
  }

  async function sendeFotos(v, benutzerId) {
    const offen = db.prepare(`SELECT id, sync_uuid, bild_datei FROM artikel
      WHERE benutzer_id = ? AND sync_bild = 1 AND bild_datei IS NOT NULL AND sync_bild_hash IS NULL LIMIT 50`).all(benutzerId);
    let gesendet = 0;
    for (const a of offen) {
      const puffer = await vorschauBild(dateien.pfadVon(a.bild_datei));
      await zentrale.roh(`/api/sync/bild/${a.sync_uuid}`, { methode: 'PUT', token: token(v), bild: puffer });
      db.prepare('UPDATE artikel SET sync_bild_hash = ? WHERE id = ?').run(dateiHash(puffer), a.id);
      gesendet += 1;
    }
    return gesendet;
  }

  /** Ein Abgleich: erst Änderungen von zockerdb.de holen, dann eigene senden, dann Fotos. */
  async function lauf(benutzerId) {
    const v = verbindung.get(benutzerId);
    if (!v || !zentrale.aktiv || laufend.has(benutzerId)) return status(benutzerId);
    laufend.add(benutzerId);
    const benutzer = { id: benutzerId, rolle: 'nutzer' };
    const zusammen = { geholt: 0, gesendet: 0, fotos: 0 };
    try {
      // 1. Holen
      let standEntfernt = v.stand_entfernt;
      for (let runde = 0; runde < 50; runde += 1) {
        const r = await syncAnfrage(v, `/aenderungen?seit=${encodeURIComponent(standEntfernt ?? '')}`);
        await sorgeFuerKatalog((r.artikel ?? []).map((a) => Number(a.zockerdb_id)).filter(Boolean));
        const e = wendeAn(db, benutzer, r, { katalogIdFuer, katalog, plattformen, dateien, fotoEntfernen: (z) => z.sync_bild === 1 });
        zusammen.geholt += e.neu + e.geaendert + e.geloescht;
        await holeFotos(v, benutzer, r.artikel ?? []);
        standEntfernt = r.stand;
        db.prepare('UPDATE sync_verbindungen SET stand_entfernt = ? WHERE benutzer_id = ?').run(standEntfernt, benutzerId);
        if (!r.weitere) break;
      }
      // 2. Senden
      let standLokal = v.stand_lokal;
      for (let runde = 0; runde < 50; runde += 1) {
        const paket = aenderungenSeit(db, benutzerId, standLokal, {
          zockerdbId: (z) => (z.k_quelle === 'zockerdb' ? Number(z.k_externe_id) : null),
          bildHash: (z) => (z.sync_bild ? z.sync_bild_hash : null),
        });
        if (paket.artikel.length || paket.geloescht.length) {
          const r = await syncAnfrage(v, '/aenderungen', { methode: 'POST', daten: { artikel: paket.artikel, geloescht: paket.geloescht } });
          zusammen.gesendet += (r.neu ?? 0) + (r.geaendert ?? 0) + (r.geloescht ?? 0);
        }
        standLokal = paket.stand;
        db.prepare('UPDATE sync_verbindungen SET stand_lokal = ? WHERE benutzer_id = ?').run(standLokal, benutzerId);
        if (!paket.weitere) break;
      }
      // 3. Ausgewählte Fotos (verkleinert)
      zusammen.fotos = await sendeFotos(v, benutzerId);
      db.prepare("UPDATE sync_verbindungen SET letzter_lauf = datetime('now'), fehler = NULL WHERE benutzer_id = ?").run(benutzerId);
      if (zusammen.geholt) erweiterungen?.melde('benutzer.geaendert', benutzerId);
    } catch (e) {
      db.prepare("UPDATE sync_verbindungen SET letzter_lauf = datetime('now'), fehler = ? WHERE benutzer_id = ?").run(e.message.slice(0, 500), benutzerId);
    } finally {
      laufend.delete(benutzerId);
    }
    return { ...status(benutzerId), ergebnis: zusammen };
  }

  async function alle() {
    for (const { benutzer_id: id } of db.prepare('SELECT benutzer_id FROM sync_verbindungen').all()) await lauf(id);
    // Alte Löschvermerke aufräumen (auch von gelöschten Konten)
    db.prepare(`DELETE FROM artikel_geloescht WHERE geloescht_am < datetime('now', '-365 days')
      OR benutzer_id NOT IN (SELECT id FROM benutzer)`).run();
  }

  return { verbinden, trennen, status, lauf, alle };
}
