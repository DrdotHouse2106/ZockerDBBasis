// E-Mail-Versand über SMTP (z. B. Postfach deines Hosters, Mailcow, Brevo, Mailjet).
// Wird für „Passwort vergessen“, die Bestätigung der E-Mail-Adresse und Benachrichtigungen genutzt.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import sharp from 'sharp';
import { MARKE } from '../../shared/marke.js';

// Logo als eingebettetes Bild (cid) – Mailprogramme blockieren externe Bilder oft, eingebettete nicht.
// Im Docker-Image liegt es in dist/, beim Entwickeln in client/public/.
const LOGO_CID = 'logo@zockerdb';
const LOGO_PFAD = ['../../dist/icons/icon-192.png', '../../client/public/icons/icon-192.png']
  .map((p) => fileURLToPath(new URL(p, import.meta.url))).find((p) => fs.existsSync(p)) ?? null;
// Klein mitschicken (64 px für 32 px Anzeige auf Retina) – manche Mailprogramme zeigen Anhänge sonst in Originalgröße
let logoKlein = null;
const logoInhalt = () => (logoKlein ??= sharp(LOGO_PFAD).resize(64, 64).png().toBuffer().catch(() => fs.readFileSync(LOGO_PFAD)));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (z) => ESC[z]);

// Farben für hellen und dunklen Modus. Ohne eigene Dunkel-Regeln färben manche Mailprogramme (Outlook, Apple Mail)
// selbst um – dann wird z. B. die weiße Knopfschrift dunkel und unlesbar.
const STIL = `:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme:dark){
.zdb-seite{background:#14111f!important;color:#ece9f5!important}
.zdb-karte{background:#1f1a2e!important;border-color:#3a3350!important}
.zdb-leise{color:#b3abc8!important}
.zdb-link{color:#c4b5fd!important}
}
.zdb-knopf,.zdb-knopf a{color:#ffffff!important}
[data-ogsc] .zdb-knopf a,[data-ogsb] .zdb-knopf{color:#ffffff!important;background:#7c3aed!important}`;

/** Einfache, gut lesbare HTML-Mail mit optionalem Knopf (Tabellenaufbau, damit auch Outlook die Größen einhält). */
export function mailHtml({ titel, absaetze = [], knopf, fuss }) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><style>${STIL}</style></head>
<body class="zdb-seite" style="margin:0;padding:0;background:#f6f4fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1d1830">
<table role="presentation" class="zdb-seite" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f4fb"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 0 16px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="32" style="width:32px;padding-right:10px;vertical-align:middle"><img src="cid:${LOGO_CID}" alt="" width="32" height="32" style="display:block;width:32px;height:32px;max-width:32px;border:0;border-radius:8px"></td>
<td style="font-size:20px;font-weight:700;vertical-align:middle">${esc(MARKE.name)}</td>
</tr></table></td></tr>
<tr><td class="zdb-karte" style="background:#ffffff;border:1px solid #e2ddef;border-radius:16px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(titel)}</h1>
${absaetze.map((a) => `<p style="line-height:1.55;margin:0 0 12px">${esc(a)}</p>`).join('')}
${knopf ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0"><tr>
<td class="zdb-knopf" bgcolor="#7c3aed" style="background:#7c3aed;border-radius:12px"><a href="${esc(knopf.url)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-weight:600;text-decoration:none;border-radius:12px"><span style="color:#ffffff">${esc(knopf.text)}</span></a></td>
</tr></table>
<p class="zdb-leise" style="font-size:13px;color:#5f5873;word-break:break-all;margin:0">Falls der Knopf nicht funktioniert: <a class="zdb-link" href="${esc(knopf.url)}" style="color:#6d28d9">${esc(knopf.url)}</a></p>` : ''}
</td></tr>
<tr><td class="zdb-leise" style="font-size:12px;color:#5f5873;padding-top:16px">${esc(fuss ?? `Diese E-Mail wurde automatisch von ${MARKE.name} versendet.`)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function erstelleMailDienst(konfiguration, { transportFn } = {}) {
  const m = konfiguration ?? {};
  const aktiv = Boolean(transportFn || (m.host && m.absender));
  let transport = null;
  if (!transportFn && aktiv) {
    const port = m.port || 587;
    transport = nodemailer.createTransport({
      host: m.host,
      port,
      secure: m.sicher === 'true' || (m.sicher !== 'false' && port === 465),
      auth: m.benutzer ? { user: m.benutzer, pass: m.passwort } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }

  /** Sendet eine E-Mail. `text` ist Pflicht, `html` optional. */
  async function sende({ an, betreff, text, html }) {
    if (!aktiv) throw new Error('Der E-Mail-Versand ist nicht eingerichtet (SMTP_HOST/SMTP_FROM).');
    // Zeilenumbrüche im Betreff entfernen (Titel stammen teils von Benutzern)
    const nachricht = { from: m.absender || `${MARKE.name} <noreply@localhost>`, to: an, subject: String(betreff).replace(/[\r\n]+/g, ' ').slice(0, 250), text, html };
    // Logo anhängen, wenn die Mail es verwendet (ohne Datei das Bild weglassen)
    if (html?.includes(`cid:${LOGO_CID}`)) {
      if (LOGO_PFAD) nachricht.attachments = [{ filename: 'logo.png', content: await logoInhalt(), cid: LOGO_CID, contentType: 'image/png' }];
      else nachricht.html = html.replace(/<img src="cid:[^"]*"[^>]*>/g, '');
    }
    // Kopie aller E-Mails zur Kontrolle (SMTP_BCC) – unsichtbar für den Empfänger
    if (m.bcc && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.bcc) && String(an).toLowerCase() !== m.bcc.toLowerCase()) nachricht.bcc = m.bcc;
    if (transportFn) return transportFn(nachricht);
    return transport.sendMail(nachricht);
  }

  return { aktiv, sende };
}
