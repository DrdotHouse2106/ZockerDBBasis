// Gemeinsame Konstanten für Server und Client.
// Die Schlüssel (value) werden in der Datenbank gespeichert, die Beschriftungen
// (label) werden in der Oberfläche angezeigt. Schlüssel niemals umbenennen,
// sonst passen bestehende Datenbankeinträge nicht mehr.

export const ARTIKELTYPEN = [
  { value: 'spiel', label: 'Spiel', mehrzahl: 'Spiele', icon: '🎮' },
  { value: 'konsole', label: 'Konsole', mehrzahl: 'Konsolen', icon: '🕹️' },
  { value: 'zubehoer', label: 'Zubehör', mehrzahl: 'Zubehör', icon: '🔌' },
];

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
  { value: 'nur_ovp', label: 'Nur OVP', kurz: 'Nur OVP' },
  { value: 'fehlt_anleitung', label: 'Fehlt Anleitung', kurz: 'o. Anl.' },
];

export const REGIONEN = [
  { value: 'pal_de', label: 'PAL (DE / USK)', kurz: 'PAL-DE' },
  { value: 'pal_eu', label: 'PAL (EU)', kurz: 'PAL-EU' },
  { value: 'ntsc_u', label: 'NTSC-U', kurz: 'NTSC-U' },
  { value: 'ntsc_j', label: 'NTSC-J', kurz: 'NTSC-J' },
];

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
];

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
  : { traeger: 'Zustand Gerät', ovp: 'Zustand OVP' });

/** Felder des Formulars, die man im Konto ausblenden kann (bereits ausgefüllte bleiben sichtbar). */
export const AUSBLENDBARE_FELDER = [
  { value: 'region', label: 'Region' },
  { value: 'zustand_ovp', label: 'Zustand der Hülle / OVP' },
  { value: 'farbe', label: 'Farbe / Sonderfarbe' },
  { value: 'edition', label: 'Edition / Variante' },
  { value: 'modellnummer', label: 'Modellnummer' },
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
    { value: 'poster', label: 'Poster / Karte' },
    { value: 'registrierkarte', label: 'Registrierkarte' },
    { value: 'beilagen', label: 'Werbebeilagen / Kataloge' },
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
};

/**
 * Beilagen-Werte: true = vorhanden, false = fehlt, Zahl ≥ 2 = so viele Stück vorhanden (z. B. drei Werbebeilagen).
 * Als Text: „✓ Anleitung“, „✓ 3× Werbebeilagen / Kataloge“, „✗ Poster / Karte“.
 */
export const beilageVorhanden = (wert) => wert === true || (Number.isInteger(wert) && wert > 0);
export function beilageText(label, wert) {
  if (!beilageVorhanden(wert)) return `✗ ${label}`;
  return `✓ ${Number.isInteger(wert) && wert > 1 ? `${wert}× ` : ''}${label}`;
}
/**
 * Vollständigkeit und Beilagen-Liste hängen zusammen (OVP + Anleitung = CIB …): aus dem einen das andere vorbelegen.
 * Andere Beilagen (Poster, Werbebeilagen …) bleiben unverändert.
 */
export function beilagenAusVollstaendigkeit(vollstaendigkeit, beilagen) {
  const setzen = { cib: { ovp: true, anleitung: true }, nur_geraet: { ovp: false, anleitung: false }, nur_ovp: { ovp: true }, fehlt_anleitung: { ovp: true, anleitung: false } }[vollstaendigkeit];
  if (!setzen) return beilagen ?? null;
  const neu = { ...(beilagen ?? {}) };
  // Eine schon eingetragene Anzahl (z. B. 2 Anleitungen) bleibt, wenn „vorhanden“ verlangt ist
  for (const [k, w] of Object.entries(setzen)) if (!(w === true && beilageVorhanden(neu[k]))) neu[k] = w;
  return neu;
}
/** Aus OVP und Anleitung die Vollständigkeit ableiten – null, wenn sich nichts sicher sagen lässt. */
export function vollstaendigkeitAusBeilagen(beilagen) {
  if (!beilagen || typeof beilagen !== 'object') return null;
  const ovp = beilagen.ovp;
  const anleitung = beilagen.anleitung;
  if (beilageVorhanden(ovp) && beilageVorhanden(anleitung)) return 'cib';
  if (beilageVorhanden(ovp) && anleitung === false) return 'fehlt_anleitung';
  if (ovp === false) return 'nur_geraet';
  return null;
}

/** Hat das Exemplar Beilagen außer Hülle/OVP und Anleitung? Dann lohnt ein Foto „Beilagen (Inhalt)“. */
export const hatExtraBeilagen = (beilagen) => Boolean(beilagen && typeof beilagen === 'object'
  && Object.entries(beilagen).some(([k, w]) => !['ovp', 'anleitung'].includes(k) && beilageVorhanden(w)));

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
  zustand: ZUSTAENDE.map((e) => e.value),
  zustand_ovp: ZUSTAENDE.map((e) => e.value),
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
  { value: 'foto_geraet', label: 'Foto: Gerät', kurz: 'Gerät', slug: 'geraet', foto: true },
  { value: 'foto_detail', label: 'Foto: Detail (Typenschild, Anschlüsse …)', kurz: 'Detail', slug: 'detail', foto: true },
];
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
export function gesuchteFotos(typ, plattform = null, { versiegelt = false, beilagen = null } = {}) {
  if (typ === 'spiel') {
    const traeger = datentraegerVon(plattform);
    if (versiegelt) return ['foto_vorne', 'foto_hinten'];
    return [...(traeger ? [`foto_${traeger}`] : []), 'foto_vorne', 'foto_hinten',
      ...(beilageVorhanden(beilagen?.anleitung) ? ['foto_anleitung'] : []), ...(hatExtraBeilagen(beilagen) ? ['foto_beilagen'] : [])];
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
