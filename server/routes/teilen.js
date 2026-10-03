// Geteilte Sammlung: /sammlung/:token – über einen geheimen Link auch ohne Konto sichtbar, nie in Suchmaschinen.
// Kaufpreise, Seriennummern, Notizen, Barcodes und eigene Fotos bleiben privat.
import { Router } from 'express';
import { ARTIKELTYPEN, REGIONEN, ZUSTAENDE, VOLLSTAENDIGKEITEN, beschriftung } from '../../shared/konstanten.js';
import { APP_START, appLink } from '../../shared/seo.js';
import { MARKE } from '../../shared/marke.js';
import { esc, CSS } from '../html.js';

const euro = (n) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const zahl = (n) => Number(n).toLocaleString('de-DE');

function seite({ titel, beschreibung, inhalt }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)}</title>
<meta name="description" content="${esc(beschreibung)}">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#16131f">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<style>${CSS}</style>
</head>
<body>
<header class="kopf">
  <a class="marke" href="${APP_START}"><img src="/icons/icon.svg" alt="" width="28" height="28"><span>${esc(MARKE.name)}<small>${esc(MARKE.untertitel)}</small></span></a>
  <a class="knopf" href="${APP_START}">Zur App</a>
</header>
<main>
${inhalt}
</main>
<footer>
  <a href="${appLink('/seite/impressum')}">Impressum</a>
  <a href="${appLink('/seite/datenschutz')}">Datenschutz</a>
</footer>
</body>
</html>`;
}

export function teilenRouter({ db, erweiterungen, konfiguration }) {
  const router = Router();
  const perFreigabe = db.prepare('SELECT id, benutzername, COALESCE(anzeigename, benutzername) AS name, freigabe_wert FROM benutzer WHERE freigabe_token = ? AND gesperrt = 0');
  const geteilteArtikel = db.prepare(`SELECT a.id, a.typ, a.titel, a.plattform, a.region, a.zustand, a.vollstaendigkeit, a.farbe, a.edition,
      a.anzahl, a.marktwert, a.katalog_id AS privat_katalog_id,
      CASE WHEN k.status = 'freigegeben' THEN k.id END AS katalog_id,
      CASE WHEN k.status = 'freigegeben' THEN k.titel END AS katalog_titel,
      CASE WHEN k.status = 'freigegeben' THEN k.typ END AS katalog_typ,
      CASE WHEN k.status = 'freigegeben' THEN k.cover_url END AS cover_url,
      p.kurz AS plattform_kurz, p.name AS plattform_name, v.bezeichnung AS variante
    FROM artikel a LEFT JOIN katalog k ON k.id = a.katalog_id LEFT JOIN plattformen p ON p.id = a.plattform_id
    LEFT JOIN katalog_varianten v ON v.id = a.variante_id AND v.status = 'freigegeben'
    WHERE a.benutzer_id = ? AND a.bestand = 'besitz' AND a.privat = 0 ORDER BY COALESCE(p.name, a.plattform, 'zzz') COLLATE NOCASE, a.titel COLLATE NOCASE LIMIT 5000`);
  const symbol = (typ) => ARTIKELTYPEN.find((t) => t.value === typ)?.icon ?? '🎮';

  // Zusatzmodule können einen genaueren Wert schätzen („wert.schaetzen“ → { wert }) und auf öffentliche
  // Katalogseiten verlinken („teilen.link“ → Pfad); ohne Modul zählt die eigene Schätzung am Artikel.
  const schaetze = (a) => {
    for (const fn of erweiterungen.alle('wert.schaetzen')) {
      const w = fn({ ...a, katalog_id: a.privat_katalog_id });
      if (w) return w.wert;
    }
    return a.marktwert ?? null;
  };
  const linkZu = (a) => erweiterungen.alle('teilen.link').map((fn) => fn(a)).find(Boolean) ?? null;

  router.get('/sammlung/:token', (req, res) => {
    const token = String(req.params.token);
    const b = token.length >= 16 ? perFreigabe.get(token) : null;
    res.set('X-Robots-Tag', 'noindex, nofollow').set('Cache-Control', 'private, no-store');
    if (!b) {
      return res.status(404).type('html').send(seite({
        titel: `Nicht gefunden | ${MARKE.name}`, beschreibung: 'Diese Seite gibt es nicht (mehr).',
        inhalt: '<h1>Nicht gefunden</h1><p>Dieser Link ist ungültig oder wurde vom Besitzer beendet.</p>',
      }));
    }
    const artikel = geteilteArtikel.all(b.id);
    const stueck = artikel.reduce((s, a) => s + (a.anzahl ?? 1), 0);
    const jeTyp = Object.fromEntries(ARTIKELTYPEN.map((t) => [t.value, artikel.filter((a) => a.typ === t.value).reduce((s, a) => s + (a.anzahl ?? 1), 0)]));
    let wert = 0;
    if (b.freigabe_wert) {
      for (const a of artikel) {
        const w = schaetze(a);
        if (w) wert += w * (a.anzahl ?? 1);
      }
    }
    const gruppen = new Map();
    for (const a of artikel) {
      const name = a.plattform_name || a.plattform || 'Ohne Plattform';
      if (!gruppen.has(name)) gruppen.set(name, []);
      gruppen.get(name).push(a);
    }
    const eintrag = (a) => {
      const details = [beschriftung(REGIONEN, a.region, 'kurz'), beschriftung(ZUSTAENDE, a.zustand), beschriftung(VOLLSTAENDIGKEITEN, a.vollstaendigkeit, 'kurz'),
        a.variante, a.edition, a.farbe, (a.anzahl ?? 1) > 1 ? `${a.anzahl}×` : null].filter(Boolean);
      const bild = a.cover_url ? `<img src="${esc(a.cover_url)}" alt="" loading="lazy" width="150" height="200">` : `<span class="platzhalter" aria-hidden="true">${symbol(a.typ)}</span>`;
      const inhaltKachel = `${bild}<b>${esc(a.titel)}</b><br><span class="leise">${esc(details.join(' · '))}</span>`;
      const ziel = a.katalog_id ? linkZu(a) : null;
      return `<li>${ziel ? `<a href="${esc(ziel)}">${inhaltKachel}</a>` : `<div>${inhaltKachel}</div>`}</li>`;
    };
    const inhalt = `<h1>Die Sammlung von ${esc(b.name)}</h1>
<div class="zahlen">
  <div class="zahl"><b>${zahl(stueck)}</b>Exemplare</div>
  ${ARTIKELTYPEN.filter((t) => jeTyp[t.value]).map((t) => `<div class="zahl"><b>${zahl(jeTyp[t.value])}</b>${esc(t.mehrzahl)}</div>`).join('')}
  <div class="zahl"><b>${zahl(gruppen.size)}</b>Plattformen</div>
  ${b.freigabe_wert && wert > 0 ? `<div class="zahl"><b>${euro(Math.round(wert))}</b>geschätzter Wert</div>` : ''}
</div>
${artikel.length ? [...gruppen].map(([name, liste]) => `<section class="karte"><h2>${esc(name)} <span class="leise">(${liste.length})</span></h2><ul class="raster">${liste.map(eintrag).join('')}</ul></section>`).join('')
    : '<p class="leise">Diese Sammlung ist noch leer.</p>'}
${konfiguration?.konten?.registrierungOffen ? `<section class="karte"><h2>Deine eigene Sammlung</h2><p>Erfasse deine Spiele, Konsolen und dein Zubehör – kostenlos, mit Barcode-Scanner.</p><p><a class="knopf" href="${appLink('/?registrieren=1')}">Kostenlos registrieren</a></p></section>` : ''}`;
    res.type('html').send(seite({
      titel: `Die Sammlung von ${b.name} | ${MARKE.name}`,
      beschreibung: `${zahl(stueck)} Spiele, Konsolen und Zubehör in der Sammlung von ${b.name}.`,
      inhalt,
    }));
  });

  return router;
}
