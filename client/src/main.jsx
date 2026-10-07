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
// Hängengebliebene Tastatur-Ansicht: iOS meldet eine um die Tastaturhöhe verkleinerte, verschobene Ansicht
// (z. B. visualViewport 611 statt 956, offsetTop 330), obwohl kein Eingabefeld aktiv ist – etwa wenn ein Feld mit
// offener Tastatur beim Seitenwechsel verschwindet. Scrollen hilft dann nicht; ein kurz fokussiertes und wieder
// verlassenes unsichtbares Feld lässt iOS die Tastatur „schließen“ und die Ansicht wiederherstellen.
let haengtSeit = 0;
let zuletztRepariert = 0;
function tastaturHaengt() {
  const vv = window.visualViewport;
  return Boolean(vv && !eingabeAktiv() && vv.scale <= 1.01 && window.innerHeight - vv.height > 100);
}
// Zähler für die Messanzeige (zur Fehlersuche: greift die Reparatur überhaupt?)
const reparaturen = { zeitgeber: 0, beruehrung: 0 };
// `mitTastatur`: iOS reagiert auf Fokus aus einem Zeitgeber (ohne Berührung) oft gar nicht. Innerhalb einer Berührung
// darf ein Feld die Tastatur wirklich öffnen – das sofortige Verlassen schließt sie und stellt die Ansicht wieder her.
function tastaturReparieren(mitTastatur = false) {
  zuletztRepariert = Date.now();
  reparaturen[mitTastatur ? 'beruehrung' : 'zeitgeber'] += 1;
  const feld = document.createElement('input');
  feld.setAttribute('aria-hidden', 'true');
  if (!mitTastatur) feld.setAttribute('inputmode', 'none');
  feld.tabIndex = -1;
  feld.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none;border:0;padding:0';
  document.body.appendChild(feld);
  try { feld.focus({ preventScroll: true }); } catch { feld.focus(); }
  setTimeout(() => {
    feld.blur();
    feld.remove();
    ansichtZuruecksetzen();
  }, 60);
}
setInterval(() => {
  if (!tastaturHaengt()) { haengtSeit = 0; return; }
  if (!haengtSeit) { haengtSeit = Date.now(); return; }
  // Erst nach kurzer Zeit eingreifen (Tastatur schließt gerade) und höchstens alle 3 Sekunden
  if (Date.now() - haengtSeit >= 700 && Date.now() - zuletztRepariert > 3000) tastaturReparieren();
}, 400);
// Hängt die Ansicht noch, repariert die nächste Berührung (außer auf Eingabefeldern, dort öffnet sich die Tastatur ohnehin)
document.addEventListener('touchend', (e) => {
  if (!tastaturHaengt() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '')) return;
  if (Date.now() - zuletztRepariert < 1000) return;
  tastaturReparieren(true);
}, { passive: true });

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
        `Reparaturen Zeitgeber ${reparaturen.zeitgeber}  Berührung ${reparaturen.beruehrung}`,
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

// In der App (Capacitor) ist die Oberfläche gebündelt – dort kein Service-Worker
const inApp = window.Capacitor?.isNativePlatform?.() === true;
if ('serviceWorker' in navigator && import.meta.env.PROD && !inApp) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((fehler) => {
      console.warn('Service-Worker konnte nicht registriert werden:', fehler);
    });
  });
}
