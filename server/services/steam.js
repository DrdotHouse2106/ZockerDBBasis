// Steam-Bibliothek importieren (offizielle Steam Web API, IPlayerService/GetOwnedGames).
// Digitale Spiele landen als eigener Bestand „digital“: sichtbar und deutlich gekennzeichnet, aber nicht Teil
// der Sammlung, des Sammlungswerts oder öffentlicher Zahlen. Voraussetzung: Steam-API-Schlüssel des Betreibers
// (STEAM_API_KEY) und ein Steam-Profil, dessen Spieldetails öffentlich sind.
import { ValidierungsFehler } from './validierung.js';

const API = 'https://api.steampowered.com';
const STEAM_ID = /^7656\d{13}$/;
const MAX_SPIELE = 10_000;
// Steam-Web-API-Schlüssel: 32 Hex-Zeichen
const SCHLUESSEL = /^[0-9A-F]{32}$/i;

export class SteamFehler extends Error {
  constructor(meldung, status = 400) {
    super(meldung);
    this.status = status;
  }
}

/** Steam-ID, Profil-Adresse (…/profiles/ID oder …/id/name) oder benutzerdefinierter Name → { steamId } oder { name }. */
export function leseSteamProfil(eingabe) {
  const text = String(eingabe ?? '').trim();
  if (STEAM_ID.test(text)) return { steamId: text };
  const profil = /steamcommunity\.com\/profiles\/(7656\d{13})/i.exec(text);
  if (profil) return { steamId: profil[1] };
  const name = /steamcommunity\.com\/id\/([\w-]{2,64})/i.exec(text)?.[1] ?? (/^[\w-]{2,64}$/.test(text) ? text : null);
  if (name) return { name };
  throw new ValidierungsFehler({ profil: 'Bitte die Adresse deines Steam-Profils oder deine Steam-ID (17 Ziffern) angeben.' });
}

/** Titel vergleichbar machen: Marken- und Sonderzeichen weg, Leerraum vereinheitlichen. */
export const normalerTitel = (t) => String(t ?? '').replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();

/** Hochformat-Cover aus dem offiziellen Steam-CDN (fehlt es, zeigt die App den Platzhalter). */
export const steamCover = (appid) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;

export function erstelleSteamDienst(db, { konfiguration, fetchFn = globalThis.fetch, katalog, plattformen, erweiterungen }) {
  const schluessel = () => konfiguration.steam?.apiKey ?? '';
  // „+k.status“/„+k.typ“: SQLite soll den Titel-Index nehmen, nicht den Index auf status (der trifft fast alle Einträge)
  const nachTitel = db.prepare(`SELECT k.id, k.titel FROM katalog k WHERE k.titel = ? COLLATE NOCASE AND +k.status = 'freigegeben' AND +k.typ = 'spiel'
    ORDER BY EXISTS (SELECT 1 FROM katalog_plattformen kp WHERE kp.katalog_id = k.id AND kp.plattform_id = ?) DESC, k.id LIMIT 1`);
  const nachOriginal = db.prepare(`SELECT k.id, k.titel FROM katalog k WHERE k.titel_original = ? COLLATE NOCASE AND +k.status = 'freigegeben' AND +k.typ = 'spiel'
    ORDER BY EXISTS (SELECT 1 FROM katalog_plattformen kp WHERE kp.katalog_id = k.id AND kp.plattform_id = ?) DESC, k.id LIMIT 1`);
  const eigenerEintrag = db.prepare("SELECT id, titel FROM katalog WHERE quelle = 'eigen' AND erstellt_von = ? AND titel = ? COLLATE NOCASE AND typ = 'spiel' LIMIT 1");
  const vorhanden = db.prepare("SELECT id FROM artikel WHERE benutzer_id = ? AND digital_quelle = 'steam' AND digital_id = ?");

  async function holeJson(pfad, parameter, key = schluessel()) {
    const url = `${API}${pfad}?${new URLSearchParams({ key, format: 'json', ...parameter })}`;
    let antwort;
    try {
      antwort = await fetchFn(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    } catch (e) {
      throw new SteamFehler(`Steam ist gerade nicht erreichbar (${e.message}).`, 502);
    }
    if (antwort.status === 401 || antwort.status === 403) {
      if (key !== schluessel()) throw new ValidierungsFehler({ schluessel: 'Steam lehnt diesen API-Schlüssel ab – bitte prüfen oder unter steamcommunity.com/dev/apikey neu anlegen.' });
      throw new SteamFehler('Der Steam-API-Schlüssel wird von Steam abgelehnt.', 502);
    }
    if (!antwort.ok) throw new SteamFehler(`Steam antwortet mit Fehler ${antwort.status}.`, 502);
    return antwort.json();
  }

  async function steamIdVon(eingabe, key) {
    const p = leseSteamProfil(eingabe);
    if (p.steamId) return p.steamId;
    const r = await holeJson('/ISteamUser/ResolveVanityURL/v1/', { vanityurl: p.name }, key);
    if (r?.response?.success !== 1 || !STEAM_ID.test(r.response.steamid ?? '')) {
      throw new ValidierungsFehler({ profil: `Kein Steam-Profil „${p.name}“ gefunden.` });
    }
    return r.response.steamid;
  }

  /**
   * Gemeinsamer Katalogeintrag zu einem Steam-Spiel: zuerst über die Steam-AppID (Andockpunkt „steam.katalog“, z. B. IGDB-Verknüpfungen),
   * sonst über den Titel (bevorzugt PC). null, wenn es keinen gibt.
   */
  function oeffentlicherEintrag(appid, name, pcId) {
    for (const fn of erweiterungen?.alle('steam.katalog') ?? []) {
      const t = fn(appid);
      if (t) return t;
    }
    const titel = normalerTitel(name);
    return nachTitel.get(titel, pcId) ?? nachOriginal.get(titel, pcId) ?? null;
  }

  /** Katalogeintrag zu einem Steam-Spiel: gemeinsamer Katalog, sonst eigener privater Eintrag. */
  function katalogFuer(spiel, benutzer, pcId) {
    const treffer = oeffentlicherEintrag(spiel.appid, spiel.name, pcId);
    if (treffer) return treffer;
    const titel = normalerTitel(spiel.name);
    const eigener = eigenerEintrag.get(benutzer.id, titel);
    if (eigener) return { ...eigener, eigen: true };
    const e = katalog.legeEigenenAn({ typ: 'spiel', titel, plattformen: ['PC'], cover_url: steamCover(spiel.appid) }, benutzer);
    return { id: e.id, titel: e.titel, eigen: true };
  }

  /**
   * Bibliothek abrufen und einspielen: neue Spiele anlegen, bei bekannten nur die Spielzeit aktualisieren.
   * eigenerSchluessel: optional der Steam-API-Schlüssel des Nutzers – damit liefert Steam die eigene Bibliothek auch bei privatem Profil.
   * Er wird nur für diesen Abruf verwendet und nirgends gespeichert oder protokolliert.
   */
  async function importiere(benutzer, eingabe, eigenerSchluessel) {
    if (!schluessel()) throw new SteamFehler('Der Steam-Import ist auf diesem Server nicht eingerichtet (STEAM_API_KEY fehlt).', 409);
    const eigener = String(eigenerSchluessel ?? '').trim().toUpperCase(); // Steam vergibt Schlüssel in Großbuchstaben
    if (eigener && !SCHLUESSEL.test(eigener)) throw new ValidierungsFehler({ schluessel: 'Ein Steam-API-Schlüssel hat 32 Zeichen (Ziffern und A–F).' });
    const key = eigener || schluessel();
    const steamId = await steamIdVon(eingabe, key);
    const r = await holeJson('/IPlayerService/GetOwnedGames/v1/', { steamid: steamId, include_appinfo: '1', include_played_free_games: '0' }, key);
    const spiele = r?.response?.games;
    if (!Array.isArray(spiele)) {
      throw new SteamFehler(eigener
        ? 'Steam liefert keine Spiele – gehört der Schlüssel zu demselben Steam-Konto wie das angegebene Profil?'
        : 'Steam liefert keine Spiele – bitte in den Steam-Datenschutzeinstellungen „Spieldetails“ auf „Öffentlich“ stellen oder deinen eigenen Steam-API-Schlüssel angeben.', 409);
    }
    const pc = plattformen.zuordnen('PC');
    const ergebnis = { gesamt: spiele.length, neu: 0, aktualisiert: 0, katalog: 0, eigene: 0 };
    db.transaction(() => {
      for (const s of spiele.slice(0, MAX_SPIELE)) {
        const appid = Number(s?.appid);
        if (!Number.isInteger(appid) || appid <= 0 || !normalerTitel(s.name)) continue;
        const minuten = Number.isInteger(s.playtime_forever) && s.playtime_forever >= 0 ? s.playtime_forever : null;
        const alt = vorhanden.get(benutzer.id, String(appid));
        if (alt) {
          db.prepare("UPDATE artikel SET spielzeit_minuten = ?, aktualisiert_am = datetime('now') WHERE id = ? AND COALESCE(spielzeit_minuten, -1) <> COALESCE(?, -1)")
            .run(minuten, alt.id, minuten);
          ergebnis.aktualisiert += 1;
          continue;
        }
        const k = katalogFuer(s, benutzer, pc?.id ?? null);
        if (k.eigen) ergebnis.eigene += 1;
        else ergebnis.katalog += 1;
        db.prepare(`INSERT INTO artikel (benutzer_id, typ, titel, plattform, plattform_id, katalog_id, bestand, digital_quelle, digital_id, spielzeit_minuten, importiert_aus)
          VALUES (?, 'spiel', ?, ?, ?, ?, 'digital', 'steam', ?, ?, 'steam')`).run(benutzer.id, k.titel, pc?.name ?? 'PC', pc?.id ?? null, k.id, String(appid), minuten);
        ergebnis.neu += 1;
      }
      db.prepare("UPDATE benutzer SET steam_id = ?, steam_import_am = datetime('now') WHERE id = ?").run(steamId, benutzer.id);
    })();
    // Früher nur privat angelegte Spiele jetzt mit dem gemeinsamen Katalog verknüpfen
    ergebnis.nachverknuepft = verknuepfeNeu(benutzer).verknuepft;
    return ergebnis;
  }

  /**
   * Steam-Spiele, die beim Import nur einen eigenen privaten Katalogeintrag bekommen haben, nachträglich mit dem gemeinsamen Katalog
   * verknüpfen (z. B. sobald die IGDB-Verknüpfung da ist). Nicht mehr genutzte private Einträge werden gelöscht – so entsteht nichts doppelt.
   * Braucht keinen Abruf bei Steam (die AppID ist gespeichert).
   */
  function verknuepfeNeu(benutzer) {
    const pc = plattformen.zuordnen('PC');
    const offen = db.prepare(`SELECT a.id, a.digital_id, a.katalog_id, k.titel FROM artikel a JOIN katalog k ON k.id = a.katalog_id
      WHERE a.benutzer_id = ? AND a.digital_quelle = 'steam' AND k.quelle = 'eigen' AND k.status = 'privat' AND k.erstellt_von = ?`).all(benutzer.id, benutzer.id);
    let verknuepft = 0;
    db.transaction(() => {
      for (const a of offen) {
        const treffer = oeffentlicherEintrag(Number(a.digital_id), a.titel, pc?.id ?? null);
        if (!treffer) continue;
        db.prepare("UPDATE artikel SET katalog_id = ?, aktualisiert_am = datetime('now') WHERE id = ?").run(treffer.id, a.id);
        verknuepft += 1;
        // Privaten Eintrag nur löschen, wenn nichts anderes mehr darauf verweist
        if (!db.prepare('SELECT 1 FROM artikel WHERE katalog_id = ? LIMIT 1').get(a.katalog_id)) {
          try { db.prepare("DELETE FROM katalog WHERE id = ? AND quelle = 'eigen' AND status = 'privat' AND erstellt_von = ?").run(a.katalog_id, benutzer.id); } catch { /* noch anderweitig verknüpft */ }
        }
      }
    })();
    return { geprueft: offen.length, verknuepft, offen: offen.length - verknuepft };
  }

  function status(benutzer) {
    const b = db.prepare('SELECT steam_id, steam_import_am FROM benutzer WHERE id = ?').get(benutzer.id) ?? {};
    return {
      aktiv: Boolean(schluessel()),
      steam_id: b.steam_id ?? null,
      zuletzt: b.steam_import_am ?? null,
      anzahl: db.prepare("SELECT COUNT(*) FROM artikel WHERE benutzer_id = ? AND digital_quelle = 'steam'").pluck().get(benutzer.id),
    };
  }

  /** Verbindung lösen; mit spieleBehalten bleiben die importierten Steam-Spiele als digitale Spiele erhalten, sonst werden sie entfernt. */
  function entferne(benutzer, { spieleBehalten = false } = {}) {
    const n = spieleBehalten ? 0 : db.prepare("DELETE FROM artikel WHERE benutzer_id = ? AND digital_quelle = 'steam'").run(benutzer.id).changes;
    db.prepare('UPDATE benutzer SET steam_id = NULL, steam_import_am = NULL WHERE id = ?').run(benutzer.id);
    return { entfernt: n };
  }

  return { importiere, status, entferne, verknuepfeNeu, get aktiv() { return Boolean(schluessel()); } };
}
