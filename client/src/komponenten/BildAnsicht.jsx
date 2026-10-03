// Bildansicht in der App: Links auf Fotos/Scans (target="_blank" mit Vorschaubild oder data-bild) öffnen nicht mehr die
// nackte Datei – in der installierten App gäbe es von dort keinen Weg zurück –, sondern eine Ansicht über der Seite.
// Schließen: ✕, Tippen daneben, Escape oder die Zurück-Geste. Mehrere Bilder derselben Liste: ‹ › oder Wischen.
import { useEffect, useRef, useState } from 'react';

const IST_PDF = /\.pdf($|\?)/i;

/** Gehört der angeklickte Link zur Bildansicht? Nur eigene Dateien, keine Downloads. */
function bildLink(ziel) {
  const a = ziel?.closest?.('a[href]');
  if (!a || a.hasAttribute('download') || a.dataset.bild === 'nein') return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin || url.searchParams.has('download')) return null;
  const istBild = a.dataset.bild !== undefined || (a.target === '_blank' && a.querySelector('img'));
  return istBild ? a : null;
}

export default function BildAnsicht() {
  const [ansicht, setAnsicht] = useState(null); // { bilder: [{ url, alt }], index }
  const offen = useRef(false);

  useEffect(() => {
    const klick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = bildLink(e.target);
      if (!a) return;
      e.preventDefault();
      // Alle Bilder derselben Liste zum Blättern
      const liste = a.closest('ul, [data-galerie], section') ?? a.parentElement;
      const links = [...liste.querySelectorAll('a[href]')].filter((x) => bildLink(x) === x);
      const bilder = links.map((x) => ({ url: x.href, alt: x.querySelector('img')?.alt ?? x.getAttribute('aria-label') ?? 'Bild' }));
      setAnsicht({ bilder, index: Math.max(0, links.indexOf(a)) });
    };
    document.addEventListener('click', klick);
    return () => document.removeEventListener('click', klick);
  }, []);

  // Zurück-Geste schließt die Ansicht (eigener Verlaufseintrag ohne neue Adresse – die Seite bleibt, wo sie ist)
  useEffect(() => {
    if (!ansicht || offen.current) return undefined;
    offen.current = true;
    window.history.pushState({ bildansicht: true }, '');
    const zurueck = () => { offen.current = false; setAnsicht(null); };
    window.addEventListener('popstate', zurueck);
    return () => window.removeEventListener('popstate', zurueck);
  }, [Boolean(ansicht)]);

  const schliessen = () => {
    if (offen.current) window.history.back(); // löst popstate aus → schließt
    else setAnsicht(null);
  };
  const blaettern = (schritt) => setAnsicht((a) => a && ({ ...a, index: (a.index + schritt + a.bilder.length) % a.bilder.length }));

  useEffect(() => {
    if (!ansicht) return undefined;
    const taste = (e) => {
      if (e.key === 'Escape') schliessen();
      if (e.key === 'ArrowRight') blaettern(1);
      if (e.key === 'ArrowLeft') blaettern(-1);
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [Boolean(ansicht)]);

  const wischStart = useRef(null);
  if (!ansicht) return null;
  const bild = ansicht.bilder[ansicht.index];
  const mehrere = ansicht.bilder.length > 1;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Bildansicht"
      onClick={(e) => { if (e.target === e.currentTarget) schliessen(); }}
      onTouchStart={(e) => { wischStart.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (wischStart.current ?? e.changedTouches[0].clientX);
        if (mehrere && Math.abs(dx) > 60) blaettern(dx < 0 ? 1 : -1);
      }}>
      <div className="flex items-center justify-between gap-2 p-3 text-white" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <span className="text-sm opacity-80">{mehrere ? `${ansicht.index + 1} / ${ansicht.bilder.length}` : ''}</span>
        <button type="button" onClick={schliessen} className="rounded-full bg-white/15 px-4 py-2 text-lg font-semibold" aria-label="Schließen">✕</button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2" onClick={(e) => { if (e.target === e.currentTarget) schliessen(); }}>
        {IST_PDF.test(bild.url)
          ? <iframe src={bild.url} title={bild.alt} className="size-full rounded bg-white" />
          : <img src={bild.url} alt={bild.alt} className="max-h-full max-w-full object-contain" />}
        {mehrere && (
          <>
            <button type="button" onClick={() => blaettern(-1)} className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-2xl text-white" aria-label="Vorheriges Bild">‹</button>
            <button type="button" onClick={() => blaettern(1)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-2xl text-white" aria-label="Nächstes Bild">›</button>
          </>
        )}
      </div>
    </div>
  );
}
