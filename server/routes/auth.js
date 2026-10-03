import { Router } from 'express';
import {
  oeffentlichesProfil, KontoFehler, pruefeNeuesPasswort, leseFunktionen, leseTouren, TOUR_STAENDE,
} from '../services/konten.js';
import { erstelleDrossel } from '../services/drossel.js';
import { setzeSitzungsCookie, loescheSitzungsCookie, erfordereAnmeldung } from '../middleware/auth.js';
import { ValidierungsFehler } from '../services/validierung.js';
import { normalisiereEmail } from '../services/kontomail.js';
import { zufallsToken, erzeugeWiederherstellungscodes, normalisiereWiederherstellungscode, sha256 } from '../services/sicherheit.js';
import { istInterneAdresse } from '../services/netz.js';
import { FUNKTIONEN } from '../../shared/konstanten.js';

const ZU_VIELE = 'Zu viele Fehlversuche. Bitte warte 15 Minuten und versuche es dann erneut.';

export function authRouter({ db, konten, konfiguration, dateien, speicher, kontoMail, captcha, erweiterungen, benachrichtigungen }) {
  const router = Router();
  const { cookieSicher } = konfiguration.konten;
  // Live-Werte (über Admin → Einstellungen änderbar)
  const registrierungOffen = () => konfiguration.konten.registrierungOffen;
  const zweiFaktorPflicht = () => konfiguration.konten.zweiFaktorPflicht;
  const drossel = erstelleDrossel({ maxVersuche: 10 });
  // Zusätzlich je IP-Adresse (viele Benutzernamen mit gängigen Passwörtern – „Password-Spraying“) und je Konto
  // über alle IP-Adressen hinweg (verteiltes Durchprobieren). Großzügiger, damit niemand fremde Konten einfach sperren kann.
  // Die IP-Sperre gilt nur für öffentliche Adressen: Hinter einem Reverse-Proxy ohne TRUST_PROXY hätten sonst alle Besucher
  // dieselbe (interne) Adresse und 30 Fehlversuche irgendwelcher Nutzer würden die Anmeldung für alle sperren.
  const ipDrossel = erstelleDrossel({ maxVersuche: 30 });
  const kontoDrossel = erstelleDrossel({ maxVersuche: 100 });
  const mailDrossel = erstelleDrossel({ maxVersuche: 5, fensterMs: 60 * 60 * 1000 });
  const emailPflicht = () => Boolean(konfiguration.emailPflicht && kontoMail.bereit());
  const registrierDrossel = erstelleDrossel({ maxVersuche: konfiguration.konten.registrierungenProStunde, fensterMs: 60 * 60 * 1000 });
  const geraet = (req) => req.headers['user-agent'];
  // Zugang anfragen: nur bei geschlossener Registrierung und wenn eingeschaltet
  const zugangsanfragenAktiv = () => Boolean(!registrierungOffen() && konfiguration.konten.zugangsanfragen && !konten.istErsteinrichtung());
  const anfrageDrossel = erstelleDrossel({ maxVersuche: 3, fensterMs: 60 * 60 * 1000 });

  // ── Ersteinrichtung: Das erste Konto wird Administrator. Kommt die Anfrage aus dem Internet (öffentliche IP) oder über einen
  // Reverse-Proxy, braucht es einen einmaligen Code aus dem Server-Protokoll – sonst könnte sich ein Fremder, der eine frisch
  // gestartete Installation zuerst findet, zum Administrator machen. Im eigenen Netz (z. B. http://192.168.…:3000) entfällt er.
  let einrichtungscode = null;
  const ueberProxy = (req) => Boolean(req.get('x-forwarded-for') || req.get('forwarded') || req.get('x-real-ip'));
  const brauchtEinrichtungscode = (req) => konten.istErsteinrichtung() && (!istInterneAdresse(req.ip) || ueberProxy(req));
  function aktuellerEinrichtungscode() {
    if (!einrichtungscode) {
      einrichtungscode = erzeugeWiederherstellungscodes(2).join('-');
      console.log(`\n🔑 Ersteinrichtung über das Internet bzw. einen Reverse-Proxy: Code für das erste Konto (Administrator): ${einrichtungscode}\n`);
    }
    return einrichtungscode;
  }
  const passtEinrichtungscode = (eingabe) => sha256(normalisiereWiederherstellungscode(eingabe)) === sha256(normalisiereWiederherstellungscode(aktuellerEinrichtungscode()));

  function anmeldenUndAntworten(req, res, benutzer, status = 200) {
    setzeSitzungsCookie(req, res, konten.erstelleSitzung(benutzer.id, { geraet: geraet(req) }), cookieSicher);
    res.status(status).json({ angemeldet: true, benutzer: oeffentlichesProfil(konten.holeBenutzer(benutzer.id)) });
  }

  router.get('/auth/status', (req, res) => {
    const ersteinrichtung = konten.istErsteinrichtung();
    res.json({
      angemeldet: Boolean(req.benutzer),
      benutzer: oeffentlichesProfil(req.benutzer),
      registrierungOffen: registrierungOffen() || ersteinrichtung,
      zugangsanfragen: zugangsanfragenAktiv(),
      ersteinrichtung,
      // Code aus dem Server-Protokoll nötig? (Der Code selbst wird dabei nur ins Protokoll geschrieben.)
      einrichtungscode: ersteinrichtung && brauchtEinrichtungscode(req) ? Boolean(aktuellerEinrichtungscode()) : false,
      zweiFaktorPflicht: zweiFaktorPflicht(),
      oeffentlicherKatalog: konfiguration.oeffentlicherKatalog,
      emailAktiv: kontoMail.bereit(),
      emailPflicht: emailPflicht(),
      captcha: captcha.oeffentlich(),
      // Angaben von Zusatzmodulen
      ...erweiterungen.sammle('auth.status'),
    });
  });

  // ── Zugang anfragen (geschlossene Registrierung) ──────────────────
  router.post('/auth/zugang', async (req, res) => {
    if (!zugangsanfragenAktiv()) return res.status(404).json({ fehler: 'Zugangsanfragen sind auf diesem Server nicht möglich.' });
    // Unsichtbares Feld für Bots: still „angenommen“, aber nichts gespeichert
    if (String(req.body?.webseite ?? '').trim()) return res.status(201).json({ ok: true });
    if (anfrageDrossel.gesperrt(req.ip)) return res.status(429).json({ fehler: 'Zu viele Anfragen. Bitte versuche es später noch einmal.' });
    const email = normalisiereEmail(req.body?.email);
    const name = String(req.body?.name ?? '').trim().slice(0, 80) || null;
    const nachricht = String(req.body?.nachricht ?? '').trim().slice(0, 1000) || null;
    if (!email) throw new ValidierungsFehler({ email: 'Bitte gib eine gültige E-Mail-Adresse an – dorthin kommt die Einladung.' });
    if (!req.body?.einwilligung) throw new ValidierungsFehler({ einwilligung: 'Bitte bestätige, dass wir deine Angaben für die Anfrage speichern dürfen.' });
    await captcha.pruefe(req.body?.captcha, { aktion: 'zugang', ip: req.ip });
    anfrageDrossel.fehlschlag(req.ip);
    // Alte Anfragen nach 90 Tagen löschen; dieselbe Adresse nicht mehrfach
    db.prepare("DELETE FROM zugangsanfragen WHERE erstellt_am < datetime('now', '-90 days')").run();
    const vorhanden = db.prepare("SELECT id FROM zugangsanfragen WHERE email = ? AND status = 'offen'").get(email);
    if (vorhanden) {
      db.prepare("UPDATE zugangsanfragen SET name = COALESCE(?, name), nachricht = COALESCE(?, nachricht), erstellt_am = datetime('now') WHERE id = ?").run(name, nachricht, vorhanden.id);
    } else {
      db.prepare('INSERT INTO zugangsanfragen (name, email, nachricht) VALUES (?, ?, ?)').run(name, email, nachricht);
      for (const id of db.prepare("SELECT id FROM benutzer WHERE rolle = 'admin' AND gesperrt = 0").pluck().all()) {
        benachrichtigungen?.sende(id, {
          art: 'system', titel: 'Neue Zugangsanfrage', link: '#/admin?reiter=benutzer',
          text: `${name || email} möchte mitmachen${nachricht ? `: „${nachricht.slice(0, 120)}${nachricht.length > 120 ? ' …' : ''}“` : '.'}`,
        });
      }
    }
    res.status(201).json({ ok: true });
  });

  // ALTCHA-Aufgabe für Registrierung und „Passwort vergessen“
  router.get('/auth/captcha', (_req, res) => {
    if (captcha.anbieter !== 'altcha') return res.status(404).json({ fehler: 'Nicht aktiv.' });
    res.set('Cache-Control', 'no-store').json(captcha.aufgabe());
  });

  // Einladungslink prüfen (Anmeldeseite zeigt dann das Registrierungsformular)
  router.get('/auth/einladung/:token', (req, res) => {
    if (drossel.gesperrt(`e:${req.ip}`)) return res.status(429).json({ fehler: ZU_VIELE });
    const e = konten.gueltigeEinladung(req.params.token);
    if (!e) drossel.fehlschlag(`e:${req.ip}`);
    res.json({ gueltig: Boolean(e), laeuft_ab: e?.laeuft_ab ?? null });
  });

  router.post('/auth/registrieren', async (req, res) => {
    // Einladung: gilt auch bei geschlossener Registrierung, einmal nutzbar
    const einladung = req.body?.einladung ? konten.gueltigeEinladung(req.body.einladung) : null;
    if (req.body?.einladung && !einladung) return res.status(403).json({ fehler: 'Der Einladungslink ist ungültig, abgelaufen oder wurde schon benutzt.' });
    if (!registrierungOffen() && !konten.istErsteinrichtung() && !einladung) {
      return res.status(403).json({ fehler: 'Die Registrierung ist auf diesem Server geschlossen.' });
    }
    if (registrierDrossel.gesperrt(req.ip)) return res.status(429).json({ fehler: 'Zu viele Registrierungen. Bitte später erneut versuchen.' });
    if (!einladung && brauchtEinrichtungscode(req)) {
      if (drossel.gesperrt(`einrichtung:${req.ip}`)) return res.status(429).json({ fehler: ZU_VIELE });
      if (!passtEinrichtungscode(req.body?.einrichtungscode)) {
        drossel.fehlschlag(`einrichtung:${req.ip}`);
        return res.status(403).json({
          fehler: 'Bitte gib den Einrichtungscode ein. Er steht im Server-Protokoll (z. B. „docker compose logs zockerdb“).', code: 'einrichtungscode',
        });
      }
    }
    // Das allererste Konto (Administrator) ohne Spam-Prüfung, damit eine Fehlkonfiguration nicht aussperrt
    // Mit Einladung ohne Spam-Prüfung – der Link selbst ist der Nachweis
    if (!konten.istErsteinrichtung() && !einladung) await captcha.pruefe(req.body?.captcha, { aktion: 'registrieren', ip: req.ip });
    // E-Mail vorab prüfen, damit bei einem Tippfehler kein halbes Konto entsteht
    const email = kontoMail.bereit() ? normalisiereEmail(req.body?.email) : null;
    if (emailPflicht() && !email) throw new ValidierungsFehler({ email: 'Bitte gib eine E-Mail-Adresse an.' });
    const offen = registrierungOffen();
    const benutzer = await konten.registriere(req.body ?? {});
    if (einladung) konten.loeseEinladungEin(einladung.id, benutzer.id);
    // Andockpunkt „konto.registriert“: z. B. Empfehlungsprogramm (Werber-Code nur bei offener Registrierung)
    erweiterungen.melde('konto.registriert', benutzer, { werber: offen && !einladung ? req.body?.werber : null, ip: req.ip, email });
    registrierDrossel.fehlschlag(req.ip); // zählt jede Registrierung
    if (email) {
      try {
        await kontoMail.anfordernBestaetigung(benutzer, email);
      } catch (e) {
        console.warn('[mail] Bestätigung nach Registrierung:', e.message);
      }
    }
    anmeldenUndAntworten(req, res, benutzer, 201);
  });

  router.post('/auth/anmelden', async (req, res) => {
    const { benutzername, passwort } = req.body ?? {};
    const name = String(benutzername ?? '').trim().toLowerCase().slice(0, 64);
    const schluessel = `${req.ip}|${name}`;
    const ipZaehlt = !istInterneAdresse(req.ip);
    if (drossel.gesperrt(schluessel) || (ipZaehlt && ipDrossel.gesperrt(req.ip)) || kontoDrossel.gesperrt(name)) return res.status(429).json({ fehler: ZU_VIELE });
    const benutzer = await konten.pruefeZugangsdaten(benutzername, passwort);
    if (!benutzer) {
      drossel.fehlschlag(schluessel);
      if (ipZaehlt) ipDrossel.fehlschlag(req.ip);
      kontoDrossel.fehlschlag(name);
      return res.status(401).json({ fehler: 'Benutzername oder Passwort ist falsch.' });
    }
    if (benutzer.gesperrt) return res.status(403).json({ fehler: 'Dieses Konto ist gesperrt. Bitte wende dich an den Administrator.' });
    drossel.zuruecksetzen(schluessel);
    if (benutzer.totp_aktiv) {
      const { token } = konten.erstelleSitzung(benutzer.id, { stufe: '2fa', geraet: geraet(req) });
      return res.json({ angemeldet: false, zweiFaktor: true, token });
    }
    anmeldenUndAntworten(req, res, benutzer);
  });

  router.post('/auth/2fa', (req, res) => {
    const { token, code, wiederherstellungscode } = req.body ?? {};
    const ergebnis = konten.leseSitzung(token, '2fa');
    if (!ergebnis) return res.status(401).json({ fehler: 'Die Anmeldung ist abgelaufen. Bitte erneut mit Passwort anmelden.', code: 'abgelaufen' });
    const schluessel = `2fa|${ergebnis.benutzer.id}`;
    if (drossel.gesperrt(schluessel)) return res.status(429).json({ fehler: ZU_VIELE });
    if (!konten.pruefeZweitenFaktor(ergebnis.benutzer, { code, wiederherstellungscode })) {
      drossel.fehlschlag(schluessel);
      return res.status(401).json({ fehler: wiederherstellungscode ? 'Dieser Wiederherstellungscode ist ungültig oder wurde schon benutzt.' : 'Der Code ist falsch oder abgelaufen.' });
    }
    drossel.zuruecksetzen(schluessel);
    konten.beendeSitzung(token);
    anmeldenUndAntworten(req, res, ergebnis.benutzer);
  });

  router.post('/auth/abmelden', (req, res) => {
    konten.beendeSitzung(req.sitzungsToken);
    loescheSitzungsCookie(req, res, cookieSicher);
    res.json({ angemeldet: false });
  });

  // ── Eigenes Konto ────────────────────────────────────────
  // Ohne 2FA-Pflicht-Prüfung, damit man die 2FA hier überhaupt einrichten kann.
  const angemeldet = erfordereAnmeldung({ zweiFaktorPflicht: false });

  // Passwortbestätigung (2FA, E-Mail, Konto löschen …) – mit Begrenzung der Fehlversuche je Konto
  async function bestaetigePasswort(req) {
    const schluessel = `bestaetigen:${req.benutzer.id}`;
    if (drossel.gesperrt(schluessel)) throw new KontoFehler(ZU_VIELE, 429);
    const benutzer = await konten.pruefeZugangsdaten(req.benutzer.benutzername, req.body?.passwort);
    if (!benutzer) {
      drossel.fehlschlag(schluessel);
      throw new ValidierungsFehler({ passwort: 'Das Passwort ist falsch.' });
    }
    drossel.zuruecksetzen(schluessel);
  }

  router.get('/konto', angemeldet, (req, res) => {
    res.json({
      ...oeffentlichesProfil(req.benutzer),
      wiederherstellungscodesUebrig: konten.anzahlWiederherstellungscodes(req.benutzer),
      email: req.benutzer.email ?? null,
      ausstehendeEmail: kontoMail.ausstehendeEmail(req.benutzer.id),
      emailAktiv: kontoMail.bereit(),
      emailPflicht: emailPflicht(),
      benachrichtigung_email: Boolean(req.benutzer.benachrichtigung_email),
      freigabe: freigabeInfo(req.benutzer),
      speicher: speicher.info(req.benutzer.id),
      datenspende: Boolean(req.benutzer.datenspende),
      datenspendeAktiv: Boolean(konfiguration.zentrale?.url && konfiguration.zentrale.spende),
      ...erweiterungen.sammle('konto.info', req.benutzer),
    });
  });

  // ── E-Mail-Adresse & Passwort vergessen ─────────
  router.post('/konto/email', angemeldet, async (req, res) => {
    await bestaetigePasswort(req);
    if (mailDrossel.gesperrt(`email:${req.benutzer.id}`)) return res.status(429).json({ fehler: 'Zu viele Anfragen. Bitte später erneut versuchen.' });
    mailDrossel.fehlschlag(`email:${req.benutzer.id}`);
    await kontoMail.anfordernBestaetigung(req.benutzer, req.body?.email);
    res.json({ ok: true, ausstehendeEmail: kontoMail.ausstehendeEmail(req.benutzer.id) });
  });

  router.delete('/konto/email', angemeldet, async (req, res) => {
    await bestaetigePasswort(req);
    if (emailPflicht()) throw new KontoFehler('Auf diesem Server ist eine E-Mail-Adresse Pflicht. Du kannst sie ändern, aber nicht entfernen.', 409);
    kontoMail.entferneEmail(req.benutzer.id);
    res.json({ ok: true });
  });

  router.post('/auth/email-bestaetigen', (req, res) => {
    const b = kontoMail.bestaetige(req.body?.token);
    res.json({ ok: true, email: b.email });
  });

  router.post('/auth/passwort-vergessen', async (req, res) => {
    if (mailDrossel.gesperrt(req.ip)) return res.status(429).json({ fehler: 'Zu viele Anfragen. Bitte später erneut versuchen.' });
    mailDrossel.fehlschlag(req.ip);
    await captcha.pruefe(req.body?.captcha, { aktion: 'passwort', ip: req.ip });
    await kontoMail.anfordernReset(req.body?.kennung);
    // Immer dieselbe Antwort – verrät nicht, ob das Konto existiert
    res.json({ ok: true, hinweis: 'Falls ein Konto mit bestätigter E-Mail-Adresse existiert, haben wir dir einen Link geschickt. Er ist 60 Minuten gültig.' });
  });

  router.post('/auth/passwort-zuruecksetzen', async (req, res) => {
    if (drossel.gesperrt(req.ip)) return res.status(429).json({ fehler: ZU_VIELE });
    try {
      await kontoMail.zuruecksetzen(req.body?.token, req.body?.neuesPasswort);
    } catch (e) {
      if (e instanceof KontoFehler) drossel.fehlschlag(req.ip);
      throw e;
    }
    res.json({ ok: true });
  });

  // ── Sammlung per geheimem Link teilen ─────────
  function freigabeInfo(b) {
    if (!b.freigabe_token) return { aktiv: false, wert_zeigen: Boolean(b.freigabe_wert) };
    const pfad = `/sammlung/${b.freigabe_token}`;
    return { aktiv: true, wert_zeigen: Boolean(b.freigabe_wert), pfad, url: konfiguration.oeffentlicheUrl ? `${konfiguration.oeffentlicheUrl}${pfad}` : null };
  }
  router.post('/konto/freigabe', angemeldet, (req, res) => {
    const b = konten.holeBenutzer(req.benutzer.id);
    const neu = req.body?.neu === true || !b.freigabe_token;
    db.prepare('UPDATE benutzer SET freigabe_token = ?, freigabe_wert = ? WHERE id = ?')
      .run(neu ? zufallsToken(18) : b.freigabe_token, req.body?.wert_zeigen === undefined ? b.freigabe_wert : (req.body.wert_zeigen ? 1 : 0), b.id);
    erweiterungen.melde('benutzer.geaendert', b.id);
    res.json(freigabeInfo(konten.holeBenutzer(b.id)));
  });
  router.delete('/konto/freigabe', angemeldet, (req, res) => {
    db.prepare('UPDATE benutzer SET freigabe_token = NULL WHERE id = ?').run(req.benutzer.id);
    res.json(freigabeInfo(konten.holeBenutzer(req.benutzer.id)));
  });

  router.get('/konto/speicher', angemeldet, (req, res) => {
    res.json(speicher.info(req.benutzer.id));
  });

  router.put('/konto', angemeldet, (req, res) => {
    const { anzeigename, sammlung_oeffentlich: oeffentlich, benachrichtigung_email: perEmail } = req.body ?? {};
    // Einstellungen von Zusatzmodulen (z. B. wöchentliche Zusammenfassung)
    for (const fn of erweiterungen.alle('konto.aendern')) fn(req.benutzer, req.body ?? {});
    if (req.body?.datenspende !== undefined) {
      db.prepare('UPDATE benutzer SET datenspende = ? WHERE id = ?').run(req.body.datenspende ? 1 : 0, req.benutzer.id);
    }
    if (req.body?.fotos_nachfragen !== undefined) {
      db.prepare('UPDATE benutzer SET fotos_nachfragen = ? WHERE id = ?').run(req.body.fotos_nachfragen ? 1 : 0, req.benutzer.id);
    }
    if (perEmail !== undefined) {
      db.prepare('UPDATE benutzer SET benachrichtigung_email = ? WHERE id = ?').run(perEmail ? 1 : 0, req.benutzer.id);
    }
    // Zusatzfelder ein-/ausschalten: { lagerort: true, … } – nur bekannte Schlüssel, übrige bleiben
    if (req.body?.funktionen && typeof req.body.funktionen === 'object') {
      const neu = { ...leseFunktionen(konten.holeBenutzer(req.benutzer.id).funktionen) };
      for (const f of FUNKTIONEN) if (typeof req.body.funktionen[f.value] === 'boolean') neu[f.value] = req.body.funktionen[f.value];
      db.prepare('UPDATE benutzer SET funktionen = ? WHERE id = ?').run(JSON.stringify(neu), req.benutzer.id);
    }
    // Geführte Touren: { tourId: 'fertig' | 'abgelehnt' | null } – null setzt die Tour zurück
    if (req.body?.touren && typeof req.body.touren === 'object' && !Array.isArray(req.body.touren)) {
      const neu = leseTouren(konten.holeBenutzer(req.benutzer.id).touren);
      for (const [id, wert] of Object.entries(req.body.touren).slice(0, 50)) {
        if (!/^[a-z0-9-]{1,40}$/.test(id)) continue;
        if (wert === null) delete neu[id];
        else if (TOUR_STAENDE.includes(wert)) neu[id] = wert;
      }
      db.prepare('UPDATE benutzer SET touren = ? WHERE id = ?').run(JSON.stringify(leseTouren(JSON.stringify(neu))), req.benutzer.id);
    }
    // „Meine Systeme“: Liste von Plattform-IDs oder null (= Standardsysteme)
    if (req.body?.meine_systeme !== undefined) {
      const ids = Array.isArray(req.body.meine_systeme)
        ? [...new Set(req.body.meine_systeme.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500) : null;
      db.prepare('UPDATE benutzer SET meine_systeme = ? WHERE id = ?').run(ids ? JSON.stringify(ids) : null, req.benutzer.id);
    }
    if (anzeigename !== undefined) {
      db.prepare('UPDATE benutzer SET anzeigename = ? WHERE id = ?').run(String(anzeigename).trim().slice(0, 60) || null, req.benutzer.id);
    }
    if (oeffentlich !== undefined) {
      db.prepare('UPDATE benutzer SET sammlung_oeffentlich = ? WHERE id = ?').run(oeffentlich ? 1 : 0, req.benutzer.id);
    }
    const b = konten.holeBenutzer(req.benutzer.id);
    res.json({ ...oeffentlichesProfil(b), benachrichtigung_email: Boolean(b.benachrichtigung_email), ...erweiterungen.sammle('konto.info', b) });
  });

  router.post('/konto/passwort', angemeldet, async (req, res) => {
    // Wie jede Passwortbestätigung gedrosselt – sonst ließe sich mit einer übernommenen Sitzung das Passwort durchprobieren
    const drosselSchluessel = `bestaetigen:${req.benutzer.id}`;
    if (drossel.gesperrt(drosselSchluessel)) throw new KontoFehler(ZU_VIELE, 429);
    const benutzer = await konten.pruefeZugangsdaten(req.benutzer.benutzername, req.body?.altesPasswort);
    if (!benutzer) {
      drossel.fehlschlag(drosselSchluessel);
      throw new ValidierungsFehler({ altesPasswort: 'Das bisherige Passwort ist falsch.' });
    }
    drossel.zuruecksetzen(drosselSchluessel);
    pruefeNeuesPasswort(req.body?.neuesPasswort, 'neuesPasswort');
    await konten.aenderePasswort(req.benutzer.id, req.body.neuesPasswort);
    konten.beendeAndereSitzungen(req.benutzer.id, req.sitzungHash);
    await kontoMail.sicherheitshinweis(req.benutzer, 'Dein Passwort wurde geändert', 'Das Passwort deines Kontos wurde gerade in den Kontoeinstellungen geändert. Andere Geräte wurden abgemeldet.');
    res.json({ ok: true });
  });

  router.post('/konto/abmelden-ueberall', angemeldet, (req, res) => {
    konten.beendeAndereSitzungen(req.benutzer.id, req.sitzungHash);
    res.json({ ok: true });
  });

  router.post('/konto/2fa/einrichten', angemeldet, async (req, res) => {
    await bestaetigePasswort(req);
    res.json(await konten.starteTotpEinrichtung(req.benutzer));
  });

  router.post('/konto/2fa/bestaetigen', angemeldet, (req, res) => {
    const codes = konten.bestaetigeTotpEinrichtung(konten.holeBenutzer(req.benutzer.id), req.body?.code);
    konten.beendeAndereSitzungen(req.benutzer.id, req.sitzungHash);
    erweiterungen.melde('benutzer.geaendert', req.benutzer.id);
    res.json({ wiederherstellungscodes: codes });
  });

  router.post('/konto/2fa/deaktivieren', angemeldet, async (req, res) => {
    if (zweiFaktorPflicht()) throw new KontoFehler('Auf diesem Server ist die Zwei-Faktor-Anmeldung Pflicht.', 403);
    await bestaetigePasswort(req);
    if (!konten.pruefeZweitenFaktor(req.benutzer, { code: req.body?.code })) {
      throw new ValidierungsFehler({ code: 'Der Code ist falsch oder abgelaufen.' });
    }
    konten.deaktiviereTotp(req.benutzer.id);
    await kontoMail.sicherheitshinweis(req.benutzer, 'Zwei-Faktor-Anmeldung deaktiviert', 'Die Zwei-Faktor-Anmeldung deines Kontos wurde gerade ausgeschaltet.');
    res.json({ ok: true });
  });

  router.post('/konto/2fa/wiederherstellungscodes', angemeldet, async (req, res) => {
    await bestaetigePasswort(req);
    if (!req.benutzer.totp_aktiv) throw new KontoFehler('Die Zwei-Faktor-Anmeldung ist nicht aktiv.');
    res.json({ wiederherstellungscodes: konten.neueWiederherstellungscodes(req.benutzer.id) });
  });

  router.delete('/konto', angemeldet, async (req, res) => {
    await bestaetigePasswort(req);
    if (req.benutzer.rolle === 'admin') {
      const admins = db.prepare("SELECT COUNT(*) AS n FROM benutzer WHERE rolle = 'admin'").get().n;
      if (admins <= 1) throw new KontoFehler('Du bist der einzige Administrator. Ernenne zuerst einen weiteren Administrator.', 409);
    }
    // Zusatzmodule räumen vorher auf (z. B. laufende Abos kündigen)
    await erweiterungen.fuehreAus('konto.loeschen', req.benutzer.id);
    dateien.loescheBenutzerdaten(req.benutzer.id);
    loescheSitzungsCookie(req, res, cookieSicher);
    res.status(204).end();
  });

  return router;
}
