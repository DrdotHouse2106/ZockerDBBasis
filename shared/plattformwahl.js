// Welche Plattform eines Spiels zeigen bzw. suchen? (Server und Oberfläche)

/** PC/Computer-Plattformen – bei mehreren Plattformen nachrangig (sonst landet man bei der PC-Fassung). */
export const istComputer = (name) => /\b(pc|windows|mac ?os|macintosh|linux|dos|steam ?os)\b/i.test(String(name ?? ''));

/**
 * Plattform für die Suche bei Händlern: eigene Wahl (z. B. Plattform des eigenen Exemplars) vor der ersten Konsole,
 * PC nur, wenn es nichts anderes gibt. `liste`: Plattformnamen in Anzeigereihenfolge.
 */
export function suchPlattform(liste, bevorzugt = null) {
  const namen = (liste ?? []).filter(Boolean);
  if (bevorzugt && namen.includes(bevorzugt)) return bevorzugt;
  return namen.find((n) => !istComputer(n)) ?? namen[0] ?? null;
}

/**
 * Standard-Plattform einer Spieleseite (ID): Plattform des eigenen Exemplars → eine der „Meine Systeme“ (Konsole vor PC)
 * → erste Konsole → erste Plattform. `plattformen`: [{ id, name }] in Anzeigereihenfolge.
 */
export function standardPlattform(plattformen, { eigene = null, systeme = null } = {}) {
  const liste = plattformen ?? [];
  if (!liste.length) return null;
  if (eigene != null && liste.some((p) => p.id === eigene)) return eigene;
  const meine = systeme ? liste.filter((p) => systeme.has(p.id)) : [];
  const ziel = meine.find((p) => !istComputer(p.name)) ?? meine[0] ?? liste.find((p) => !istComputer(p.name)) ?? liste[0];
  return ziel.id;
}
