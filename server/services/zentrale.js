// Verbindung einer selbst gehosteten Installation zu zockerdb.de (der „Zentrale“).
//
// Was darüber läuft:
//  - Suche und Barcodes: Die Zentrale sucht in ihrem Katalog und – nur wenn nötig – bei IGDB. Jeder Treffer landet
//    dort im gemeinsamen Katalog (mit echten deutschen Titeln und übersetzten Texten) und hier mit derselben
//    ZockerDB-ID (quelle „zockerdb“). Eigene IGDB-Zugangsdaten sind nicht nötig.
//  - Abgleich: Einträge mit ZockerDB-ID werden regelmäßig aktualisiert (z. B. sobald die deutsche Übersetzung da ist).
//  - „Zu ZockerDB freigeben“: eigene Einträge bei zockerdb.de einreichen; nach der Freigabe wird der Eintrag hier
//    automatisch zum gemeinsamen Eintrag.
//  - Datenspende (nur wenn der Administrator sie einschaltet): wöchentlich nur Anzahlen je ZockerDB-ID – wie viele
//    Sammler, wie viele Exemplare – und gelernte Barcodes. Keine Benutzernamen, Preise, Notizen oder Fotos.
//    Benutzer können sich im Konto ausnehmen. Die Vorschau zeigt genau, was gesendet würde.
//  - Rückgabe: Sammlerzahlen aller ZockerDB-Nutzer und Link zur öffentlichen Seite je Eintrag.
//
// Die Installation meldet sich beim ersten Kontakt selbst an und erhält einen Zugangsschlüssel (ohne persönliche Daten).
import { MARKE } from '../../shared/marke.js';
import { ARTIKELTYPEN } from '../../shared/konstanten.js';

const TYPEN = ARTIKELTYPEN.map((t) => t.value);
const SPENDE_TAGE = 7;
const ABGLEICH_TAGE = 14;

export class ZentraleFehler extends Error {}

const text = (wert, max) => (typeof wert === 'string' && wert.trim() ? wert.trim().slice(0, max) : null);

/** Eintrag der Zentrale → Katalog-Datensatz dieser Installation (Daten von außen: streng geprüft). */
export function zentralZuEintrag(e) {
  const id = Number(e?.id);
  if (!Number.isInteger(id) || id <= 0 || !TYPEN.includes(e.typ) || !text(e.titel, 200)) return null;
  const jahr = Number(e.erscheinungsjahr);
  return {
    quelle: 'zockerdb',
    externe_id: String(id),
    typ: e.typ,
    titel: text(e.titel, 200),
    titel_original: text(e.titel_original, 200),
    igdb_url: /^https:\/\/www\.igdb\.com\/[\w/-]+$/.test(e.igdb_url ?? '') ? e.igdb_url : null,
    plattformen: Array.isArray(e.plattformen) ? e.plattformen.map((p) => text(p, 100)).filter(Boolean).slice(0, 20) : [],
    erscheinungsjahr: Number.isInteger(jahr) && jahr > 1900 && jahr < 2200 ? jahr : null,
    hersteller: text(e.hersteller, 200),
    cover_url: /^https:\/\//.test(e.cover_url ?? '') ? String(e.cover_url).slice(0, 1000) : null,
    beschreibung: text(e.beschreibung, 5000),
    status: 'freigegeben',
  };
}

export function erstelleZentrale(db, { konfiguration: k, fetchFn = globalThis.fetch, version = '', cache }) {
  const einstellungLesen = db.prepare('SELECT wert FROM einstellungen WHERE schluessel = ?');
  const einstellungSchreiben = db.prepare(`INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?)
    ON CONFLICT (schluessel) DO UPDATE SET wert = excluded.wert`);
  const lies = (schluessel) => {
    const z = einstellungLesen.get(schluessel);
    try { return z ? JSON.parse(z.wert) : null; } catch { return null; }
  };
  const schreibe = (schluessel, wert) => einstellungSchreiben.run(schluessel, JSON.stringify(wert));

  const url = () => k.zentrale?.url ?? '';
  let katalog = null; // wird nach dem Anlegen des Katalogdienstes gesetzt (gegenseitige Abhängigkeit)
  let letzterFehler = null;

  /** Anfrage an die Zentrale. `bild` = Foto als Körper senden, `roh` = Antwort als Puffer (Fotos) statt JSON. */
  async function roh(pfad, { methode = 'GET', daten, token, zeit = 15_000, bild, roh: binaer = false } = {}) {
    let antwort;
    try {
      antwort = await fetchFn(`${url()}${pfad}`, {
        method: methode,
        headers: {
          Accept: 'application/json',
          ...(daten !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(bild ? { 'Content-Type': 'image/jpeg' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: bild ?? (daten !== undefined ? JSON.stringify(daten) : undefined),
        signal: AbortSignal.timeout(zeit),
      });
    } catch (e) {
      throw new ZentraleFehler(`zockerdb.de ist nicht erreichbar (${e.message}).`);
    }
    if (binaer && antwort.ok) return { puffer: Buffer.from(await antwort.arrayBuffer()) };
    const inhalt = await antwort.json().catch(() => ({}));
    if (!antwort.ok) {
      const fehler = new ZentraleFehler(inhalt.fehler ?? `zockerdb.de antwortet mit Fehler ${antwort.status}.`);
      fehler.status = antwort.status;
      throw fehler;
    }
    return inhalt;
  }

  /** Zugang dieser Installation – beim ersten Mal (oder nach einem Adresswechsel) automatisch anmelden. */
  async function zugang(neu = false) {
    const gespeichert = lies('zentrale_zugang');
    if (!neu && gespeichert?.url === url() && gespeichert.schluessel) return gespeichert;
    const antwort = await roh('/api/zentral/instanz', { methode: 'POST', daten: { name: `${MARKE.name} (selbst gehostet)`, version } });
    const z = { url: url(), id: antwort.id, schluessel: antwort.schluessel, seit: new Date().toISOString() };
    schreibe('zentrale_zugang', z);
    return z;
  }

  async function anfrage(pfad, optionen = {}) {
    if (!url()) throw new ZentraleFehler('Die Verbindung zu zockerdb.de ist ausgeschaltet.');
    try {
      const z = await zugang();
      try {
        const ergebnis = await roh(pfad, { ...optionen, token: z.schluessel });
        letzterFehler = null;
        return ergebnis;
      } catch (e) {
        // Schlüssel unbekannt (z. B. Datenbank der Zentrale neu) → einmal neu anmelden
        if (e.status !== 401) throw e;
        const z2 = await zugang(true);
        return await roh(pfad, { ...optionen, token: z2.schluessel });
      }
    } catch (e) {
      letzterFehler = e.message;
      throw e;
    }
  }

  const abfrage = (werte) => {
    const p = new URLSearchParams();
    for (const [s, w] of Object.entries(werte)) if (w !== undefined && w !== null && w !== '') p.set(s, String(w));
    const t = p.toString();
    return t ? `?${t}` : '';
  };

  // ── Katalog ────────────────────────────────────────────────
  /** Suche bei der Zentrale (dort: erst Katalog, IGDB nur bei Bedarf bzw. auf Wunsch seitenweise). */
  async function suche(begriff, typ, { online = false, seite = 0 } = {}) {
    const r = await anfrage(`/api/zentral/suche${abfrage({ q: begriff, typ, online: online ? 1 : undefined, seite: seite || undefined })}`);
    const treffer = [...(r.lokal ?? []), ...(r.online ?? [])].map(zentralZuEintrag).filter(Boolean);
    return { treffer, mehrOnline: Boolean(r.mehrOnline), seite: Number.isInteger(r.seite) ? r.seite : null };
  }

  async function barcode(code) {
    const r = await anfrage(`/api/zentral/barcode/${encodeURIComponent(code)}`);
    return {
      produktname: text(r.produktname, 300),
      quelle: r.produktname ? 'zockerdb' : null,
      treffer: (r.treffer ?? []).map(zentralZuEintrag).filter(Boolean),
    };
  }

  /** Einträge mit ZockerDB-ID auffrischen (Titel, Texte, Cover) – ältere zuerst, höchstens 200 je Lauf. */
  const abgleichFaellig = db.prepare(`SELECT id, externe_id FROM katalog WHERE quelle = 'zockerdb'
      AND ((zentral_abgleich IS NULL AND erstellt_am < datetime('now', '-1 hour'))
           OR zentral_abgleich < datetime('now', '-${ABGLEICH_TAGE} days'))
    ORDER BY zentral_abgleich IS NOT NULL, zentral_abgleich LIMIT 200`);
  const abgleichMerken = db.prepare("UPDATE katalog SET zentral_abgleich = datetime('now') WHERE id = ?");
  async function abgleich() {
    const faellig = abgleichFaellig.all();
    if (!faellig.length) return { aktualisiert: 0 };
    const r = await anfrage(`/api/zentral/eintraege?ids=${faellig.map((z) => z.externe_id).join(',')}`);
    let aktualisiert = 0;
    db.transaction(() => {
      for (const e of r.eintraege ?? []) {
        const daten = zentralZuEintrag(e);
        if (!daten) continue;
        katalog.speichere(daten);
        aktualisiert += 1;
      }
      for (const z of faellig) abgleichMerken.run(z.id);
    })();
    return { aktualisiert };
  }

  // ── Zu ZockerDB freigeben ────────────────────────────────────
  async function einreichen(eintrag) {
    const r = await anfrage('/api/zentral/einreichen', {
      methode: 'POST',
      daten: {
        lokale_id: eintrag.id, typ: eintrag.typ, titel: eintrag.titel, plattformen: eintrag.plattformen,
        erscheinungsjahr: eintrag.erscheinungsjahr, hersteller: eintrag.hersteller, beschreibung: eintrag.beschreibung,
        sammlerhinweise: eintrag.sammlerhinweise,
        barcodes: db.prepare('SELECT DISTINCT code FROM barcode_zuordnungen WHERE katalog_id = ? LIMIT 10').all(eintrag.id).map((z) => z.code),
      },
    });
    db.prepare("UPDATE katalog SET zentral_id = ?, zentral_status = ?, zentral_hinweis = NULL WHERE id = ?")
      .run(Number(r.id), r.status === 'freigegeben' ? 'freigegeben' : 'eingereicht', eintrag.id);
    if (r.status === 'freigegeben') uebernimmFreigabe(eintrag.id, Number(r.id));
    return db.prepare('SELECT zentral_id, zentral_status, zentral_hinweis FROM katalog WHERE id = ?').get(eintrag.id);
  }

  /**
   * Freigegeben: Der eigene Eintrag wird zum gemeinsamen Eintrag mit ZockerDB-ID. Gibt es den hier schon (z. B. weil
   * zockerdb.de die Einreichung mit einem vorhandenen Eintrag zusammengeführt hat), wandert alles dorthin.
   */
  function uebernimmFreigabe(lokaleId, zentralId) {
    db.transaction(() => {
      const vorhanden = db.prepare("SELECT id FROM katalog WHERE quelle = 'zockerdb' AND externe_id = ?").get(String(zentralId));
      if (vorhanden && vorhanden.id !== lokaleId) {
        for (const tabelle of ['artikel', 'medien', 'kommentare', 'katalog_varianten']) {
          db.prepare(`UPDATE ${tabelle} SET katalog_id = ? WHERE katalog_id = ?`).run(vorhanden.id, lokaleId);
        }
        db.prepare('INSERT OR IGNORE INTO barcode_zuordnungen (code, katalog_id, benutzer_id) SELECT code, ?, benutzer_id FROM barcode_zuordnungen WHERE katalog_id = ?')
          .run(vorhanden.id, lokaleId);
        db.prepare('DELETE FROM katalog WHERE id = ?').run(lokaleId);
      } else {
        db.prepare(`UPDATE katalog SET quelle = 'zockerdb', externe_id = ?, status = 'freigegeben', zentral_status = 'freigegeben',
          zentral_abgleich = NULL, aktualisiert_am = datetime('now') WHERE id = ?`).run(String(zentralId), lokaleId);
      }
    })();
  }

  async function pruefeEinreichungen() {
    const offen = db.prepare("SELECT id, zentral_id FROM katalog WHERE zentral_status = 'eingereicht' AND zentral_id IS NOT NULL LIMIT 200").all();
    if (!offen.length) return { geaendert: 0 };
    const r = await anfrage(`/api/zentral/einreichungen?ids=${offen.map((z) => z.zentral_id).join(',')}`);
    const stand = new Map((r.einreichungen ?? []).map((e) => [Number(e.id), e]));
    let geaendert = 0;
    for (const z of offen) {
      const e = stand.get(z.zentral_id);
      if (!e || e.status === 'eingereicht') continue;
      geaendert += 1;
      if (e.status === 'freigegeben') uebernimmFreigabe(z.id, Number(e.ziel_id ?? e.id));
      else db.prepare('UPDATE katalog SET zentral_status = ?, zentral_hinweis = ? WHERE id = ?').run('abgelehnt', text(e.hinweis, 500), z.id);
    }
    return { geaendert };
  }

  // ── Datenspende ────────────────────────────────────────────
  /** Genau das, was gesendet würde (auch für die Vorschau in der Administration). */
  function spendeDaten() {
    const bestand = db.prepare(`SELECT CAST(k.externe_id AS INTEGER) AS id, COUNT(DISTINCT a.benutzer_id) AS sammler,
        SUM(COALESCE(a.anzahl, 1)) AS exemplare
      FROM artikel a JOIN katalog k ON k.id = a.katalog_id JOIN benutzer b ON b.id = a.benutzer_id
      WHERE k.quelle = 'zockerdb' AND b.datenspende = 1
      GROUP BY k.externe_id ORDER BY id`).all();
    const barcodes = db.prepare(`SELECT DISTINCT z.code, CAST(k.externe_id AS INTEGER) AS id
      FROM barcode_zuordnungen z JOIN katalog k ON k.id = z.katalog_id JOIN benutzer b ON b.id = z.benutzer_id
      WHERE k.quelle = 'zockerdb' AND b.datenspende = 1 ORDER BY z.code`).all();
    return { bestand, barcodes };
  }

  async function spende() {
    const daten = spendeDaten();
    const r = await anfrage('/api/zentral/spende', { methode: 'POST', daten, zeit: 60_000 });
    schreibe('zentrale_spende', { am: new Date().toISOString(), eintraege: daten.bestand.length, barcodes: daten.barcodes.length });
    return r;
  }

  // ── Rückgabe: Sammlerzahlen bei ZockerDB ─────────────────────
  async function statistik(zentralId) {
    const schluessel = `zentrale:statistik:${zentralId}`;
    const holen = () => anfrage(`/api/zentral/statistik?ids=${zentralId}`).then((r) => r.statistik?.[zentralId] ?? null);
    return cache ? cache.merke(schluessel, holen) : holen();
  }

  /** Ist `b` eine neuere Version als `a`? (1.10.0 > 1.9.3) */
  const neuer = (a, b) => {
    const teile = (v) => String(v ?? '').split(/[.-]/).slice(0, 3).map((t) => Number.parseInt(t, 10) || 0);
    const [x, y] = [teile(a), teile(b)];
    for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return y[i] > x[i];
    return false;
  };

  /** Aktuelle Version bei zockerdb.de nachsehen (höchstens alle 12 Stunden). */
  async function pruefeVersion() {
    const letzte = lies('zentrale_version');
    if (letzte && Date.now() - Date.parse(letzte.geprueft) < 12 * 60 * 60 * 1000) return letzte;
    const r = await roh('/api/zentral/version');
    const stand = { version: text(r.version, 30), hinweise: /^https:\/\//.test(r.hinweise ?? '') ? r.hinweise : null, geprueft: new Date().toISOString() };
    schreibe('zentrale_version', stand);
    return stand;
  }

  /** Regelmäßige Aufgaben: Abgleich, Stand der Einreichungen, Datenspende (wöchentlich, wenn eingeschaltet). */
  async function lauf({ spendeErzwingen = false } = {}) {
    if (!url()) return null;
    await pruefeVersion().catch(() => null);
    const ergebnis = { abgleich: await abgleich(), einreichungen: await pruefeEinreichungen() };
    const letzte = lies('zentrale_spende');
    const faellig = !letzte || Date.now() - Date.parse(letzte.am) > SPENDE_TAGE * 24 * 60 * 60 * 1000;
    if (k.zentrale.spende && (faellig || spendeErzwingen)) ergebnis.spende = await spende();
    return ergebnis;
  }

  function status() {
    const z = lies('zentrale_zugang');
    const hinweise = lies('zentrale_hinweise') ?? {};
    return {
      // Einmalige Frage nach der Datenspende (Administration) und weggeklickter Hinweis
      spendeGefragt: Boolean(hinweise.spendeGefragt),
      spendeHinweisAus: Boolean(hinweise.spendeHinweisAus),
      // Update-Hinweis: neuere Version bei zockerdb.de verfügbar?
      version,
      neueVersion: (() => { const v = lies('zentrale_version'); return v?.version && neuer(version, v.version) ? v : null; })(),
      aktiv: Boolean(url()),
      url: url(),
      angemeldet: Boolean(z?.schluessel && z.url === url()),
      spende: Boolean(k.zentrale?.spende),
      letzteSpende: lies('zentrale_spende'),
      eintraege: db.prepare("SELECT COUNT(*) AS n FROM katalog WHERE quelle = 'zockerdb'").get().n,
      letzterFehler,
    };
  }

  return {
    get aktiv() { return Boolean(url()); },
    get url() { return url(); },
    setzeKatalog(dienst) { katalog = dienst; },
    /** Merker für Hinweise in der Administration (gefragt, weggeklickt). */
    merkeHinweis(schluessel) { schreibe('zentrale_hinweise', { ...(lies('zentrale_hinweise') ?? {}), [schluessel]: new Date().toISOString() }); },
    anfrage, roh, suche, barcode, abgleich, einreichen, pruefeEinreichungen, spendeDaten, spende, statistik, lauf, status,
  };
}
