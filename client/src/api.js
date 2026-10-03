// Dünne Hülle um fetch mit deutschen Fehlermeldungen.
import { offlineFaehig, merke } from './offline.js';
import { spracheTrifft } from '../../shared/sprachen.js';

export class ApiFehler extends Error {
  constructor(meldung, status, felder, code) {
    super(meldung);
    this.status = status;
    this.felder = felder ?? {};
    this.code = code;
  }
}

// Abgelaufene Sitzung oder 2FA-Pflicht an die App melden (siehe App.jsx).
function meldeSonderfall(status, json) {
  if (status === 401 && json?.code === 'nicht_angemeldet') window.dispatchEvent(new Event('vss:abgemeldet'));
  if (status === 403 && json?.code === '2fa_einrichten') window.dispatchEvent(new Event('vss:2fa-pflicht'));
}

/** Upload mit Fortschrittsanzeige (fetch kennt keinen Upload-Fortschritt). */
export function hochladenMitFortschritt(pfad, formular, onFortschritt) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', pfad);
    xhr.upload.onprogress = (e) => e.lengthComputable && onFortschritt?.(e.loaded / e.total);
    xhr.onload = () => {
      let json = null;
      try { json = JSON.parse(xhr.responseText); } catch { /* leer */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(json);
      else {
        meldeSonderfall(xhr.status, json);
        reject(new ApiFehler(json?.fehler ?? `Hochladen fehlgeschlagen (HTTP ${xhr.status}).`, xhr.status, json?.felder, json?.code));
      }
    };
    xhr.onerror = () => reject(new ApiFehler('Der Server ist nicht erreichbar.', 0));
    xhr.send(formular);
  });
}

/**
 * `basis`: Stand (aktualisiert_am), auf dem eine Änderung beruht – nur für Offline-Änderungen (Konflikterkennung beim Übertragen).
 * Ohne Verbindung werden Sammlungsänderungen gemerkt und später übertragen; die Antwort trägt dann `offline: true`.
 */
export async function anfrage(pfad, { methode = 'GET', daten, formular, signal, basis, beschreibung } = {}) {
  let antwort;
  const offlineMerken = async () => {
    await merke({ pfad, methode, daten, basis, beschreibung });
    const id = Number(/\/(\d+)$/.exec(pfad)?.[1]) || null;
    return methode === 'DELETE' ? { offline: true, id } : { ...(daten ?? {}), id, offline: true };
  };
  if (!navigator.onLine && !formular && offlineFaehig(pfad, methode)) return offlineMerken();
  try {
    antwort = await fetch(pfad, {
      method: methode,
      headers: daten !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: formular ?? (daten !== undefined ? JSON.stringify(daten) : undefined),
      signal,
      credentials: 'same-origin',
    });
  } catch (fehler) {
    if (fehler.name === 'AbortError') throw fehler;
    if (!formular && offlineFaehig(pfad, methode)) return offlineMerken();
    throw new ApiFehler(
      navigator.onLine ? 'Der Server ist nicht erreichbar.' : 'Keine Internetverbindung. Bitte später erneut versuchen.',
      0,
    );
  }
  if (antwort.status === 204) return null;
  const json = await antwort.json().catch(() => null);
  if (!antwort.ok) {
    meldeSonderfall(antwort.status, json);
    throw new ApiFehler(json?.fehler ?? `Unerwarteter Fehler (HTTP ${antwort.status}).`, antwort.status, json?.felder, json?.code);
  }
  return json;
}

export const abfrage = (parameter) => {
  const sauber = Object.fromEntries(Object.entries(parameter).filter(([, w]) => w !== undefined && w !== null && w !== ''));
  const text = new URLSearchParams(sauber).toString();
  return text ? `?${text}` : '';
};

export const api = {
  status: () => anfrage('/api/status'),
  artikelAnzahl: () => anfrage('/api/artikel/anzahl'),
  artikelListe: (filter = {}, signal) => anfrage(`/api/artikel${abfrage(filter)}`, { signal }).catch((e) => (e.status === 0 ? sammlungOffline(filter, e) : Promise.reject(e))),
  plattformen: () => anfrage('/api/artikel/plattformen'),
  artikel: (id) => anfrage(`/api/artikel/${id}`),
  // Konvolute (mehrere Artikel zu einem Gesamtpreis)
  konvolute: () => anfrage('/api/konvolute'),
  konvolut: (id) => anfrage(`/api/konvolute/${id}`),
  konvolutAnlegen: (daten) => anfrage('/api/konvolute', { methode: 'POST', daten }),
  konvolutAendern: (id, daten) => anfrage(`/api/konvolute/${id}`, { methode: 'PUT', daten }),
  konvolutLoeschen: (id) => anfrage(`/api/konvolute/${id}`, { methode: 'DELETE' }),
  konvolutZuordnen: (id, ids) => anfrage(`/api/konvolute/${id}/artikel`, { methode: 'POST', daten: { ids } }),
  konvolutEntfernen: (id, artikelId) => anfrage(`/api/konvolute/${id}/artikel/${artikelId}`, { methode: 'DELETE' }),
  artikelAnlegen: (daten, { beschreibung } = {}) => anfrage('/api/artikel', { methode: 'POST', daten, beschreibung }),
  artikelAendern: (id, daten, { basis, beschreibung } = {}) => anfrage(`/api/artikel/${id}`, { methode: 'PUT', daten, basis, beschreibung }),
  artikelLoeschen: (id, { basis, beschreibung } = {}) => anfrage(`/api/artikel/${id}`, { methode: 'DELETE', basis, beschreibung }),
  // Verkauft bzw. abgegeben ({ bestand, anzahl, datum, preis = Gesamterlös }) und zurück in die Sammlung
  artikelAbgang: (id, daten) => anfrage(`/api/artikel/${id}/abgang`, { methode: 'POST', daten }),
  artikelVerleihen: (id, daten) => anfrage(`/api/artikel/${id}/verleihen`, { methode: 'POST', daten }),
  artikelVerleihVerlauf: (id) => anfrage(`/api/artikel/${id}/verleihungen`),
  verleihungen: () => anfrage('/api/verleihungen'),
  verleihZurueck: (id) => anfrage(`/api/verleihungen/${id}/zurueck`, { methode: 'POST' }),
  verleihAntwort: (id, bestaetigen) => anfrage(`/api/verleihungen/${id}/antwort`, { methode: 'POST', daten: { bestaetigen } }),
  artikelZurueck: (id) => anfrage(`/api/artikel/${id}/zurueck`, { methode: 'POST' }),
  lagerorte: () => anfrage('/api/artikel/lagerorte'),
  lagerortSetzen: (ids, { ort, regal, fach }) => anfrage('/api/artikel/lagerort', { methode: 'POST', daten: { ids, ort, regal, fach } }),
  wartung: (id) => anfrage(`/api/artikel/${id}/wartung`),
  wartungNeu: (id, daten) => anfrage(`/api/artikel/${id}/wartung`, { methode: 'POST', daten }),
  wartungLoeschen: (wid) => anfrage(`/api/artikel/wartung/${wid}`, { methode: 'DELETE' }),
  wartungsmerkmale: (katalogId) => anfrage(`/api/katalog/${katalogId}/wartungsmerkmale`),
  wartungsmerkmaleSetzen: (katalogId, daten) => anfrage(`/api/katalog/${katalogId}/wartungsmerkmale`, { methode: 'PUT', daten }),
  merkmalVorschlaege: () => anfrage('/api/katalog/wartungsmerkmale/vorschlaege'),
  merkmalEntscheiden: (id, uebernehmen) => anfrage(`/api/katalog/wartungsmerkmale/vorschlaege/${id}`, { methode: 'POST', daten: { uebernehmen } }),
  bildHochladen: (id, datei) => {
    const formular = new FormData();
    formular.append('bild', datei);
    return anfrage(`/api/artikel/${id}/bild`, { methode: 'POST', formular });
  },
  bildEntfernen: (id) => anfrage(`/api/artikel/${id}/bild`, { methode: 'DELETE' }),
  katalogSuche: (q, typ, signal, { online, seite } = {}) => anfrage(`/api/katalog/suche${abfrage({ q, typ, online: online ? 1 : undefined, seite: seite || undefined })}`, { signal }),
  katalogBarcode: (code) => anfrage(`/api/katalog/barcode/${encodeURIComponent(code)}`),
  katalogEintrag: (id) => anfrage(`/api/katalog/${id}`),
  katalogAnlegen: (daten) => anfrage('/api/katalog', { methode: 'POST', daten }),
  eigeneKatalogeintraege: () => anfrage('/api/katalog/eigene'),
  katalogLoeschen: (id) => anfrage(`/api/katalog/${id}`, { methode: 'DELETE' }),
  statistik: () => anfrage('/api/statistik'),
  importieren: (daten) => anfrage('/api/import', { methode: 'POST', daten }),

  // Anmeldung & Konto
  authStatus: () => anfrage('/api/auth/status'),
  anmelden: (daten) => anfrage('/api/auth/anmelden', { methode: 'POST', daten }),
  zweiterFaktor: (daten) => anfrage('/api/auth/2fa', { methode: 'POST', daten }),
  einladungPruefen: (token) => anfrage(`/api/auth/einladung/${encodeURIComponent(token)}`),
  registrieren: (daten) => anfrage('/api/auth/registrieren', { methode: 'POST', daten }),
  captchaAufgabe: () => anfrage('/api/auth/captcha'),
  passwortVergessen: (kennung, captcha) => anfrage('/api/auth/passwort-vergessen', { methode: 'POST', daten: { kennung, captcha } }),
  passwortZuruecksetzen: (token, neuesPasswort) => anfrage('/api/auth/passwort-zuruecksetzen', { methode: 'POST', daten: { token, neuesPasswort } }),
  emailBestaetigen: (token) => anfrage('/api/auth/email-bestaetigen', { methode: 'POST', daten: { token } }),
  emailSetzen: (email, passwort) => anfrage('/api/konto/email', { methode: 'POST', daten: { email, passwort } }),
  emailEntfernen: (passwort) => anfrage('/api/konto/email', { methode: 'DELETE', daten: { passwort } }),
  csvAnalyse: (text) => anfrage('/api/import/csv/analyse', { methode: 'POST', daten: { text } }),
  csvImport: (daten) => anfrage('/api/import/csv', { methode: 'POST', daten }),
  benachrichtigungen: () => anfrage('/api/benachrichtigungen'),
  benachrichtigungenAnzahl: () => anfrage('/api/benachrichtigungen/anzahl'),
  benachrichtigungGelesen: (id) => anfrage('/api/benachrichtigungen/gelesen', { methode: 'POST', daten: id ? { id } : {} }),
  neuigkeiten: () => anfrage('/api/neuigkeiten'),
  neuigkeitenGelesen: () => anfrage('/api/neuigkeiten/gelesen', { methode: 'POST', daten: {} }),
  benachrichtigungsAuswahl: () => anfrage('/api/benachrichtigungen/auswahl'),
  benachrichtigungsAuswahlSetzen: (kategorien) => anfrage('/api/benachrichtigungen/auswahl', { methode: 'PUT', daten: { kategorien } }),
  benachrichtigungLoeschen: (id) => anfrage(`/api/benachrichtigungen/${id}`, { methode: 'DELETE' }),
  freigabeSetzen: (daten) => anfrage('/api/konto/freigabe', { methode: 'POST', daten }),
  freigabeBeenden: () => anfrage('/api/konto/freigabe', { methode: 'DELETE' }),
  adminTestMail: (an) => anfrage('/api/admin/test-mail', { methode: 'POST', daten: { an } }),
  adminIgdbTest: () => anfrage('/api/admin/igdb/test', { methode: 'POST', daten: {} }),
  abmelden: () => anfrage('/api/auth/abmelden', { methode: 'POST', daten: {} }),
  konto: () => anfrage('/api/konto'),
  // Verbindung zu zockerdb.de (selbst gehostet)
  syncStatus: () => anfrage('/api/konto/sync'),
  syncVerbinden: (token) => anfrage('/api/konto/sync/verbinden', { methode: 'POST', daten: { token } }),
  syncJetzt: () => anfrage('/api/konto/sync/jetzt', { methode: 'POST', daten: {} }),
  syncTrennen: () => anfrage('/api/konto/sync', { methode: 'DELETE' }),
  syncBild: (id, an) => anfrage(`/api/artikel/${id}/sync-bild`, { methode: 'PUT', daten: { an } }),
  katalogZentral: (id) => anfrage(`/api/katalog/${id}/zentral`),
  zentralEinreichen: (id) => anfrage(`/api/katalog/${id}/zentral-einreichen`, { methode: 'POST', daten: {} }),
  zugangAnfragen: (daten) => anfrage('/api/auth/zugang', { methode: 'POST', daten }),
  adminZugangsanfragen: () => anfrage('/api/admin/zugangsanfragen'),
  adminZugangsanfrageEinladen: (id) => anfrage(`/api/admin/zugangsanfragen/${id}/einladen`, { methode: 'POST' }),
  adminZugangsanfrageLoeschen: (id) => anfrage(`/api/admin/zugangsanfragen/${id}`, { methode: 'DELETE' }),
  adminEinladungen: () => anfrage('/api/admin/einladungen'),
  adminEinladungErstellen: (daten) => anfrage('/api/admin/einladungen', { methode: 'POST', daten }),
  adminEinladungLoeschen: (id) => anfrage(`/api/admin/einladungen/${id}`, { methode: 'DELETE' }),
  adminAktualisierung: (pruefen = false) => anfrage(`/api/admin/aktualisierung${pruefen ? '?pruefen=1' : ''}`),
  adminAktualisieren: () => anfrage('/api/admin/aktualisierung', { methode: 'POST' }),
  adminZentrale: () => anfrage('/api/admin/zentrale'),
  adminZentraleSpende: (an) => anfrage('/api/admin/zentrale/spende', { methode: 'POST', daten: { an } }),
  adminZentraleHinweisAus: (frage) => anfrage('/api/admin/zentrale/hinweis-aus', { methode: 'POST', daten: { frage } }),
  adminZentraleLauf: (spende) => anfrage('/api/admin/zentrale/lauf', { methode: 'POST', daten: { spende } }),
  speicher: () => anfrage('/api/konto/speicher'),
  kontoAendern: (daten) => anfrage('/api/konto', { methode: 'PUT', daten }),
  kalender: (p) => anfrage(`/api/kalender${abfrage(p)}`),
  berichtSpeichern: (katalogId, daten) => anfrage(`/api/katalog/${katalogId}/bericht`, { methode: 'PUT', daten }),
  berichtLoeschen: (katalogId) => anfrage(`/api/katalog/${katalogId}/bericht`, { methode: 'DELETE' }),
  berichtSichtbarkeit: (id, ausblenden) => anfrage(`/api/berichte/${id}/sichtbarkeit`, { methode: 'POST', daten: { ausblenden } }),
  steamStatus: () => anfrage('/api/steam'),
  steamImport: (profil) => anfrage('/api/steam/import', { methode: 'POST', daten: { profil } }),
  steamTrennen: () => anfrage('/api/steam', { methode: 'DELETE' }),
  passwortAendern: (daten) => anfrage('/api/konto/passwort', { methode: 'POST', daten }),
  ueberallAbmelden: () => anfrage('/api/konto/abmelden-ueberall', { methode: 'POST', daten: {} }),
  kontoLoeschen: (passwort) => anfrage('/api/konto', { methode: 'DELETE', daten: { passwort } }),
  totpEinrichten: (passwort) => anfrage('/api/konto/2fa/einrichten', { methode: 'POST', daten: { passwort } }),
  totpBestaetigen: (code) => anfrage('/api/konto/2fa/bestaetigen', { methode: 'POST', daten: { code } }),
  totpDeaktivieren: (daten) => anfrage('/api/konto/2fa/deaktivieren', { methode: 'POST', daten }),
  neueWiederherstellungscodes: (passwort) => anfrage('/api/konto/2fa/wiederherstellungscodes', { methode: 'POST', daten: { passwort } }),

  // Scans & Dokumente
  medien: (katalogId) => anfrage(`/api/katalog/${katalogId}/medien`),
  medium: (id) => anfrage(`/api/medien/${id}`),
  mediumAendern: (id, daten) => anfrage(`/api/medien/${id}`, { methode: 'PUT', daten }),
  mediumLoeschen: (id) => anfrage(`/api/medien/${id}`, { methode: 'DELETE' }),
  mediumHochladen: (artikelId, felder, datei, onFortschritt) => {
    const formular = new FormData();
    for (const [k, v] of Object.entries(felder)) if (v !== undefined && v !== null && v !== '') formular.append(k, v);
    formular.append('datei', datei);
    return hochladenMitFortschritt(`/api/artikel/${artikelId}/medien`, formular, onFortschritt);
  },

  // Katalog, Plattformen, Varianten, Kommentare
  plattformenAlle: () => anfrage('/api/plattformen'),
  katalogListe: (filter = {}) => anfrage(`/api/katalog-liste${abfrage(filter)}`),
  katalogSeite: (id) => anfrage(`/api/katalog-seite/${id}`),
  katalogAendern: (id, daten) => anfrage(`/api/katalog/${id}`, { methode: 'PUT', daten }),
  varianten: (katalogId) => anfrage(`/api/katalog/${katalogId}/varianten`),
  varianteAnlegen: (katalogId, daten) => anfrage(`/api/katalog/${katalogId}/varianten`, { methode: 'POST', daten }),
  varianteAendern: (id, daten) => anfrage(`/api/varianten/${id}`, { methode: 'PUT', daten }),
  varianteLoeschen: (id) => anfrage(`/api/varianten/${id}`, { methode: 'DELETE' }),
  kommentare: (katalogId) => anfrage(`/api/katalog/${katalogId}/kommentare`),
  kommentarAnlegen: (katalogId, text) => anfrage(`/api/katalog/${katalogId}/kommentare`, { methode: 'POST', daten: { text } }),
  kommentarAendern: (id, text) => anfrage(`/api/kommentare/${id}`, { methode: 'PUT', daten: { text } }),
  kommentarLoeschen: (id) => anfrage(`/api/kommentare/${id}`, { methode: 'DELETE' }),
  // Vorschläge: Fotos zum Titelvorschlag, fehlende Plattformen
  belegfotos: (katalogId) => anfrage(`/api/katalog/${katalogId}/belegfotos`),
  belegfotoHochladen: (katalogId, datei) => {
    const formular = new FormData();
    formular.append('foto', datei);
    return anfrage(`/api/katalog/${katalogId}/belegfotos`, { methode: 'POST', formular });
  },
  belegfotoLoeschen: (id) => anfrage(`/api/belegfotos/${id}`, { methode: 'DELETE' }),
  plattformVorschlagen: (daten) => anfrage('/api/plattformen/vorschlaege', { methode: 'POST', daten }),
  eigenePlattformVorschlaege: () => anfrage('/api/plattformen/vorschlaege'),
  plattformVorschlagEntscheiden: (id, daten) => anfrage(`/api/moderation/plattform-vorschlaege/${id}`, { methode: 'POST', daten }),
  ideen: () => anfrage('/api/ideen'),
  ideenAehnliche: (q) => anfrage(`/api/ideen/aehnliche?q=${encodeURIComponent(q)}`),
  ideeEinreichen: (daten) => anfrage('/api/ideen', { methode: 'POST', daten }),
  ideeStimme: (id) => anfrage(`/api/ideen/${id}/stimme`, { methode: 'POST' }),
  ideeEntscheiden: (id, daten) => anfrage(`/api/ideen/${id}`, { methode: 'PUT', daten }),
  ideeLoeschen: (id) => anfrage(`/api/ideen/${id}`, { methode: 'DELETE' }),
  plattformAnlegen: (daten) => anfrage('/api/moderation/plattformen', { methode: 'POST', daten }),
  plattformAendern: (id, daten) => anfrage(`/api/moderation/plattformen/${id}`, { methode: 'PUT', daten }),

  // Rechtliches, Admin-Übersicht
  seiten: () => anfrage('/api/seiten'),
  seite: (slug) => anfrage(`/api/seiten/${encodeURIComponent(slug)}`),
  seiteSpeichern: (slug, daten) => anfrage(`/api/admin/seiten/${encodeURIComponent(slug)}`, { methode: 'PUT', daten }),
  adminUebersicht: () => anfrage('/api/admin/uebersicht'),
  // Administration
  adminEinstellungen: () => anfrage('/api/admin/einstellungen'),
  adminEinstellungenSpeichern: (daten) => anfrage('/api/admin/einstellungen', { methode: 'PUT', daten }),
  adminSicherungen: () => anfrage('/api/admin/sicherungen'),
  adminSicherungStarten: () => anfrage('/api/admin/sicherungen', { methode: 'POST', daten: {} }),
  adminBenutzer: () => anfrage('/api/admin/benutzer'),
  adminBenutzerAendern: (id, daten) => anfrage(`/api/admin/benutzer/${id}`, { methode: 'PUT', daten }),
  admin2faZuruecksetzen: (id) => anfrage(`/api/admin/benutzer/${id}/2fa-zuruecksetzen`, { methode: 'POST', daten: {} }),
  adminPasswort: (id, neuesPasswort) => anfrage(`/api/admin/benutzer/${id}/passwort`, { methode: 'POST', daten: { neuesPasswort } }),
  adminBenutzerLoeschen: (id) => anfrage(`/api/admin/benutzer/${id}`, { methode: 'DELETE' }),
};

/** Zwischengespeicherte Daten des Service-Workers löschen (z. B. beim Abmelden). */
export async function leereZwischenspeicher() {
  if (!('caches' in window)) return;
  const namen = await caches.keys();
  await Promise.all(namen.filter((n) => !n.startsWith('huelle-')).map((n) => caches.delete(n)));
  // Offline-Warteschlange gehört zum abgemeldeten Konto
  try { indexedDB.deleteDatabase('zockerdb-offline'); } catch { /* egal */ }
}

/**
 * Offline-Suche in der Sammlung: die zuletzt geladene Liste aus dem Zwischenspeicher des Service-Workers, im Browser gefiltert.
 * Das Ergebnis trägt `offline = true` (die App kennzeichnet es als „nur geladene Daten“).
 */
async function sammlungOffline(filter, fehler) {
  if (!('caches' in window)) throw fehler;
  let beste = null;
  for (const name of (await caches.keys()).filter((n) => n.startsWith('daten-'))) {
    const cache = await caches.open(name);
    for (const anfrageAlt of await cache.keys()) {
      const url = new URL(anfrageAlt.url);
      if (url.pathname !== '/api/artikel') continue;
      const p = Object.fromEntries(url.searchParams);
      // Am besten eine ungefilterte Liste (Sortierung egal) desselben Bestands
      const passend = !p.q && !p.typ && !p.plattform_id && !p.spielstatus && !p.sprache && !p.verliehen && (p.bestand ?? 'besitz') === (filter.bestand ?? 'besitz');
      if (passend) { beste = await cache.match(anfrageAlt); break; }
    }
    if (beste) break;
  }
  if (!beste) throw fehler;
  const liste = await beste.json();
  const q = String(filter.q ?? '').trim().toLowerCase();
  const ergebnis = liste.filter((a) => (!filter.typ || a.typ === filter.typ)
    && (!filter.plattform_id || String(a.plattform_id) === String(filter.plattform_id))
    && (!filter.spielstatus || a.spielstatus === filter.spielstatus)
    && (!filter.sprache || spracheTrifft(a.katalog_sprachen, filter.sprache))
    && (!filter.verliehen || a.verleih_id)
    && (!q || [a.titel, a.plattform, a.edition, a.farbe, a.barcode].some((w) => String(w ?? '').toLowerCase().includes(q))));
  ergebnis.offline = true;
  return ergebnis;
}
