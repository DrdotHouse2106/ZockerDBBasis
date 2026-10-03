import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// iOS (installierte App): Nach dem Schließen der Tastatur, nach dem Zoomen oder beim Zurückkehren in die App bleibt
// die Ansicht manchmal verschoben – die Fußleiste steht dann mitten im Bild und die Kopfleiste fehlt.
// Ein Scrollen auf genau dieselbe Stelle ignoriert Safari teils als „nichts zu tun“, deshalb kurz um ein Pixel
// verschieben und zurück; das zwingt die Ansicht zur Neuberechnung.
const eingabeAktiv = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '');
function ansichtZuruecksetzen() {
  if (eingabeAktiv()) return;
  const vv = window.visualViewport;
  // Nur eingreifen, wenn nicht absichtlich hineingezoomt wurde
  if (vv && vv.scale > 1.01) return;
  const x = window.scrollX;
  const y = window.scrollY;
  window.scrollTo(x, y + 1);
  window.scrollTo(x, y);
}
function spaeterZuruecksetzen() {
  setTimeout(ansichtZuruecksetzen, 120);
  setTimeout(ansichtZuruecksetzen, 450);
}
document.addEventListener('focusout', spaeterZuruecksetzen);
window.addEventListener('pageshow', spaeterZuruecksetzen);
window.addEventListener('popstate', spaeterZuruecksetzen);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') spaeterZuruecksetzen();
});
// Messanzeige zur Fehlersuche (Fußleiste auf dem iPhone): einschalten unter Administration → Update oder mit
// „?ansicht=messen“ in der Adresse, ausschalten dort bzw. mit „?ansicht=aus“. Zeigt die Maße, die der Browser meldet – sonst bleibt alles unverändert.
try {
  const wahl = new URLSearchParams(window.location.search).get('ansicht');
  if (wahl === 'messen') localStorage.setItem('ansicht-messen', '1');
  if (wahl === 'aus') localStorage.removeItem('ansicht-messen');
  if (localStorage.getItem('ansicht-messen') === '1') {
    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:fixed;left:50%;top:40%;transform:translateX(-50%);z-index:9999;pointer-events:none;'
      + 'background:rgba(0,0,0,.8);color:#fff;font:12px/1.4 monospace;padding:6px 8px;border-radius:6px;white-space:pre';
    const zeigen = () => {
      const vv = window.visualViewport;
      const nav = document.querySelector('nav.fixed');
      const r = nav?.getBoundingClientRect();
      box.textContent = [
        `innerHeight ${window.innerHeight}  clientHeight ${document.documentElement.clientHeight}`,
        `vv.height ${vv?.height?.toFixed(1)}  vv.offsetTop ${vv?.offsetTop?.toFixed(1)}  scale ${vv?.scale?.toFixed(2)}`,
        `screen ${window.screen.height}  scrollY ${Math.round(window.scrollY)}  body ${document.documentElement.scrollHeight}`,
        `Leiste oben ${r ? Math.round(r.top) : '–'} unten ${r ? Math.round(r.bottom) : '–'}  Fokus ${document.activeElement?.tagName}`,
      ].join('\n');
    };
    const anhaengen = () => { document.body.appendChild(box); zeigen(); };
    if (document.body) anhaengen(); else window.addEventListener('DOMContentLoaded', anhaengen);
    window.visualViewport?.addEventListener('resize', zeigen);
    window.visualViewport?.addEventListener('scroll', zeigen);
    window.addEventListener('scroll', zeigen, { passive: true });
    window.addEventListener('resize', zeigen);
    document.addEventListener('focusin', zeigen);
    document.addEventListener('focusout', () => setTimeout(zeigen, 500));
    setInterval(zeigen, 1000);
  }
} catch { /* Speicher gesperrt – keine Messanzeige */ }

if (window.visualViewport) {
  let zeitgeber;
  window.visualViewport.addEventListener('resize', () => {
    clearTimeout(zeitgeber);
    zeitgeber = setTimeout(() => {
      const vv = window.visualViewport;
      // Ansicht kleiner als das Fenster oder nach unten versetzt, obwohl keine Tastatur offen ist
      if (!eingabeAktiv() && (vv.offsetTop > 1 || window.innerHeight - vv.height > 1)) ansichtZuruecksetzen();
    }, 200);
  });
}

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((fehler) => {
      console.warn('Service-Worker konnte nicht registriert werden:', fehler);
    });
  });
}
