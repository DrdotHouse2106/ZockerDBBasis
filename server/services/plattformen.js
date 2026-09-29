// Plattform-Stammdaten: Zuordnung von Freitext/IGDB-Namen zu festen Plattformen.

const normal = (text) => String(text ?? '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9|]+/g, '');

export function plattformZuObjekt(zeile) {
  return zeile ? { ...zeile, aliase: JSON.parse(zeile.aliase || '[]'), standard: zeile.standard === undefined ? true : Boolean(zeile.standard) } : null;
}

/** Persönliche Systemauswahl eines Benutzers (Set von Plattform-IDs) oder null = Standardsysteme. */
export function meineSysteme(benutzer) {
  if (!benutzer?.meine_systeme) return null;
  try {
    const ids = JSON.parse(benutzer.meine_systeme);
    return Array.isArray(ids) ? new Set(ids.map(Number).filter(Number.isInteger)) : null;
  } catch {
    return null;
  }
}

/** Baut einen Suchindex Name/Kurzname/Aliase → Plattform. */
export function ladePlattformIndex(db) {
  const index = new Map();
  for (const zeile of db.prepare('SELECT * FROM plattformen').all()) {
    const p = plattformZuObjekt(zeile);
    for (const schluessel of [p.name, p.kurz, ...p.aliase]) {
      const n = normal(schluessel);
      if (n && !index.has(n)) index.set(n, p);
    }
    // Auch der Name ohne Klammerzusatz, z. B. „Super Nintendo (SNES)“
    index.set(normal(p.name), p);
  }
  return index;
}

export function ordnePlattformZu(index, text) {
  if (!text) return null;
  return index.get(normal(text)) ?? null;
}

export function erstellePlattformDienst(db) {
  let index = null;
  const aktuellerIndex = () => (index ??= ladePlattformIndex(db));

  return {
    alle: () => db.prepare('SELECT * FROM plattformen ORDER BY hersteller, erscheinungsjahr, name').all().map(plattformZuObjekt),
    hole: (id) => plattformZuObjekt(db.prepare('SELECT * FROM plattformen WHERE id = ?').get(id)),
    zuordnen: (text) => ordnePlattformZu(aktuellerIndex(), text),
    /** Nach Änderungen an den Stammdaten aufrufen. */
    indexNeuLaden: () => { index = null; },
    /**
     * Nach dem Anlegen einer Plattform oder neuen Aliasen: alle Katalogeinträge, deren Plattformliste einen dieser Namen
     * enthält, mit der Plattform verknüpfen. Liefert die Zahl neuer Verknüpfungen.
     */
    verknuepfeNachNamen(plattformId, namen) {
      const normalisiert = [...new Set(namen.map(normal).filter(Boolean))];
      if (!normalisiert.length) return 0;
      const kandidaten = db.prepare(`SELECT DISTINCT k.id, j.value AS name FROM katalog k, json_each(k.plattformen) j
        WHERE k.plattformen <> '[]' AND lower(j.value) IN (SELECT lower(value) FROM json_each(?))`).all(JSON.stringify(namen));
      const einfuegen = db.prepare('INSERT OR IGNORE INTO katalog_plattformen (katalog_id, plattform_id) VALUES (?, ?)');
      let neu = 0;
      db.transaction(() => {
        for (const k of kandidaten) if (normalisiert.includes(normal(k.name))) neu += einfuegen.run(k.id, plattformId).changes;
      })();
      return neu;
    },
    /** Verknüpft einen Katalogeintrag mit den Plattformen aus seiner Namensliste. */
    verknuepfeKatalog(katalogId, namen) {
      const einfuegen = db.prepare('INSERT OR IGNORE INTO katalog_plattformen (katalog_id, plattform_id) VALUES (?, ?)');
      for (const name of namen ?? []) {
        const p = ordnePlattformZu(aktuellerIndex(), name);
        if (p) einfuegen.run(katalogId, p.id);
      }
    },
  };
}
