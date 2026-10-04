// Benachrichtigungen in der App (Glocke) und – wenn der Benutzer es einschaltet – per E-Mail.
import { MARKE } from '../../shared/marke.js';
import { APP_START } from '../../shared/seo.js';
import { mailHtml } from './mail.js';

const MAX_JE_BENUTZER = 200;

/**
 * Arten von Benachrichtigungen, die jeder Benutzer einzeln abschalten kann (je Kanal: App, E-Mail, Push).
 * Zusatzmodule melden weitere Arten über „benachrichtigungen.kategorien“ an. Unbekannte Arten werden immer zugestellt.
 */
export const KATEGORIEN = [
  { id: 'beitraege', label: 'Deine Beiträge', beschreibung: 'Einreichungen, Fotos und Vorschläge wurden geprüft', arten: ['freigabe', 'ablehnung'] },
  { id: 'leihe', label: 'Verleih', beschreibung: 'Erinnerungen an verliehene Spiele', arten: ['leihe'] },
  { id: 'community', label: 'Community & Erfolge', beschreibung: 'Freunde, neue Erfolge und Termine aus dem Kalender', arten: ['freunde', 'erfolg', 'kalender'] },
  { id: 'moderation', label: 'Moderation', beschreibung: 'Neue Meldungen und Prüfaufgaben', arten: ['moderation', 'meldung'], nurModeration: true },
  // Sicherheitsrelevantes bleibt in der App immer sichtbar
  { id: 'system', label: 'Konto & Sicherheit', beschreibung: 'Wichtige Hinweise zu deinem Konto – in der App immer an', arten: ['system', 'rolle'], appPflicht: true },
];
const STANDARD = { app: true, email: true, push: true };

export function erstelleBenachrichtigungsDienst(db, { mail, konfiguration, erweiterungen }) {
  let push = null; // wird nach dem Anlegen gesetzt (Web-Push aufs Handy)
  const q = {
    anlegen: db.prepare('INSERT INTO benachrichtigungen (benutzer_id, art, titel, text, link) VALUES (?, ?, ?, ?, ?) RETURNING id'),
    kuerzen: db.prepare(`DELETE FROM benachrichtigungen WHERE benutzer_id = @b AND id NOT IN
      (SELECT id FROM benachrichtigungen WHERE benutzer_id = @b ORDER BY id DESC LIMIT ${MAX_JE_BENUTZER})`),
    empfaenger: db.prepare('SELECT id, benutzername, anzeigename, email, rolle, benachrichtigung_email, benachrichtigung_auswahl FROM benutzer WHERE id = ?'),
    auswahlSetzen: db.prepare('UPDATE benutzer SET benachrichtigung_auswahl = ? WHERE id = ?'),
    liste: db.prepare('SELECT id, art, titel, text, link, gelesen, erstellt_am FROM benachrichtigungen WHERE benutzer_id = ? ORDER BY id DESC LIMIT ?'),
    ungelesen: db.prepare('SELECT COUNT(*) AS n FROM benachrichtigungen WHERE benutzer_id = ? AND gelesen = 0'),
    alleGelesen: db.prepare('UPDATE benachrichtigungen SET gelesen = 1 WHERE benutzer_id = ? AND gelesen = 0'),
    eineGelesen: db.prepare('UPDATE benachrichtigungen SET gelesen = 1 WHERE benutzer_id = ? AND id = ?'),
    loeschen: db.prepare('DELETE FROM benachrichtigungen WHERE benutzer_id = ? AND id = ?'),
  };

  // Kategorien des Kerns und der Zusatzmodule (erst beim Aufruf gesammelt – Module melden sich nach dem Anlegen an)
  const kategorien = () => [...(erweiterungen?.alle('benachrichtigungen.kategorien').flatMap((fn) => fn()) ?? []), ...KATEGORIEN];
  const kategorieVon = (art) => kategorien().find((k) => k.arten.includes(art)) ?? null;
  function auswahlVon(b) {
    try { return JSON.parse(b?.benachrichtigung_auswahl || '{}') ?? {}; } catch { return {}; }
  }
  /** Was der Benutzer für diese Art eingestellt hat (fehlende Angaben = Standard: alles an). */
  function einstellung(b, kat) {
    const e = { ...STANDARD, ...(kat ? auswahlVon(b)[kat.id] : {}) };
    if (kat?.appPflicht) e.app = true;
    return e;
  }

  /** Einstellungen für die Kontoseite: je Kategorie App/E-Mail/Push und welche Kanäle es gibt. */
  function auswahl(benutzerId) {
    const b = q.empfaenger.get(benutzerId);
    const moderation = ['admin', 'moderator'].includes(b?.rolle);
    return {
      kanaele: { email: Boolean(mail.aktiv && b?.email && konfiguration.oeffentlicheUrl), email_an: Boolean(b?.benachrichtigung_email), push: Boolean(push) },
      kategorien: kategorien().filter((k) => !k.nurModeration || moderation).map((k) => ({
        id: k.id, label: k.label, beschreibung: k.beschreibung, app_pflicht: Boolean(k.appPflicht), ...einstellung(b, k),
      })),
    };
  }
  function setzeAuswahl(benutzerId, eingabe = {}) {
    const b = q.empfaenger.get(benutzerId);
    const alt = auswahlVon(b);
    for (const k of kategorien()) {
      const neu = eingabe?.[k.id];
      if (!neu || typeof neu !== 'object') continue;
      alt[k.id] = { ...STANDARD, ...alt[k.id] };
      for (const kanal of ['app', 'email', 'push']) if (typeof neu[kanal] === 'boolean') alt[k.id][kanal] = neu[kanal];
      if (k.appPflicht) alt[k.id].app = true;
    }
    q.auswahlSetzen.run(JSON.stringify(alt), benutzerId);
    return auswahl(benutzerId);
  }

  /**
   * Neue Benachrichtigung. `link` ist eine App-Adresse wie „#/katalog/5“.
   * Fehler beim E-Mail-Versand werden nur protokolliert und brechen nichts ab.
   */
  function sende(benutzerId, { art, titel, text = null, link = null }) {
    if (!benutzerId) return null;
    const b = q.empfaenger.get(benutzerId);
    if (!b) return null;
    // Vom Benutzer abgeschaltete Arten: je Kanal (App, E-Mail, Push) einzeln
    const e = einstellung(b, kategorieVon(art));
    let id = null;
    if (e.app) {
      ({ id } = q.anlegen.get(b.id, art, String(titel).slice(0, 200), text ? String(text).slice(0, 1000) : null, link));
      q.kuerzen.run({ b: b.id });
    }
    if (e.push) push?.sende(b.id, { titel, text, link, tag: art }).catch((err) => console.warn('[push]', err.message));
    if (e.email && b.benachrichtigung_email && b.email && mail.aktiv && konfiguration.oeffentlicheUrl) {
      const url = `${konfiguration.oeffentlicheUrl}${APP_START}${link ? link.replace(/^\/+/, '') : ''}`;
      const gruss = `Hallo ${b.anzeigename || b.benutzername},`;
      mail.sende({
        an: b.email,
        betreff: `${MARKE.name}: ${titel}`,
        text: `${gruss}\n\n${titel}${text ? `\n${text}` : ''}\n\n${url}\n\nWelche E-Mails du bekommst, stellst du unter „Konto“ → „Benachrichtigungen“ ein.`,
        html: mailHtml({
          titel, absaetze: [gruss, text].filter(Boolean), knopf: { text: `In ${MARKE.name} ansehen`, url },
          fuss: 'Welche E-Mails du bekommst, stellst du in der App unter „Konto“ → „Benachrichtigungen“ ein.',
        }),
      }).catch((e) => console.warn('[benachrichtigung]', e.message));
    }
    return id;
  }

  /**
   * Gleichartige Meldungen zusammenfassen: Gibt es zum Schlüssel schon eine ungelesene Meldung der letzten 24 Stunden,
   * wird sie hochgezählt („5 deiner Fotos …“) – ohne erneute Push- oder E-Mail-Nachricht. Sonst eine normale Meldung.
   * titel/text: Funktionen der Anzahl.
   */
  function sendeGesammelt(benutzerId, { art, schluessel, titel, text = () => null, link = null, linkMehrere = link }) {
    if (!benutzerId) return null;
    const vorhanden = db.prepare(`SELECT id, anzahl FROM benachrichtigungen WHERE benutzer_id = ? AND sammel = ? AND gelesen = 0
      AND erstellt_am >= datetime('now', '-1 day') ORDER BY id DESC LIMIT 1`).get(benutzerId, schluessel);
    if (vorhanden) {
      const n = vorhanden.anzahl + 1;
      db.prepare('UPDATE benachrichtigungen SET anzahl = ?, titel = ?, text = ?, link = ? WHERE id = ?')
        .run(n, String(titel(n)).slice(0, 200), text(n) ? String(text(n)).slice(0, 1000) : null, linkMehrere, vorhanden.id);
      return vorhanden.id;
    }
    const id = sende(benutzerId, { art, titel: titel(1), text: text(1), link });
    if (id) db.prepare('UPDATE benachrichtigungen SET sammel = ? WHERE id = ?').run(schluessel, id);
    return id;
  }

  return {
    sende,
    sendeGesammelt,
    auswahl,
    setzeAuswahl,
    setzePush: (dienst) => { push = dienst; },
    liste: (benutzerId, limit = 50) => q.liste.all(benutzerId, Math.min(200, limit)).map((z) => ({ ...z, gelesen: Boolean(z.gelesen) })),
    ungelesen: (benutzerId) => q.ungelesen.get(benutzerId).n,
    markiereGelesen: (benutzerId, id = null) => (id ? q.eineGelesen.run(benutzerId, id) : q.alleGelesen.run(benutzerId)),
    loesche: (benutzerId, id) => q.loeschen.run(benutzerId, id),
  };
}
