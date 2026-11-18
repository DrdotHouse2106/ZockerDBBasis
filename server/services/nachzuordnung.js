// Nachträgliche Katalog-Zuordnung für Exemplare ohne Katalogtreffer (z. B. nach einem Import aus CLZ Games):
// läuft im Hintergrund (kein Zeitlimit der Anfrage), Fortschritt abrufbar, am Ende eine Benachrichtigung.
// Abgleich je Exemplar:
//  1. Katalog durchsuchen (wortweise, fehlertolerant) – Treffer zählt nur mit gleichem Titel nach Vereinheitlichung
//     (Groß/klein, Akzente, Apostrophe, Satzzeichen, römische Zahlen, „The“, „Disney's“, „Version“, „Edition“)
//     und, falls am Exemplar gesetzt, gleicher Plattform.
//  2. Nichts gefunden: online nachsehen (IGDB bzw. zockerdb.de) – die Treffer landen im Katalog – und erneut abgleichen.
//  3. Mehrere gleichwertige Treffer: Hauptspiele vor Bundles/DLCs; bleibt es mehrdeutig, wird nichts zugeordnet.
// Private Platzhalter-Einträge (automatisch angelegt, weil ein Exemplar einen Katalogeintrag braucht) werden ersetzt und gelöscht.
import { NEBENTYPEN } from './katalog.js';
import { suchWoerter } from './suchwoerter.js';

const ROEMISCH = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };
const FUELLWOERTER = new Set(['the', 'a', 'version', 'edition', 'disney', 'disneys']);
// Online-Abfragen je Lauf begrenzen (IGDB erlaubt nur wenige Anfragen je Sekunde)
const MAX_ONLINE = 1500;
const PAUSE_ONLINE_MS = 250;

/** Titel vereinheitlichen: „Disney's Treasure Planet“ = „Treasure Planet“, „Pokémon Platinum Version“ = „Pokemon Platinum“, „GTA III“ = „GTA 3“. */
export function titelSchluessel(titel) {
  return String(titel ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/['’`´]/g, '').replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().split(' ').filter(Boolean)
    .map((w) => ROEMISCH[w] ?? w)
    .filter((w) => !FUELLWOERTER.has(w))
    .join(' ');
}

export function erstelleNachzuordnung(db, { katalog, benachrichtigungen = null, erweiterungen = null, onlineMoeglich = () => false, pause = PAUSE_ONLINE_MS }) {
  const q = {
    offen: db.prepare(`SELECT a.id, a.titel, a.typ, a.plattform_id, a.katalog_id FROM artikel a LEFT JOIN katalog k ON k.id = a.katalog_id
      WHERE a.benutzer_id = @benutzer AND a.typ IN ('spiel', 'konsole')
        AND (a.katalog_id IS NULL OR (k.quelle = 'eigen' AND k.status = 'privat' AND k.erstellt_von = @benutzer))
        AND (@alle = 1 OR a.katalog_abgleich_am IS NULL)
      ORDER BY a.id`),
    plattform: db.prepare('SELECT 1 FROM katalog_plattformen WHERE katalog_id = ? AND plattform_id = ?'),
    sammler: db.prepare('SELECT COUNT(DISTINCT benutzer_id) FROM artikel WHERE katalog_id = ?').pluck(),
    verknuepfe: db.prepare("UPDATE artikel SET katalog_id = ?, katalog_abgleich_am = datetime('now') WHERE id = ?"),
    versucht: db.prepare("UPDATE artikel SET katalog_abgleich_am = datetime('now') WHERE id = ?"),
  };
  const laeufe = new Map(); // benutzerId → { laeuft, gesamt, erledigt, verknuepft, online, versprechen }

  /** Bester eindeutiger Treffer im Katalog (oder null). */
  function passend(artikel, benutzer) {
    const schluessel = titelSchluessel(artikel.titel);
    if (!schluessel) return null;
    // Gesucht wird ohne Füllwörter – die Suche verlangt jedes Wort („Disney's Treasure Planet“ fände sonst „Treasure Planet“ nicht)
    const suchtext = suchWoerter(artikel.titel).filter((w) => !FUELLWOERTER.has(w)).join(' ') || artikel.titel;
    const kandidaten = katalog.sucheLokal(suchtext, artikel.typ, benutzer)
      .filter((k) => k.id !== artikel.katalog_id && !(k.quelle === 'eigen' && k.status === 'privat'))
      .filter((k) => [k.titel, k.titel_original, ...(k.weitere_titel ?? [])].some((t) => t && titelSchluessel(t) === schluessel))
      .filter((k) => !artikel.plattform_id || q.plattform.get(k.id, artikel.plattform_id));
    if (kandidaten.length <= 1) return kandidaten[0] ?? null;
    const haupt = kandidaten.filter((k) => !NEBENTYPEN.includes(k.spieltyp ?? ''));
    if (haupt.length === 1) return haupt[0];
    // Mehrdeutig: nur zuordnen, wenn genau ein Eintrag schon von anderen Sammlern genutzt wird
    const genutzt = (haupt.length ? haupt : kandidaten).filter((k) => q.sammler.get(k.id) > 0);
    return genutzt.length === 1 ? genutzt[0] : null;
  }

  async function lauf(benutzer, ids, stand) {
    const warte = () => new Promise((r) => setTimeout(r, pause));
    for (const artikel of ids) {
      // Nach jedem Exemplar freigeben, damit andere Anfragen nicht warten müssen
      await new Promise((r) => setImmediate(r));
      try {
        let treffer = passend(artikel, benutzer);
        if (!treffer && stand.online < MAX_ONLINE && onlineMoeglich()) {
          stand.online += 1;
          await katalog.suche(artikel.titel, artikel.typ, benutzer, { online: true }).catch(() => null);
          treffer = passend(artikel, benutzer);
          if (pause) await warte();
        }
        if (treffer) {
          const alt = artikel.katalog_id;
          q.verknuepfe.run(treffer.id, artikel.id);
          if (alt) katalog.loescheUngenutztenEigenen(alt, benutzer.id);
          stand.verknuepft += 1;
        } else q.versucht.run(artikel.id);
      } catch (fehler) {
        console.warn('[nachzuordnung]', fehler.message);
        q.versucht.run(artikel.id);
      }
      stand.erledigt += 1;
    }
    stand.laeuft = false;
    stand.fertig_am = new Date().toISOString();
    erweiterungen?.melde('benutzer.geaendert', benutzer.id);
    if (stand.gesamt >= 10 || stand.verknuepft) {
      benachrichtigungen?.sende(benutzer.id, {
        art: 'sammlung', titel: `Katalog-Zuordnung fertig: ${stand.verknuepft} von ${stand.gesamt} zugeordnet`,
        text: stand.gesamt > stand.verknuepft ? `${stand.gesamt - stand.verknuepft} haben noch keinen eindeutigen Treffer – unter „Spiele zuordnen“ findest du Vorschläge.` : 'Alle haben jetzt einen Katalogeintrag mit Cover und Angaben.',
        link: stand.gesamt > stand.verknuepft ? '#/zuordnen' : '#/sammlung',
      });
    }
  }

  /**
   * Seite „Spiele zuordnen“: offene Exemplare mit bis zu vier Vorschlägen aus dem Katalog (passende Plattform zuerst,
   * dann die meisten gemeinsamen Wörter) – hier entscheidet der Sammler selbst.
   */
  const qListe = db.prepare(`SELECT a.id, a.titel, a.typ, a.plattform, a.plattform_id, a.katalog_id, a.barcode FROM artikel a LEFT JOIN katalog k ON k.id = a.katalog_id
    WHERE a.benutzer_id = @benutzer AND a.typ IN ('spiel', 'konsole')
      AND (a.katalog_id IS NULL OR (k.quelle = 'eigen' AND k.status = 'privat' AND k.erstellt_von = @benutzer))
    ORDER BY a.titel COLLATE NOCASE, a.id LIMIT @limit OFFSET @offset`);
  const qAnzahl = db.prepare(`SELECT COUNT(*) FROM artikel a LEFT JOIN katalog k ON k.id = a.katalog_id
    WHERE a.benutzer_id = ? AND a.typ IN ('spiel', 'konsole')
      AND (a.katalog_id IS NULL OR (k.quelle = 'eigen' AND k.status = 'privat' AND k.erstellt_von = ?))`).pluck();
  function liste(benutzer, { ab = 0, je = 20 } = {}) {
    const zeilen = qListe.all({ benutzer: benutzer.id, limit: je, offset: Math.max(0, ab) });
    return {
      gesamt: qAnzahl.get(benutzer.id, benutzer.id),
      eintraege: zeilen.map((a) => ({ artikel: { id: a.id, titel: a.titel, typ: a.typ, plattform: a.plattform, barcode: a.barcode }, vorschlaege: vorschlaegeFuer(a, benutzer) })),
    };
  }
  function vorschlaegeFuer(artikel, benutzer) {
    const woerter = new Set(suchWoerter(titelSchluessel(artikel.titel)));
    const suchtext = suchWoerter(artikel.titel).filter((w) => !FUELLWOERTER.has(w)).join(' ') || artikel.titel;
    // Erst alle Wörter; findet das nichts, die ersten zwei Wörter (z. B. Untertitel weicht ab), zuletzt das längste Wort
    const teile = suchtext.split(' ');
    const laengstes = [...teile].sort((a, b) => b.length - a.length)[0];
    let kandidaten = [];
    for (const versuch of [suchtext, teile.slice(0, 2).join(' '), laengstes?.length >= 4 ? laengstes : null]) {
      if (versuch && !kandidaten.length) kandidaten = katalog.sucheLokal(versuch, artikel.typ, benutzer);
    }
    return kandidaten
      .filter((k) => k.id !== artikel.katalog_id && !(k.quelle === 'eigen' && k.status === 'privat'))
      .map((k) => {
        const kw = suchWoerter(titelSchluessel(k.titel_original || k.titel));
        const gemeinsam = kw.filter((w) => woerter.has(w)).length / Math.max(woerter.size, kw.length, 1);
        const plattform = Boolean(artikel.plattform_id && q.plattform.get(k.id, artikel.plattform_id));
        return { k, wert: (plattform ? 1 : 0) + gemeinsam - (NEBENTYPEN.includes(k.spieltyp ?? '') ? 0.3 : 0), plattform };
      })
      .sort((a, b) => b.wert - a.wert)
      .slice(0, 4)
      .map(({ k, plattform }) => ({
        id: k.id, titel: k.titel, titel_original: k.titel_original, cover_url: k.cover_url, erscheinungsjahr: k.erscheinungsjahr,
        plattformen: k.plattformen, spieltyp: k.spieltyp, passende_plattform: plattform,
      }));
  }

  /** Zuordnung starten (läuft je Benutzer höchstens einmal gleichzeitig). `alle`: auch schon einmal vergeblich versuchte Exemplare. */
  function starte(benutzer, { alle = false } = {}) {
    const aktuell = laeufe.get(benutzer.id);
    if (aktuell?.laeuft) return oeffentlich(aktuell);
    const ids = q.offen.all({ benutzer: benutzer.id, alle: alle ? 1 : 0 });
    const stand = { laeuft: ids.length > 0, gesamt: ids.length, erledigt: 0, verknuepft: 0, online: 0, fertig_am: ids.length ? null : new Date().toISOString() };
    laeufe.set(benutzer.id, stand);
    if (ids.length) stand.versprechen = lauf(benutzer, ids, stand).catch((e) => { stand.laeuft = false; console.warn('[nachzuordnung]', e.message); });
    return oeffentlich(stand);
  }

  const oeffentlich = (s) => ({ laeuft: s.laeuft, gesamt: s.gesamt, erledigt: s.erledigt, verknuepft: s.verknuepft, fertig_am: s.fertig_am });
  const stand = (benutzerId) => {
    const s = laeufe.get(benutzerId);
    return s ? oeffentlich(s) : null;
  };
  /** Für Tests: auf das Ende des laufenden Durchgangs warten. */
  const warte = async (benutzerId) => { await laeufe.get(benutzerId)?.versprechen; return stand(benutzerId); };

  return { starte, stand, warte, passend, liste };
}
