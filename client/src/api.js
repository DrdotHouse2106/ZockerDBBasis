// Dünne Hülle um fetch mit deutschen Fehlermeldungen.
import { offlineFaehig, merke } from './offline.js';
import { spracheTrifft } from '../../shared/sprachen.js';
import { bereiteDateiVor } from './bilddatei.js';
import { istApp, apiUrl, zugangsKoepfe, zugangsCredentials, zugangBereit, verarbeiteAntwort, merkeToken, wartenAufSitzung, sitzungGeklaertMelden } from './zugang.js';
import * as appOffline from './appoffline.js';
import { nativerUpload } from './nativ.js';

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

/** Wartet, bis die App wieder im Vordergrund ist (iOS/Android unterbrechen laufende Übertragungen im Hintergrund). */
const wartenAufVordergrund = () => new Promise((ok) => {
  if (document.visibilityState === 'visible') return ok();
  const pruefen = () => { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', pruefen); ok(); } };
  document.addEventListener('visibilitychange', pruefen);
});

/**
 * Upload mit Fortschrittsanzeige (fetch kennt keinen Upload-Fortschritt). In der App bricht das System Übertragungen ab, wenn man
 * die App währenddessen verlässt; war der Upload dann noch nicht vollständig beim Server, wird er nach der Rückkehr (höchstens
 * zweimal) neu gestartet – der Server hat in dem Fall nichts gespeichert, es entstehen keine Doubletten.
 */
export async function hochladenMitFortschritt(pfad, formular, onFortschritt, versuch = 0) {
  await zugangBereit();
  let uebertragen = false;
  let imHintergrund = false;
  const merkeHintergrund = () => { if (document.visibilityState === 'hidden') imHintergrund = true; };
  document.addEventListener('visibilitychange', merkeHintergrund);
  try {
    const nativ = nativerUpload();
    if (nativ) {
      // App (iOS): das System überträgt weiter, auch wenn man die App verlässt
      const { status, text } = await nativ(pfad, formular, onFortschritt).catch(() => { throw new ApiFehler('Der Server ist nicht erreichbar.', 0); });
      let json = null;
      try { json = JSON.parse(text); } catch { /* leer */ }
      if (status >= 200 && status < 300) return await verarbeiteAntwort(pfad, json);
      meldeSonderfall(status, json);
      throw new ApiFehler(json?.fehler ?? `Hochladen fehlgeschlagen (HTTP ${status}).`, status, json?.felder, json?.code);
    }
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', apiUrl(pfad));
      xhr.withCredentials = zugangsCredentials !== 'omit';
      for (const [name, wert] of Object.entries(zugangsKoepfe())) xhr.setRequestHeader(name, wert);
      xhr.upload.onprogress = (e) => e.lengthComputable && onFortschritt?.(e.loaded / e.total);
      xhr.upload.onload = () => { uebertragen = true; onFortschritt?.(1); }; // alles übertragen – jetzt arbeitet der Server
      xhr.onload = () => {
        let json = null;
        try { json = JSON.parse(xhr.responseText); } catch { /* leer */ }
        if (xhr.status >= 200 && xhr.status < 300) verarbeiteAntwort(pfad, json).then(resolve, reject);
        else {
          meldeSonderfall(xhr.status, json);
          reject(new ApiFehler(json?.fehler ?? `Hochladen fehlgeschlagen (HTTP ${xhr.status}).`, xhr.status, json?.felder, json?.code));
        }
      };
      xhr.onerror = () => reject(new ApiFehler(
        uebertragen ? 'Die Verbindung wurde unterbrochen, bevor der Server geantwortet hat. Bitte prüfe, ob der Upload angekommen ist.' : 'Der Server ist nicht erreichbar.', 0));
      xhr.send(formular);
    });
  } catch (fehler) {
    if (istApp && imHintergrund && !uebertragen && fehler instanceof ApiFehler && fehler.status === 0 && versuch < 2) {
      await wartenAufVordergrund();
      onFortschritt?.(0);
      return hochladenMitFortschritt(pfad, formular, onFortschritt, versuch + 1);
    }
    throw fehler;
  } finally {
    document.removeEventListener('visibilitychange', merkeHintergrund);
  }
}

/** Bild als Rohkörper senden (z. B. Maske beim Freistellen) bzw. als Blob holen – ohne Offline-Speicher. */
async function bildAnfrage(pfad, { methode = 'GET', bild } = {}) {
  await zugangBereit();
  let antwort;
  try {
    antwort = await fetch(apiUrl(pfad), {
      method: methode,
      headers: { ...(bild ? { 'Content-Type': bild.type || 'image/png' } : {}), ...zugangsKoepfe() },
      body: bild,
      credentials: zugangsCredentials,
      cache: 'no-store',
    });
  } catch {
    throw new ApiFehler(navigator.onLine ? 'Der Server ist nicht erreichbar.' : 'Keine Internetverbindung. Bitte später erneut versuchen.', 0);
  }
  if (!antwort.ok) {
    const json = await antwort.json().catch(() => null);
    meldeSonderfall(antwort.status, json);
    throw new ApiFehler(json?.fehler ?? `Unerwarteter Fehler (HTTP ${antwort.status}).`, antwort.status, json?.felder, json?.code);
  }
  return methode === 'GET' ? antwort.blob() : antwort.json().catch(() => null);
}

/**
 * `basis`: Stand (aktualisiert_am), auf dem eine Änderung beruht – nur für Offline-Änderungen (Konflikterkennung beim Übertragen).
 * Ohne Verbindung werden Sammlungsänderungen gemerkt und später übertragen; die Antwort trägt dann `offline: true`.
 */
export async function anfrage(pfad, optionen = {}) {
  // App: Uploads (formular) brechen ab, wenn man die App währenddessen verlässt – nach der Rückkehr einmal neu versuchen
  let imHintergrund = false;
  const merkeHintergrund = () => { if (document.visibilityState === 'hidden') imHintergrund = true; };
  if (istApp && optionen.formular) document.addEventListener('visibilitychange', merkeHintergrund);
  try {
    try {
      return await anfrageIntern(pfad, optionen);
    } catch (fehler) {
      if (!(istApp && optionen.formular && imHintergrund && fehler instanceof ApiFehler && fehler.status === 0)) throw fehler;
      await wartenAufVordergrund();
      return await anfrageIntern(pfad, optionen);
    }
  } finally {
    document.removeEventListener('visibilitychange', merkeHintergrund);
    // App: ab jetzt dürfen lesende Anfragen los (Dateischlüssel bekannt bzw. Sitzung nicht zu klären)
    if (pfad === '/api/auth/status') sitzungGeklaertMelden();
  }
}

async function anfrageIntern(pfad, { methode = 'GET', daten, formular, signal, basis, beschreibung } = {}) {
  let antwort;
  const offlineMerken = async () => {
    await merke({ pfad, methode, daten, basis, beschreibung });
    const id = Number(/\/(\d+)$/.exec(pfad)?.[1]) || null;
    return methode === 'DELETE' ? { offline: true, id } : { ...(daten ?? {}), id, offline: true };
  };
  if (!navigator.onLine && !formular && offlineFaehig(pfad, methode)) return offlineMerken();
  try {
    await zugangBereit();
    if (istApp && methode === 'GET' && pfad !== '/api/auth/status') await wartenAufSitzung();
    const nativ = formular && nativerUpload();
    if (nativ) {
      const { status, text } = await nativ(pfad, formular);
      antwort = new Response(status === 204 ? null : text, { status });
    } else antwort = await fetch(apiUrl(pfad), {
      method: methode,
      headers: { ...(daten !== undefined ? { 'Content-Type': 'application/json' } : {}), ...zugangsKoepfe() },
      body: formular ?? (daten !== undefined ? JSON.stringify(daten) : undefined),
      signal,
      credentials: zugangsCredentials,
    });
  } catch (fehler) {
    if (fehler.name === 'AbortError') throw fehler;
    if (!formular && offlineFaehig(pfad, methode)) return offlineMerken();
    // App ohne Verbindung: zuletzt gesehene Antwort (im Browser erledigt das der Service-Worker)
    // – außer Sammlungslisten: die kommen aus dem vollständigen Abgleich (siehe sammlungOffline)
    if (appOffline.speicherbar(pfad, methode) && !/^\/api\/artikel(\?|$)/.test(pfad)) {
      const gespeichert = await appOffline.leseAntwort(pfad);
      if (gespeichert !== undefined) return verarbeiteAntwort(pfad, gespeichert);
    }
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
  if (!istApp) return json;
  // App: unveränderte Antwort für offline merken, dann aufbereiten (Token, Dateischlüssel, Bildadressen)
  if (methode === 'GET') appOffline.merkeAntwort(pfad, structuredClone(json));
  const ergebnis = await verarbeiteAntwort(pfad, json);
  // Nach Änderungen an der Sammlung bzw. nach der Anmeldung abgleichen
  if (methode !== 'GET' && /^\/api\/(artikel|konvolute)\b/.test(pfad)) appOffline.planeAbgleich();
  if (pfad === '/api/auth/status' && ergebnis?.angemeldet && ergebnis.benutzer?.id) {
    await appOffline.pruefeKonto(ergebnis.benutzer.id);
    appOffline.abgleichFaellig();
  }
  return ergebnis;
}

export const abfrage = (parameter) => {
  const sauber = Object.fromEntries(Object.entries(parameter).filter(([, w]) => w !== undefined && w !== null && w !== ''));
  const text = new URLSearchParams(sauber).toString();
  return text ? `?${text}` : '';
};

export const api = {
  status: () => anfrage('/api/status'),
  artikelAnzahl: () => anfrage('/api/artikel/anzahl'),
  /**
   * `zwischenstand(liste)`: App – die gespeicherte Sammlung sofort liefern, während die Antwort des Servers noch aussteht
   * (schneller Start). Die zurückgegebene Zusage bringt wie bisher den Stand des Servers.
   */
  artikelListe: (filter = {}, signal, { zwischenstand } = {}) => {
    if (zwischenstand && istApp) sammlungZwischenstand(filter).then((liste) => { if (liste && !signal?.aborted) zwischenstand(liste); }).catch(() => {});
    return anfrage(`/api/artikel${abfrage(filter)}`, { signal }).catch((e) => (e.status === 0 ? sammlungOffline(filter, e) : Promise.reject(e)));
  },
  plattformen: () => anfrage('/api/artikel/plattformen'),
  /** `zwischenstand(artikel)`: App – das Exemplar sofort aus dem letzten Abgleich zeigen, während der Server noch antwortet. */
  artikel: (id, { zwischenstand, signal } = {}) => {
    if (zwischenstand && istApp) artikelZwischenstand(id).then((a) => { if (a && !signal?.aborted) zwischenstand(a); }).catch(() => {});
    return anfrage(`/api/artikel/${id}`, { signal }).catch((e) => (e.status === 0 ? artikelOffline(id, e) : Promise.reject(e)));
  },
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
  // Wie bei den Fotos: erst vollständig lesen (Apple Fotos/iCloud) und HEIC/HEIF in JPEG umwandeln – sonst lehnt der Server das Bild ab
  bildHochladen: async (id, datei) => {
    const formular = new FormData();
    formular.append('bild', await bereiteDateiVor(datei));
    return anfrage(`/api/artikel/${id}/bild`, { methode: 'POST', formular });
  },
  bildEntfernen: (id) => anfrage(`/api/artikel/${id}/bild`, { methode: 'DELETE' }),
  artikelKatalogWaehlen: (id, katalogId) => anfrage(`/api/artikel/${id}/katalog`, { methode: 'POST', daten: { katalog_id: katalogId } }),
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
  importListe: () => anfrage('/api/import/liste'),
  importRueckgaengig: (id, nurUnveraendert = false) => anfrage(`/api/import/${id}${nurUnveraendert ? '?nur_unveraendert=1' : ''}`, { methode: 'DELETE' }),
  zuordnungStarten: () => anfrage('/api/import/zuordnen', { methode: 'POST', daten: { alle: true } }),
  zuordnungStand: () => anfrage('/api/import/zuordnen'),
  zuordnungListe: (ab = 0) => anfrage(`/api/import/zuordnen/liste?ab=${ab}`),
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
  abmelden: () => anfrage('/api/auth/abmelden', { methode: 'POST', daten: {} }).finally(() => merkeToken(null)),
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
  // Fotos freistellen: Stand (Helfer?), Entscheidung des Fotografen; Administration: Warteschlange und Nachholen
  freistellenStatus: () => anfrage('/api/freistellen/status'),
  // Helfer-Gerät (App): Aufträge reservieren, Bild nur im Arbeitsspeicher holen, Maske zurückgeben
  freistellenNaechste: (anzahl = 20) => anfrage(`/api/freistellen/naechste?anzahl=${anzahl}`),
  freistellenBild: (id) => bildAnfrage(`/api/freistellen/${id}/bild`),
  freistellenMaske: (id, maske) => bildAnfrage(`/api/freistellen/${id}`, { methode: 'PUT', bild: maske }),
  freistellenHintergrund: () => anfrage('/api/freistellen/hintergrund', { methode: 'POST', daten: {} }),
  freistellenFehler: (id) => anfrage(`/api/freistellen/${id}/fehler`, { methode: 'POST', daten: {} }),
  // Eigenes Foto direkt nach dem Upload (App); angenommen = Ergebnis schon geprüft
  mediumFreistellen: (medienId, maske, angenommen = false) => bildAnfrage(`/api/medien/${medienId}/freistellen${angenommen ? '?angenommen=1' : ''}`, { methode: 'PUT', bild: maske }),
  freistellenPruefen: (alle = false, uebernommen = false) => anfrage(`/api/freistellen/pruefen?${new URLSearchParams({ ...(alle ? { alle: '1' } : {}), ...(uebernommen ? { uebernommen: '1' } : {}) })}`),
  // Eigene Datei als Blob (z. B. Foto fürs Freistellen auf dem Gerät)
  datei: (url) => bildAnfrage(url),
  freistellenAnfordern: (medienId) => anfrage(`/api/medien/${medienId}/freistellen/anfordern`, { methode: 'POST', daten: {} }),
  // Avatar: mehrere Benutzer auf einmal (Listen), eigenes Bild hochladen bzw. entfernen
  avatare: (ids) => anfrage(`/api/avatare?ids=${ids.join(',')}`),
  avatarBild: (bild) => bildAnfrage('/api/konto/avatar/bild', { methode: 'PUT', bild }),
  avatarBildEntfernen: () => anfrage('/api/konto/avatar/bild', { methode: 'DELETE' }),
  adminAvatarEntfernen: (id) => anfrage(`/api/admin/benutzer/${id}/avatar`, { methode: 'DELETE' }),
  freistellenEntscheiden: (medienId, annehmen) => anfrage(`/api/medien/${medienId}/freistellen/entscheiden`, { methode: 'POST', daten: { annehmen } }),
  adminFreistellen: () => anfrage('/api/admin/freistellen'),
  adminFreistellenNachholen: () => anfrage('/api/admin/freistellen/nachholen', { methode: 'POST', daten: {} }),
  kalender: (p) => anfrage(`/api/kalender${abfrage(p)}`),
  berichtSpeichern: (katalogId, daten) => anfrage(`/api/katalog/${katalogId}/bericht`, { methode: 'PUT', daten }),
  berichtLoeschen: (katalogId) => anfrage(`/api/katalog/${katalogId}/bericht`, { methode: 'DELETE' }),
  berichtSichtbarkeit: (id, ausblenden) => anfrage(`/api/berichte/${id}/sichtbarkeit`, { methode: 'POST', daten: { ausblenden } }),
  // Figurenserien (Merch)
  serien: () => anfrage('/api/serien'),
  serie: (id) => anfrage(`/api/serien/${id}`),
  serieFolgen: (id, folgen) => anfrage(`/api/serien/${id}/folgen`, { methode: 'PUT', daten: { folgen } }),
  serieAnlegen: (daten) => anfrage('/api/serien', { methode: 'POST', daten }),
  serieAendern: (id, daten) => anfrage(`/api/serien/${id}`, { methode: 'PUT', daten }),
  serieLoeschen: (id) => anfrage(`/api/serien/${id}`, { methode: 'DELETE' }),
  serieSpiele: (id, spiele) => anfrage(`/api/serien/${id}/spiele`, { methode: 'PUT', daten: { spiele } }),
  serieListe: (serieId, text) => anfrage(`/api/serien/${serieId}/liste`, { methode: 'POST', daten: { text } }),
  figurAnlegen: (serieId, daten) => anfrage(`/api/serien/${serieId}/figuren`, { methode: 'POST', daten }),
  figurAendern: (katalogId, daten) => anfrage(`/api/serien/figur/${katalogId}`, { methode: 'PUT', daten }),
  figurFarbe: (katalogId, farbe, zustand) => anfrage(`/api/serien/figur/${katalogId}/farbe`, { methode: 'PUT', daten: { farbe, zustand } }),
  serienBeleg: (katalogId, varianteId, datei) => {
    const formular = new FormData();
    formular.append('foto', datei);
    if (varianteId) formular.append('variante_id', String(varianteId));
    return anfrage(`/api/serien/figur/${katalogId}/beleg`, { methode: 'POST', formular });
  },
  steamStatus: () => anfrage('/api/steam'),
  steamImport: (profil, schluessel) => anfrage('/api/steam/import', { methode: 'POST', daten: { profil, ...(schluessel ? { schluessel } : {}) } }),
  steamTrennen: (behalten = false) => anfrage(`/api/steam${behalten ? '?behalten=1' : ''}`, { methode: 'DELETE' }),
  steamVerknuepfen: () => anfrage('/api/steam/verknuepfen', { methode: 'POST', daten: {} }),
  passwortAendern: (daten) => anfrage('/api/konto/passwort', { methode: 'POST', daten }),
  ueberallAbmelden: () => anfrage('/api/konto/abmelden-ueberall', { methode: 'POST', daten: {} }),
  sitzungen: () => anfrage('/api/konto/sitzungen'),
  sitzungBeenden: (id) => anfrage(`/api/konto/sitzungen/${id}`, { methode: 'DELETE' }),
  sammlungLeeren: (passwort) => anfrage('/api/konto/sammlung-leeren', { methode: 'POST', daten: { passwort } }),
  kontoLoeschen: (passwort, { fotosUeberlassen = false } = {}) => anfrage('/api/konto', { methode: 'DELETE', daten: { passwort, fotos_ueberlassen: fotosUeberlassen } }),
  totpEinrichten: (passwort) => anfrage('/api/konto/2fa/einrichten', { methode: 'POST', daten: { passwort } }),
  totpBestaetigen: (code) => anfrage('/api/konto/2fa/bestaetigen', { methode: 'POST', daten: { code } }),
  totpDeaktivieren: (daten) => anfrage('/api/konto/2fa/deaktivieren', { methode: 'POST', daten }),
  neueWiederherstellungscodes: (passwort) => anfrage('/api/konto/2fa/wiederherstellungscodes', { methode: 'POST', daten: { passwort } }),

  // Scans & Dokumente
  medien: (katalogId) => anfrage(`/api/katalog/${katalogId}/medien`),
  medium: (id) => anfrage(`/api/medien/${id}`),
  mediumAendern: (id, daten) => anfrage(`/api/medien/${id}`, { methode: 'PUT', daten }),
  mediumLoeschen: (id) => anfrage(`/api/medien/${id}`, { methode: 'DELETE' }),
  mediumHochladen: async (artikelId, felder, datei, onFortschritt) => {
    const formular = new FormData();
    for (const [k, v] of Object.entries(felder)) if (v !== undefined && v !== null && v !== '') formular.append(k, v);
    formular.append('datei', await bereiteDateiVor(datei));
    return hochladenMitFortschritt(`/api/artikel/${artikelId}/medien`, formular, onFortschritt);
  },

  // Katalog, Plattformen, Varianten, Kommentare
  plattformenAlle: () => anfrage('/api/plattformen'),
  katalogListe: (filter = {}) => anfrage(`/api/katalog-liste${abfrage(filter)}`),
  // plattform: ID oder „auto“ (Standard-Plattform); ohne Angabe ungefiltert
  katalogSeite: (id, plattform) => anfrage(`/api/katalog-seite/${id}${plattform ? `?plattform=${encodeURIComponent(plattform)}` : ''}`),
  katalogAendern: (id, daten) => anfrage(`/api/katalog/${id}`, { methode: 'PUT', daten }),
  varianten: (katalogId) => anfrage(`/api/katalog/${katalogId}/varianten`),
  varianteAnlegen: (katalogId, daten) => anfrage(`/api/katalog/${katalogId}/varianten`, { methode: 'POST', daten }),
  varianteAendern: (id, daten) => anfrage(`/api/varianten/${id}`, { methode: 'PUT', daten }),
  varianteLoeschen: (id) => anfrage(`/api/varianten/${id}`, { methode: 'DELETE' }),
  // Lieferumfang einer Ausgabe vorschlagen (Moderation trägt direkt ein); optional mit Foto
  lieferumfangVorschlagen: (id, { lieferumfang, begruendung, foto }) => {
    const formular = new FormData();
    formular.append('lieferumfang', JSON.stringify(lieferumfang));
    if (begruendung) formular.append('begruendung', begruendung);
    if (foto) formular.append('foto', foto);
    return anfrage(`/api/varianten/${id}/lieferumfang`, { methode: 'POST', formular });
  },
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
  plattformVorschlagAendern: (id, daten) => anfrage(`/api/plattformen/vorschlaege/${id}`, { methode: 'PUT', daten }),
  eigenePlattformVorschlaege: () => anfrage('/api/plattformen/vorschlaege'),
  plattformVorschlagEntscheiden: (id, daten) => anfrage(`/api/moderation/plattform-vorschlaege/${id}`, { methode: 'POST', daten }),
  ideen: () => anfrage('/api/ideen'),
  ideenAehnliche: (q) => anfrage(`/api/ideen/aehnliche?q=${encodeURIComponent(q)}`),
  ideeEinreichen: (daten) => anfrage('/api/ideen', { methode: 'POST', daten }),
  ideeStimme: (id) => anfrage(`/api/ideen/${id}/stimme`, { methode: 'POST' }),
  ideeEntscheiden: (id, daten) => anfrage(`/api/ideen/${id}`, { methode: 'PUT', daten }),
  ideeAendern: (id, daten) => anfrage(`/api/ideen/${id}`, { methode: 'PATCH', daten }),
  ideeLoeschen: (id) => anfrage(`/api/ideen/${id}`, { methode: 'DELETE' }),
  ideeAnhaenge: (id, dateien) => {
    const formular = new FormData();
    for (const d of dateien) formular.append('dateien', d);
    return anfrage(`/api/ideen/${id}/anhaenge`, { methode: 'POST', formular });
  },
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
  // `bestaetigung` ({ passwort, code }): nur nötig, wenn das Ziel selbst Administrator ist
  admin2faZuruecksetzen: (id, bestaetigung = {}) => anfrage(`/api/admin/benutzer/${id}/2fa-zuruecksetzen`, { methode: 'POST', daten: { ...bestaetigung } }),
  adminPasswort: (id, neuesPasswort, bestaetigung = {}) => anfrage(`/api/admin/benutzer/${id}/passwort`, { methode: 'POST', daten: { neuesPasswort, ...bestaetigung } }),
  adminBenutzerLoeschen: (id, bestaetigung = {}) => anfrage(`/api/admin/benutzer/${id}`, { methode: 'DELETE', daten: { ...bestaetigung } }),
};

/** Zwischengespeicherte Daten des Service-Workers löschen (z. B. beim Abmelden). */
export async function leereZwischenspeicher() {
  await appOffline.leeren();
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
/** App: die ganze Sammlung aus dem letzten Abgleich, nach Bestand und den offline bekannten Filtern eingegrenzt. */
async function sammlungGespeichert(filter) {
  const ganz = await appOffline.sammlung();
  if (!ganz) return null;
  const bestand = filter.bestand ?? 'besitz';
  const passend = ganz.json.filter((a) => bestand === 'alle' || a.bestand === bestand || (bestand === 'weg' && ['verkauft', 'abgegeben'].includes(a.bestand)));
  const ergebnis = filtereOffline(await verarbeiteAntwort('/api/artikel', structuredClone(passend)), filter);
  ergebnis.offlineStand = ganz.zeit;
  return ergebnis;
}

// Filter, die filtereOffline genauso auswertet wie der Server – nur dann taugt der gespeicherte Stand als Zwischenstand
const ZWISCHENSTAND_FILTER = new Set(['bestand', 'einzeln', 'q', 'typ', 'plattform_id', 'spielstatus', 'sprache', 'verliehen']);

/** App: gespeicherte Sammlung als vorläufige Anzeige, solange der Server noch nicht geantwortet hat (sonst null). */
async function sammlungZwischenstand(filter) {
  if (!Object.keys(filter).every((k) => ZWISCHENSTAND_FILTER.has(k))) return null;
  const liste = await sammlungGespeichert(filter);
  if (!liste) return null;
  // Nicht „ohne Verbindung“ – nur noch nicht vom Server bestätigt
  liste.offline = false;
  delete liste.offlineStand;
  liste.vorlaeufig = true;
  return liste;
}

async function sammlungOffline(filter, fehler) {
  // App: die ganze Sammlung aus dem letzten Abgleich (alle Bestände), hier nach Bestand gefiltert
  const gespeichert = await sammlungGespeichert(filter);
  if (gespeichert) return gespeichert;
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
  return filtereOffline(await beste.json(), filter);
}

/** Exemplar ohne Verbindung aus der ganzen Sammlung des letzten Abgleichs (App). */
async function artikelOffline(id, fehler) {
  const ganz = await appOffline.sammlung();
  const artikel = ganz?.json.find((a) => String(a.id) === String(id));
  if (!artikel) throw fehler;
  return verarbeiteAntwort(`/api/artikel/${id}`, structuredClone(artikel));
}

/** App: Exemplar aus dem letzten Abgleich als vorläufige Anzeige, solange der Server noch nicht geantwortet hat. */
async function artikelZwischenstand(id) {
  const ganz = await appOffline.sammlung();
  const artikel = ganz?.json.find((a) => String(a.id) === String(id));
  if (!artikel) return null;
  const ergebnis = await verarbeiteAntwort(`/api/artikel/${id}`, structuredClone(artikel));
  ergebnis.vorlaeufig = true;
  return ergebnis;
}

function filtereOffline(liste, filter) {
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
