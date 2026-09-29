// Steam-Bibliothek importieren (offizielle Steam Web API, IPlayerService/GetOwnedGames).
// Digitale Spiele landen als eigener Bestand „digital“: sichtbar und deutlich gekennzeichnet, aber nicht Teil
// der Sammlung, des Sammlungswerts oder öffentlicher Zahlen. Voraussetzung: Steam-API-Schlüssel des Betreibers
// (STEAM_API_KEY) und ein Steam-Profil, dessen Spieldetails öffentlich sind.
import { ValidierungsFehler } from './validierung.js';

const API = 'https://api.steampowered.com';
const STEAM_ID = /^7656\d{13}$/;
const MAX_SPIELE = 10_000;

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

export function erstelleSteamDienst(db, { konfiguration, fetchFn = globalThis.fetch, katalog, plattformen }) {
  const schluessel = () => konfiguration.steam?.apiKey ?? '';
  const nachTitel = db.prepare(`SELECT k.id, k.titel FROM katalog k WHERE k.status = 'freigegeben' AND k.typ = 'spiel' AND k.titel = ? COLLATE NOCASE
    ORDER BY EXISTS (SELECT 1 FROM katalog_plattformen kp WHERE kp.katalog_id = k.id AND kp.plattform_id = ?) DESC, k.id LIMIT 1`);
  const nachOriginal = db.prepare(`SELECT k.id, k.titel FROM katalog k WHERE k.status = 'freigegeben' AND k.typ = 'spiel' AND k.titel_original = ? COLLATE NOCASE
    ORDER BY EXISTS (SELECT 1 FROM katalog_plattformen kp WHERE kp.katalog_id = k.id AND kp.plattform_id = ?) DESC, k.id LIMIT 1`);
  const eigenerEintrag = db.prepare("SELECT id, titel FROM katalog WHERE quelle = 'eigen' AND erstellt_von = ? AND titel = ? COLLATE NOCASE AND typ = 'spiel' LIMIT 1");
  const vorhanden = db.prepare("SELECT id FROM artikel WHERE benutzer_id = ? AND digital_quelle = 'steam' AND digital_id = ?");

  async function holeJson(pfad, parameter) {
    const url = `${API}${pfad}?${new URLSearchParams({ key: schluessel(), format: 'json', ...parameter })}`;
    let antwort;
    try {
      antwort = await fetchFn(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    } catch (e) {
      throw new SteamFehler(`Steam ist gerade nicht erreichbar (${e.message}).`, 502);
    }
    if (antwort.status === 401 || antwort.status === 403) throw new SteamFehler('Der Steam-API-Schlüssel wird von Steam abgelehnt.', 502);
    if (!antwort.ok) throw new SteamFehler(`Steam antwortet mit Fehler ${antwort.status}.`, 502);
    return antwort.json();
  }

  async function steamIdVon(eingabe) {
    const p = leseSteamProfil(eingabe);
    if (p.steamId) return p.steamId;
    const r = await holeJson('/ISteamUser/ResolveVanityURL/v1/', { vanityurl: p.name });
    if (r?.response?.success !== 1 || !STEAM_ID.test(r.response.steamid ?? '')) {
      throw new ValidierungsFehler({ profil: `Kein Steam-Profil „${p.name}“ gefunden.` });
    }
    return r.response.steamid;
  }

  /** Katalogeintrag zu einem Steam-Spiel: gemeinsamer Katalog (Titel, bevorzugt PC), sonst eigener privater Eintrag. */
  function katalogFuer(spiel, benutzer, pcId) {
    const titel = normalerTitel(spiel.name);
    const treffer = nachTitel.get(titel, pcId) ?? nachOriginal.get(titel, pcId);
    if (treffer) return treffer;
    const eigener = eigenerEintrag.get(benutzer.id, titel);
    if (eigener) return { ...eigener, eigen: true };
    const e = katalog.legeEigenenAn({ typ: 'spiel', titel, plattformen: ['PC'], cover_url: steamCover(spiel.appid) }, benutzer);
    return { id: e.id, titel: e.titel, eigen: true };
  }

  /** Bibliothek abrufen und einspielen: neue Spiele anlegen, bei bekannten nur die Spielzeit aktualisieren. */
  async function importiere(benutzer, eingabe) {
    if (!schluessel()) throw new SteamFehler('Der Steam-Import ist auf diesem Server nicht eingerichtet (STEAM_API_KEY fehlt).', 409);
    const steamId = await steamIdVon(eingabe);
    const r = await holeJson('/IPlayerService/GetOwnedGames/v1/', { steamid: steamId, include_appinfo: '1', include_played_free_games: '0' });
    const spiele = r?.response?.games;
    if (!Array.isArray(spiele)) {
      throw new SteamFehler('Steam liefert keine Spiele – bitte in den Steam-Datenschutzeinstellungen „Spieldetails“ auf „Öffentlich“ stellen.', 409);
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
        db.prepare(`INSERT INTO artikel (benutzer_id, typ, titel, plattform, plattform_id, katalog_id, bestand, digital_quelle, digital_id, spielzeit_minuten)
          VALUES (?, 'spiel', ?, ?, ?, ?, 'digital', 'steam', ?, ?)`).run(benutzer.id, k.titel, pc?.name ?? 'PC', pc?.id ?? null, k.id, String(appid), minuten);
        ergebnis.neu += 1;
      }
      db.prepare("UPDATE benutzer SET steam_id = ?, steam_import_am = datetime('now') WHERE id = ?").run(steamId, benutzer.id);
    })();
    return ergebnis;
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

  /** Verbindung lösen und alle importierten Steam-Spiele entfernen. */
  function entferne(benutzer) {
    const n = db.prepare("DELETE FROM artikel WHERE benutzer_id = ? AND digital_quelle = 'steam'").run(benutzer.id).changes;
    db.prepare('UPDATE benutzer SET steam_id = NULL, steam_import_am = NULL WHERE id = ?').run(benutzer.id);
    return { entfernt: n };
  }

  return { importiere, status, entferne, get aktiv() { return Boolean(schluessel()); } };
}
