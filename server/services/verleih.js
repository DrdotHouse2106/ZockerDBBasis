// Leihliste: Exemplare verleihen – an einen Namen (Freitext) oder an einen ZockerDB-Benutzer, der die Leihe bestätigt oder ablehnt
// und sie unter „Ausgeliehen von anderen“ sieht (nur Titel, Plattform und Verleiher, keine Preise). Verliehene Exemplare bleiben
// im Besitz und damit im Sammlungswert. Nach dem geplanten Rückgabetag erinnert die App den Verleiher (wöchentlich wiederholt).
import { ValidierungsFehler, leerZuNull } from './validierung.js';

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const heute = () => new Date().toISOString().slice(0, 10);
const name = (b) => b?.anzeigename || b?.benutzername || 'Jemand';

export function erstelleVerleihDienst(db, { benachrichtigungen }) {
  const aktiv = db.prepare('SELECT * FROM verleihungen WHERE artikel_id = ? AND zurueck_am IS NULL');
  const benutzer = db.prepare('SELECT id, benutzername, anzeigename, gesperrt FROM benutzer WHERE id = ?');
  const perName = db.prepare('SELECT id, benutzername, anzeigename, gesperrt FROM benutzer WHERE benutzername = ? COLLATE NOCASE');

  function verleihe(verleiher, artikel, eingabe = {}) {
    if (artikel.bestand !== 'besitz') throw new ValidierungsFehler({ an: 'Verleihen lassen sich nur Exemplare, die du besitzt.' });
    if (aktiv.get(artikel.id)) throw new ValidierungsFehler({ an: 'Dieses Exemplar ist bereits verliehen.' });
    const fehler = {};
    let an = null;
    const nutzername = leerZuNull(eingabe.an_benutzername)?.replace(/^@/, '');
    const anName = leerZuNull(eingabe.an_name);
    if (nutzername) {
      an = perName.get(nutzername);
      if (!an || an.gesperrt) fehler.an_benutzername = `Es gibt keinen Benutzer „${nutzername}“.`;
      else if (an.id === verleiher.id) fehler.an_benutzername = 'An dich selbst kannst du nichts verleihen.';
    } else if (!anName) fehler.an_name = 'Bitte angeben, an wen du es verleihst.';
    else if (anName.length > 100) fehler.an_name = 'Höchstens 100 Zeichen.';
    const seit = leerZuNull(eingabe.seit) ?? heute();
    if (!TAG.test(seit)) fehler.seit = 'Bitte ein gültiges Datum angeben.';
    const rueckgabe = leerZuNull(eingabe.rueckgabe);
    if (rueckgabe && (!TAG.test(rueckgabe) || rueckgabe < seit)) fehler.rueckgabe = 'Die Rückgabe muss nach dem Verleihdatum liegen.';
    const notiz = leerZuNull(eingabe.notiz);
    if (notiz && notiz.length > 500) fehler.notiz = 'Höchstens 500 Zeichen.';
    if (Object.keys(fehler).length) throw new ValidierungsFehler(fehler);

    const v = db.prepare(`INSERT INTO verleihungen (artikel_id, verleiher_id, an_name, an_benutzer_id, seit, rueckgabe_geplant, notiz, bestaetigung)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
      .get(artikel.id, verleiher.id, an ? name(an) : anName, an?.id ?? null, seit, rueckgabe, notiz, an ? 'offen' : null);
    if (an) {
      benachrichtigungen?.sende(an.id, {
        art: 'leihe', titel: `${name(benutzer.get(verleiher.id))} hat dir „${artikel.titel}“ geliehen`,
        text: `${rueckgabe ? `Geplante Rückgabe: ${rueckgabe.split('-').reverse().join('.')}. ` : ''}Bitte kurz bestätigen.`, link: '#/verliehen?ansicht=geliehen',
      });
    }
    return v;
  }

  /** Zurückbekommen (Verleiher) – bleibt als Verlauf erhalten. */
  function zurueck(verleiherId, verleihId) {
    const v = db.prepare(`UPDATE verleihungen SET zurueck_am = ? WHERE id = ? AND verleiher_id = ? AND zurueck_am IS NULL RETURNING *`)
      .get(heute(), Number(verleihId), verleiherId);
    if (!v) throw new ValidierungsFehler({ id: 'Diese Leihe gibt es nicht (mehr).' });
    return v;
  }

  /** Der Ausleihende bestätigt oder lehnt ab (z. B. versehentlich ausgewählt). */
  function antworte(ausleiher, verleihId, bestaetigen) {
    const v = db.prepare(`UPDATE verleihungen SET bestaetigung = ? WHERE id = ? AND an_benutzer_id = ? AND zurueck_am IS NULL RETURNING *`)
      .get(bestaetigen ? 'bestaetigt' : 'abgelehnt', Number(verleihId), ausleiher.id);
    if (!v) throw new ValidierungsFehler({ id: 'Diese Leihe gibt es nicht (mehr).' });
    const titel = db.prepare('SELECT titel FROM artikel WHERE id = ?').pluck().get(v.artikel_id);
    benachrichtigungen?.sende(v.verleiher_id, {
      art: 'leihe', titel: bestaetigen ? `${name(benutzer.get(ausleiher.id))} hat die Leihe bestätigt` : `${name(benutzer.get(ausleiher.id))} kennt die Leihe nicht`,
      text: `„${titel}“${bestaetigen ? '' : ' – bitte prüfe, an wen du es verliehen hast.'}`, link: `#/artikel/${v.artikel_id}`,
    });
    return v;
  }

  function uebersicht(benutzerId) {
    const verliehen = db.prepare(`SELECT v.*, a.titel, a.plattform, a.typ, a.bild_datei, a.cover_url, k.cover_url AS katalog_cover_url,
        v.rueckgabe_geplant IS NOT NULL AND v.rueckgabe_geplant < date('now') AND v.zurueck_am IS NULL AS ueberfaellig
      FROM verleihungen v JOIN artikel a ON a.id = v.artikel_id LEFT JOIN katalog k ON k.id = a.katalog_id
      WHERE v.verleiher_id = ? ORDER BY v.zurueck_am IS NOT NULL, v.seit DESC, v.id DESC LIMIT 300`).all(benutzerId);
    // Ausgeliehen von anderen: nur Titel, Plattform, Cover und Verleiher – keine Preise oder privaten Angaben
    const geliehen = db.prepare(`SELECT v.id, v.seit, v.rueckgabe_geplant, v.bestaetigung, a.titel, a.plattform, a.typ,
        k.cover_url AS katalog_cover_url, COALESCE(b.anzeigename, b.benutzername) AS verleiher
      FROM verleihungen v JOIN artikel a ON a.id = v.artikel_id LEFT JOIN katalog k ON k.id = a.katalog_id AND k.status = 'freigegeben'
      JOIN benutzer b ON b.id = v.verleiher_id
      WHERE v.an_benutzer_id = ? AND v.zurueck_am IS NULL AND COALESCE(v.bestaetigung, '') <> 'abgelehnt' ORDER BY v.seit DESC`).all(benutzerId);
    return {
      verliehen: verliehen.map((v) => ({ ...v, ueberfaellig: Boolean(v.ueberfaellig), bild_url: v.bild_datei ? `/api/dateien/${v.bild_datei}` : v.cover_url || v.katalog_cover_url || null })),
      geliehen: geliehen.map((v) => ({ ...v, bild_url: v.katalog_cover_url ?? null })),
    };
  }

  const verlauf = (artikelId) => db.prepare('SELECT * FROM verleihungen WHERE artikel_id = ? ORDER BY seit DESC, id DESC LIMIT 50').all(artikelId);

  /** Erinnerung an überfällige Rückgaben – je Leihe höchstens einmal pro Woche. */
  function erinnere() {
    const faellig = db.prepare(`SELECT v.*, a.titel FROM verleihungen v JOIN artikel a ON a.id = v.artikel_id
      WHERE v.zurueck_am IS NULL AND v.rueckgabe_geplant IS NOT NULL AND v.rueckgabe_geplant < date('now')
        AND (v.erinnert_am IS NULL OR v.erinnert_am <= date('now', '-7 days'))`).all();
    for (const v of faellig) {
      benachrichtigungen?.sende(v.verleiher_id, {
        art: 'leihe', titel: `Rückgabe überfällig: „${v.titel}“`,
        text: `Verliehen an ${v.an_name} seit ${v.seit.split('-').reverse().join('.')}, geplante Rückgabe ${v.rueckgabe_geplant.split('-').reverse().join('.')}.`,
        link: `#/artikel/${v.artikel_id}`,
      });
      db.prepare("UPDATE verleihungen SET erinnert_am = date('now') WHERE id = ?").run(v.id);
    }
    return faellig.length;
  }

  return { verleihe, zurueck, antworte, uebersicht, verlauf, erinnere, aktiv: (artikelId) => aktiv.get(artikelId) ?? null };
}
