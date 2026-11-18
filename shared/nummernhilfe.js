// Hilfe zu Modell- und Drucknummern je Plattform: passende Beispiele im Formular und ein Erklärtext („ⓘ“) – was die
// Buchstaben bedeuten und wo man die Nummer findet. Allgemein gehalten; Ausnahmen gibt es bei einzelnen Herausgebern.

const PS_REGION = 'Der dritte Buchstabe steht für den Markt: E = Europa (PAL), U = USA, P oder J = Japan. Der zweite: C = von Sony selbst, L = von einem anderen Herausgeber.';
const NINTENDO_REGION = 'Der Buchstabe nach dem Systemkürzel ist die Region: P = PAL (Europa), E = USA, J = Japan.';
const NINTENDO_SPRACHE = 'Der letzte Buchstabe der Spielkennung ist die Sprachfassung bzw. der Markt, z. B. D = deutsch, P = Europa (mehrsprachig), F = französisch, E = USA, J = Japan.';
const NINTENDO_ENDUNG = 'Die zweite Nummer endet auf das Vertriebsland der Verpackung: NOE = Deutschland/Österreich, UKV = Großbritannien, FAH = Frankreich, ESP = Spanien, ITA = Italien, HOL = Niederlande, EUR = Europa allgemein.';
const NINTENDO_WO = 'Steht unten auf der Rückseite der Hülle neben dem Barcode; die erste meist auch auf der Disc bzw. dem Modul. Trag am besten beide ein, mit Komma getrennt.';
const DRUCK_PS = { beispiel: 'z. B. 8826161', text: 'Kleine Nummer auf dem Cover-Rücken, meist unter der Produktnummer – unterscheidet Nachdrucke derselben Ausgabe.' };
const DRUCK_ALLGEMEIN = { beispiel: 'z. B. Nummer am Cover-Rücken', text: 'Kleine Druckerei-Nummer auf dem Cover oder der Anleitung (falls vorhanden) – unterscheidet Nachdrucke derselben Ausgabe.' };

function nintendo(kuerzel, name, beispiel, zweite, disc = 'Disc', mitRegion = disc === 'Disc') {
  return {
    beispiel: `z. B. ${beispiel}, ${zweite}`,
    titel: `Nummern bei ${name}`,
    punkte: [
      `${kuerzel} ist das Kürzel für ${name}. Beispiel: ${beispiel} ist die Produktnummer, ${zweite} dieselbe Kennung mit dem Vertriebsland.`,
      ...(mitRegion ? [NINTENDO_REGION] : []), NINTENDO_SPRACHE, NINTENDO_ENDUNG, NINTENDO_WO,
      'Nicht gemeint: „MODEL NO.: DOL-006(EUR)“ o. Ä. – das ist die Konsole, nicht das Spiel – und Artikelnummern der Herausgeber (z. B. EAD…).',
    ],
    druck: DRUCK_ALLGEMEIN,
  };
}

const PLATTFORMEN = [
  [/playstation\s*5|\bps5\b/i, () => ({ beispiel: 'z. B. PPSA-01234', titel: 'Nummern bei PlayStation 5', punkte: [
    'PPSA-… ist die Spielkennung der PS5; den Markt erkennt man nicht am Kürzel, sondern an der Nummer selbst.',
    'Steht unten auf der Rückseite der Hülle und auf der Disc. Mehrere Discs mit Komma trennen.'], druck: DRUCK_PS })],
  [/playstation\s*4|\bps4\b/i, () => ({ beispiel: 'z. B. CUSA-03067', titel: 'Nummern bei PlayStation 4', punkte: [
    'CUSA-… ist die Spielkennung der PS4; den Markt erkennt man nicht am Kürzel, sondern an der Nummer selbst (EU- und US-Fassung haben verschiedene Nummern).',
    'Steht unten auf der Rückseite der Hülle und auf der Disc. Mehrere Discs mit Komma trennen.'], druck: DRUCK_PS })],
  [/playstation\s*3|\bps3\b/i, () => ({ beispiel: 'z. B. BLES-00001, BCES-00001', titel: 'Nummern bei PlayStation 3', punkte: [
    'B = Blu-ray. ' + PS_REGION, 'NP… (z. B. NPEB) sind Download-Titel aus dem Store.',
    'Steht auf dem Cover-Rücken, unten auf der Rückseite und auf der Disc.'], druck: DRUCK_PS })],
  [/playstation\s*2|\bps2\b/i, () => ({ beispiel: 'z. B. SLES-52345, SCES-50000', titel: 'Nummern bei PlayStation 2', punkte: [
    'S = Spiel auf CD/DVD. ' + PS_REGION, 'Steht auf dem Cover-Rücken, unten auf der Rückseite und auf der Disc; mehrere Discs mit Komma trennen.'], druck: DRUCK_PS })],
  [/playstation portable|\bpsp\b/i, () => ({ beispiel: 'z. B. ULES-00001, UCES-00001', titel: 'Nummern bei PSP', punkte: [
    'U = UMD. ' + PS_REGION, 'Steht auf dem Cover-Rücken und auf der UMD.'], druck: DRUCK_PS })],
  [/vita/i, () => ({ beispiel: 'z. B. PCSB-00001, PCSF-00001', titel: 'Nummern bei PS Vita', punkte: [
    'PCS… ist die Kennung der Vita-Karte; B und F stehen für Europa, A und E für USA, G und C für Japan.', 'Steht auf der Rückseite der Hülle und auf der Karte.'], druck: DRUCK_PS })],
  [/^playstation(\s*1)?$|\bps1\b|\bpsx\b|psone/i, () => ({ beispiel: 'z. B. SLES-00972, SCES-00001', titel: 'Nummern bei PlayStation', punkte: [
    'S = Spiel auf CD. ' + PS_REGION, 'Steht auf dem Cover-Rücken, unten auf der Rückseite und auf der Disc; mehrere Discs mit Komma trennen.'], druck: DRUCK_PS })],
  [/xbox/i, (name) => ({ beispiel: 'z. B. X12-34567', titel: `Nummern bei ${name}`, punkte: [
    'Spiele von Microsoft tragen eine Teilenummer wie X12-34567; andere Herausgeber verwenden eigene Nummern.',
    'Steht klein auf dem Cover-Rücken oder unten auf der Rückseite, oft auch auf der Disc. Den Markt erkennt man an „PAL“ bzw. dem Altersaufkleber, nicht an der Nummer.'],
  druck: DRUCK_ALLGEMEIN })],
  [/gamecube|game cube|\bngc\b/i, () => nintendo('DOL', 'den GameCube', 'DOL-P-GNDD', 'DOL-GNDD-NOE')],
  [/wii\s*u/i, () => nintendo('WUP', 'die Wii U', 'WUP-P-AXFP', 'WUP-AXFP-EUR')],
  [/\bwii\b/i, () => nintendo('RVL', 'die Wii', 'RVL-P-RSBP', 'RVL-RSBP-NOE')],
  [/switch/i, () => nintendo('HAC', 'die Switch', 'HAC-P-AAAAA', 'HAC-AAAAA-EUR', 'Modul', true)],
  [/3ds/i, () => nintendo('CTR', 'den 3DS', 'CTR-P-AREP', 'CTR-AREP-NOE', 'Modul', true)],
  [/nintendo ds|\bnds\b|^ds$/i, () => nintendo('NTR', 'den DS', 'NTR-AMCP', 'NTR-AMCP-NOE', 'Modul')],
  [/game ?boy advance|\bgba\b/i, () => nintendo('AGB', 'den Game Boy Advance', 'AGB-AXVP', 'AGB-AXVP-NOE', 'Modul')],
  [/game ?boy colou?r|\bgbc\b/i, () => nintendo('CGB', 'den Game Boy Color', 'CGB-BXTP', 'CGB-BXTP-NOE', 'Modul')],
  [/game ?boy/i, () => nintendo('DMG', 'den Game Boy', 'DMG-ML', 'DMG-ML-NOE', 'Modul')],
  [/nintendo 64|\bn64\b/i, () => nintendo('NUS', 'das Nintendo 64', 'NUS-NSMP', 'NUS-NSMP-NOE', 'Modul')],
  [/super nintendo|\bsnes\b/i, () => nintendo('SNSP', 'das Super Nintendo (PAL)', 'SNSP-MW', 'SNSP-MW-NOE', 'Modul')],
  [/^nes$|nintendo entertainment system/i, () => nintendo('NES', 'das NES', 'NES-SM', 'NES-SM-NOE', 'Modul')],
];

/** Hilfe zu Modell- und Drucknummer für eine Plattform (Name) – mit allgemeinem Rückfall. */
export function nummernHilfe(plattform) {
  const name = String(typeof plattform === 'string' ? plattform : plattform?.name ?? '').trim();
  const treffer = name && PLATTFORMEN.find(([muster]) => muster.test(name));
  if (treffer) return treffer[1](name);
  return {
    beispiel: 'z. B. CUSA-03067, SLES-00972, DOL-P-GNDD', titel: 'Modellnummer',
    punkte: ['Die Produktnummer steht meist unten auf der Rückseite der Hülle neben dem Barcode und oft auch auf der Disc bzw. dem Modul.',
      'Wähle oben die Plattform – dann stehen hier passende Beispiele und was die Buchstaben bedeuten.'],
    druck: DRUCK_ALLGEMEIN,
  };
}

// Region aus der Produktnummer: Bei Nintendo verrät die Endung das Vertriebsland (…-NOE = Deutschland/Österreich), sonst der letzte
// Buchstabe der vierstelligen Spielkennung (…D = deutsch). Bei PlayStation zeigt das Kürzel nur den Markt (Europa, USA, Japan) –
// welches europäische Land, verrät erst das Alterskennzeichen. Der Barcode sagt dagegen nichts über den Markt.
const NINTENDO_ENDUNGEN = {
  NOE: 'pal_de', FRG: 'pal_de', GER: 'pal_de', UKV: 'pal_uk', FRA: 'pal_fr', FAH: 'pal_fr', HOL: 'pal_benelux', NLD: 'pal_benelux',
  ESP: 'pal_es', ITA: 'pal_it', SCN: 'pal_nordic', EUR: 'pal_eu', EUU: 'pal_eu', USA: 'ntsc_u', CAN: 'ntsc_u', JPN: 'ntsc_j',
};
const NINTENDO_SPRACHBUCHSTABE = { D: 'pal_de', F: 'pal_fr', S: 'pal_es', I: 'pal_it', H: 'pal_benelux', P: 'pal_eu', X: 'pal_eu', Y: 'pal_eu', E: 'ntsc_u', J: 'ntsc_j' };
const NINTENDO_KUERZEL = /^(NES|SNSP|SNS|SHVC|DMG|CGB|AGB|NUS|DOL|RVL|WUP|NTR|TWL|CTR|KTR|HAC)$/;
const EUROPA_TEXT = 'Europäische Fassung – welches Land, verrät das Alterskennzeichen (USK = Deutschland, nur PEGI = anderes Land).';

function regionEinerNummer(roh) {
  const teile = String(roh ?? '').toUpperCase().trim().split(/[\s-]+/).filter(Boolean);
  if (teile.length >= 2 && NINTENDO_KUERZEL.test(teile[0])) {
    const endung = teile[teile.length - 1];
    if (teile.length >= 3 && NINTENDO_ENDUNGEN[endung]) return { region: NINTENDO_ENDUNGEN[endung], grund: `Endung ${endung}` };
    const kennung = teile.find((t, i) => i > 0 && t.length === 4 && /^[A-Z0-9]{3}[A-Z]$/.test(t));
    const buchstabe = kennung?.slice(-1);
    if (buchstabe && NINTENDO_SPRACHBUCHSTABE[buchstabe]) return { region: NINTENDO_SPRACHBUCHSTABE[buchstabe], grund: `Spielkennung ${kennung}` };
    return null;
  }
  const kurz = teile.join('');
  // PlayStation 1–3, PSP: dritter Buchstabe = Markt; Vita: PCSB/PCSF = Europa, PCSA/PCSE = USA, PCSG/PCSC = Japan
  const ps = /^(S[LC]|B[LC]|U[LC])([EUJP])[A-Z]?\d{3,6}$/.exec(kurz);
  const vita = /^PCS([A-Z])\d{3,6}$/.exec(kurz);
  const markt = ps ? { E: 'eu', U: 'us', J: 'jp', P: 'jp' }[ps[2]] : vita ? { B: 'eu', F: 'eu', A: 'us', E: 'us', G: 'jp', C: 'jp' }[vita[1]] : null;
  if (markt === 'eu') return { region: null, europa: true, grund: kurz.slice(0, 4), hinweis: EUROPA_TEXT };
  if (markt === 'us') return { region: 'ntsc_u', grund: kurz.slice(0, 4) };
  if (markt === 'jp') return { region: 'ntsc_j', grund: kurz.slice(0, 4) };
  return null;
}

/**
 * Region aus einer oder mehreren Produktnummern (mit Komma getrennt) → { region, grund, hinweis? } oder null.
 * `region` ist null, wenn nur der Markt Europa feststeht (dann steht in `hinweis`, woran man das Land erkennt).
 * Die genaueste Angabe gewinnt (Land vor „Europa allgemein“).
 */
export function regionAusProduktnummer(text) {
  const treffer = String(text ?? '').split(/[,;/]/).map(regionEinerNummer).filter(Boolean);
  if (!treffer.length) return null;
  // Endung (Vertriebsland der Verpackung) vor Sprachbuchstaben, Land vor „Europa allgemein“
  const genau = (t) => t.region && t.region !== 'pal_eu';
  return treffer.find((t) => genau(t) && t.grund.startsWith('Endung')) ?? treffer.find(genau) ?? treffer.find((t) => t.region) ?? treffer[0];
}

/** Merkmale, an denen man die Region einer Verpackung erkennt – für die Hilfe am Regionsfeld. */
export const REGION_MERKMALE = [
  ['Alterskennzeichen', 'USK-Logo (farbiges Quadrat „USK ab …“) → PAL-DE. Nur PEGI und Rückseite in mehreren Sprachen → PAL-EU, in nur einer Sprache meist das jeweilige Land (nur Englisch → PAL-UK, nur Französisch → PAL-FR). ESRB (E, T, M) → NTSC-U. CERO → NTSC-J.'],
  ['Nintendo-Produktnummer', 'Die Endung zeigt das Vertriebsland: NOE/FRG = Deutschland/Österreich, UKV = UK, FRA/FAH = Frankreich, HOL = Niederlande, ESP = Spanien, ITA = Italien, SCN = Skandinavien, EUR = Europa allgemein, USA, JPN.'],
  ['PlayStation-Produktnummer', 'Der dritte Buchstabe zeigt nur den Markt: SLES/BLES/ULES = Europa, SLUS/BLUS = USA, SLPS/BLJM = Japan. Das europäische Land verrät das Alterskennzeichen.'],
  ['Barcode', 'Sagt nichts über die Region: Die ersten Ziffern zeigen, wo der Hersteller registriert ist. EA nutzt z. B. für ganz Europa britische Nummern (5030…).'],
];
