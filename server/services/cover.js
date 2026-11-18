import { REGIONEN, coverRegionKette } from '../../shared/konstanten.js';

// Cover passend zur Fassung eines Exemplars. Reihenfolge (die erste vorhandene gewinnt):
//  1. freigegebenes Community-Foto „Verpackung vorne“ (bzw. Cover-Scan, bei Figuren „Foto: Figur“) genau dieser Variante (z. B. der Farbe),
//     sonst einer Variante derselben Region – nur Fotos derselben Plattform (oder ohne bekannte Plattform), z. B. keine PS4-Hülle beim PS5-Exemplar,
//     und derselben Fassung (ein Platinum-Foto nur beim Platinum-Exemplar; Fotos ohne Fassung passen überall, die passende geht vor);
//     ein Foto mit Region (PAL-UK …) nur bei dieser Region – auch ohne Variante
//  2. Cover der regionalen Fassung (z. B. EU bei IGDB) – für PAL-DE erst PAL-DE, dann PAL-EU
//  3. das allgemeine Katalog-Cover
//  4. ohne Katalog-Cover (z. B. lose Figuren): ein freigegebenes Foto der Figur – ohne Farbe zuerst
// Eigenes Foto und eigenes Cover am Exemplar gehen vor (siehe artikelZuObjekt). Ohne Region gilt der deutsche Markt.

/**
 * SQL-Ausdruck für die Bilddatei eines Fotos: die freigestellte Fassung (Hintergrund entfernt), sobald der Fotograf sie angenommen hat,
 * sonst die angegebenen Dateien in dieser Reihenfolge (z. B. Vorschau, Anzeige, Original).
 */
export const fotoDateiSql = (m = 'm', ...dateien) => `CASE WHEN ${m}.frei_status = 'angenommen' AND ${m}.frei_datei IS NOT NULL THEN ${m}.frei_datei
  ELSE COALESCE(${(dateien.length ? dateien : ['vorschau_datei', 'anzeige_datei', 'datei']).map((d) => `${m}.${d}`).join(', ')}) END`;

/** SQL-Ausdruck für das Cover eines Exemplars (`a` = artikel, `k` = katalog). */
export function exemplarCoverSql(a = 'a', k = 'k') {
  const region = `COALESCE(${a}.region, (SELECT rv.region FROM katalog_varianten rv WHERE rv.id = ${a}.variante_id), 'pal_de')`;
  return `COALESCE(
    (SELECT '/api/dateien/' || ${fotoDateiSql('m')} FROM medien m
       LEFT JOIN katalog_varianten mv ON mv.id = m.variante_id
       WHERE m.katalog_id = ${a}.katalog_id AND m.sichtbarkeit = 'freigegeben' AND m.art IN ('foto_vorne', 'cover_vorne', 'foto_figur', 'foto_karte_vorne') AND m.mime LIKE 'image/%'
         AND (m.variante_id = ${a}.variante_id OR COALESCE(m.region, mv.region) = ${region})
         AND (m.region IS NULL OR m.region = ${region})
         AND (m.plattform_id IS NULL OR ${a}.plattform_id IS NULL OR m.plattform_id = ${a}.plattform_id)
         AND (m.edition IS NULL OR m.edition = ${a}.edition COLLATE NOCASE)
       ORDER BY m.variante_id IS ${a}.variante_id DESC, m.region IS ${region} DESC, m.plattform_id IS ${a}.plattform_id DESC, (m.edition = ${a}.edition COLLATE NOCASE) IS 1 DESC, m.art IN ('foto_figur', 'foto_karte_vorne') DESC, m.art = 'foto_vorne' DESC, m.id LIMIT 1),
    (SELECT kc.url FROM katalog_cover kc WHERE kc.katalog_id = ${a}.katalog_id
       AND (kc.region = ${region} OR (kc.region = 'pal_eu' AND ${region} LIKE 'pal%'))
       ORDER BY kc.region = ${region} DESC LIMIT 1),
    ${k}.cover_url,
    (SELECT '/api/dateien/' || ${fotoDateiSql('m')} FROM medien m
       WHERE m.katalog_id = ${a}.katalog_id AND m.sichtbarkeit = 'freigegeben' AND m.art IN ('foto_figur', 'foto_karte_vorne') AND m.mime LIKE 'image/%'
         AND (m.plattform_id IS NULL OR ${a}.plattform_id IS NULL OR m.plattform_id = ${a}.plattform_id)
       ORDER BY m.variante_id IS NULL DESC, m.id LIMIT 1))`;
}

/**
 * Cover je Region und das passende Cover eines Katalogeintrags (für /api/katalog/:id und die Spieleseite).
 * `katalog` = Katalogdienst (regionale Cover, z. B. von IGDB).
 */
export function erstelleCoverAuswahl(db, katalog) {
  // Cover je Region: freigegebene Community-Fotos „Verpackung vorne“ (bzw. Cover-Scans) einer Variante mit Region und die regionalen
  // Fassungen (z. B. EU bei IGDB) – je Region eines, Community-Foto zuerst
  // Region des Fotos (vom Exemplar übernommen), sonst die seiner Variante
  const communityCover = db.prepare(`SELECT COALESCE(m.region, v.region) AS region, '/api/dateien/' || ${fotoDateiSql('m', 'anzeige_datei', 'datei')} AS url
    FROM medien m LEFT JOIN katalog_varianten v ON v.id = m.variante_id
    WHERE m.katalog_id = ? AND m.sichtbarkeit = 'freigegeben' AND m.art IN ('foto_vorne', 'cover_vorne') AND m.mime LIKE 'image/%' AND COALESCE(m.region, v.region) IS NOT NULL
    ORDER BY m.art = 'foto_vorne' DESC, m.id`);
  // Wie auf der Serienseite: freigegebene Fotos für alle, eigene (noch in Prüfung) zusätzlich für den, der sie hochgeladen hat
  const figurFoto = db.prepare(`SELECT '/api/dateien/' || ${fotoDateiSql('medien', 'anzeige_datei', 'datei')} FROM medien
    WHERE katalog_id = @katalog AND (sichtbarkeit = 'freigegeben' OR (benutzer_id = @benutzer AND sichtbarkeit <> 'abgelehnt'))
      AND art IN ('foto_figur', 'foto_karte_vorne') AND mime LIKE 'image/%'
    ORDER BY sichtbarkeit = 'freigegeben' DESC, variante_id IS NULL DESC, id LIMIT 1`).pluck();
  return function coverRegionen(eintrag, benutzer) {
    const je = new Map();
    for (const c of communityCover.all(eintrag.id)) if (!je.has(c.region)) je.set(c.region, { region: c.region, url: c.url, quelle: 'community' });
    for (const c of katalog.regionalCover(eintrag.id)) if (!je.has(c.region)) je.set(c.region, { region: c.region, url: c.url, quelle: c.quelle });
    const liste = REGIONEN.map((r) => je.get(r.value)).filter(Boolean);
    // Passend für den deutschen Markt: PAL-DE, dann PAL-EU, sonst das Katalog-Cover
    // Ohne Cover (z. B. lose Figuren): ein freigegebenes Foto der Figur
    const passend = coverRegionKette('pal_de').map((r) => je.get(r)).find(Boolean)?.url ?? (eintrag.cover_url || null) ?? figurFoto.get({ katalog: eintrag.id, benutzer: benutzer?.id ?? -1 }) ?? null;
    return { cover_regionen: liste, cover_passend: passend };
  };
}
