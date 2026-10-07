// Benutzerkonten, Sitzungen und Zwei-Faktor-Authentifizierung.
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { MARKE } from '../../shared/marke.js';
import {
  hashePasswort, pruefePasswort, vergleicheMitPlatzhalter, zufallsToken, sha256, verschluessele, entschluessele,
  erzeugeTotpGeheimnis, pruefeTotp, erzeugeWiederherstellungscodes, normalisiereWiederherstellungscode,
} from './sicherheit.js';
import { ValidierungsFehler } from './validierung.js';
import { FUNKTIONEN, leseAusgeblendeteFelder } from '../../shared/konstanten.js';

export const COOKIE_NAME = 'vss_sitzung';
const ZWEI_FAKTOR_FRIST_MS = 5 * 60 * 1000;

export class KontoFehler extends Error {
  constructor(meldung, status = 400, code) {
    super(meldung);
    this.status = status;
    this.code = code;
  }
}

/** Zuschaltbare Zusatzfelder (Lagerort, Wartung, Beilagen) – standardmäßig alle aus. */
export function leseFunktionen(json) {
  let roh = {};
  try { roh = json ? JSON.parse(json) : {}; } catch { /* ungültig – alles aus */ }
  return Object.fromEntries(FUNKTIONEN.map((f) => [f.value, roh?.[f.value] === true]));
}

/** Stand der geführten Touren: { tourId: 'fertig' | 'abgelehnt' } – Unbekanntes wird verworfen. */
export const TOUR_STAENDE = ['fertig', 'abgelehnt'];
export function leseTouren(json) {
  let roh = {};
  try { roh = json ? JSON.parse(json) : {}; } catch { /* ungültig – leer */ }
  return Object.fromEntries(Object.entries(roh ?? {}).filter(([id, w]) => /^[a-z0-9-]{1,40}$/.test(id) && TOUR_STAENDE.includes(w)).slice(0, 50));
}

export function oeffentlichesProfil(b) {
  if (!b) return null;
  return {
    id: b.id,
    benutzername: b.benutzername,
    anzeigename: b.anzeigename || b.benutzername,
    rolle: b.rolle,
    totp_aktiv: Boolean(b.totp_aktiv),
    sammlung_oeffentlich: Boolean(b.sammlung_oeffentlich),
    funktionen: leseFunktionen(b.funktionen),
    touren: leseTouren(b.touren),
    fotos_nachfragen: b.fotos_nachfragen !== 0,
    fotos_oeffentlich: b.fotos_oeffentlich === 1,
    ausgeblendete_felder: leseAusgeblendeteFelder(b.ausgeblendete_felder),
    erstellt_am: b.erstellt_am,
    letzte_anmeldung: b.letzte_anmeldung,
  };
}

export function pruefeBenutzername(name) {
  const wert = String(name ?? '').trim();
  if (!/^[A-Za-z0-9ÄÖÜäöüß_.-]{3,32}$/.test(wert)) {
    throw new ValidierungsFehler({ benutzername: '3–32 Zeichen: Buchstaben, Ziffern sowie _ . - (keine Leerzeichen).' });
  }
  return wert;
}

export function pruefeNeuesPasswort(passwort, feld = 'passwort') {
  const wert = String(passwort ?? '');
  if (wert.length < 10) throw new ValidierungsFehler({ [feld]: 'Das Passwort muss mindestens 10 Zeichen lang sein.' });
  if (wert.length > 200) throw new ValidierungsFehler({ [feld]: 'Das Passwort darf höchstens 200 Zeichen lang sein.' });
  return wert;
}

export function erstelleKontenDienst(db, { schluessel, sitzungTage, appName = MARKE.name }) {
  const sitzungDauerMs = sitzungTage * 24 * 60 * 60 * 1000;
  const q = {
    anzahlBenutzer: db.prepare('SELECT COUNT(*) AS n FROM benutzer'),
    perId: db.prepare('SELECT * FROM benutzer WHERE id = ?'),
    perName: db.prepare('SELECT * FROM benutzer WHERE benutzername = ?'),
    anlegen: db.prepare(`INSERT INTO benutzer (benutzername, anzeigename, passwort_hash, rolle, bedingungen_akzeptiert_am)
                         VALUES (?, ?, ?, ?, datetime('now')) RETURNING *`),
    sitzungAnlegen: db.prepare(`INSERT INTO sitzungen (token_hash, benutzer_id, stufe, laeuft_ab, geraet, art, dateischluessel_hash)
                                VALUES (?, ?, ?, ?, ?, ?, ?)`),
    sitzungPerDateischluessel: db.prepare("SELECT * FROM sitzungen WHERE dateischluessel_hash = ? AND stufe = 'voll'"),
    sitzungenVon: db.prepare(`SELECT rowid AS id, token_hash, art, geraet, erstellt_am, laeuft_ab FROM sitzungen
                              WHERE benutzer_id = ? AND stufe = 'voll' AND laeuft_ab >= ? ORDER BY laeuft_ab DESC`),
    sitzungPerIdLoeschen: db.prepare('DELETE FROM sitzungen WHERE rowid = ? AND benutzer_id = ?'),
    sitzungLesen: db.prepare('SELECT * FROM sitzungen WHERE token_hash = ?'),
    sitzungVerlaengern: db.prepare('UPDATE sitzungen SET laeuft_ab = ? WHERE token_hash = ?'),
    sitzungLoeschen: db.prepare('DELETE FROM sitzungen WHERE token_hash = ?'),
    alleSitzungenLoeschen: db.prepare('DELETE FROM sitzungen WHERE benutzer_id = ?'),
    andereSitzungenLoeschen: db.prepare('DELETE FROM sitzungen WHERE benutzer_id = ? AND token_hash != ?'),
    abgelaufeneLoeschen: db.prepare('DELETE FROM sitzungen WHERE laeuft_ab < ?'),
    angemeldet: db.prepare("UPDATE benutzer SET letzte_anmeldung = datetime('now') WHERE id = ?"),
  };

  const istErsteinrichtung = () => q.anzahlBenutzer.get().n === 0;

  async function registriere({ benutzername, passwort, anzeigename, bedingungen_akzeptiert: akzeptiert }) {
    const name = pruefeBenutzername(benutzername);
    pruefeNeuesPasswort(passwort);
    if (akzeptiert !== true) {
      throw new ValidierungsFehler({ bedingungen: 'Bitte akzeptiere die Nutzungsbedingungen und bestätige, die Datenschutzerklärung gelesen zu haben.' });
    }
    if (q.perName.get(name)) throw new ValidierungsFehler({ benutzername: 'Dieser Benutzername ist bereits vergeben.' });
    const hash = await hashePasswort(passwort);
    return db.transaction(() => {
      const erster = istErsteinrichtung();
      const benutzer = q.anlegen.get(name, String(anzeigename ?? '').trim().slice(0, 60) || null, hash, erster ? 'admin' : 'nutzer');
      if (erster) {
        // Daten aus einer Installation ohne Benutzerkonten (Version 1) dem ersten Konto zuordnen.
        db.prepare('UPDATE artikel SET benutzer_id = ? WHERE benutzer_id IS NULL').run(benutzer.id);
        db.prepare("UPDATE katalog SET erstellt_von = ? WHERE quelle = 'eigen' AND erstellt_von IS NULL").run(benutzer.id);
      }
      return benutzer;
    })();
  }

  /** Prüft Benutzername + Passwort. Liefert den Benutzer oder null. */
  async function pruefeZugangsdaten(benutzername, passwort) {
    const benutzer = q.perName.get(String(benutzername ?? '').trim());
    if (!benutzer) return vergleicheMitPlatzhalter(String(passwort ?? ''));
    return (await pruefePasswort(String(passwort ?? ''), benutzer.passwort_hash)) ? benutzer : null;
  }

  /**
   * Schlüssel nur zum Abrufen von Dateien (GET /api/dateien/…) für App-Sitzungen: Bilder in <img> können keinen
   * Authorization-Kopf mitschicken. Aus der Sitzung abgeleitet – das Sitzungstoken selbst steht so nie in einer URL.
   */
  const dateiSchluessel = (tokenHash) => crypto.createHmac('sha256', String(schluessel)).update(`dateien:${tokenHash}`).digest('base64url');

  /** `art`: 'web' (Cookie) oder 'app' (Token im Authorization-Kopf). */
  function erstelleSitzung(benutzerId, { stufe = 'voll', geraet, art = 'web' } = {}) {
    const token = zufallsToken();
    const dauer = stufe === 'voll' ? sitzungDauerMs : ZWEI_FAKTOR_FRIST_MS;
    const tokenHash = sha256(token);
    const mitDateischluessel = art === 'app' && stufe === 'voll';
    q.sitzungAnlegen.run(tokenHash, benutzerId, stufe, Date.now() + dauer, geraet?.slice(0, 200) ?? null,
      art === 'app' ? 'app' : 'web', mitDateischluessel ? sha256(dateiSchluessel(tokenHash)) : null);
    if (stufe === 'voll') q.angemeldet.run(benutzerId);
    return { token, maxAlterMs: dauer };
  }

  /** Liefert { sitzung, benutzer } für ein gültiges Token, sonst null. Verlängert volle Sitzungen gleitend. */
  function leseSitzung(token, erwarteteStufe = 'voll') {
    if (!token) return null;
    const tokenHash = sha256(token);
    const sitzung = q.sitzungLesen.get(tokenHash);
    if (!sitzung || sitzung.stufe !== erwarteteStufe) return null;
    if (sitzung.laeuft_ab < Date.now()) {
      q.sitzungLoeschen.run(tokenHash);
      return null;
    }
    const benutzer = q.perId.get(sitzung.benutzer_id);
    if (!benutzer || benutzer.gesperrt) return null;
    // Höchstens einmal pro Stunde verlängern, um Schreibzugriffe zu sparen.
    if (erwarteteStufe === 'voll' && sitzung.laeuft_ab - Date.now() < sitzungDauerMs - 60 * 60 * 1000) {
      q.sitzungVerlaengern.run(Date.now() + sitzungDauerMs, tokenHash);
    }
    return { sitzung, benutzer, tokenHash };
  }

  /** Benutzer zu einem Dateischlüssel (nur lesend, verlängert die Sitzung nicht). */
  function leseDateischluessel(wert) {
    if (!wert || typeof wert !== 'string') return null;
    const sitzung = q.sitzungPerDateischluessel.get(sha256(wert));
    if (!sitzung || sitzung.laeuft_ab < Date.now()) return null;
    const benutzer = q.perId.get(sitzung.benutzer_id);
    return benutzer && !benutzer.gesperrt ? benutzer : null;
  }

  /** Angemeldete Geräte eines Kontos; „zuletzt aktiv“ ergibt sich aus der gleitenden Laufzeit (auf eine Stunde genau). */
  const sitzungenVon = (benutzerId, aktuellerHash) => q.sitzungenVon.all(benutzerId, Date.now()).map(({ token_hash: hash, laeuft_ab: ablauf, ...s }) => ({
    ...s, zuletzt_aktiv: new Date(Math.min(Date.now(), ablauf - sitzungDauerMs)).toISOString(), aktuell: hash === aktuellerHash,
  }));
  const beendeSitzungPerId = (benutzerId, id) => q.sitzungPerIdLoeschen.run(Number(id), benutzerId).changes > 0;

  const beendeSitzung = (token) => token && q.sitzungLoeschen.run(sha256(token));
  const beendeAlleSitzungen = (benutzerId) => q.alleSitzungenLoeschen.run(benutzerId);
  const beendeAndereSitzungen = (benutzerId, tokenHash) => q.andereSitzungenLoeschen.run(benutzerId, tokenHash);
  const raeumeAuf = () => q.abgelaufeneLoeschen.run(Date.now()).changes;

  // ── Einladungen: Konto für Bekannte, auch wenn die Registrierung geschlossen ist ──
  // Der Link ist einmal nutzbar und läuft ab. Passwort und Zustimmung zu den Bedingungen gibt die eingeladene Person selbst an.
  function erstelleEinladung(vonId, { notiz, tage = 7 } = {}) {
    const dauer = Math.min(30, Math.max(1, Number.parseInt(tage, 10) || 7));
    const token = zufallsToken(24);
    const zeile = db.prepare(`INSERT INTO einladungen (token_hash, notiz, erstellt_von, laeuft_ab)
      VALUES (?, ?, ?, datetime('now', ?)) RETURNING id, notiz, laeuft_ab, erstellt_am`)
      .get(sha256(token), String(notiz ?? '').trim().slice(0, 100) || null, vonId, `+${dauer} days`);
    return { ...zeile, token };
  }
  const einladungen = () => db.prepare(`SELECT e.id, e.notiz, e.laeuft_ab, e.benutzt_am, e.erstellt_am, b.benutzername AS benutzt_von
    FROM einladungen e LEFT JOIN benutzer b ON b.id = e.benutzer_id
    -- Angenommene Einladungen, deren Konto inzwischen gelöscht ist, nicht mehr anzeigen
    WHERE NOT (e.benutzt_am IS NOT NULL AND b.id IS NULL) ORDER BY e.id DESC LIMIT 100`).all();
  const gueltigeEinladung = (token) => (token ? db.prepare(`SELECT * FROM einladungen WHERE token_hash = ?
    AND benutzt_am IS NULL AND laeuft_ab > datetime('now')`).get(sha256(String(token))) ?? null : null);
  const loeseEinladungEin = (id, benutzerId) => db.prepare("UPDATE einladungen SET benutzt_am = datetime('now'), benutzer_id = ? WHERE id = ? AND benutzt_am IS NULL")
    .run(benutzerId, id).changes > 0;
  const loescheEinladung = (id) => db.prepare('DELETE FROM einladungen WHERE id = ?').run(Number(id)).changes > 0;

  // ── Zwei-Faktor-Authentifizierung ─────────────────────────
  function totpGeheimnis(benutzer) {
    return benutzer.totp_geheimnis ? entschluessele(benutzer.totp_geheimnis, schluessel) : null;
  }

  async function starteTotpEinrichtung(benutzer) {
    if (benutzer.totp_aktiv) throw new KontoFehler('Die Zwei-Faktor-Anmeldung ist bereits aktiv.');
    const geheimnis = erzeugeTotpGeheimnis();
    db.prepare('UPDATE benutzer SET totp_geheimnis = ?, totp_letzter_schritt = NULL WHERE id = ?')
      .run(verschluessele(geheimnis, schluessel), benutzer.id);
    const label = `${encodeURIComponent(appName)}:${encodeURIComponent(benutzer.benutzername)}`;
    const otpauthUrl = `otpauth://totp/${label}?secret=${geheimnis}&issuer=${encodeURIComponent(appName)}&algorithm=SHA1&digits=6&period=30`;
    const qrSvg = await QRCode.toString(otpauthUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    return { geheimnis, otpauthUrl, qrSvg };
  }

  function neueWiederherstellungscodes(benutzerId) {
    const codes = erzeugeWiederherstellungscodes();
    db.prepare('UPDATE benutzer SET wiederherstellungscodes = ? WHERE id = ?')
      .run(JSON.stringify(codes.map((c) => sha256(normalisiereWiederherstellungscode(c)))), benutzerId);
    return codes;
  }

  function bestaetigeTotpEinrichtung(benutzer, code) {
    if (benutzer.totp_aktiv) throw new KontoFehler('Die Zwei-Faktor-Anmeldung ist bereits aktiv.');
    const geheimnis = totpGeheimnis(benutzer);
    if (!geheimnis) throw new KontoFehler('Bitte die Einrichtung zuerst starten.');
    const schritt = pruefeTotp(geheimnis, code);
    if (schritt === null) throw new ValidierungsFehler({ code: 'Der Code ist falsch oder abgelaufen. Bitte den aktuellen Code aus der App eingeben.' });
    db.prepare('UPDATE benutzer SET totp_aktiv = 1, totp_letzter_schritt = ? WHERE id = ?').run(schritt, benutzer.id);
    return neueWiederherstellungscodes(benutzer.id);
  }

  /** Prüft einen TOTP-Code oder einen einmaligen Wiederherstellungscode. */
  function pruefeZweitenFaktor(benutzer, { code, wiederherstellungscode }) {
    if (wiederherstellungscode) {
      const hash = sha256(normalisiereWiederherstellungscode(wiederherstellungscode));
      const liste = JSON.parse(benutzer.wiederherstellungscodes || '[]');
      if (!liste.includes(hash)) return false;
      db.prepare('UPDATE benutzer SET wiederherstellungscodes = ? WHERE id = ?')
        .run(JSON.stringify(liste.filter((h) => h !== hash)), benutzer.id);
      return true;
    }
    const geheimnis = totpGeheimnis(benutzer);
    if (!geheimnis) return false;
    const schritt = pruefeTotp(geheimnis, code, benutzer.totp_letzter_schritt);
    if (schritt === null) return false;
    db.prepare('UPDATE benutzer SET totp_letzter_schritt = ? WHERE id = ?').run(schritt, benutzer.id);
    return true;
  }

  function deaktiviereTotp(benutzerId) {
    db.prepare(`UPDATE benutzer SET totp_aktiv = 0, totp_geheimnis = NULL, totp_letzter_schritt = NULL,
                wiederherstellungscodes = NULL WHERE id = ?`).run(benutzerId);
  }

  const anzahlWiederherstellungscodes = (benutzer) => JSON.parse(benutzer.wiederherstellungscodes || '[]').length;

  async function aenderePasswort(benutzerId, neuesPasswort) {
    pruefeNeuesPasswort(neuesPasswort, 'neuesPasswort');
    db.prepare('UPDATE benutzer SET passwort_hash = ? WHERE id = ?').run(await hashePasswort(neuesPasswort), benutzerId);
  }

  return {
    istErsteinrichtung, registriere, pruefeZugangsdaten, erstelleSitzung, leseSitzung, beendeSitzung,
    dateiSchluessel, leseDateischluessel, sitzungenVon, beendeSitzungPerId,
    beendeAlleSitzungen, beendeAndereSitzungen, raeumeAuf, erstelleEinladung, einladungen, gueltigeEinladung, loeseEinladungEin, loescheEinladung, starteTotpEinrichtung, bestaetigeTotpEinrichtung,
    pruefeZweitenFaktor, deaktiviereTotp, neueWiederherstellungscodes, anzahlWiederherstellungscodes,
    aenderePasswort, holeBenutzer: (id) => q.perId.get(id),
  };
}
