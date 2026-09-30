// Geführte Touren: dunkelt die Seite ab, hebt ein Element hervor ([data-tour="…"]) und erklärt es in einer Sprechblase
// mit Pfeil. Schritte können vorher auf eine Seite wechseln, auf einen Tipp auf das markierte Element warten („Hier tippen“)
// und Beispieleinträge anlegen. Die Touren selbst stehen in touren.js; Zusatzmodule liefern weitere (MODUL.touren) oder
// ergänzen Schritte bestehender Touren (MODUL.tourSchritte).
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api.js';
import { useSitzung } from './sitzung.js';
import { MODUL } from './erweiterungen.jsx';
import { TOUREN } from './touren.js';

const TourKontext = createContext({ aktiv: null, starte: () => {}, touren: [], beende: () => {} });
export const useTour = () => useContext(TourKontext);

const BEISPIEL_SCHLUESSEL = 'zockerdb-tour-beispiel';
const merkeBeispiel = (id) => { try { if (id) localStorage.setItem(BEISPIEL_SCHLUESSEL, String(id)); else localStorage.removeItem(BEISPIEL_SCHLUESSEL); } catch { /* egal */ } };
const gemerktesBeispiel = () => { try { return localStorage.getItem(BEISPIEL_SCHLUESSEL); } catch { return null; } };

/**
 * Alle Touren samt Modul-Schritten. MODUL.tourSchritte: { tourId: [{ nach: schrittId, schritte: […] }] } –
 * ohne „nach“ (oder unbekannt) vor dem Schlussschritt eingefügt.
 */
export function alleTouren() {
  return [...TOUREN, ...(MODUL.touren ?? [])].map((t) => {
    let schritte = t.schritte;
    for (const { nach, schritte: extra } of MODUL.tourSchritte?.[t.id] ?? []) {
      const hinter = schritte.findIndex((s) => s.id === nach);
      const ende = schritte.findIndex((s) => s.ende);
      const pos = hinter >= 0 ? hinter + 1 : ende >= 0 ? ende : schritte.length;
      schritte = [...schritte.slice(0, pos), ...extra, ...schritte.slice(pos)];
    }
    return schritte === t.schritte ? t : { ...t, schritte };
  });
}

const wert = (w, ...args) => (typeof w === 'function' ? w(...args) : w);

/** Sichtbares Element zu einem Tour-Namen (Handy- und Desktop-Navigation tragen denselben Namen). */
function findeZiel(name) {
  if (!name) return null;
  for (const el of document.querySelectorAll(`[data-tour="${CSS.escape(name)}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
  }
  return null;
}

const aktuellerPfad = () => window.location.hash.replace(/^#/, '') || '/';

export function TourAnbieter({ children }) {
  const sitzung = useSitzung();
  const { benutzer } = sitzung;
  const [lauf, setLauf] = useState(null); // { tour, index, kontext }
  const touren = useMemo(() => alleTouren().filter((t) => !t.fuer || t.fuer(sitzung)), [sitzung]);

  // Übrig gebliebenes Beispiel (Seite während der Tour neu geladen) aufräumen
  useEffect(() => {
    const id = gemerktesBeispiel();
    if (id && benutzer && !lauf) api.artikelLoeschen(id).catch(() => {}).finally(() => merkeBeispiel(null));
  }, [benutzer]); // eslint-disable-line react-hooks/exhaustive-deps

  const kontext = useCallback((extra = {}) => ({ ...sitzung, ...extra }), [sitzung]);
  const schritte = useCallback((tour, k) => tour.schritte.filter((s) => !s.sichtbar || s.sichtbar(k)), []);

  const speichereStand = useCallback(async (tourId, stand) => {
    try { await api.kontoAendern({ touren: { [tourId]: stand } }); await sitzung.aktualisiere(); } catch { /* offline – beim nächsten Mal erneut anbieten */ }
  }, [sitzung]);

  const starte = useCallback((id) => {
    const tour = touren.find((t) => t.id === id);
    if (tour) setLauf({ tour, index: 0, kontext: {} });
  }, [touren]);

  /** Tour beenden: Beispieleinträge löschen (außer „behalten“) und den Stand am Konto merken. */
  const beende = useCallback(async ({ fertig = false, behalten = false } = {}) => {
    const l = lauf;
    setLauf(null);
    if (!l) return;
    if (l.kontext.beispielId && !behalten) await api.artikelLoeschen(l.kontext.beispielId).catch(() => {});
    merkeBeispiel(null);
    await l.tour.beimEnde?.(l.kontext, { fertig, behalten });
    const bisher = benutzer?.touren?.[l.tour.id];
    if (fertig || bisher !== 'fertig') speichereStand(l.tour.id, fertig ? 'fertig' : 'abgelehnt');
  }, [lauf, benutzer, speichereStand]);

  const gehe = useCallback((richtung) => setLauf((l) => (l ? { ...l, index: l.index + richtung, bereit: false } : l)), []);

  // Schritt vorbereiten: Beispiele anlegen, auf die richtige Seite wechseln
  const liste = lauf ? schritte(lauf.tour, kontext(lauf.kontext)) : [];
  const schritt = lauf ? liste[Math.max(0, Math.min(lauf.index, liste.length - 1))] : null;
  useEffect(() => {
    if (!lauf || !schritt || lauf.bereit) return;
    let abbruch = false;
    (async () => {
      let k = lauf.kontext;
      if (schritt.vorher) {
        try {
          const neu = await schritt.vorher(kontext(k));
          if (neu) { k = { ...k, ...neu }; if (neu.beispielId) merkeBeispiel(neu.beispielId); }
        } catch { k = { ...k, beispielFehler: true }; }
      }
      if (abbruch) return;
      // Durch das Beispiel können Schritte wegfallen – dann den nächsten passenden nehmen
      const neueListe = schritte(lauf.tour, kontext(k));
      if (!neueListe.includes(schritt)) { setLauf((l) => ({ ...l, kontext: k })); return; }
      const ziel = wert(schritt.route, kontext(k));
      if (ziel && aktuellerPfad() !== ziel) window.location.hash = ziel;
      setLauf((l) => (l ? { ...l, kontext: k, index: neueListe.indexOf(schritt), bereit: true } : l));
    })();
    return () => { abbruch = true; };
  }, [lauf, schritt, kontext, schritte]);

  const wertKontext = useMemo(() => ({
    aktiv: lauf ? { tourId: lauf.tour.id, schrittId: schritt?.id ?? null } : null,
    touren, starte, beende,
  }), [lauf, schritt, touren, starte, beende]);

  return (
    <TourKontext.Provider value={wertKontext}>
      {children}
      {lauf?.bereit && schritt && createPortal(
        <TourSchritt
          key={`${lauf.tour.id}-${schritt.id}`}
          schritt={schritt}
          k={kontext(lauf.kontext)}
          nummer={liste.indexOf(schritt) + 1}
          gesamt={liste.length}
          onWeiter={() => (liste.indexOf(schritt) >= liste.length - 1 ? beende({ fertig: true }) : gehe(1))}
          onZurueck={liste.indexOf(schritt) > 0 ? () => gehe(-1) : null}
          onBeenden={beende}
        />,
        document.body,
      )}
    </TourKontext.Provider>
  );
}

const ABSTAND = 8; // Luft um das hervorgehobene Element
const RAND = 16;

function TourSchritt({ schritt, k, nummer, gesamt, onWeiter, onZurueck, onBeenden }) {
  const [rechteck, setRechteck] = useState(null);
  const [gesucht, setGesucht] = useState(Boolean(schritt.ziel));
  const [blase, setBlase] = useState({ b: 352, h: 200 });
  const blasenRef = useRef(null);
  const weiterRef = useRef(null);
  const zielName = wert(schritt.ziel, k);

  // Ziel suchen (bis zu 4 s, die Seite lädt evtl. noch) und seine Lage laufend verfolgen
  useLayoutEffect(() => {
    if (!zielName) { setGesucht(false); return undefined; }
    let rahmen;
    let gescrollt = false;
    const start = performance.now();
    const messen = () => {
      const el = findeZiel(zielName);
      if (el) {
        if (!gescrollt) {
          gescrollt = true;
          const r = el.getBoundingClientRect();
          if (r.top < 64 || r.bottom > window.innerHeight - 80) el.scrollIntoView({ block: 'center' });
        }
        const r = el.getBoundingClientRect();
        setRechteck((alt) => (alt && alt.x === r.x && alt.y === r.y && alt.width === r.width && alt.height === r.height ? alt : { x: r.x, y: r.y, width: r.width, height: r.height }));
        setGesucht(false);
      } else {
        setRechteck(null);
        if (performance.now() - start > 4000) setGesucht(false);
      }
      rahmen = requestAnimationFrame(messen);
    };
    messen();
    return () => cancelAnimationFrame(rahmen);
  }, [zielName]);

  // „Hier tippen“: ein Tipp auf das markierte Element führt weiter
  useEffect(() => {
    if (!schritt.klick || !zielName) return undefined;
    const tipp = (e) => {
      const el = findeZiel(zielName);
      if (el && el.contains(e.target)) setTimeout(onWeiter, 80);
    };
    document.addEventListener('click', tipp, true);
    return () => document.removeEventListener('click', tipp, true);
  }, [schritt.klick, zielName, onWeiter]);

  // Tastatur: Esc beendet, Pfeiltasten blättern
  useEffect(() => {
    const taste = (e) => {
      if (e.key === 'Escape') onBeenden();
      else if (e.key === 'ArrowRight' && !schritt.ende) onWeiter();
      else if (e.key === 'ArrowLeft' && onZurueck) onZurueck();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onWeiter, onZurueck, onBeenden, schritt.ende]);

  useLayoutEffect(() => {
    const el = blasenRef.current;
    if (el) setBlase((alt) => (alt.b === el.offsetWidth && alt.h === el.offsetHeight ? alt : { b: el.offsetWidth, h: el.offsetHeight }));
  });
  useEffect(() => { if (!gesucht) weiterRef.current?.focus({ preventScroll: true }); }, [gesucht]);

  if (gesucht) return <div className="fixed inset-0 z-[90] bg-black/60" aria-hidden="true" />;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const loch = rechteck && {
    x: Math.max(rechteck.x - ABSTAND, 0), y: Math.max(rechteck.y - ABSTAND, 0),
    r: Math.min(rechteck.x + rechteck.width + ABSTAND, vw), u: Math.min(rechteck.y + rechteck.height + ABSTAND, vh),
  };
  // Sprechblase unter bzw. über dem Element, sonst unten am Rand; ohne Element in der Mitte
  let stil;
  let pfeil = null;
  if (loch) {
    const mitte = (loch.x + loch.r) / 2;
    const links = Math.min(Math.max(mitte - blase.b / 2, RAND), vw - blase.b - RAND);
    const pfeilX = Math.min(Math.max(mitte - links, 20), blase.b - 20);
    if (vh - loch.u >= blase.h + 24) { stil = { top: loch.u + 14, left: links }; pfeil = { oben: true, x: pfeilX }; }
    else if (loch.y >= blase.h + 24) { stil = { top: loch.y - blase.h - 14, left: links }; pfeil = { oben: false, x: pfeilX }; }
    else stil = { bottom: RAND, left: links };
  } else {
    stil = { top: Math.max((vh - blase.h) / 2, RAND), left: Math.max((vw - blase.b) / 2, RAND) };
  }

  const text = wert(schritt.text, k);
  return (
    <>
      {loch ? (
        <>
          {/* Abdunkeln rundherum – Klicks daneben bleiben wirkungslos */}
          <div className="fixed z-[90] bg-black/60" style={{ left: 0, top: 0, width: vw, height: loch.y }} />
          <div className="fixed z-[90] bg-black/60" style={{ left: 0, top: loch.u, width: vw, height: Math.max(vh - loch.u, 0) }} />
          <div className="fixed z-[90] bg-black/60" style={{ left: 0, top: loch.y, width: loch.x, height: loch.u - loch.y }} />
          <div className="fixed z-[90] bg-black/60" style={{ left: loch.r, top: loch.y, width: Math.max(vw - loch.r, 0), height: loch.u - loch.y }} />
          {/* Ohne „Hier tippen“ ist auch das markierte Element gesperrt, damit man nicht versehentlich wegnavigiert */}
          {!schritt.klick && <div className="fixed z-[90]" style={{ left: loch.x, top: loch.y, width: loch.r - loch.x, height: loch.u - loch.y }} />}
          <div className={`pointer-events-none fixed z-[91] rounded-xl border-2 border-akzent ${schritt.klick ? 'tour-puls' : ''}`}
            style={{ left: loch.x, top: loch.y, width: loch.r - loch.x, height: loch.u - loch.y }} aria-hidden="true" />
          {schritt.klick && (
            // Finger über dem Element; steht dort schon die Sprechblase, seitlich daneben
            <span className="tour-zeiger pointer-events-none fixed z-[92] text-3xl" aria-hidden="true"
              style={pfeil?.oben === false || loch.y < 44
                ? { left: loch.r + 40 < vw ? loch.r + 2 : loch.x - 38, top: (loch.y + loch.u) / 2 - 20 }
                : { left: (loch.x + loch.r) / 2 - 16, top: loch.y - 40 }}>
              {pfeil?.oben === false || loch.y < 44 ? (loch.r + 40 < vw ? '👈' : '👉') : '👇'}
            </span>
          )}
        </>
      ) : <div className="fixed inset-0 z-[90] bg-black/60" />}

      <div ref={blasenRef} role="dialog" aria-modal="true" aria-labelledby="tour-titel" aria-describedby="tour-text"
        className="karte fixed z-[93] w-[min(22rem,calc(100vw-2rem))] space-y-2 p-4 shadow-2xl" style={stil}>
        {pfeil && (
          <span aria-hidden="true" className="absolute size-3.5 rotate-45 border-rand bg-karte"
            style={{ left: pfeil.x - 7, ...(pfeil.oben ? { top: -8, borderLeftWidth: 1, borderTopWidth: 1 } : { bottom: -8, borderRightWidth: 1, borderBottomWidth: 1 }) }} />
        )}
        <div className="flex items-start justify-between gap-2">
          <h2 id="tour-titel" className="font-semibold">{wert(schritt.titel, k)}</h2>
          <button type="button" className="-mt-1 -mr-1 rounded-lg px-2 py-0.5 text-leise hover:bg-karte-hover" onClick={() => onBeenden()} aria-label="Tour beenden">✕</button>
        </div>
        <div id="tour-text" className="space-y-1.5 text-sm text-leise">
          {(Array.isArray(text) ? text : [text]).filter(Boolean).map((absatz, i) => <p key={i}>{absatz}</p>)}
        </div>
        {schritt.klick && loch && <p className="text-sm font-semibold text-akzent-hell">👉 Tippe auf die markierte Stelle – oder auf „Weiter“.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-xs text-leise">{nummer} / {gesamt}</span>
          <div className="flex flex-wrap justify-end gap-2">
            {onZurueck && <button type="button" className="knopf-sekundaer px-3 py-1.5 text-sm" onClick={onZurueck}>Zurück</button>}
            {schritt.ende && k.beispielId ? (
              <>
                <button type="button" className="knopf-sekundaer px-3 py-1.5 text-sm" onClick={() => onBeenden({ fertig: true, behalten: true })}>Beispiel behalten</button>
                <button ref={weiterRef} type="button" className="knopf-primaer px-3 py-1.5 text-sm" onClick={() => onBeenden({ fertig: true })}>Fertig – Beispiel löschen</button>
              </>
            ) : (
              <button ref={weiterRef} type="button" className="knopf-primaer px-3 py-1.5 text-sm" onClick={onWeiter}>{schritt.ende ? 'Fertig' : 'Weiter'}</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Angebot einer Tour (z. B. auf der Sammlungsseite für Neue) – verschwindet nach „Nein danke“ oder der Tour. */
export function TourAngebot({ tour: tourId, titel, text }) {
  const { benutzer, aktualisiere } = useSitzung();
  const { touren, starte, aktiv } = useTour();
  const [weg, setWeg] = useState(false);
  const tour = touren.find((t) => t.id === tourId);
  if (!tour || !benutzer || weg || aktiv || benutzer.touren?.[tourId]) return null;
  const ablehnen = async () => {
    setWeg(true);
    try { await api.kontoAendern({ touren: { [tourId]: 'abgelehnt' } }); await aktualisiere(); } catch { /* egal */ }
  };
  return (
    <section className="karte flex flex-col gap-3 border-akzent/50 p-4 sm:flex-row sm:items-center" data-tour-angebot={tourId}>
      <span className="text-3xl" aria-hidden="true">🧭</span>
      <div className="flex-1">
        <p className="font-semibold">{titel ?? tour.titel}</p>
        <p className="text-sm text-leise">{text ?? tour.beschreibung} Du kannst jederzeit abbrechen – und sie später unter „Mehr → Hilfe & Touren“ neu starten.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className="knopf-sekundaer" onClick={ablehnen}>Nein danke</button>
        <button type="button" className="knopf-primaer" onClick={() => starte(tourId)}>Tour starten</button>
      </div>
    </section>
  );
}

/** „Mehr → Hilfe & Touren“: alle Touren, die für dieses Konto passen. */
export function TourListe() {
  const { benutzer } = useSitzung();
  const { touren, starte } = useTour();
  if (!touren.length) return null;
  return (
    <section className="karte space-y-3 p-4" data-tour="mehr-touren">
      <h2 className="font-semibold">Hilfe & Touren</h2>
      <p className="text-sm text-leise">Geführte Rundgänge mit Pfeilen durch die App – Schritt für Schritt, mit Beispieleinträgen, die danach wieder verschwinden.</p>
      <ul className="divide-y divide-rand">
        {touren.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{t.titel}{benutzer?.touren?.[t.id] === 'fertig' && <span className="ml-2 text-xs text-erfolg">✓ erledigt</span>}</span>
              <span className="block text-xs text-leise">{t.beschreibung}</span>
            </span>
            <button type="button" className="knopf-sekundaer px-3 py-1.5 text-sm" onClick={() => starte(t.id)}>Starten</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
