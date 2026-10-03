// Update per Knopf in der Administration: Die App bittet einen Watchtower-Container (HTTP-API) darum,
// das neueste Image zu laden und den ZockerDB-Container damit neu zu starten.
// Die App selbst bekommt keinen Zugriff auf Docker – den hat nur Watchtower. Vorher wird die Datenbank gesichert.
import fs from 'node:fs';
import path from 'node:path';
import { ValidierungsFehler } from './validierung.js';
import { PROJEKT_WURZEL } from '../pfade.js';

/**
 * Versionshinweise (NEUERUNGEN.md): Jeder Eintrag beginnt mit „## TT.MM.JJJJ – Titel“, darunter Stichpunkte „- …“.
 * Die Überschrift ist zugleich die Kennung – so lässt sich vergleichen, was ein neuer Stand gegenüber dem installierten mitbringt.
 * Eine Zeile „<!-- für: admin -->“ bzw. „<!-- für: moderation -->“ unter der Überschrift richtet den Eintrag nur an diese Rollen
 * (fehlt sie, gilt er für alle Sammler – wichtig für „Neu seit deinem letzten Besuch“).
 */
export function leseNeuerungen(text) {
  const eintraege = [];
  for (const zeile of String(text ?? '').split(/\r?\n/)) {
    const kopf = /^##\s+(.+?)\s*$/.exec(zeile);
    if (kopf) {
      const datum = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(kopf[1]);
      eintraege.push({
        id: kopf[1],
        datum: datum ? `${datum[3]}-${datum[2].padStart(2, '0')}-${datum[1].padStart(2, '0')}` : null,
        titel: kopf[1].replace(/^\d{1,2}\.\d{1,2}\.\d{4}\s*[–-]\s*/, '').replace(/\*\*/g, ''),
        punkte: [],
        fuer: null,
      });
      continue;
    }
    const fuer = /^\s*<!--\s*für:\s*(admin|moderation)\s*-->\s*$/.exec(zeile);
    if (fuer && eintraege.length) {
      eintraege.at(-1).fuer = fuer[1];
      continue;
    }
    const punkt = /^\s*[-*]\s+(.+?)\s*$/.exec(zeile);
    if (punkt && eintraege.length) eintraege.at(-1).punkte.push(punkt[1].replace(/\*\*|`/g, ''));
  }
  return eintraege;
}

/** Quellen der Versionshinweise: die des Kerns und die von Zusatzmodulen (Pfad im Repository + Datei im Image). */
export function neuerungsQuellen(module = []) {
  return [
    { pfad: 'NEUERUNGEN.md', datei: path.join(PROJEKT_WURZEL, 'NEUERUNGEN.md') },
    ...module.filter((m) => m.neuerungen).map((m) => m.neuerungen),
  ];
}

/** Stand des laufenden Images (Build-Argumente aus dem Dockerfile, siehe CI). */
export function leseBuild(env = process.env) {
  const commit = /^[0-9a-f]{7,40}$/i.test(env.ZOCKERDB_BUILD ?? '') ? env.ZOCKERDB_BUILD.slice(0, 7) : null;
  const datum = Number.isNaN(Date.parse(env.ZOCKERDB_BUILD_DATE ?? '')) ? null : new Date(env.ZOCKERDB_BUILD_DATE).toISOString();
  return { commit, datum };
}

export function erstelleAktualisierung({ konfiguration, sicherung, build, fetchFn = fetch, quellen = neuerungsQuellen() }) {
  const k = () => konfiguration.aktualisierung ?? {};
  // Zustand des letzten Versuchs; nach einem erfolgreichen Update startet der Server neu und der Zustand ist wieder leer
  let lauf = null;
  // Letzte Update-Prüfung bei GitHub (höchstens stündlich, „Jetzt prüfen“ erzwingt sie)
  let pruefung = null;

  // Versionshinweise des installierten Stands (liegen im Image)
  const installiert = quellen.flatMap((q) => {
    try { return leseNeuerungen(fs.readFileSync(q.datei, 'utf8')); } catch { return []; }
  }).sort((a, b) => String(b.datum ?? '').localeCompare(String(a.datum ?? '')));
  const bekannt = new Set(installiert.map((e) => e.id));

  function status() {
    return { eingerichtet: Boolean(k().url && k().token), build, lauf, pruefung, neuerungen: installiert.slice(0, 15) };
  }

  const githubKopf = (accept = 'application/vnd.github+json') => ({
    Accept: accept, 'User-Agent': 'ZockerDB-Update-Pruefung',
    ...(k().githubToken ? { Authorization: `Bearer ${k().githubToken}` } : {}),
  });

  /**
   * Was bringt der neue Stand mit? Versionshinweise des neuen Stands laden und mit den installierten vergleichen,
   * dazu die Zahl der Änderungen im Quellcode. Fehler hier verhindern den Update-Hinweis nicht.
   */
  async function wasIstNeu(repo, sha) {
    const neu = [];
    for (const q of quellen) {
      try {
        const antwort = await fetchFn(`https://api.github.com/repos/${repo}/contents/${q.pfad}?ref=${sha}`, {
          headers: githubKopf('application/vnd.github.raw+json'), signal: AbortSignal.timeout(15_000),
        });
        if (!antwort.ok) continue;
        const text = (await antwort.text()).slice(0, 500_000);
        neu.push(...leseNeuerungen(text).filter((e) => !bekannt.has(e.id)));
      } catch { /* ohne Versionshinweise weiter */ }
    }
    let aenderungen = null;
    if (build.commit) {
      try {
        const antwort = await fetchFn(`https://api.github.com/repos/${repo}/compare/${build.commit}...${sha}`, {
          headers: githubKopf(), signal: AbortSignal.timeout(15_000),
        });
        if (antwort.ok) aenderungen = Number((await antwort.json()).ahead_by) || null;
      } catch { /* ohne Zahl weiter */ }
    }
    neu.sort((a, b) => String(b.datum ?? '').localeCompare(String(a.datum ?? '')));
    return { neuerungen: neu.slice(0, 50), aenderungen };
  }

  /**
   * Gibt es einen neueren, fertig gebauten Stand? Maßgeblich ist der letzte erfolgreiche CI-Lauf (Tests + Docker-Image)
   * auf main im eingestellten Repository. Neuer heißt: anderer Commit und später fertig als das eigene Image gebaut wurde.
   */
  async function pruefe({ erzwingen = false } = {}) {
    if (!erzwingen && pruefung && Date.now() - Date.parse(pruefung.geprueft) < 60 * 60 * 1000 && !pruefung.fehler) return pruefung;
    const repo = k().repo;
    if (!repo) return (pruefung = null);
    const geprueft = new Date().toISOString();
    try {
      const antwort = await fetchFn(`https://api.github.com/repos/${repo}/actions/workflows/ci.yml/runs?branch=main&status=success&per_page=1`, {
        headers: githubKopf(),
        signal: AbortSignal.timeout(15_000),
      });
      if (antwort.status === 404 || antwort.status === 401) {
        throw new Error(k().githubToken ? `Kein Zugriff auf ${repo} – GitHub-Token prüfen (Berechtigung „Actions: Read-only“).`
          : `${repo} ist privat oder nicht erreichbar – für private Repositorys einen GitHub-Token eintragen.`);
      }
      if (!antwort.ok) throw new Error(`GitHub antwortet mit Fehler ${antwort.status}.`);
      const run = (await antwort.json()).workflow_runs?.[0];
      if (!run) throw new Error('Noch kein erfolgreicher Build gefunden.');
      const verfuegbar = { commit: String(run.head_sha).slice(0, 7), datum: run.updated_at, titel: String(run.display_title ?? '').slice(0, 200) };
      const neu = Boolean(build.commit && verfuegbar.commit !== build.commit
        && (!build.datum || Date.parse(verfuegbar.datum) > Date.parse(build.datum)));
      const zusatz = neu ? await wasIstNeu(repo, String(run.head_sha)) : { neuerungen: [], aenderungen: null };
      pruefung = { geprueft, repo, verfuegbar, neu, ...zusatz, fehler: null };
    } catch (fehler) {
      pruefung = { geprueft, repo, verfuegbar: null, neu: false, fehler: fehler.name === 'TimeoutError' ? 'GitHub ist nicht erreichbar.' : fehler.message };
    }
    return pruefung;
  }

  async function starte() {
    if (!k().url || !k().token) {
      throw new ValidierungsFehler({ aktualisierung: 'Das Update per Knopf ist nicht eingerichtet (UPDATE_URL und UPDATE_TOKEN, siehe README).' });
    }
    if (lauf?.zustand === 'laeuft') return status();
    lauf = { zustand: 'laeuft', seit: new Date().toISOString() };
    // Sicherheitshalber vorher eine frische Sicherung der Datenbank
    await sicherung.lauf({ erzwingen: true }).catch(() => null);
    const gestartet = lauf.seit;
    const ende = (werte) => { if (lauf?.seit === gestartet) lauf = { ...lauf, ...werte, beendet: new Date().toISOString() }; };

    // Watchtower antwortet erst, wenn es fertig ist. Gibt es ein neues Image, beendet es vorher diesen
    // Container – dann kommt keine Antwort mehr an. Kommt eine Antwort, war nichts zu tun.
    fetchFn(k().url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${k().token}` },
      signal: AbortSignal.timeout(15 * 60 * 1000),
    }).then((r) => {
      if (r.status === 401 || r.status === 403) ende({ zustand: 'fehler', fehler: 'Watchtower hat den Token abgelehnt – UPDATE_TOKEN prüfen.' });
      else if (!r.ok) ende({ zustand: 'fehler', fehler: `Watchtower meldet einen Fehler (HTTP ${r.status}).` });
      else ende({ zustand: 'aktuell' });
    }).catch((fehler) => {
      const ursache = fehler.cause?.code ?? fehler.code ?? fehler.name;
      // Verbindung abgerissen: Watchtower beendet gerade diesen Container für das Update
      if (['ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE'].includes(ursache)) return ende({ zustand: 'neustart' });
      const text = ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT', 'EAI_AGAIN'].includes(ursache)
        ? `Watchtower ist unter ${k().url} nicht erreichbar (${ursache}).`
        : `Update fehlgeschlagen: ${fehler.message}`;
      ende({ zustand: 'fehler', fehler: text });
    });
    return status();
  }

  return { status, starte, pruefe };
}
