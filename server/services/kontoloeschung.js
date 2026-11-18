// Konto löschen: Auf Wunsch bleiben die mit der Community geteilten (freigegebenen) Fotos erhalten – ohne Bezug zum Konto und
// ohne Namen. Danach: Für Einträge, die dadurch kein freigegebenes Foto mehr haben, werden Besitzer (die Foto-Nachfragen nicht
// abgeschaltet haben) einmal gefragt, ob sie eins beitragen, und das Moderationsteam bekommt einen anonymen Hinweis.
const FOTO = "art LIKE 'foto\\_%' ESCAPE '\\'";

export function erstelleKontoLoeschung(db, { dateien, benachrichtigungen }) {
  const geteilte = db.prepare(`SELECT COUNT(*) FROM medien WHERE benutzer_id = ? AND sichtbarkeit = 'freigegeben' AND ${FOTO}`).pluck();
  const ueberlassen = db.prepare(`UPDATE medien SET benutzer_id = NULL, name_nennen = 0
    WHERE benutzer_id = ? AND sichtbarkeit = 'freigegeben' AND ${FOTO}`);
  const eintraegeMitFotos = db.prepare(`SELECT DISTINCT katalog_id FROM medien WHERE benutzer_id = ? AND sichtbarkeit = 'freigegeben' AND ${FOTO}`).pluck();
  const nochFoto = db.prepare(`SELECT 1 FROM medien WHERE katalog_id = ? AND sichtbarkeit = 'freigegeben' AND ${FOTO} LIMIT 1`).pluck();
  const besitzer = db.prepare(`SELECT DISTINCT a.benutzer_id FROM artikel a JOIN benutzer b ON b.id = a.benutzer_id
    WHERE a.katalog_id = ? AND a.bestand = 'besitz' AND b.gesperrt = 0 AND b.fotos_nachfragen != 0`).pluck();
  const titelVon = db.prepare('SELECT titel FROM katalog WHERE id = ?').pluck();

  /** Anzahl der geteilten (freigegebenen) Fotos – für die Frage im Löschdialog. */
  const geteilteFotos = (benutzerId) => geteilte.get(benutzerId);

  /**
   * Konto samt Daten löschen. `fotosUeberlassen`: geteilte Fotos bleiben anonym erhalten (Einwilligung im Löschdialog).
   * Liefert { ueberlassen, entfernt, luecken }.
   */
  function loesche(benutzerId, { fotosUeberlassen = false } = {}) {
    let anzahlUeberlassen = 0;
    const betroffen = fotosUeberlassen ? [] : eintraegeMitFotos.all(benutzerId);
    const entfernt = fotosUeberlassen ? 0 : geteilte.get(benutzerId);
    if (fotosUeberlassen) anzahlUeberlassen = ueberlassen.run(benutzerId).changes;
    dateien.loescheBenutzerdaten(benutzerId);
    const luecken = betroffen.filter((k) => !nochFoto.get(k));
    if (luecken.length) {
      // Besitzer der betroffenen Einträge: eine gesammelte Meldung am Tag
      const jeBesitzer = new Map();
      for (const k of luecken) for (const b of besitzer.all(k)) jeBesitzer.set(b, [...(jeBesitzer.get(b) ?? []), k]);
      for (const [b, eintraege] of jeBesitzer) {
        for (const k of eintraege) {
          benachrichtigungen?.sendeGesammelt(b, {
            art: 'sammlung', schluessel: 'fotos-luecke',
            titel: (n) => (n === 1 ? `„${titelVon.get(k)}“ braucht ein neues Foto` : `${n} Einträge deiner Sammlung brauchen neue Fotos`),
            text: () => 'Ein Sammler hat sein Konto gelöscht, seine Fotos sind weg. Magst du von deinem Exemplar ein Foto beitragen?',
            link: `#/katalog/${k}`, linkMehrere: '#/sammlung',
          });
        }
      }
    }
    if (entfernt > 0 || anzahlUeberlassen > 0) {
      const moderatoren = db.prepare("SELECT id FROM benutzer WHERE rolle IN ('admin', 'moderator') AND gesperrt = 0").pluck().all();
      for (const m of moderatoren) {
        benachrichtigungen?.sende(m, {
          art: 'moderation',
          titel: anzahlUeberlassen
            ? `Gelöschtes Konto: ${anzahlUeberlassen} Fotos der Community überlassen`
            : `Gelöschtes Konto: ${entfernt} geteilte Fotos entfernt`,
          text: anzahlUeberlassen
            ? 'Die Fotos bleiben ohne Namen sichtbar.'
            : `${luecken.length} ${luecken.length === 1 ? 'Eintrag hat' : 'Einträge haben'} jetzt kein freigegebenes Foto mehr; Besitzer wurden gefragt, ob sie eins beitragen.`,
          link: null,
        });
      }
    }
    return { ueberlassen: anzahlUeberlassen, entfernt, luecken: luecken.length };
  }

  return { geteilteFotos, loesche };
}
