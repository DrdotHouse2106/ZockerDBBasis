import { COOKIE_NAME } from '../services/konten.js';

export function leseCookies(header = '') {
  const cookies = {};
  for (const teil of header.split(';')) {
    const trenner = teil.indexOf('=');
    if (trenner < 0) continue;
    const name = teil.slice(0, trenner).trim();
    try {
      cookies[name] = decodeURIComponent(teil.slice(trenner + 1).trim());
    } catch {
      /* ungültiges Cookie ignorieren */
    }
  }
  return cookies;
}

function istSicher(req, einstellung) {
  if (einstellung === 'true') return true;
  if (einstellung === 'false') return false;
  return req.secure;
}

export function setzeSitzungsCookie(req, res, { token, maxAlterMs }, cookieSicher) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: istSicher(req, cookieSicher),
    maxAge: maxAlterMs,
    path: '/',
  });
}

export function loescheSitzungsCookie(req, res, cookieSicher) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: istSicher(req, cookieSicher), path: '/' });
}

/** Token aus „Authorization: Bearer …“ (Apps); `undefined`, wenn der Kopf fehlt, '' bei anderem Verfahren. */
export function leseBearer(req) {
  const kopf = req.headers.authorization;
  if (kopf === undefined) return undefined;
  return /^Bearer\s+(\S+)$/i.exec(kopf)?.[1] ?? '';
}

/**
 * Anfrage einer App (iOS/Android): mit Authorization-Kopf oder „X-ZockerDB-Client: app“ (z. B. die Anmeldung selbst,
 * noch ohne Token). Beide Köpfe erzwingen im Browser eine CORS-Vorabanfrage, die nur die App-Herkünfte bestehen.
 */
export const istAppAnfrage = (req) => req.headers.authorization !== undefined || req.headers['x-zockerdb-client'] === 'app';

/**
 * Liest die Sitzung und hängt req.benutzer an (falls angemeldet): bei App-Anfragen nur aus dem Authorization-Kopf,
 * sonst aus dem Cookie (Browser). Bei App-Anfragen wird ein Cookie immer ignoriert – sie sind von der Herkunftsprüfung
 * ausgenommen und dürfen deshalb nie mit dem Cookie eines Besuchers handeln.
 */
export function ladeSitzung(konten) {
  return (req, _res, next) => {
    req.perToken = istAppAnfrage(req);
    req.sitzungsToken = req.perToken ? leseBearer(req) : leseCookies(req.headers.cookie)[COOKIE_NAME];
    const ergebnis = konten.leseSitzung(req.sitzungsToken);
    if (ergebnis) {
      req.benutzer = ergebnis.benutzer;
      req.sitzungHash = ergebnis.tokenHash;
      req.sitzungArt = ergebnis.sitzung.art;
    } else if (!req.perToken && req.method === 'GET' && req.query.schluessel && /^\/dateien\/[^/]+$/.test(req.path)) {
      // Bilder und Scans in der App: <img> kann keinen Kopf senden – Dateischlüssel der App-Sitzung, gilt nur hier
      const benutzer = konten.leseDateischluessel(req.query.schluessel);
      if (benutzer) req.benutzer = benutzer;
    }
    next();
  };
}

/**
 * Schutz vor Cross-Site-Request-Forgery: Ändernde Anfragen müssen von derselben
 * Herkunft stammen (zusätzlich zum SameSite-Cookie).
 */
export function pruefeHerkunft(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Apps melden sich per Token im Authorization-Kopf an, Cookies werden bei ihren Anfragen ignoriert (siehe ladeSitzung) –
  // ohne Cookie gibt es nichts, was eine fremde Seite missbrauchen könnte.
  if (istAppAnfrage(req)) return next();
  const herkunft = req.headers.origin;
  if (!herkunft) return next(); // z. B. curl/Skripte ohne Browser – dort gibt es kein fremdes Cookie
  try {
    if (new URL(herkunft).host === req.headers.host) return next();
  } catch {
    /* ungültige Origin */
  }
  res.status(403).json({ fehler: 'Anfrage von fremder Herkunft abgelehnt.' });
}

/** `optionen.zweiFaktorPflicht` wird bei jeder Anfrage gelesen (live änderbar über Admin → Einstellungen). */
export function erfordereAnmeldung(optionen) {
  return (req, res, next) => {
    if (!req.benutzer) return res.status(401).json({ fehler: 'Bitte melde dich an.', code: 'nicht_angemeldet' });
    if (optionen.zweiFaktorPflicht && !req.benutzer.totp_aktiv) {
      return res.status(403).json({
        fehler: 'Auf diesem Server ist die Zwei-Faktor-Anmeldung Pflicht. Bitte richte sie zuerst ein.',
        code: '2fa_einrichten',
      });
    }
    next();
  };
}

export function erfordereAdmin(req, res, next) {
  if (req.benutzer?.rolle !== 'admin') return res.status(403).json({ fehler: 'Nur für Administratoren.' });
  next();
}
