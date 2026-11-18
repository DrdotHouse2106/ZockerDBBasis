// Lieferumfang je Ausgabe (Variante eines Katalogeintrags): welche Beilagen zu einer Sonderausgabe gehören.
// Wer die Variante selbst angelegt hat (und sie noch nicht freigegeben ist) und das Moderationsteam tragen den Lieferumfang direkt ein,
// alle anderen schlagen ihn vor – optional mit Foto als Beleg. Das Moderationsteam bestätigt, ändert oder lehnt ab. Das Foto liegt nur
// bis zur Entscheidung auf dem Server (ohne Metadaten wie GPS) und wird danach gelöscht. Vorschläge der KI-Fotoprüfung kommen ohne Foto.
import crypto from 'node:crypto';
import { istModerator, normalisiereLieferumfang, lieferumfangText } from '../../shared/konstanten.js';
import { verarbeiteBild } from './medien.js';
import { KontoFehler } from './konten.js';
import { ValidierungsFehler } from './validierung.js';

export const LIEFERUMFANG_FOTO_PRAEFIX = 'lieferumfang-';
const MAX_OFFEN = 30;

const lies = (json) => { try { return json ? JSON.parse(json) : null; } catch { return null; } };

export function erstelleLieferumfangDienst(db, { dateien, benachrichtigungen }) {
  const variante = db.prepare('SELECT * FROM katalog_varianten WHERE id = ?');
  const offeneJeBenutzer = db.prepare("SELECT COUNT(*) FROM lieferumfang_vorschlaege WHERE benutzer_id = ? AND status = 'offen'").pluck();
  const eigeneOffene = db.prepare("SELECT id, foto FROM lieferumfang_vorschlaege WHERE variante_id = ? AND benutzer_id = ? AND status = 'offen'");
  const entferne = db.prepare('DELETE FROM lieferumfang_vorschlaege WHERE id = ?');

  async function speichereFoto(puffer) {
    const datei = `${LIEFERUMFANG_FOTO_PRAEFIX}${crypto.randomUUID()}.webp`;
    try {
      await verarbeiteBild(puffer, (b) => b.rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 })
        .toFile(dateien.pfadVon(datei)));
    } catch {
      dateien.loesche(datei);
      throw new ValidierungsFehler({ foto: 'Das Bild konnte nicht gelesen werden. Bitte ein Foto als JPG, PNG oder WebP wählen.' });
    }
    return datei;
  }

  /** Variante, die der Benutzer sehen darf (freigegeben, selbst angelegt oder Moderation) – sonst 404. */
  function sichtbareVariante(benutzer, id) {
    const v = variante.get(Number(id));
    if (!v || !(v.status === 'freigegeben' || v.erstellt_von === benutzer.id || istModerator(benutzer))) throw new KontoFehler('Variante nicht gefunden.', 404);
    return v;
  }

  /**
   * Lieferumfang eintragen oder vorschlagen. Liefert { gespeichert: true } (direkt übernommen), { vorgeschlagen: true } oder
   * { unveraendert: true }.
   */
  async function vorschlagen(benutzer, varianteId, { lieferumfang, begruendung } = {}, foto = null) {
    const lu = normalisiereLieferumfang(lieferumfang);
    if (!lu) throw new ValidierungsFehler({ lieferumfang: 'Bitte mindestens einen Bestandteil des Lieferumfangs wählen.' });
    const v = sichtbareVariante(benutzer, varianteId);
    const json = JSON.stringify(lu);
    if (istModerator(benutzer) || (v.erstellt_von === benutzer.id && v.status !== 'freigegeben')) {
      db.prepare('UPDATE katalog_varianten SET lieferumfang = ? WHERE id = ?').run(json, v.id);
      return { gespeichert: true, lieferumfang: lu };
    }
    if (v.lieferumfang && JSON.stringify(normalisiereLieferumfang(v.lieferumfang)) === json) return { unveraendert: true };
    if (offeneJeBenutzer.get(benutzer.id) >= MAX_OFFEN) throw new ValidierungsFehler({ lieferumfang: 'Du hast schon viele offene Vorschläge – bitte warte auf die Prüfung.' });
    const datei = foto ? await speichereFoto(foto) : null;
    db.transaction(() => {
      // Ein neuer Vorschlag ersetzt den eigenen offenen für dieselbe Ausgabe
      for (const alt of eigeneOffene.all(v.id, benutzer.id)) { entferne.run(alt.id); if (alt.foto) dateien.loesche(alt.foto); }
      db.prepare('INSERT INTO lieferumfang_vorschlaege (variante_id, benutzer_id, lieferumfang, begruendung, foto) VALUES (?, ?, ?, ?, ?)')
        .run(v.id, benutzer.id, json, String(begruendung ?? '').trim().slice(0, 500) || null, datei);
    })();
    return { vorgeschlagen: true };
  }

  /**
   * Vorschlag aus der KI-Fotoprüfung (Fotoart „Beilagen“): nur als Vorschlag für die Moderation, nie automatisch übernommen.
   * Nichts, wenn die Ausgabe schon denselben Lieferumfang hat oder dasselbe schon offen ist. Liefert die ID oder null.
   */
  function vorschlagAusKi(benutzerId, varianteId, lieferumfang) {
    const lu = normalisiereLieferumfang(lieferumfang);
    const v = variante.get(Number(varianteId));
    if (!lu || !v || v.status !== 'freigegeben') return null;
    const json = JSON.stringify(lu);
    if (v.lieferumfang && JSON.stringify(normalisiereLieferumfang(v.lieferumfang)) === json) return null;
    if (db.prepare("SELECT 1 FROM lieferumfang_vorschlaege WHERE variante_id = ? AND lieferumfang = ? AND status = 'offen'").get(v.id, json)) return null;
    if (offeneJeBenutzer.get(benutzerId) >= MAX_OFFEN) return null;
    return Number(db.prepare("INSERT INTO lieferumfang_vorschlaege (variante_id, benutzer_id, lieferumfang, quelle, begruendung) VALUES (?, ?, ?, 'ki', 'Von der KI auf einem Foto der Beilagen erkannt')")
      .run(v.id, benutzerId, json).lastInsertRowid);
  }

  /** Offene Vorschläge für die Moderation (mit aktuellem Lieferumfang der Ausgabe zum Vergleich). */
  function offene(varianteId = null) {
    return db.prepare(`SELECT p.id, p.variante_id, p.lieferumfang, p.begruendung, p.foto, p.quelle, p.erstellt_am, v.bezeichnung AS variante, v.lieferumfang AS aktuell,
        v.katalog_id, k.titel AS katalog_titel, COALESCE(b.anzeigename, b.benutzername) AS von
      FROM lieferumfang_vorschlaege p JOIN katalog_varianten v ON v.id = p.variante_id JOIN katalog k ON k.id = v.katalog_id LEFT JOIN benutzer b ON b.id = p.benutzer_id
      WHERE p.status = 'offen' AND (@v IS NULL OR p.variante_id = @v) ORDER BY p.id LIMIT 200`).all({ v: varianteId })
      .map(({ foto, ...p }) => ({ ...p, lieferumfang: lies(p.lieferumfang), aktuell: lies(p.aktuell), text: lieferumfangText(lies(p.lieferumfang)), foto_url: foto ? `/api/dateien/${foto}` : null }));
  }

  /** Entscheidung der Moderation: übernehmen (optional mit korrigiertem Lieferumfang) oder ablehnen. Das Foto wird gelöscht. */
  function entscheide(id, uebernehmen, korrektur = null) {
    const p = db.prepare("SELECT * FROM lieferumfang_vorschlaege WHERE id = ? AND status = 'offen'").get(Number(id));
    if (!p) return null;
    const lu = normalisiereLieferumfang(korrektur ?? p.lieferumfang);
    if (uebernehmen && !lu) throw new ValidierungsFehler({ lieferumfang: 'Bitte mindestens einen Bestandteil wählen.' });
    db.transaction(() => {
      if (uebernehmen) db.prepare('UPDATE katalog_varianten SET lieferumfang = ? WHERE id = ?').run(JSON.stringify(lu), p.variante_id);
      db.prepare('UPDATE lieferumfang_vorschlaege SET status = ?, foto = NULL WHERE id = ?').run(uebernehmen ? 'uebernommen' : 'abgelehnt', p.id);
    })();
    if (p.foto) dateien.loesche(p.foto);
    const v = variante.get(p.variante_id);
    if (p.benutzer_id && p.quelle === 'sammler') {
      benachrichtigungen?.sende(p.benutzer_id, {
        art: 'system',
        titel: uebernehmen ? 'Dein Vorschlag zum Lieferumfang wurde übernommen' : 'Dein Vorschlag zum Lieferumfang wurde nicht übernommen',
        text: uebernehmen ? `Lieferumfang „${v?.bezeichnung ?? ''}“: ${lieferumfangText(lu)}. Danke fürs Mithelfen!` : 'Danke trotzdem für deine Mühe.',
        link: `#/katalog/${v?.katalog_id ?? ''}`,
      });
    }
    return { ...p, variante: v };
  }

  /** Fotos von Vorschlägen löschen (z. B. wenn die Ausgabe gelöscht wird). */
  function loescheFotosZurVariante(varianteId) {
    for (const f of db.prepare('SELECT foto FROM lieferumfang_vorschlaege WHERE variante_id = ? AND foto IS NOT NULL').pluck().all(varianteId)) dateien.loesche(f);
  }

  const darfSehen = (benutzer, name) => name.startsWith(LIEFERUMFANG_FOTO_PRAEFIX)
    && Boolean(db.prepare("SELECT 1 FROM lieferumfang_vorschlaege WHERE foto = ? AND status = 'offen' AND (benutzer_id = ? OR ?)").get(name, benutzer.id, istModerator(benutzer) ? 1 : 0));
  const dateienVon = (benutzerId) => db.prepare('SELECT foto FROM lieferumfang_vorschlaege WHERE benutzer_id = ? AND foto IS NOT NULL').pluck().all(benutzerId);

  return { vorschlagen, vorschlagAusKi, offene, entscheide, loescheFotosZurVariante, darfSehen, dateienVon };
}
