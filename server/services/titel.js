// Hilfsfunktionen, um Produktnamen aus Barcode-Datenbanken in brauchbare
// Suchbegriffe für IGDB umzuwandeln. Händlertitel sehen oft so aus:
// "Super Mario Odyssey - [Nintendo Switch] USK 6" → "Super Mario Odyssey"

const PLATTFORM_BEGRIFFE = [
  'nintendo switch 2', 'nintendo switch', 'switch 2', 'switch',
  'playstation 5', 'playstation 4', 'playstation 3', 'playstation 2', 'playstation vita', 'playstation portable', 'playstation',
  // „PS4“, „Ps-4“, „PS 4“ (Händlerschreibweisen)
  'ps[-\\s]?[1-5]', 'psx', 'psp', 'ps vita', 'psvita',
  'xbox series x', 'xbox series s', 'xbox series x\\|s', 'xbox one', 'xbox 360', 'xbox',
  'nintendo 3ds', 'new 3ds', '3ds', 'nintendo ds', 'nds',
  'wii u', 'wiiu', 'wii', 'gamecube', 'game cube', 'ngc',
  'nintendo 64', 'n64', 'super nintendo', 'snes', 'nes',
  'game boy advance', 'gameboy advance', 'gba', 'game boy color', 'gameboy color', 'gbc', 'game boy', 'gameboy',
  'sega mega drive', 'mega drive', 'megadrive', 'sega saturn', 'saturn', 'dreamcast', 'master system', 'game gear',
  'pc dvd-rom', 'pc dvd', 'pc cd-rom', 'pc',
];

const FUELLWOERTER = [
  'usk\\s*(ab\\s*)?\\d+', 'pegi\\s*\\d+', 'fsk\\s*\\d+', 'ab \\d+ jahren?',
  'standard edition', 'standard', 'deutsche version', 'dt\\. version', 'uncut', 'at-pegi',
  'pal', 'ntsc', 'ntsc-u', 'ntsc-j', 'videospiel', 'computerspiel', 'spiel', 'game', 'software', 'neu', 'ovp', 'new', 'sealed',
  // Händler- und Auktionstitel („Ps3 Boxed + Instructions“, „komplett mit Anleitung“)
  'boxed', 'unboxed', 'instructions?', 'manual', 'complete', 'cib', 'loose', 'mit anleitung', 'ohne anleitung', 'anleitung', 'with manual',
  'in ovp', 'originalverpackt', 'gebraucht', 'used', 'sehr gut', 'guter zustand', 'top zustand', 'rar', 'selten', 'rare',
  // Verkaufsfloskeln („Brand New And Sealed - In Stock - Quick Dispatch“)
  'brand\\s+new', 'brand(\\s+and)?', 'and\\s+sealed', 'factory\\s+sealed', 'versiegelt', 'mint', 'neuwertig', 'in\\s+stock',
  '(quick|fast|free|same\\s+day)\\s+(dispatch|delivery|shipping|postage|p\\s*&\\s*p)', 'free\\s+uk\\s+(delivery|postage)', 'uk\\s+seller',
  'uk\\s+version', 'eu\\s+version', 'german\\s+version', 'de[-\\s]version',
  // Regionsangaben und Händlerkürzel („Region 2 VGC“, „Region Free“)
  'region\\s*(free|frei|[0-9]|[a-c])', 'vgc',
  // Sprachfassungen anderer Länder („Russian Version“, „French Import“)
  '(great|best)\\s+value', 'boxed',
  // Zustandsangaben aus Verkaufstiteln („Cib, Very Good“, „Like New“, „In Good Condition“)
  'complete\\s+in\\s+box', '(very|in)\\s+good(\\s+condition)?', 'good\\s+condition', 'excellent(\\s+condition)?', 'like\\s+new',
  '(russian|french|italian|spanish|polish|czech|hungarian|nordic|scandinavian|dutch|portuguese|turkish|greek|arabic|asian|japanese|korean|chinese|english|us|usa|ntsc|australian|aus)\\s+(version|edition|import|release)',
  // Verkäufer-Werbung („Highly Rated Ebay Seller Great Prices“)
  '(highly|top)\\s+rated', '(ebay\\s+)?seller', 'ebay', '(great|best|low|top)\\s+prices?', 'videogames?', 'video\\s+games?', 'save\\s+[£€$]\\w*', '(free|kostenloser)\\s+(shipping|versand)', 'import', 'versandkostenfrei', 'blitzversand', 'sofort\\s+lieferbar', 'neu\\s*&\\s*ovp',
];

// Hersteller bzw. Publisher vor dem Titel („Electronic Arts - Plants vs. Zombies …“) – nur mit Trenner dahinter, damit Titel wie
// „Sega Rally“ oder „Nintendo Land“ erhalten bleiben
const HERSTELLER = [
  'electronic arts', 'ea sports', 'ea games', 'ea', 'ubisoft', 'activision( blizzard)?', 'blizzard', 'nintendo', 'sony( computer| interactive)?( entertainment)?',
  'microsoft( studios)?', 'xbox game studios', 'bandai namco( entertainment)?', 'namco', 'square enix', 'capcom', 'konami', 'sega', 'thq nordic', 'thq',
  'take[- ]?two( interactive)?', '2k( games| sports)?', 'rockstar( games)?', 'bethesda( softworks)?', 'warner bros\\.?( games| interactive)?', 'koch media',
  'deep silver', 'plaion', 'focus( home)?( interactive| entertainment)?', 'nacon', 'bigben( interactive)?', 'milestone', 'codemasters', 'atari', 'eidos',
  'disney( interactive)?', 'lucasarts', 'koei tecmo', 'tecmo koei', 'level[- ]5', 'atlus', 'marvelous', 'rising star( games)?', 'astragon', 'rondomedia',
  'daedalic', 'kalypso( media)?', 'headup( games)?', 'microids', 'numskull( games)?', 'limited run games', 'red art games', 'strictly limited( games)?',
  'super rare games', 'ravenscourt', 'wild river', 'merge games', 'modus( games)?', 'maximum games', 'just for games', 'pqube', 'idea factory',
  'nis america', 'aksys( games)?', 'xseed( games)?', 'ghostlight', 'avanquest', 'funbox', 'zoo( games)?', 'mastertronic', 'dtp( entertainment)?',
];
const herstellerRegex = new RegExp(`^\\s*(${HERSTELLER.join('|')})(\\s+(gmbh|ltd\\.?|inc\\.?|europe|deutschland|germany|uk))*\\s*[-–:|]\\s+`, 'i');

// Publisher mit Zahl im Namen („2K Games“) – sonst läse die Plattformerkennung „playstation 2k Games“ als PlayStation 1
const ZAHL_HERSTELLER = /\b2k\s*(games|sports)\b/gi;

const plattformMuster = PLATTFORM_BEGRIFFE.map((b) => b.replace(/ /g, '\\s*')).join('|');
const plattformRegex = new RegExp(`\\b(${plattformMuster})\\b`, 'gi');
// Hersteller ohne Trenner, aber direkt vor der Plattform („Bethesda Softworks Ps4 The Elder Scrolls Online“)
const herstellerVorPlattform = new RegExp(`^\\s*(${HERSTELLER.join('|')})\\s+(?=(${plattformMuster})\\b)`, 'i');
const SPRACHKUERZEL = '(en|eng|de|ger|deu|dt|fr|fra|fre|it|ita|es|esp|spa|nl|pl|pol|ru|rus|pt|por|cz|cs|hu|tr)';
const fuellRegex = new RegExp(`\\b(${FUELLWOERTER.join('|')})\\b`, 'gi');

export function bereinigeProduktname(name) {
  if (!name) return '';
  let t = String(name)
    .replace(/\[[^\]]*\]/g, ' ') // [PlayStation 4]
    // Text in anderen Schriften („Русская Версия“) – der Katalog führt lateinische Titel
    .replace(/[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Arabic}]+/gu, ' ')
    .replace(/\s*-{2,}\s*/g, ' - ') // „Nba 2k15 --nba 2k15“: doppelter Bindestrich als Trenner
    .replace(herstellerRegex, '') // „Electronic Arts - …“
    .replace(herstellerVorPlattform, '')
    .replace(ZAHL_HERSTELLER, ' ')
    .replace(/\([^)]*\)/g, ' ') // (PEGI)
    // Sprachkürzel-Listen („En/ger“, „DE/EN/FR“)
    .replace(new RegExp(`\\b${SPRACHKUERZEL}(\\s*[/,]\\s*${SPRACHKUERZEL})+\\b`, 'gi'), ' ')
    .replace(plattformRegex, ' ')
    .replace(fuellRegex, ' ')
    .replace(/[|/®™©+£€$]+/g, ' ')
    // „Top“ nur als eigene Aufzählung („…, Top, …“), nicht im Titel („Top Spin“)
    .replace(/,\s*top\s*(?=,|$)/gi, ',')
    .replace(/\s+,(\s*,)*/g, ' ') // Komma-Reste wie „Battlefield 4 , Save“
    .replace(/(,\s*)+$/g, '')
    // Artikelnummern von Händlern (B1393, SKU-12345) – nur Buchstaben+Ziffern-Kürzel, keine Jahres- oder Teilnummern wie „2“
    .replace(/\b[A-Z]{1,4}-?\d{3,}\b/g, ' ')
    .replace(/\s+[-–:]\s*$/g, '')
    // Einzelne Buchstaben als Rest („Modern Warfare U“ = US) – nicht I, V, X (römische Zahlen) und A
    .replace(/(^|\s)[B-HJ-UWYZ](?=\s|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Hersteller vor dem Titel, der erst nach dem Entfernen der Plattform vorne steht („Ps3 / Sony Playstation 3 Game - Call Of Duty“)
  t = t.replace(/^[\s\-–:,.]+/, '').replace(herstellerRegex, '');
  // Kürzel vor dem eigentlichen Namen, der danach noch einmal vollständig kommt („Call Of Duty-activ Call Of Duty Black Ops“):
  // ab der Wiederholung der ersten Wörter weiterlesen
  const woerter = t.split(/\s+/);
  for (let n = Math.min(3, woerter.length - 1); n >= 2; n--) {
    const anfang = woerter.slice(0, n).join(' ').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '');
    const zweite = woerter.findIndex((_, i) => i >= n && woerter.slice(i, i + n).join(' ').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '') === anfang);
    if (zweite > 0 && woerter.length - zweite > n) { t = woerter.slice(zweite).join(' '); break; }
  }
  // Übrig gebliebene Trenner am Anfang/Ende entfernen.
  t = t.replace(/^[\s\-–:,.]+|[\s\-–:,.]+$/g, '').trim();
  return t || String(name).trim();
}

/** Liefert nur Ziffern und prüft die Länge (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function normalisiereBarcode(code) {
  const ziffern = String(code ?? '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(ziffern.length)) return null;
  return ziffern;
}

/** Alle gleichwertigen Schreibweisen eines Codes (UPC-A ↔ EAN-13 mit führender 0). */
export function barcodeVarianten(code) {
  const varianten = new Set([code]);
  if (code.length === 12) varianten.add(`0${code}`);
  if (code.length === 13 && code.startsWith('0')) varianten.add(code.slice(1));
  return [...varianten];
}

const ROEMISCH = { 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII', 13: 'XIII' };
const ARABISCH = Object.fromEntries(Object.entries(ROEMISCH).map(([a, r]) => [r, a]));

/**
 * Suchbegriffe für einen Produktnamen aus einer Barcode-Datenbank – vom genauesten zum gröbsten:
 * bereinigt, ohne Zusätze hinter „ - “ (Editionen, Verpackung), und jeweils mit Zahl ↔ römischer Zahl („4“ ↔ „IV“).
 */
export function suchbegriffe(produktname, max = 6) {
  const bereinigt = bereinigeProduktname(produktname);
  const ohneZusatz = bereinigt.split(/\s+[-–]\s+/)[0].trim();
  // „Xxl2“ → „Xxl 2“ (Händler schreiben Zahlen oft ans Wort)
  const getrennt = ohneZusatz.replace(/([a-zäöü]{2,})(\d{1,2})\b/gi, '$1 $2');
  const ohneEdition = ohneZusatz.replace(/\b(bonus|limited|special|collector'?s|deluxe|gold|goty|game of the year|complete|premium|day one|steelbook)\s+edition\b.*$/i, '').trim();
  const liste = [];
  // Bis einschließlich der Fortsetzungsnummer („Call Of Duty: Modern Warfare 3 Russian …“ → „… Modern Warfare 3“)
  const bisNummer = getrennt.match(/^(.+?\S\s+(?:\d{1,2}|[IVX]{1,4}))\b/)?.[1] ?? '';
  // Notfalls nur die ersten Wörter („Asterix & Obelix“), damit überhaupt etwas zur Auswahl steht
  const kurz = getrennt.split(/\s+/).slice(0, 3).join(' ');
  for (const t of [bereinigt, ohneZusatz, getrennt, ohneEdition, bisNummer, kurz]) {
    if (!t || t.length < 2) continue;
    liste.push(t);
    // Zahl ↔ römische Zahl (nur ganze Wörter, z. B. „Creed 4:“ → „Creed IV:“)
    const roemisch = t.replace(/\b(1[0-3]|[2-9])\b/g, (z) => ROEMISCH[z]);
    const arabisch = t.replace(/\b(XIII|XII|XI|IX|VIII|VII|VI|IV|V|III|II|X)\b/g, (z) => ARABISCH[z]);
    liste.push(roemisch, arabisch);
    // Ohne Doppelpunkt („Creed IV: Black Flag“ heißt bei IGDB „Creed IV Black Flag“)
    if (t.includes(':')) liste.push(roemisch.replace(/\s*:\s*/g, ' '));
  }
  return [...new Set(liste.map((t) => t.replace(/\s{2,}/g, ' ').trim()).filter((t) => t.length >= 2))].slice(0, max);
}

/** Plattform-Begriff im Produktnamen (z. B. „Ps3“) – zum Vorsortieren der Treffer. */
export function plattformImNamen(produktname) {
  const m = String(produktname ?? '').replace(ZAHL_HERSTELLER, ' ').match(plattformRegex);
  return m ? m[0].trim() : null;
}

/** Titel vergleichbar machen: klein, römische Zahlen als Ziffern, ohne Satzzeichen und „The“. */
export function vergleichsTitel(titel) {
  return String(titel ?? '')
    .replace(/\b(XIII|XII|XI|IX|VIII|VII|VI|IV|V|III|II|X)\b/g, (z) => ARABISCH[z])
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the /, '')
    .trim();
}

/**
 * Treffer einer Barcode-Suche nach Übereinstimmung mit dem Produktnamen sortieren:
 * gleicher Titel zuerst, dann Titel, die damit beginnen (kürzere – meist das Hauptspiel – vor Editionen und Zusatzinhalten),
 * dann der Rest; Bundles und Zusatzinhalte eine Stufe tiefer; bei Gleichstand passende Plattform, dann kürzerer Titel.
 */
export function rangiereTreffer(treffer, begriffe, plattformName = null, nebentypen = []) {
  const ziele = [...new Set(begriffe.map(vergleichsTitel).filter(Boolean))];
  const rang = (e) => {
    const titel = [e.titel, e.titel_original].filter(Boolean).map(vergleichsTitel);
    if (titel.some((t) => ziele.includes(t))) return 0;
    if (titel.some((t) => ziele.some((z) => t.startsWith(`${z} `)))) return 1;
    if (titel.some((t) => ziele.some((z) => z.startsWith(`${t} `)))) return 2;
    return 3;
  };
  return treffer
    // Bundle/DLC zählt eine Stufe schlechter: gleich gut passender Titel → Hauptspiel zuerst; ein genau passendes Bundle
    // (z. B. „Ezio Trilogy“) bleibt aber vor nur ähnlichen Titeln
    .map((e, i) => ({ e, i, r: rang(e) * 2 + (nebentypen.includes(e.spieltyp) ? 2 : 0), p: plattformName && e.plattformen?.includes(plattformName) ? 0 : 1, l: String(e.titel ?? '').length }))
    .sort((a, b) => a.r - b.r || a.p - b.p || a.l - b.l || a.i - b.i)
    .map((x) => x.e);
}
