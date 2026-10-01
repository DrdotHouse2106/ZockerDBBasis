import { Router } from 'express';
import { KontoFehler } from '../services/konten.js';
import { mailHtml } from '../services/mail.js';
import { MARKE } from '../../shared/marke.js';
import { erstelleDrossel } from '../services/drossel.js';

// Nur über die .env änderbar – zur Information in der Oberfläche
const NUR_ENV = ['APP_SECRET', 'DATABASE_PATH', 'UPLOAD_DIR', 'PORT', 'HOST', 'TRUST_PROXY', 'COOKIE_SECURE', 'SESSION_DAYS', 'REGISTRATIONS_PER_HOUR'];

export function adminRouter({ db, konten, dateien, speicher, sicherung, aktualisierung, mail, benachrichtigungen, igdb, einstellungen, konfiguration, erweiterungen }) {
  const router = Router();
  const bestaetigungsDrossel = erstelleDrossel({ maxVersuche: 5 });
  const anzahlAdmins = () => db.prepare("SELECT COUNT(*) AS n FROM benutzer WHERE rolle = 'admin' AND gesperrt = 0").get().n;
  const ziel = (req) => {
    const b = konten.holeBenutzer(Number(req.params.id));
    if (!b) throw new KontoFehler('Benutzer nicht gefunden.', 404);
    return b;
  };

  // Übersicht für das Admin-Dashboard
  router.get('/uebersicht', (_req, res) => {
    const zahl = (sql) => db.prepare(sql).get().n;
    const ergebnis = {
      benutzer: zahl('SELECT COUNT(*) AS n FROM benutzer'),
      moderatoren: zahl("SELECT COUNT(*) AS n FROM benutzer WHERE rolle IN ('moderator', 'admin')"),
      mitZweiFaktor: zahl('SELECT COUNT(*) AS n FROM benutzer WHERE totp_aktiv = 1'),
      gesperrt: zahl('SELECT COUNT(*) AS n FROM benutzer WHERE gesperrt = 1'),
      neueBenutzer7Tage: zahl("SELECT COUNT(*) AS n FROM benutzer WHERE erstellt_am >= datetime('now', '-7 days')"),
      artikel: zahl("SELECT COALESCE(SUM(anzahl), 0) AS n FROM artikel WHERE bestand = 'besitz'"),
      katalogFreigegeben: zahl("SELECT COUNT(*) AS n FROM katalog WHERE status = 'freigegeben'"),
      katalogPrivat: zahl("SELECT COUNT(*) AS n FROM katalog WHERE status IN ('privat', 'abgelehnt')"),
      offen: {
        katalog: zahl("SELECT COUNT(*) AS n FROM katalog WHERE status = 'eingereicht'"),
        varianten: zahl("SELECT COUNT(*) AS n FROM katalog_varianten WHERE status = 'eingereicht'"),
        medien: zahl("SELECT COUNT(*) AS n FROM medien WHERE sichtbarkeit = 'eingereicht'"),
      },
      medienFreigegeben: zahl("SELECT COUNT(*) AS n FROM medien WHERE sichtbarkeit = 'freigegeben'"),
      speicher: {
        gesamt: zahl('SELECT COALESCE(SUM(groesse_gesamt), 0) AS n FROM medien')
          + zahl('SELECT COALESCE(SUM(bild_groesse), 0) AS n FROM artikel WHERE bild_datei IS NOT NULL'),
        gemeinschaft: zahl("SELECT COALESCE(SUM(groesse_gesamt), 0) AS n FROM medien WHERE sichtbarkeit = 'freigegeben'"),
        standardMb: speicher.standardMb,
      },
      dienste: {
        igdb: igdb.konfiguriert,
        registrierungOffen: konfiguration.konten.registrierungOffen,
        zweiFaktorPflicht: konfiguration.konten.zweiFaktorPflicht,
        oeffentlicherKatalog: konfiguration.oeffentlicherKatalog,
        medienTeilen: konfiguration.medienTeilenErlaubt,
        fotosTeilen: konfiguration.fotosTeilenErlaubt,
      },
    };
    // Zusatzmodule ergänzen die Übersicht (z. B. Preisimport, KI-Vorprüfung, externe Sicherung)
    for (const fn of erweiterungen.alle('admin.uebersicht')) fn(ergebnis);
    res.json(ergebnis);
  });

  // ── Update per Knopf (Watchtower) ──────────────────────────
  router.get('/aktualisierung', async (req, res) => {
    // Beim Öffnen der Übersicht: stündlich bei GitHub nachsehen, „Jetzt prüfen“ erzwingt es
    await aktualisierung.pruefe({ erzwingen: req.query.pruefen === '1' });
    res.json(aktualisierung.status());
  });
  router.post('/aktualisierung', async (_req, res) => res.json(await aktualisierung.starte()));

  // ── Server-Einstellungen (Vorrang vor der .env, wirken sofort) ─────────
  router.get('/einstellungen', (_req, res) => {
    res.json({ einstellungen: einstellungen.liste(), nurEnv: NUR_ENV, protokoll: einstellungen.protokoll(50), ...erweiterungen.sammle('admin.einstellungen') });
  });

  router.put('/einstellungen', async (req, res) => {
    const { werte = {}, zuruecksetzen = [], entfernen = [], passwort, code } = req.body ?? {};
    const aenderung = {
      werte: werte && typeof werte === 'object' ? werte : {},
      zuruecksetzen: Array.isArray(zuruecksetzen) ? zuruecksetzen.map(String) : [],
      entfernen: Array.isArray(entfernen) ? entfernen.map(String) : [],
    };
    // Schlüssel und sicherheitsrelevante Werte nur mit Passwort (und 2FA-Code, falls aktiv)
    if (einstellungen.brauchtBestaetigung(aenderung)) {
      const drosselSchluessel = `einstellungen:${req.benutzer.id}`;
      if (bestaetigungsDrossel.gesperrt(drosselSchluessel)) {
        throw new KontoFehler('Zu viele Fehlversuche. Bitte warte 15 Minuten.', 429);
      }
      if (!passwort) throw new KontoFehler('Diese Änderung ist sicherheitsrelevant. Bitte bestätige sie mit deinem Passwort.', 403, 'bestaetigung_noetig');
      const b = await konten.pruefeZugangsdaten(req.benutzer.benutzername, passwort);
      const vollstaendig = konten.holeBenutzer(req.benutzer.id);
      const zweiterFaktorOk = !vollstaendig.totp_aktiv || (code && konten.pruefeZweitenFaktor(vollstaendig, { code: String(code) }));
      if (!b || !zweiterFaktorOk) {
        bestaetigungsDrossel.fehlschlag(drosselSchluessel);
        throw new KontoFehler(!b ? 'Das Passwort ist falsch.' : 'Der 2FA-Code ist falsch oder fehlt.', 403, 'bestaetigung_noetig');
      }
      bestaetigungsDrossel.zuruecksetzen(drosselSchluessel);
    }
    const geaendert = einstellungen.setze(aenderung, req.benutzer);
    res.json({ geaendert, einstellungen: einstellungen.liste(), protokoll: einstellungen.protokoll(50), ...erweiterungen.sammle('admin.einstellungen') });
  });

  // Test-E-Mail an die eigene (oder angegebene) Adresse
  router.post('/test-mail', async (req, res) => {
    const an = String(req.body?.an ?? '').trim() || req.benutzer.email;
    if (!an) throw new KontoFehler('Bitte eine Empfängeradresse angeben oder unter „Konto“ eine E-Mail-Adresse hinterlegen.');
    if (!mail.aktiv) throw new KontoFehler('Der E-Mail-Versand ist nicht eingerichtet (SMTP-Server und Absender fehlen).');
    try {
      await mail.sende({ an, betreff: 'ZockerDB: Test-E-Mail', text: 'Der E-Mail-Versand funktioniert. 🎮' });
    } catch (e) {
      throw new KontoFehler(`Versand fehlgeschlagen: ${e.message}`, 502);
    }
    res.json({ ok: true, an });
  });

  // IGDB-Zugang testen: Anmeldung bei Twitch, eine Beispielsuche und ob Datenabzüge (für Datenpartner) freigeschaltet sind
  router.post('/igdb/test', async (_req, res) => {
    if (!igdb.konfiguriert) throw new KontoFehler('IGDB ist nicht eingerichtet – bitte Client-ID und Client-Secret eintragen und speichern.');
    const beginn = Date.now();
    let treffer;
    try {
      treffer = await igdb.sucheSpiele('Super Mario Bros', 3);
    } catch (e) {
      throw new KontoFehler(`Verbindung fehlgeschlagen: ${e.message}`, 502);
    }
    const dauer = Date.now() - beginn;
    let abzuege;
    try {
      const liste = await igdb.hole('dumps');
      abzuege = { freigeschaltet: Array.isArray(liste), anzahl: Array.isArray(liste) ? liste.length : 0 };
    } catch (e) {
      abzuege = { freigeschaltet: false, hinweis: e.message };
    }
    res.json({ ok: true, dauer, beispiele: treffer.map((t) => t.titel_original ?? t.titel), abzuege });
  });

  // ── Datenbank-Sicherungen ─────────
  router.get('/sicherungen', (_req, res) => res.json({ ...sicherung.status(), ...erweiterungen.sammle('admin.sicherungen') }));
  router.post('/sicherungen', async (_req, res) => {
    const s = await sicherung.lauf({ erzwingen: true });
    if (s.letzterFehler) return res.status(500).json({ fehler: `Sicherung fehlgeschlagen: ${s.letzterFehler}` });
    res.json({ ...s, ...erweiterungen.sammle('admin.sicherungen') });
  });

  router.get('/benutzer', (_req, res) => {
    res.json(db.prepare(`
      SELECT b.id, b.benutzername, b.anzeigename, b.email, b.rolle, b.gesperrt, b.totp_aktiv, b.sammlung_oeffentlich,
             b.erstellt_am, b.letzte_anmeldung, COUNT(a.id) AS eintraege
      FROM benutzer b LEFT JOIN artikel a ON a.benutzer_id = b.id AND a.bestand = 'besitz'
      GROUP BY b.id ORDER BY b.erstellt_am`).all().map((b) => ({
        ...b, speicher: speicher.info(b.id),
        // Zusatzmodule (z. B. Händlerstatus und gebuchte Pakete)
        ...erweiterungen.sammle('admin.benutzer', b.id),
      })));
  });

  // ── Einladungen: Konto für Bekannte bei geschlossener Registrierung ──
  router.get('/einladungen', (_req, res) => res.json(konten.einladungen()));
  /** Einladung anlegen und – mit E-Mail-Adresse – per Mail verschicken. Der Link wird nur jetzt angezeigt (gespeichert ist eine Prüfsumme). */
  async function ladeEin(req, { email, notiz, tage }) {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new KontoFehler('Bitte eine gültige E-Mail-Adresse angeben.');
    if (email && !mail.aktiv) throw new KontoFehler('Der E-Mail-Versand ist nicht eingerichtet (SMTP) – den Link bitte kopieren und selbst weitergeben.');
    const e = konten.erstelleEinladung(req.benutzer.id, { notiz: notiz || email, tage });
    // „?app=1“: Ohne Anmeldung zeigt „/“ sonst die öffentliche Startseite statt der App.
    const basis = konfiguration.oeffentlicheUrl || `${req.protocol}://${req.get('host')}`;
    const link = `${basis}/?app=1#/?einladung=${e.token}`;
    if (!email) return { ...e, link, versendet: false, an: null };
    const von = req.benutzer.anzeigename || req.benutzer.benutzername;
    const bis = new Date(`${e.laeuft_ab.replace(' ', 'T')}Z`).toLocaleDateString('de-DE');
    try {
      await mail.sende({
        an: email,
        betreff: `Einladung zu ${MARKE.name}`,
        text: `Hallo,\n\n${von} lädt dich zu ${MARKE.name} ein – ${MARKE.untertitel}.\n\nMit diesem Link legst du dir dein Konto an (gültig bis ${bis}, nur einmal verwendbar):\n${link}\n\nBenutzername und Passwort wählst du selbst.`,
        html: mailHtml({
          titel: `Einladung zu ${MARKE.name}`,
          absaetze: [`${von} lädt dich zu ${MARKE.name} ein – ${MARKE.untertitel}.`, `Mit dem Knopf legst du dir dein Konto an. Benutzername und Passwort wählst du selbst. Der Link gilt bis ${bis} und nur für ein Konto.`],
          knopf: { url: link, text: 'Konto anlegen' },
        }),
      });
    } catch (fehler) {
      return { ...e, link, versendet: false, fehler: `Die E-Mail konnte nicht versendet werden (${fehler.message}). Den Link kannst du kopieren.` };
    }
    return { ...e, link, versendet: true, an: email };
  }

  router.post('/einladungen', async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    res.status(201).json(await ladeEin(req, { email, notiz: req.body?.notiz, tage: req.body?.tage }));
  });

  // ── Zugangsanfragen (geschlossene Registrierung) ──
  router.get('/zugangsanfragen', (_req, res) => {
    db.prepare("DELETE FROM zugangsanfragen WHERE erstellt_am < datetime('now', '-90 days')").run();
    res.json(db.prepare("SELECT id, name, email, nachricht, status, erstellt_am, bearbeitet_am FROM zugangsanfragen ORDER BY status = 'offen' DESC, erstellt_am DESC LIMIT 200").all());
  });
  router.post('/zugangsanfragen/:id/einladen', async (req, res) => {
    const a = db.prepare("SELECT * FROM zugangsanfragen WHERE id = ?").get(Number(req.params.id));
    if (!a) throw new KontoFehler('Anfrage nicht gefunden.', 404);
    // Ohne E-Mail-Versand: Link zum Kopieren und selbst Weitergeben
    const ergebnis = await ladeEin(req, { email: mail.aktiv ? a.email : '', notiz: `Zugangsanfrage: ${a.name || a.email}` });
    db.prepare("UPDATE zugangsanfragen SET status = 'eingeladen', bearbeitet_am = datetime('now'), bearbeitet_von = ? WHERE id = ?").run(req.benutzer.id, a.id);
    res.status(201).json({ ...ergebnis, anfrage_email: a.email });
  });
  router.delete('/zugangsanfragen/:id', (req, res) => {
    if (!db.prepare('DELETE FROM zugangsanfragen WHERE id = ?').run(Number(req.params.id)).changes) throw new KontoFehler('Anfrage nicht gefunden.', 404);
    res.status(204).end();
  });
  router.delete('/einladungen/:id', (req, res) => {
    if (!konten.loescheEinladung(req.params.id)) throw new KontoFehler('Einladung nicht gefunden.', 404);
    res.status(204).end();
  });

  router.put('/benutzer/:id', (req, res) => {
    const b = ziel(req);
    const { rolle, gesperrt, speicher_limit_mb: limitMb } = req.body ?? {};
    const verliertAdmin = b.rolle === 'admin' && !b.gesperrt && ((rolle && rolle !== 'admin') || gesperrt);
    if (verliertAdmin && anzahlAdmins() <= 1) throw new KontoFehler('Es muss mindestens ein aktiver Administrator bleiben.', 409);
    if (rolle !== undefined) {
      if (!['admin', 'moderator', 'nutzer'].includes(rolle)) throw new KontoFehler('Ungültige Rolle.');
      db.prepare('UPDATE benutzer SET rolle = ? WHERE id = ?').run(rolle, b.id);
      if (rolle !== b.rolle) {
        const name = { admin: 'Administrator', moderator: 'Moderator', nutzer: 'Nutzer' }[rolle];
        benachrichtigungen.sende(b.id, {
          art: 'rolle', titel: `Deine Rolle: ${name}`,
          text: rolle === 'moderator' ? 'Du kannst jetzt Einreichungen prüfen und Katalogeinträge bearbeiten – unter „Mehr → Moderation“, dort zeigt dir eine kurze Tour alles. Danke für deine Hilfe!' : null,
          link: rolle === 'nutzer' ? null : rolle === 'moderator' ? '#/moderation' : '#/admin',
        });
      }
    }
    if (limitMb !== undefined) {
      // null/leer = Standard, 0 = unbegrenzt, sonst MB
      const wert = limitMb === null || limitMb === '' ? null : Number(limitMb);
      if (wert !== null && (!Number.isInteger(wert) || wert < 0 || wert > 10_000_000)) {
        throw new KontoFehler('Bitte ein Speicherlimit in ganzen MB angeben (0 = unbegrenzt, leer = Standard).');
      }
      db.prepare('UPDATE benutzer SET speicher_limit_mb = ? WHERE id = ?').run(wert, b.id);
    }
    if (gesperrt !== undefined) {
      db.prepare('UPDATE benutzer SET gesperrt = ? WHERE id = ?').run(gesperrt ? 1 : 0, b.id);
      if (gesperrt) konten.beendeAlleSitzungen(b.id);
    }
    res.json({ ok: true });
  });

  router.post('/benutzer/:id/2fa-zuruecksetzen', (req, res) => {
    const b = ziel(req);
    konten.deaktiviereTotp(b.id);
    konten.beendeAlleSitzungen(b.id);
    res.json({ ok: true });
  });

  router.post('/benutzer/:id/passwort', async (req, res) => {
    const b = ziel(req);
    await konten.aenderePasswort(b.id, req.body?.neuesPasswort);
    konten.beendeAlleSitzungen(b.id);
    res.json({ ok: true });
  });

  router.delete('/benutzer/:id', async (req, res) => {
    const b = ziel(req);
    if (b.id === req.benutzer.id) throw new KontoFehler('Das eigene Konto bitte unter „Konto“ löschen.', 409);
    if (b.rolle === 'admin' && anzahlAdmins() <= 1) throw new KontoFehler('Der letzte Administrator kann nicht gelöscht werden.', 409);
    await erweiterungen.fuehreAus('konto.loeschen', b.id);
    dateien.loescheBenutzerdaten(b.id);
    res.status(204).end();
  });

  return router;
}
