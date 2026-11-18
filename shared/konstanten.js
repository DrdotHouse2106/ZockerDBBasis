// Gemeinsame Konstanten für Server und Client.
// Die Schlüssel (value) werden in der Datenbank gespeichert, die Beschriftungen
// (label) werden in der Oberfläche angezeigt. Schlüssel niemals umbenennen,
// sonst passen bestehende Datenbankeinträge nicht mehr.

export const ARTIKELTYPEN = [
  { value: 'spiel', label: 'Spiel', mehrzahl: 'Spiele', icon: '🎮' },
  { value: 'konsole', label: 'Konsole', mehrzahl: 'Konsolen', icon: '🕹️' },
  { value: 'zubehoer', label: 'Zubehör', mehrzahl: 'Zubehör', icon: '🔌' },
  // Kurz „Merch“ in Reitern, Filtern und Knöpfen; die lange Form nur als Beschreibung/Tooltip
  { value: 'merch', label: 'Merch', mehrzahl: 'Merch', icon: '🧸', beschreibung: 'Merch & Sammlerstücke' },
];

/** Kategorien für Merch (Spalte artikel.merch_kategorie). */
export const MERCH_KATEGORIEN = [
  { value: 'spielfigur', label: 'Spielfiguren', beschreibung: 'Spielfiguren mit Funktion: Amiibo, Skylanders, Disney Infinity, LEGO Dimensions, Starlink' },
  { value: 'karte', label: 'Sammelkarten', beschreibung: 'Sammelkarten mit Spielebezug, z. B. amiibo-Karten' },
  { value: 'figur', label: 'Figuren & Statuen', beschreibung: 'Figuren, Statuen, Actionfiguren – ausdrücklich auch Funko Pop mit Spiele-Lizenz' },
  { value: 'buch', label: 'Bücher & Hefte', beschreibung: 'Lösungsbücher, Artbooks, Magazine' },
  { value: 'musik', label: 'Musik', beschreibung: 'Soundtracks auf CD oder Vinyl' },
  { value: 'kleidung', label: 'Kleidung & Accessoires', beschreibung: 'Shirts, Mützen, Taschen, Pins und mehr' },
  { value: 'promo', label: 'Werbung & Promo', beschreibung: 'Poster, Aufsteller, Händlermaterial' },
];

/**
 * Verpackung bei Merch: „OVP ungeöffnet / OVP geöffnet / lose“. Gespeichert wird sie in den vorhandenen Feldern
 * (ungeöffnet = Zustand „Neu/OVP“ + komplett, geöffnet = komplett, lose = nur der Gegenstand) – keine eigene Spalte.
 */
export const MERCH_VERPACKUNGEN = [
  { value: 'ungeoeffnet', label: 'OVP ungeöffnet' },
  { value: 'geoeffnet', label: 'OVP geöffnet' },
  { value: 'lose', label: 'Lose' },
];
/** Verpackung eines Merch-Exemplars aus Zustand und Vollständigkeit (null = keine Angabe). */
export function merchVerpackung({ zustand, vollstaendigkeit } = {}) {
  if (vollstaendigkeit === 'nur_geraet') return 'lose';
  if (vollstaendigkeit === 'cib') return zustand === 'neu_ovp' ? 'ungeoeffnet' : 'geoeffnet';
  return null;
}
/** Zustand und Vollständigkeit zur gewählten Verpackung (bei „geöffnet“ ist „Neu/OVP“ ausgeschlossen). */
export function merchVerpackungAnwenden(verpackung, { zustand } = {}) {
  if (verpackung === 'ungeoeffnet') return { vollstaendigkeit: 'cib', zustand: 'neu_ovp' };
  if (verpackung === 'geoeffnet') return { vollstaendigkeit: 'cib', zustand: zustand === 'neu_ovp' ? 'wie_neu' : zustand };
  if (verpackung === 'lose') return { vollstaendigkeit: 'nur_geraet', zustand: zustand === 'neu_ovp' ? 'wie_neu' : zustand };
  return {};
}

export const ZUSTAENDE = [
  { value: 'neu_ovp', label: 'Neu/OVP', beschreibung: 'Neu und originalverschweißt, nie benutzt.' },
  { value: 'wie_neu', label: 'Wie neu', beschreibung: 'Kaum benutzt, keine sichtbaren Gebrauchsspuren.' },
  { value: 'sehr_gut', label: 'Sehr gut', beschreibung: 'Minimale Gebrauchsspuren, voll funktionsfähig.' },
  { value: 'gut', label: 'Gut', beschreibung: 'Normale Gebrauchsspuren, voll funktionsfähig.' },
  { value: 'akzeptabel', label: 'Akzeptabel', beschreibung: 'Deutliche Gebrauchsspuren, funktionsfähig.' },
  { value: 'defekt', label: 'Defekt', beschreibung: 'Nicht oder nur eingeschränkt funktionsfähig.' },
];

export const VOLLSTAENDIGKEITEN = [
  { value: 'cib', label: 'CIB (Komplett in OVP)', kurz: 'CIB' },
  { value: 'nur_geraet', label: 'Nur Gerät/Disc/Modul', kurz: 'Lose' },
  // z. B. Game-Boy-Modul in der Plastik-Schutzhülle, aber ohne Karton – zählt beim Wert wie „lose“
  { value: 'mit_huelle', label: 'Mit Schutzhülle (ohne Karton)', kurz: 'Hülle' },
  { value: 'nur_ovp', label: 'Nur OVP', kurz: 'Nur OVP' },
  { value: 'fehlt_anleitung', label: 'Fehlt Anleitung', kurz: 'o. Anl.' },
  // Disc-Spiele: Hülle da, aber der Cover-Einleger (Inlay) hinter der Folie fehlt
  { value: 'fehlt_inlay', label: 'Fehlt Inlay', kurz: 'o. Inlay' },
];

export const REGIONEN = [
  { value: 'pal_de', label: 'PAL (DE / USK)', kurz: 'PAL-DE' },
  { value: 'pal_eu', label: 'PAL (EU)', kurz: 'PAL-EU' },
  // Genauere europäische Fassungen (Sprachen, Cover, Alterskennzeichen unterscheiden sich) – zählen im Filter „PAL (EU)“ mit
  { value: 'pal_at', label: 'PAL – Österreich/Schweiz', kurz: 'PAL-AT/CH', gruppe: 'pal_eu' },
  { value: 'pal_uk', label: 'PAL – UK', kurz: 'PAL-UK', gruppe: 'pal_eu' },
  { value: 'pal_fr', label: 'PAL – Frankreich', kurz: 'PAL-FR', gruppe: 'pal_eu' },
  { value: 'pal_benelux', label: 'PAL – Benelux', kurz: 'PAL-BNL', gruppe: 'pal_eu' },
  { value: 'pal_es', label: 'PAL – Spanien/Portugal', kurz: 'PAL-ES/PT', gruppe: 'pal_eu' },
  { value: 'pal_it', label: 'PAL – Italien', kurz: 'PAL-IT', gruppe: 'pal_eu' },
  { value: 'pal_nordic', label: 'PAL – Skandinavien', kurz: 'PAL-NOR', gruppe: 'pal_eu' },
  { value: 'ntsc_u', label: 'NTSC-U', kurz: 'NTSC-U' },
  { value: 'ntsc_j', label: 'NTSC-J', kurz: 'NTSC-J' },
];

/** Region samt genauerer Fassungen – für Filter: „pal_eu“ → pal_eu, pal_uk, pal_fr … */
export const regionUmfang = (wert) => [wert, ...REGIONEN.filter((r) => r.gruppe === wert).map((r) => r.value)];

/**
 * Cover-Regionen in der Reihenfolge, in der sie für eine Fassung passen: genau die Region, dann die europäische Fassung als nächste
 * Verwandte (PAL-DE → PAL-DE, PAL-EU). Ohne Region gilt der deutsche Markt.
 */
export function coverRegionKette(region) {
  const r = REGIONEN.some((x) => x.value === region) ? region : 'pal_de';
  return r.startsWith('pal_') && r !== 'pal_eu' ? [r, 'pal_eu'] : [r];
}

/** Region einer regionalen Fassung bei IGDB (Name bzw. Kennung, z. B. „Europe“/„EU“, „North America“, „Japan“) → Wert aus REGIONEN. */
export function regionAusIgdb(name, kennung = '') {
  const t = `${name ?? ''}|${kennung ?? ''}`.toLowerCase();
  if (/german|deutsch|\|de$/.test(t)) return 'pal_de';
  if (/europe|\|eu$|pal/.test(t)) return 'pal_eu';
  if (/north america|\|na$|usa|united states/.test(t)) return 'ntsc_u';
  if (/japan|\|jp$/.test(t)) return 'ntsc_j';
  return null;
}

// Stammdaten der Plattformen (werden beim ersten Start in die Datenbank übernommen und
// können danach von Admins/Moderatoren gepflegt werden). „aliase“ dienen der Zuordnung
// von Freitext und IGDB-Namen.
export const PLATTFORM_STAMMDATEN = [
  // Nintendo
  { name: 'Nintendo Entertainment System', kurz: 'NES', hersteller: 'Nintendo', typ: 'konsole', jahr: 1983, aliase: ['NES', 'Famicom', 'Family Computer'] },
  { name: 'Super Nintendo', kurz: 'SNES', hersteller: 'Nintendo', typ: 'konsole', jahr: 1990, aliase: ['SNES', 'Super Nintendo Entertainment System', 'Super Famicom', 'Super Nintendo (SNES)'] },
  { name: 'Nintendo 64', kurz: 'N64', hersteller: 'Nintendo', typ: 'konsole', jahr: 1996, aliase: ['N64'] },
  { name: 'Nintendo GameCube', kurz: 'GC', hersteller: 'Nintendo', typ: 'konsole', jahr: 2001, aliase: ['GameCube', 'NGC', 'GCN'] },
  { name: 'Nintendo Wii', kurz: 'Wii', hersteller: 'Nintendo', typ: 'konsole', jahr: 2006, aliase: ['Wii'] },
  { name: 'Nintendo Wii U', kurz: 'Wii U', hersteller: 'Nintendo', typ: 'konsole', jahr: 2012, aliase: ['Wii U', 'WiiU'] },
  { name: 'Nintendo Switch', kurz: 'Switch', hersteller: 'Nintendo', typ: 'konsole', jahr: 2017, aliase: ['Switch', 'NSW'] },
  { name: 'Nintendo Switch 2', kurz: 'Switch 2', hersteller: 'Nintendo', typ: 'konsole', jahr: 2025, aliase: ['Switch 2'] },
  { name: 'Game Boy', kurz: 'GB', hersteller: 'Nintendo', typ: 'handheld', jahr: 1989, aliase: ['GB', 'Gameboy'] },
  { name: 'Game Boy Color', kurz: 'GBC', hersteller: 'Nintendo', typ: 'handheld', jahr: 1998, aliase: ['GBC', 'Gameboy Color'] },
  { name: 'Game Boy Advance', kurz: 'GBA', hersteller: 'Nintendo', typ: 'handheld', jahr: 2001, aliase: ['GBA', 'Gameboy Advance'] },
  { name: 'Nintendo DS', kurz: 'DS', hersteller: 'Nintendo', typ: 'handheld', jahr: 2004, aliase: ['NDS', 'DS', 'Nintendo DSi'] },
  { name: 'Nintendo 3DS', kurz: '3DS', hersteller: 'Nintendo', typ: 'handheld', jahr: 2011, aliase: ['3DS', 'New Nintendo 3DS', 'New 3DS'] },
  { name: 'Virtual Boy', kurz: 'VB', hersteller: 'Nintendo', typ: 'konsole', jahr: 1995, aliase: [] },
  // Sony
  { name: 'PlayStation', kurz: 'PS1', hersteller: 'Sony', typ: 'konsole', jahr: 1994, aliase: ['PS1', 'PSX', 'PSone', 'PlayStation 1'] },
  { name: 'PlayStation 2', kurz: 'PS2', hersteller: 'Sony', typ: 'konsole', jahr: 2000, aliase: ['PS2'] },
  { name: 'PlayStation 3', kurz: 'PS3', hersteller: 'Sony', typ: 'konsole', jahr: 2006, aliase: ['PS3'] },
  { name: 'PlayStation 4', kurz: 'PS4', hersteller: 'Sony', typ: 'konsole', jahr: 2013, aliase: ['PS4'] },
  { name: 'PlayStation 5', kurz: 'PS5', hersteller: 'Sony', typ: 'konsole', jahr: 2020, aliase: ['PS5'] },
  { name: 'PlayStation Portable', kurz: 'PSP', hersteller: 'Sony', typ: 'handheld', jahr: 2004, aliase: ['PSP', 'PlayStation Portable (PSP)'] },
  { name: 'PlayStation Vita', kurz: 'Vita', hersteller: 'Sony', typ: 'handheld', jahr: 2011, aliase: ['PS Vita', 'PSVita'] },
  // Microsoft
  { name: 'Xbox', kurz: 'Xbox', hersteller: 'Microsoft', typ: 'konsole', jahr: 2001, aliase: ['Xbox Classic'] },
  { name: 'Xbox 360', kurz: 'X360', hersteller: 'Microsoft', typ: 'konsole', jahr: 2005, aliase: ['X360'] },
  { name: 'Xbox One', kurz: 'XOne', hersteller: 'Microsoft', typ: 'konsole', jahr: 2013, aliase: ['XB1'] },
  { name: 'Xbox Series X|S', kurz: 'XSX', hersteller: 'Microsoft', typ: 'konsole', jahr: 2020, aliase: ['Xbox Series X', 'Xbox Series S', 'XSX'] },
  // Sega
  { name: 'Sega Master System', kurz: 'SMS', hersteller: 'Sega', typ: 'konsole', jahr: 1986, aliase: ['Master System', 'Sega Master System/Mark III'] },
  { name: 'Sega Mega Drive', kurz: 'MD', hersteller: 'Sega', typ: 'konsole', jahr: 1988, aliase: ['Mega Drive', 'Genesis', 'Sega Genesis', 'Sega Mega Drive/Genesis'] },
  { name: 'Sega Mega-CD', kurz: 'MCD', hersteller: 'Sega', typ: 'konsole', jahr: 1991, aliase: ['Mega-CD', 'Sega CD'] },
  { name: 'Sega 32X', kurz: '32X', hersteller: 'Sega', typ: 'konsole', jahr: 1994, aliase: ['32X'] },
  { name: 'Sega Saturn', kurz: 'Saturn', hersteller: 'Sega', typ: 'konsole', jahr: 1994, aliase: ['Saturn'] },
  { name: 'Sega Dreamcast', kurz: 'DC', hersteller: 'Sega', typ: 'konsole', jahr: 1998, aliase: ['Dreamcast'] },
  { name: 'Sega Game Gear', kurz: 'GG', hersteller: 'Sega', typ: 'handheld', jahr: 1990, aliase: ['Game Gear'] },
  // Weitere
  { name: 'Atari 2600', kurz: '2600', hersteller: 'Atari', typ: 'konsole', jahr: 1977, aliase: ['Atari VCS'] },
  { name: 'Atari 7800', kurz: '7800', hersteller: 'Atari', typ: 'konsole', jahr: 1986, aliase: [] },
  { name: 'Atari Jaguar', kurz: 'Jaguar', hersteller: 'Atari', typ: 'konsole', jahr: 1993, aliase: ['Jaguar'] },
  { name: 'Atari Lynx', kurz: 'Lynx', hersteller: 'Atari', typ: 'handheld', jahr: 1989, aliase: ['Lynx'] },
  { name: 'Commodore 64', kurz: 'C64', hersteller: 'Commodore', typ: 'computer', jahr: 1982, aliase: ['C64', 'Commodore C64/128/MAX'] },
  { name: 'Commodore Amiga', kurz: 'Amiga', hersteller: 'Commodore', typ: 'computer', jahr: 1985, aliase: ['Amiga'] },
  { name: 'Neo Geo', kurz: 'NeoGeo', hersteller: 'SNK', typ: 'konsole', jahr: 1990, aliase: ['Neo Geo AES', 'Neo Geo MVS', 'Neo Geo CD'] },
  { name: 'PC Engine', kurz: 'PCE', hersteller: 'NEC', typ: 'konsole', jahr: 1987, aliase: ['TurboGrafx-16', 'TurboGrafx-16/PC Engine'] },
  { name: 'PC', kurz: 'PC', hersteller: 'PC', typ: 'computer', jahr: null, aliase: ['PC (Microsoft Windows)', 'Windows', 'DOS', 'PC DVD-ROM', 'PC CD-ROM'] },
  { name: 'Sonstige', kurz: 'Sonst.', hersteller: 'Sonstige', typ: 'sonstige', jahr: null, aliase: [] },
];

// Einfache Namensliste (z. B. für Vorschläge)
export const PLATTFORMEN = PLATTFORM_STAMMDATEN.map((p) => p.name);

export const HERSTELLER_REIHENFOLGE = ['Nintendo', 'Sony', 'Microsoft', 'Sega', 'Atari', 'Commodore', 'SNK', 'NEC', 'PC', 'Sonstige'];

/** Wie ein Artikel in die Sammlung kam – oft gibt es keinen Einzelpreis (lange her, Konvolut, Geschenk). */
export const HERKUNFT = [
  { value: 'gekauft', label: 'Einzeln gekauft', kurz: 'Gekauft' },
  { value: 'konvolut', label: 'Aus einem Konvolut / Paket', kurz: 'Konvolut' },
  { value: 'geschenk', label: 'Geschenkt bekommen', kurz: 'Geschenk' },
  { value: 'getauscht', label: 'Getauscht', kurz: 'Getauscht' },
  { value: 'schon_immer', label: 'Schon immer da (z. B. aus der Kindheit)', kurz: 'Schon immer' },
  { value: 'unbekannt', label: 'Weiß ich nicht mehr', kurz: 'Unbekannt' },
];

/** Wo man selbst gekauft hat (für die Preisgeschichte des Exemplars). */
export const KAUFQUELLEN = [
  { value: 'laden', label: 'Laden / Händler vor Ort' },
  { value: 'online', label: 'Online-Shop' },
  { value: 'ebay', label: 'eBay' },
  { value: 'kleinanzeigen', label: 'Kleinanzeigen' },
  { value: 'flohmarkt', label: 'Flohmarkt / Trödelmarkt' },
  { value: 'boerse', label: 'Sammlerbörse / Messe' },
  { value: 'privat', label: 'Von privat (Freunde, Bekannte)' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

/** Wie wird der Gesamtpreis eines Konvoluts auf die Artikel verteilt? */
export const KONVOLUT_AUFTEILUNG = [
  { value: 'gleich', label: 'Gleichmäßig je Stück' },
  { value: 'wert', label: 'Nach geschätztem Wert' },
];

/** Bestand eines Exemplars: nur „Im Besitz“ zählt zur Sammlung und zum Sammlungswert. */
export const BESTAND = [
  { value: 'besitz', label: 'Im Besitz', kurz: 'Im Besitz' },
  { value: 'verkauft', label: 'Verkauft', kurz: 'Verkauft' },
  { value: 'abgegeben', label: 'Verschenkt / getauscht', kurz: 'Abgegeben' },
  // Digital (z. B. Steam-Import): deutlich gekennzeichnet, zählt nicht zur Sammlung und zum Sammlungswert
  { value: 'digital', label: 'Digital', kurz: 'Digital' },
  // Leere Hülle/OVP ohne Spiel: dient dem Fotografieren für die Datenbank – zählt nicht zur Sammlung, zum Wert und zu Statistiken
  { value: 'verpackung', label: 'Leere Verpackung (für Fotos)', kurz: 'Leere Hülle' },
];

/** „Nur OVP“ heißt: leere Verpackung – gehört nicht zur Sammlung (aus Bestand „besitz“ wird „verpackung“ und zurück). */
export function bestandFuerVollstaendigkeit(vollstaendigkeit, bestand) {
  if (vollstaendigkeit === 'nur_ovp' && (bestand ?? 'besitz') === 'besitz') return 'verpackung';
  if (vollstaendigkeit !== 'nur_ovp' && bestand === 'verpackung') return 'besitz';
  return bestand;
}

/**
 * Katalogfilter nach Veröffentlichungsregion. Einträge ohne bekannte Regionen werden immer gezeigt.
 * Australien/Neuseeland sind PAL-Märkte; weltweite Veröffentlichungen zählen überall.
 */
export const KATALOG_REGIONEN = [
  { value: 'pal', label: 'PAL (Europa)', codes: ['eu', 'au', 'ww'] },
  { value: 'ntsc_u', label: 'NTSC-U (Nordamerika)', codes: ['na', 'ww'] },
  { value: 'ntsc_j', label: 'NTSC-J (Japan)', codes: ['jp', 'ww'] },
  { value: 'alle', label: 'Alle Regionen', codes: null },
];

/** Woher ein digitales Spiel stammt (Store) – für die Kennzeichnung „DIGITAL · …“. */
export const DIGITAL_QUELLEN = [
  { value: 'playstation', label: 'PlayStation Store', kurz: 'PlayStation' },
  { value: 'nintendo', label: 'Nintendo eShop', kurz: 'eShop' },
  { value: 'xbox', label: 'Xbox Store', kurz: 'Xbox' },
  { value: 'steam', label: 'Steam', kurz: 'Steam' },
  { value: 'gog', label: 'GOG', kurz: 'GOG' },
  { value: 'epic', label: 'Epic Games Store', kurz: 'Epic' },
  { value: 'andere', label: 'Anderer Store', kurz: null },
];

/** Spielstatus eines Exemplars – „Nicht gespielt“ ergibt den „Pile of Shame“. */
export const SPIELSTATUS = [
  { value: 'nicht_gespielt', label: 'Nicht gespielt', icon: '📦' },
  { value: 'angefangen', label: 'Angefangen', icon: '▶️' },
  { value: 'durchgespielt', label: 'Durchgespielt', icon: '🏁' },
  { value: 'komplett', label: '100 %', icon: '🏆' },
  { value: 'abgebrochen', label: 'Abgebrochen', icon: '⏹️' },
];

/** Zuschaltbare Zusatzfelder (Profil → „Zusätzliche Felder“), standardmäßig aus. */
export const FUNKTIONEN = [
  { value: 'lagerort', label: 'Lagerort', beschreibung: 'Ort → Regal/Schrank → Fach/Kiste je Exemplar, mit Übersicht und Filter.' },
  { value: 'wartung', label: 'Zustand & Wartung', beschreibung: 'Wartungsverlauf (Batterie, Recap, Laufwerk, Mods …) und Hinweise zum Batteriealter.' },
  { value: 'beilagen', label: 'Beilagen & Seriennummern', beschreibung: 'Checkliste der Beilagen und Abgleich der Seriennummer von Gerät und OVP.' },
];

/** Beschriftung der beiden Zustände: Datenträger bzw. Gerät und Hülle bzw. OVP. */
export const zustandBeschriftung = (typ) => (typ === 'spiel'
  ? { traeger: 'Zustand Disc / Modul', ovp: 'Zustand Hülle / OVP' }
  : typ === 'merch' ? { traeger: 'Zustand Figur / Artikel', ovp: 'Zustand Verpackung (Box, Blister)' }
    : { traeger: 'Zustand Gerät', ovp: 'Zustand OVP' });

/**
 * Bewertungshilfe je Zustandsstufe – getrennt für den Datenträger (Disc/Modul), ein Gerät, eine Figur bzw. Merch und die Hülle/OVP.
 * Angelehnt an die üblichen Stufen beim Sammeln und auf Verkaufsplattformen.
 */
export const ZUSTAND_HILFE = {
  neu_ovp: {
    traeger: 'Ungespielt, noch eingeschweißt.',
    geraet: 'Unbenutzt, original verpackt bzw. versiegelt.',
    figur: 'Unbenutzt, noch original verpackt bzw. im ungeöffneten Blister.',
    ovp: 'Original eingeschweißt (Folie intakt), keine Druckstellen.',
    inlay: 'Unberührt hinter der Folie.',
  },
  wie_neu: {
    traeger: 'Keine Kratzer bzw. Spuren, Etikett makellos, Kontakte blank.',
    geraet: 'Keine Kratzer, nicht vergilbt, alle Funktionen einwandfrei.',
    figur: 'Keine Abriebstellen, Farben satt, Gelenke fest, nichts vergilbt.',
    ovp: 'Geöffnet, aber ohne Knicke, Risse oder Verfärbungen; Cover sauber.',
    inlay: 'Farben satt, keine Knicke, Risse oder Flecken.',
  },
  sehr_gut: {
    traeger: 'Einzelne feine Kratzer, nur im Gegenlicht sichtbar; Etikett vollständig.',
    geraet: 'Leichte Gebrauchsspuren, kaum sichtbare Kratzer, kaum vergilbt.',
    figur: 'Minimaler Farbabrieb an Kanten (nur bei genauem Hinsehen), sonst einwandfrei.',
    ovp: 'Leichte Lagerspuren (Ecken minimal bestoßen), keine Risse, keine Aufkleber.',
    inlay: 'Minimal gewellt oder ein leichter Knick am Rand, sonst einwandfrei.',
  },
  gut: {
    traeger: 'Sichtbare Kratzer, läuft aber fehlerfrei; Etikett mit kleinen Spuren.',
    geraet: 'Deutliche Gebrauchsspuren oder Vergilbung, voll funktionsfähig.',
    figur: 'Sichtbarer Farbabrieb oder leichte Verfärbung, kleine Kratzer; nichts gebrochen.',
    ovp: 'Knicke, bestoßene Ecken oder kleiner Riss; Preisaufkleber oder Beschriftung.',
    inlay: 'Sichtbare Knicke, leicht verblichen, kleiner Riss oder Beschriftung.',
  },
  akzeptabel: {
    traeger: 'Viele oder tiefe Kratzer, Etikett beschädigt bzw. beschriftet – läuft noch.',
    geraet: 'Starke Spuren, Risse im Gehäuse oder Teile fehlen, funktioniert noch.',
    figur: 'Deutlicher Abrieb, Vergilbung oder lockere Gelenke; kleine Teile fehlen oder sind geklebt.',
    ovp: 'Stark beschädigt: Risse, Wasserschaden, fehlende Laschen, zerbrochene Hülle.',
    inlay: 'Deutlich eingerissen, Wasserschaden, stark verblichen oder Teile fehlen.',
  },
  defekt: {
    traeger: 'Lädt nicht, hängt oder bricht ab (z. B. gebrochene Disc, korrodierte Kontakte).',
    geraet: 'Startet nicht oder wichtige Funktionen fallen aus.',
    figur: 'Gebrochen, Teile fehlen oder Chip/Funktion (z. B. NFC) geht nicht mehr.',
    ovp: 'Nur noch in Teilen vorhanden oder unbrauchbar.',
    inlay: 'Nur noch in Resten vorhanden oder durch eine Kopie ersetzt.',
  },
};

/** Felder des Formulars, die man im Konto ausblenden kann (bereits ausgefüllte bleiben sichtbar). */
export const AUSBLENDBARE_FELDER = [
  { value: 'region', label: 'Region' },
  { value: 'zustand_ovp', label: 'Zustand der Hülle / OVP' },
  { value: 'zustand_inlay', label: 'Zustand des Inlays (Disc-Spiele)' },
  { value: 'farbe', label: 'Farbe / Sonderfarbe' },
  { value: 'edition', label: 'Edition / Variante' },
  { value: 'modellnummer', label: 'Modellnummer' },
  { value: 'drucknummer', label: 'Drucknummer (Cover, nur Spiele)' },
  { value: 'seriennummer', label: 'Seriennummer' },
  { value: 'kaufdatum', label: 'Kaufdatum' },
  { value: 'kauf_quelle', label: 'Gekauft bei/auf' },
  { value: 'erstkauf', label: 'Erstkauf laut Beleg (Neupreis)' },
  { value: 'marktwert', label: 'Marktwert (eigene Schätzung)' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'notizen', label: 'Eigene Notizen' },
];
export function leseAusgeblendeteFelder(roh) {
  try {
    const liste = typeof roh === 'string' ? JSON.parse(roh) : roh;
    const erlaubt = new Set(AUSBLENDBARE_FELDER.map((f) => f.value));
    return Array.isArray(liste) ? [...new Set(liste.filter((f) => erlaubt.has(f)))] : [];
  } catch { return []; }
}

/** Wartungsmerkmale eines Katalogeintrags – bestimmen, welche Wartungsarten am Exemplar angeboten werden. */
export const WARTUNGSMERKMALE = [
  { value: 'speicherbatterie', label: 'Speicherbatterie', hinweis: 'Spielstände bzw. Uhr hängen an einer Knopfzelle – sie hält meist 15–25 Jahre.' },
  { value: 'optisches_laufwerk', label: 'Optisches Laufwerk', hinweis: 'Laser und Mechanik altern; Laser justieren oder tauschen.' },
  { value: 'elkos', label: 'Elektrolytkondensatoren', hinweis: 'Alte Elkos trocknen aus oder laufen aus – ein Recap beugt Schäden vor.' },
  { value: 'vergilbung', label: 'Vergilbender Kunststoff', hinweis: 'Das Gehäuse vergilbt mit der Zeit (ABS mit Flammschutzmittel).' },
];

/** Wartungsarten; mit `merkmal` nur angeboten, wenn der Katalogeintrag das Merkmal hat (oder es unbekannt ist). */
export const WARTUNGSARTEN = [
  { value: 'batterie', label: 'Batterie getauscht', icon: '🔋', merkmal: 'speicherbatterie' },
  { value: 'recap', label: 'Recap (Elkos getauscht)', icon: '⚡', merkmal: 'elkos' },
  { value: 'laufwerk', label: 'Laufwerk/Laser gewartet', icon: '💿', merkmal: 'optisches_laufwerk' },
  { value: 'retrobright', label: 'Entgilbt (Retrobright)', icon: '☀️', merkmal: 'vergilbung' },
  { value: 'reinigung', label: 'Reinigung', icon: '🧽' },
  { value: 'mod', label: 'Mod/Umbau', icon: '🔧' },
  { value: 'reparatur', label: 'Reparatur', icon: '🛠️' },
  { value: 'sonstiges', label: 'Sonstiges', icon: '📝' },
];

// Standardwerte je Plattform (Kurzname) und Artikeltyp: true = hat das Merkmal, null = je nach Titel (wird angeboten),
// nicht aufgeführt = hat es nicht. Das Moderationsteam kann sie je Katalogeintrag überschreiben.
const MERKMAL_STANDARD = {
  spiel: {
    speicherbatterie: { werte: null, plattformen: ['NES', 'SNES', 'N64', 'GB', 'GBC', 'GBA', 'MD', 'PCE', 'NeoGeo'] },
  },
  konsole: {
    speicherbatterie: { werte: true, plattformen: ['Saturn', 'DC', 'GC', 'NeoGeo'] },
    optisches_laufwerk: { werte: true, plattformen: ['PS1', 'PS2', 'PS3', 'PS4', 'PS5', 'PSP', 'Saturn', 'DC', 'GC', 'Wii', 'Wii U', 'Xbox', 'X360', 'XOne', 'XSX', 'MCD'] },
    elkos: { werte: true, plattformen: ['SMS', 'MD', 'MCD', '32X', 'Saturn', 'DC', 'GG', 'Lynx', 'NeoGeo', 'PCE', 'VB', '2600', '7800', 'Jaguar', 'C64', 'Amiga', 'NES', 'SNES', 'N64', 'GB', 'GBC', 'PS1', 'PS2', 'Xbox'] },
    vergilbung: { werte: true, plattformen: ['SNES', 'NES', 'GB', 'GBC', 'N64', 'SMS', 'MD', 'C64', 'Amiga', 'PS1', '2600', '7800', 'PCE'] },
  },
};
MERKMAL_STANDARD.zubehoer = { vergilbung: MERKMAL_STANDARD.konsole.vergilbung };

/** Standard-Wartungsmerkmale für Plattform (Kurzname) und Artikeltyp: { merkmal: true | null }. */
export function standardWartungsmerkmale(plattformKurz, typ) {
  const ergebnis = {};
  for (const [merkmal, { werte, plattformen }] of Object.entries(MERKMAL_STANDARD[typ] ?? {})) {
    if (plattformKurz && plattformen.includes(plattformKurz)) ergebnis[merkmal] = werte;
  }
  return ergebnis;
}

/** Welche Wartungsarten zu den Merkmalen passen (Merkmal true oder null = je nach Titel). */
export function passendeWartungsarten(merkmale = {}) {
  return WARTUNGSARTEN.filter((a) => !a.merkmal || (a.merkmal in merkmale && merkmale[a.merkmal] !== false));
}

/** Beilagen-Checkliste je Artikeltyp. */
export const BEILAGEN = {
  spiel: [
    { value: 'ovp', label: 'OVP / Hülle' },
    { value: 'anleitung', label: 'Anleitung' },
    { value: 'inlay', label: 'Inlay / Schutzhülle' },
    { value: 'steelbook', label: 'Steelbook' },
    { value: 'poster', label: 'Poster / Karte' },
    { value: 'registrierkarte', label: 'Registrierkarte' },
    { value: 'beilagen', label: 'Beilagen (Kataloge, Werbung, Sicherheitshinweise)' },
    // Sonderausgaben (Special/Collector's/Limited Edition) – in der Checkliste eingeklappt, bis eines davon erfasst ist
    { value: 'schuber', label: 'Schuber / Sammlerbox', sonder: true },
    { value: 'zweite_disc', label: 'Zweite Disc / Data Disc', sonder: true },
    { value: 'artbook', label: 'Artbook', sonder: true },
    { value: 'code', label: 'Download-/DLC-Code (unbenutzt)', sonder: true },
    { value: 'soundtrack', label: 'Soundtrack', sonder: true },
    { value: 'figur', label: 'Figur / Statue', sonder: true },
    { value: 'extras', label: 'Sticker, Pins & weitere Extras', sonder: true },
  ],
  konsole: [
    { value: 'ovp', label: 'OVP' },
    { value: 'einleger', label: 'Einleger / Styropor' },
    { value: 'anleitung', label: 'Anleitung' },
    { value: 'netzteil', label: 'Netzteil' },
    { value: 'kabel', label: 'AV-/HDMI-Kabel' },
    { value: 'controller', label: 'Controller' },
    { value: 'garantiekarte', label: 'Garantiekarte / Kaufbeleg' },
  ],
  zubehoer: [
    { value: 'ovp', label: 'OVP' },
    { value: 'anleitung', label: 'Anleitung' },
    { value: 'kabel', label: 'Kabel' },
  ],
  // Merch: Sockel, Zertifikat und Karte/Code (z. B. Amiibo-Karten) statt Inlay und Datenträger
  merch: [
    { value: 'ovp', label: 'OVP / Karton' },
    { value: 'sockel', label: 'Sockel' },
    { value: 'zertifikat', label: 'Zertifikat' },
    { value: 'karte_code', label: 'Karte / Code' },
    { value: 'anleitung', label: 'Anleitung' },
  ],
};

/**
 * Beilagen-Liste mit passender Beschriftung je Datenträger: Bei Disc-Spielen ist „Inlay“ der Cover-Einleger hinter der
 * Folie der Hülle, bei Modul-Spielen die Plastik-Schutzhülle bzw. der Einsatz im Karton. Der Schlüssel bleibt „inlay“.
 */
export function beilagenFuer(typ, plattform = null) {
  const liste = BEILAGEN[typ] ?? BEILAGEN.spiel;
  if ((typ ?? 'spiel') !== 'spiel') return liste;
  const traeger = plattform ? datentraegerVon(plattform) : null;
  const label = traeger === 'disc' ? 'Inlay / Cover-Einleger' : traeger === 'modul' ? 'Schutzhülle / Einsatz' : 'Inlay / Schutzhülle';
  return liste.map((b) => (b.value === 'inlay' ? { ...b, label } : b));
}

/** Typische Mängel am Inlay (Cover-Einleger hinter der Folie der Hülle). */
export const INLAY_MAENGEL = [
  { value: 'eingerissen', label: 'Eingerissen' },
  { value: 'wasserschaden', label: 'Wasserschaden / gewellt' },
  { value: 'verblichen', label: 'Verblichen' },
  { value: 'beschriftet', label: 'Beschriftet' },
  { value: 'aufkleber', label: 'Aufkleber / Klebereste' },
  { value: 'geknickt', label: 'Geknickt' },
  { value: 'kopie', label: 'Kopie / Nachdruck' },
];

/**
 * Gibt es bei diesem Exemplar ein Inlay zu bewerten? Nur Disc-Spiele (bzw. unbekannter Datenträger) mit Hülle – und nicht,
 * wenn das Inlay als „gab es nicht“ markiert ist (z. B. Steelbook-/Special-Editionen ohne Cover-Einleger).
 */
export const hatInlayZustand = ({ typ, plattform, bestand, vollstaendigkeit, beilagen }) => typ === 'spiel' && bestand !== 'digital'
  && vollstaendigkeit !== 'nur_geraet' && vollstaendigkeit !== 'fehlt_inlay' && (plattform ? datentraegerVon(plattform) : null) !== 'modul'
  && !(beilagen && typeof beilagen === 'object' && beilagen.inlay === BEILAGE_OHNE);

/**
 * Beilagen-Werte: true = vorhanden, false = fehlt, Zahl ≥ 2 = so viele Stück vorhanden (z. B. drei Werbebeilagen).
 * Als Text: „✓ Anleitung“, „✓ 3× Beilagen (Kataloge, Werbung, Sicherheitshinweise)“, „✗ Poster / Karte“.
 */
export const beilageVorhanden = (wert) => wert === true || (Number.isInteger(wert) && wert > 0);
/**
 * Plattformen, deren Spiele meist ohne gedruckte Anleitung erschienen sind (PS4, PS5, Xbox One/Series, Switch): Dort wird die
 * Anleitung mit „gab es nicht“ vorbelegt – ein Spiel ohne Anleitung ist dort trotzdem vollständig (CIB).
 */
export function ohneAnleitungUeblich(plattform) {
  const text = typeof plattform === 'string' ? plattform : [plattform?.name, plattform?.kurz].filter(Boolean).join(' ');
  return /playstation\s*[45]\b|\bps[45]\b|xbox\s*(one|series)|\bswitch\b/i.test(text ?? '');
}
// Neuauflagen (Budget-Reihen) je Plattform mit ihren PAL-Namen – zur Auswahl „Fassung“ im Formular, auch wenn für das Spiel
// noch keine Varianten gepflegt sind (z. B. „F1 2014“ als Essentials). Reihenfolge: genaue Namen vor allgemeinen.
const NEUAUFLAGEN = [
  [/playstation\s*4|\bps4\b/i, ['PlayStation Hits']],
  [/playstation\s*3|\bps3\b/i, ['Platinum', 'Essentials']],
  [/playstation\s*2|\bps2\b/i, ['Platinum']],
  [/playstation portable|\bpsp\b/i, ['Platinum', 'Essentials']],
  [/vita/i, ['Essentials']],
  [/^playstation(\s*1)?$|\bps1\b|\bpsx\b|psone/i, ['Platinum']],
  [/xbox\s*360|\bx360\b/i, ['Classics']],
  [/^xbox$/i, ['Classics']],
  [/gamecube|\bngc\b/i, ["Player's Choice"]],
  [/wii\s*u/i, ['Nintendo Selects']],
  [/\bwii\b/i, ['Nintendo Selects']],
  [/3ds/i, ['Nintendo Selects']],
];
/** Übliche Neuauflagen einer Plattform (leer, wenn es keine gibt). */
export function neuauflagenFuer(plattform) {
  const name = String(typeof plattform === 'string' ? plattform : plattform?.name ?? '').trim();
  return NEUAUFLAGEN.find(([muster]) => muster.test(name))?.[1] ?? [];
}

/** „Gab es nicht“: z. B. viele PS4-/PS5-Spiele haben keine Anleitung – fehlt also nicht, zählt für CIB wie vorhanden. */
export const BEILAGE_OHNE = 'ohne';
export const beilageOhne = (wert) => wert === BEILAGE_OHNE;
export function beilageText(label, wert) {
  if (beilageOhne(wert)) return `– ${label} (nicht beigelegt)`;
  if (!beilageVorhanden(wert)) return `✗ ${label}`;
  return `✓ ${Number.isInteger(wert) && wert > 1 ? `${wert}× ` : ''}${label}`;
}
/**
 * Vollständigkeit und Beilagen-Liste hängen zusammen (OVP + Anleitung = CIB …): aus dem einen das andere vorbelegen.
 * Andere Beilagen (Poster, Werbebeilagen …) bleiben unverändert.
 */
export function beilagenAusVollstaendigkeit(vollstaendigkeit, beilagen, plattform = null) {
  // Plattformen ohne Anleitung (PS4, Switch …): CIB heißt dort OVP ohne Anleitung – nicht „Anleitung vorhanden“
  // Disc-Spiele (PS4, PS2, GameCube …): Zu CIB gehört auch das Inlay (Cover-Einleger hinter der Folie)
  const cib = { ovp: true, anleitung: ohneAnleitungUeblich(plattform) ? BEILAGE_OHNE : true, ...(plattform && datentraegerVon(plattform) === 'disc' ? { inlay: true } : {}) };
  const setzen = { cib, nur_geraet: { ovp: false, anleitung: false }, mit_huelle: { ovp: false, inlay: true }, nur_ovp: { ovp: true }, fehlt_anleitung: { ovp: true, anleitung: false }, fehlt_inlay: { ovp: true, inlay: false } }[vollstaendigkeit];
  if (!setzen) return beilagen ?? null;
  const neu = { ...(beilagen ?? {}) };
  // Eine schon eingetragene Anzahl (z. B. 2 Anleitungen) bleibt, wenn „vorhanden“ verlangt ist – ebenso „gab es nicht“
  for (const [k, w] of Object.entries(setzen)) if (!((w === true || beilageOhne(w)) && (beilageVorhanden(neu[k]) || beilageOhne(neu[k])))) neu[k] = w;
  return neu;
}
/**
 * Aus OVP und Anleitung die Vollständigkeit ableiten – null, wenn sich nichts sicher sagen lässt. `bisher`: die gewählte
 * Vollständigkeit – „Nur OVP“ (leere Hülle, ohne Disc/Modul) bleibt, solange die OVP angehakt ist, auch wenn alle Beilagen da sind.
 */
export function vollstaendigkeitAusBeilagen(beilagen, bisher = null) {
  if (!beilagen || typeof beilagen !== 'object') return null;
  if (bisher === 'nur_ovp' && beilageVorhanden(beilagen.ovp)) return 'nur_ovp';
  const ovp = beilagen.ovp;
  const anleitung = beilagen.anleitung;
  // Inlay (Cover-Einleger) ausdrücklich „fehlt“ → nicht komplett
  if (beilageVorhanden(ovp) && beilagen.inlay === false) return 'fehlt_inlay';
  // Keine Anleitung beigelegt (gab es nicht) → trotzdem komplett
  if (beilageVorhanden(ovp) && (beilageVorhanden(anleitung) || beilageOhne(anleitung))) return 'cib';
  if (beilageVorhanden(ovp) && anleitung === false) return 'fehlt_anleitung';
  if (ovp === false) return beilageVorhanden(beilagen.inlay) ? 'mit_huelle' : 'nur_geraet';
  return null;
}

// ── Lieferumfang je Ausgabe (Variante) ───────────────────────────────────────────────
// Sonderausgaben (Special/Collector's Edition) haben einen festen Lieferumfang, z. B. { zweite_disc: 1, artbook: 1, schuber: 1, steelbook: 1, code: 1 }.
// Schlüssel sind die der Beilagen-Checkliste (ohne Hülle, Anleitung und Inlay – die gehören zu jedem Spiel), Werte die Anzahl.
// Bei „zweite_disc“ bedeutet die Zahl die zusätzlichen Discs (1 = zwei Discs insgesamt).
const LIEFERUMFANG_POSTEN = [
  ['steelbook', 'Steelbook', 'Steelbook'], ['artbook', 'Artbook', 'Artbook'], ['schuber', 'Schuber', 'Schuber / Sammlerbox'],
  ['zweite_disc', 'Zweite Disc', 'Zweite Disc / Data Disc'], ['code', 'DLC-Code', 'unbenutzter Download-/DLC-Code'],
  ['soundtrack', 'Soundtrack', 'Soundtrack'], ['figur', 'Figur', 'Figur / Statue'], ['poster', 'Poster', 'Poster / Karte'],
  ['registrierkarte', 'Registrierkarte', 'Registrierkarte'], ['beilagen', 'Beilagen', 'Beilagen (Kataloge, Werbung, Sicherheitshinweise)'], ['extras', 'Extras', 'Sticker, Pins & weitere Extras'],
];
export const LIEFERUMFANG_SCHLUESSEL = LIEFERUMFANG_POSTEN.map(([k]) => k);

/** Lieferumfang prüfen: { schluessel: Anzahl } mit bekannten Schlüsseln und Anzahlen von 1 bis 9 (true = 1); leer → null. */
export function normalisiereLieferumfang(roh) {
  let objekt = roh;
  if (typeof roh === 'string') { try { objekt = JSON.parse(roh); } catch { return null; } }
  if (!objekt || typeof objekt !== 'object' || Array.isArray(objekt)) return null;
  const ergebnis = {};
  for (const k of LIEFERUMFANG_SCHLUESSEL) {
    const w = objekt[k];
    if (w === true) ergebnis[k] = 1;
    else if (Number.isInteger(w) && w >= 1 && w <= 9) ergebnis[k] = w;
  }
  return Object.keys(ergebnis).length ? ergebnis : null;
}

/** Posten des Lieferumfangs in fester Reihenfolge: [{ schluessel, anzahl, text, name }] – „2 Discs“, „DLC-Code“, „2× Poster“. */
export function lieferumfangPosten(lieferumfang) {
  const lu = normalisiereLieferumfang(lieferumfang);
  if (!lu) return [];
  return LIEFERUMFANG_POSTEN.filter(([k]) => k in lu).map(([k, name, label]) => {
    const anzahl = lu[k];
    const text = k === 'zweite_disc' ? `${anzahl + 1} Discs` : anzahl > 1 ? `${anzahl}× ${name}` : name;
    return { schluessel: k, anzahl, text, name, label };
  });
}

/** „Steelbook, Artbook, Schuber, 2 Discs, DLC-Code“ (leer ohne Lieferumfang). */
export const lieferumfangText = (lieferumfang) => lieferumfangPosten(lieferumfang).map((p) => p.text).join(', ');

const anzahlVorhanden = (w) => (w === true ? 1 : Number.isInteger(w) && w > 0 ? w : 0);

/**
 * Stand eines Exemplars gegenüber dem Lieferumfang seiner Ausgabe.
 *  - fehlt: Bestandteile, die ausdrücklich fehlen (✗, „gab es nicht“ oder zu wenige) – auch OVP und Anleitung
 *  - offen: Bestandteile des Lieferumfangs, zu denen in der Checkliste noch nichts steht
 *  - cib:   OVP, Anleitung (oder „gab es nicht“) und der ganze Lieferumfang sind vorhanden
 *  - text:  „Vollständig (CIB)“, „Unvollständig – Artbook fehlt“ oder null, wenn sich nichts sicher sagen lässt
 * Ohne Lieferumfang (null) gilt die bisherige Logik: OVP + Anleitung.
 */
export function lieferumfangStand(beilagen, lieferumfang = null) {
  const posten = lieferumfangPosten(lieferumfang);
  const b = beilagen && typeof beilagen === 'object' ? beilagen : {};
  const fehlt = [];
  const offen = [];
  if (b.ovp === false) fehlt.push({ schluessel: 'ovp', text: 'OVP' });
  if (b.anleitung === false) fehlt.push({ schluessel: 'anleitung', text: 'Anleitung' });
  for (const p of posten) {
    const w = b[p.schluessel];
    if (w === undefined) { offen.push(p); continue; }
    const hat = anzahlVorhanden(w);
    // zweite_disc: „vorhanden“ (true) deckt eine zusätzliche Disc ab
    if (hat < p.anzahl) fehlt.push({ schluessel: p.schluessel, text: p.schluessel === 'code' ? 'unbenutzter DLC-Code' : p.schluessel === 'zweite_disc' ? 'Zweite Disc' : p.text });
  }
  const grundlage = beilageVorhanden(b.ovp) && (beilageVorhanden(b.anleitung) || beilageOhne(b.anleitung));
  const cib = grundlage && !fehlt.length && !offen.length;
  let text = null;
  if (cib) text = 'Vollständig (CIB)';
  else if (fehlt.length) text = `Unvollständig – ${fehlt.map((f) => f.text).join(', ')} ${fehlt.length === 1 ? 'fehlt' : 'fehlen'}`;
  return { cib, fehlt, offen, text, mitLieferumfang: posten.length > 0 };
}

/**
 * Hat das Exemplar Beilagen außer Hülle/OVP und Anleitung? Dann lohnt ein Foto „Beilagen (Inhalt)“.
 * Inlay/Schutzhülle zählt nicht: Das Inlay ist das Cover (steckt schon in „Verpackung vorne/hinten“).
 */
// Das Steelbook hat eine eigene Fotoart – dafür kein Foto „Beilagen“ verlangen
const KEINE_EXTRA_BEILAGE = ['ovp', 'anleitung', 'inlay', 'steelbook'];
export const hatExtraBeilagen = (beilagen) => Boolean(beilagen && typeof beilagen === 'object'
  && Object.entries(beilagen).some(([k, w]) => !KEINE_EXTRA_BEILAGE.includes(k) && beilageVorhanden(w)));

/** Seriennummern vergleichen (ohne Leerzeichen, Bindestriche, Groß-/Kleinschreibung): true, false oder null (nicht beide angegeben). */
export function seriennummerPasst(geraet, ovp) {
  const norm = (s) => String(s ?? '').replace(/[\s\-_.]/g, '').toUpperCase();
  if (!norm(geraet) || !norm(ovp)) return null;
  return norm(geraet) === norm(ovp);
}

export const ALLE_WERTE = {
  spielstatus: SPIELSTATUS.map((e) => e.value),
  digital_quelle: DIGITAL_QUELLEN.map((e) => e.value),
  bestand: BESTAND.map((e) => e.value),
  herkunft: HERKUNFT.map((e) => e.value),
  typ: ARTIKELTYPEN.map((e) => e.value),
  merch_kategorie: MERCH_KATEGORIEN.map((e) => e.value),
  zustand: ZUSTAENDE.map((e) => e.value),
  zustand_ovp: ZUSTAENDE.map((e) => e.value),
  zustand_inlay: ZUSTAENDE.map((e) => e.value),
  kauf_quelle: KAUFQUELLEN.map((e) => e.value),
  vollstaendigkeit: VOLLSTAENDIGKEITEN.map((e) => e.value),
  region: REGIONEN.map((e) => e.value),
  pruefstatus: ['privat', 'eingereicht', 'freigegeben', 'abgelehnt'],
  rolle: ['nutzer', 'moderator', 'admin'],
};

/** Darf diese Rolle moderieren (Katalog freigeben, Scans prüfen, Kauflinks pflegen)? */
export const istModerator = (benutzer) => ['admin', 'moderator'].includes(benutzer?.rolle);

/** Liefert die Beschriftung zu einem gespeicherten Wert (oder den Wert selbst). */
export function beschriftung(liste, wert, feld = 'label') {
  const eintrag = liste.find((e) => e.value === wert);
  return eintrag ? eintrag[feld] ?? eintrag.label : wert ?? '';
}

// Arten von Scans und Dokumenten, die an einen Katalogeintrag (z. B. ein Spiel) angehängt werden können.
// Scans (Cover, Handbuch …) sind 1:1-Abbildungen geschützter Werke – nie öffentlich. Fotos (foto: true) zeigen den Gegenstand
// selbst; mit Einwilligung des Fotografen dürfen sie nach Prüfung öffentlich gezeigt werden. `slug` erscheint im Dateinamen.
export const MEDIENARTEN = [
  { value: 'cover_vorne', label: 'Cover vorne' },
  { value: 'cover_hinten', label: 'Cover hinten' },
  { value: 'cover_komplett', label: 'Cover komplett (Inlay)' },
  { value: 'handbuch', label: 'Handbuch / Anleitung' },
  { value: 'label', label: 'Modul-/Disc-Label' },
  { value: 'sonstiges', label: 'Sonstiges' },
  { value: 'foto_modul', label: 'Foto: Modul / Spielkarte', kurz: 'Modul', slug: 'modul', foto: true },
  { value: 'foto_disc', label: 'Foto: Disc', kurz: 'Disc', slug: 'disc', foto: true },
  { value: 'foto_diskette', label: 'Foto: Diskette / Kassette', kurz: 'Diskette', slug: 'diskette', foto: true },
  { value: 'foto_vorne', label: 'Foto: Verpackung vorne', kurz: 'Verpackung vorne', slug: 'verpackung-vorne', foto: true },
  { value: 'foto_hinten', label: 'Foto: Verpackung hinten', kurz: 'Verpackung hinten', slug: 'verpackung-hinten', foto: true },
  { value: 'foto_anleitung', label: 'Foto: Anleitung', kurz: 'Anleitung', slug: 'anleitung', foto: true },
  { value: 'foto_komplett', label: 'Foto: Alles zusammen (Hülle, Disc, Anleitung)', kurz: 'Alles zusammen (CIB)', slug: 'komplett-cib', foto: true },
  { value: 'foto_beilagen', label: 'Foto: Beilagen (was drin ist)', kurz: 'Beilagen', slug: 'beilagen', foto: true },
  { value: 'foto_steelbook', label: 'Foto: Steelbook', kurz: 'Steelbook', slug: 'steelbook', foto: true },
  { value: 'foto_geraet', label: 'Foto: Gerät', kurz: 'Gerät', slug: 'geraet', foto: true },
  { value: 'foto_figur', label: 'Foto: Figur / Artikel selbst', kurz: 'Figur', slug: 'figur', foto: true },
  { value: 'foto_karte_vorne', label: 'Foto: Karte vorne', kurz: 'Karte vorne', slug: 'karte-vorne', foto: true },
  { value: 'foto_karte_hinten', label: 'Foto: Karte Rückseite', kurz: 'Karte Rückseite', slug: 'karte-hinten', foto: true },
  { value: 'foto_detail', label: 'Foto: Detail (Typenschild, Anschlüsse …)', kurz: 'Detail', slug: 'detail', foto: true },
];
/** Fotoarten, bei denen Freistellen sinnvoll ist: der Gegenstand selbst, nicht Beilagen, Anleitungen oder Details. */
export const FREISTELL_ARTEN = ['foto_figur', 'foto_karte_vorne', 'foto_karte_hinten', 'foto_modul', 'foto_disc', 'foto_diskette',
  'foto_geraet', 'foto_vorne', 'foto_hinten', 'foto_komplett'];

export const istFotoArt = (art) => Boolean(MEDIENARTEN.find((a) => a.value === art)?.foto);

// Datenträger der Spiele je Plattform (Kurzname) – bestimmt, welches Foto gesucht wird (Modul bei N64, Disc bei der PlayStation)
const DATENTRAEGER = {
  modul: ['NES', 'SNES', 'N64', 'Switch', 'Switch 2', 'GB', 'GBC', 'GBA', 'DS', '3DS', 'VB', 'Vita', 'SMS', 'MD', '32X', 'GG', '2600', '7800', 'Jaguar', 'Lynx', 'NeoGeo', 'PCE'],
  disc: ['GC', 'Wii', 'Wii U', 'PS1', 'PS2', 'PS3', 'PS4', 'PS5', 'PSP', 'Xbox', 'X360', 'XOne', 'XSX', 'MCD', 'Saturn', 'DC', 'PC'],
  diskette: ['C64', 'Amiga'],
};
/** 'modul' | 'disc' | 'diskette' | null – aus dem Kurznamen, für unbekannte Plattformen aus dem Namen geraten. */
export function datentraegerVon(plattform) {
  const kurz = typeof plattform === 'string' ? plattform : plattform?.kurz;
  const name = typeof plattform === 'string' ? plattform : plattform?.name ?? '';
  for (const [art, liste] of Object.entries(DATENTRAEGER)) if (kurz && liste.includes(kurz)) return art;
  if (/playstation|xbox|saturn|dreamcast|gamecube|wii|mega-?cd|sega cd|\bcd\b/i.test(name)) return 'disc';
  if (/game ?boy|nintendo (64|ds|3ds|switch)|nes\b|famicom|mega drive|genesis|master system|game gear|atari|lynx|jaguar|wonderswan|neo ?geo pocket/i.test(name)) return 'modul';
  return null;
}

/**
 * Welche Fotos wünschen wir uns zu einem Eintrag? (Reihenfolge = Wichtigkeit)
 * Für ein bestimmtes Exemplar: `versiegelt` (Zustand „Neu/OVP“) – dann nichts, wofür man es öffnen müsste;
 * `beilagen` (Beilagen-Liste des Exemplars) – mit Anleitung ein Foto der Anleitung, mit zusätzlichen Beilagen auch eins davon.
 * „Alles zusammen (CIB)“ wird nicht eigens gesucht – die Einzelfotos zeigen dasselbe (hochladen lässt es sich weiterhin).
 */
export function gesuchteFotos(typ, plattform = null, { versiegelt = false, beilagen = null, mitVerpackung = false, merchKategorie = null, nurVerpackung = false } = {}) {
  // Leere Verpackung bzw. „Nur OVP“: kein Datenträger, keine Figur, kein Gerät – nur die Verpackung (und was drin liegt)
  if (nurVerpackung) {
    if (typ !== 'spiel') return typ === 'merch' ? ['foto_vorne', 'foto_hinten'] : ['foto_vorne'];
    return ['foto_vorne', 'foto_hinten', ...(beilageVorhanden(beilagen?.anleitung) ? ['foto_anleitung'] : []),
      ...(hatExtraBeilagen(beilagen) ? ['foto_beilagen'] : []), ...(beilageVorhanden(beilagen?.steelbook) ? ['foto_steelbook'] : [])];
  }
  if (typ === 'spiel') {
    const traeger = datentraegerVon(plattform);
    if (versiegelt) return ['foto_vorne', 'foto_hinten'];
    return [...(traeger ? [`foto_${traeger}`] : []), 'foto_vorne', 'foto_hinten',
      ...(beilageVorhanden(beilagen?.anleitung) ? ['foto_anleitung'] : []), ...(hatExtraBeilagen(beilagen) ? ['foto_beilagen'] : []),
      ...(beilageVorhanden(beilagen?.steelbook) ? ['foto_steelbook'] : [])];
  }
  // Merch/Figuren: nach der Verpackung nur fragen, wenn es eine gibt (OVP geöffnet oder ungeöffnet) – lose Figuren haben keine
  if (typ === 'merch') {
    if (versiegelt) return ['foto_vorne', 'foto_hinten'];
    // Sammelkarten (z. B. amiibo-Karten): nur die Vorderseite – die Rückseite ist meist bei allen Karten gleich (Foto davon bleibt möglich).
    // Detailfotos sind bei Figuren freiwillig (möglich, aber nicht gesucht)
    const selbst = merchKategorie === 'karte' ? ['foto_karte_vorne'] : ['foto_figur'];
    return mitVerpackung ? [...selbst, 'foto_vorne', 'foto_hinten'] : selbst;
  }
  if (versiegelt) return ['foto_vorne'];
  if (typ === 'konsole') return ['foto_geraet', 'foto_vorne', 'foto_detail'];
  return ['foto_geraet', 'foto_vorne'];
}

// Freigabe-Status für Katalogeinträge, Varianten und Scans (Moderation)
export const PRUEFSTATUS = [
  { value: 'privat', label: 'Privat', beschreibung: 'Nur für dich sichtbar.' },
  { value: 'eingereicht', label: 'Zur Prüfung eingereicht', beschreibung: 'Wartet auf Freigabe durch das Moderationsteam.' },
  { value: 'freigegeben', label: 'Freigegeben', beschreibung: 'Für alle Benutzer sichtbar.' },
  { value: 'abgelehnt', label: 'Abgelehnt', beschreibung: 'Nicht freigegeben – bleibt privat.' },
  { value: 'ausgeblendet', label: 'Ausgeblendet', beschreibung: 'Von der Datenquelle entfernt – nur für das Moderationsteam sichtbar.' },
];

export const ROLLEN = [
  { value: 'nutzer', label: 'Nutzer' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Administrator' },
];

/** Pflichtangaben gewerblicher Anbieter (Anbieterkennzeichnung) und freiwillige Zusatzangaben. */

/** Kurzfassung der Nutzungsrechte an Katalogbeiträgen – angezeigt beim Einreichen (Einzelheiten: Nutzungsbedingungen). */
export const KATALOGBEITRAG_HINWEIS = 'Dein Beitrag wird Teil des gemeinsamen Katalogs: Er darf dauerhaft genutzt, verbessert und angezeigt werden '
  + 'und bleibt auch nach dem Löschen deines Kontos erhalten – ohne deinen Namen. Deine Sammlung selbst bleibt privat.';

/**
 * Trennt einen Ausgaben-Zusatz vom Spieltitel für die Anzeige: „Horizon Zero Dawn: Complete Edition“ →
 * { titel: 'Horizon Zero Dawn', ausgabe: 'Complete Edition' }. Der gespeicherte Titel bleibt unverändert.
 */
const AUSGABE_ZUSATZ = /^(.{3,}?)\s*[:–—-]\s*((?:the\s+)?(?:complete|game of the year|goty|definitive|ultimate|deluxe|gold|collector[’']?s|special|limited|day one|legendary|royal|premium|enhanced|anniversary|director[’']?s cut)(?:\s+(?:edition|version|ausgabe))?)\s*$/i;
export function titelUndAusgabe(titel) {
  const m = String(titel ?? '').match(AUSGABE_ZUSATZ);
  return m ? { titel: m[1].trim(), ausgabe: m[2].trim() } : { titel: titel ?? '', ausgabe: null };
}

/**
 * Anzeige der Figurenserie eines Exemplars bzw. Katalogeintrags: „Monster in my Pocket · Serie 1 · #4“ (leer ohne Serie).
 * Die Nummer bekommt das Präfix der Serie („#“, „W“ …).
 */
export function serienBezeichnung({ serie_name: name, serie_ueber_name: ueber, serie_praefix: praefix, serien_nummer: nummer } = {}) {
  if (!name) return '';
  const nr = nummer ? `${praefix ?? '#'}${nummer}` : null;
  return [ueber, name, nr].filter(Boolean).join(' · ');
}


/** Jugendschutz in Deutschland (am Katalogeintrag, gepflegt von der Moderation). */
export const JUGENDSCHUTZ = [
  { value: 'indiziert', label: 'Indiziert', erklaerung: 'Von der BzKJ (früher BPjM) in die Liste jugendgefährdender Medien aufgenommen – Verkauf nur an Erwachsene, keine Werbung.' },
  { value: 'beschlagnahmt', label: 'Beschlagnahmt', erklaerung: 'Gerichtlich beschlagnahmt (z. B. § 131 StGB) – in Deutschland nicht verkehrsfähig.' },
  { value: 'gestrichen', label: 'Vom Index gestrichen', erklaerung: 'War indiziert, wurde später aus der Liste gestrichen (Listenstreichung bzw. nach 25 Jahren).' },
];
/** Kurzer Text für die Anzeige, z. B. „Indiziert seit 1997“ oder „Vom Index gestrichen 2019 (indiziert 1997)“. */
export function jugendschutzText(e) {
  const art = JUGENDSCHUTZ.find((j) => j.value === e?.jugendschutz);
  if (!art) return null;
  if (art.value === 'gestrichen') return `${art.label}${e.jugendschutz_bis ? ` ${e.jugendschutz_bis}` : ''}${e.jugendschutz_seit ? ` (indiziert ${e.jugendschutz_seit})` : ''}`;
  return `${art.label}${e.jugendschutz_seit ? ` seit ${e.jugendschutz_seit}` : ''}`;
}

// Avatar: Symbol und Farbe zur Auswahl im Konto (ohne Upload); ein eigenes Bild ersetzt das Symbol.
// Ohne Auswahl: Anfangsbuchstabe auf einer Farbe, die sich aus der Benutzer-ID ergibt.
export const AVATAR_SYMBOLE = ['🎮', '👾', '🕹️', '🍄', '⭐', '👻', '🐉', '🗡️', '🛡️', '🏆', '💎', '🚀', '🤖', '🐱', '🦊', '🐸', '🔥', '⚡', '🎲', '🧩', '💾', '📼', '🪙', '❤️'];
export const AVATAR_FARBEN = [
  { name: 'Lila', hex: '#8b5cf6' }, { name: 'Blau', hex: '#3b82f6' }, { name: 'Türkis', hex: '#14b8a6' }, { name: 'Grün', hex: '#22c55e' },
  { name: 'Gelb', hex: '#eab308' }, { name: 'Orange', hex: '#f97316' }, { name: 'Rot', hex: '#ef4444' }, { name: 'Pink', hex: '#ec4899' },
  { name: 'Braun', hex: '#a16207' }, { name: 'Grau', hex: '#64748b' },
];
/** Avatar eines Benutzers für die Anzeige: Symbol, Farbe (Standard aus der ID) und Bildadresse (nur angemeldet abrufbar). */
export function avatarVon(b) {
  if (!b) return null;
  const farbe = AVATAR_FARBEN.some((f) => f.hex === b.avatar_farbe) ? b.avatar_farbe : AVATAR_FARBEN[Math.abs(Number(b.id) || 0) % AVATAR_FARBEN.length].hex;
  return {
    symbol: AVATAR_SYMBOLE.includes(b.avatar_symbol) ? b.avatar_symbol : null,
    farbe,
    url: b.avatar_datei ? `/api/dateien/${b.avatar_datei}` : null,
  };
}
