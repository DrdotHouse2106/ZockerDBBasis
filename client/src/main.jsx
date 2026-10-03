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
// Bleibt die Ansicht trotzdem verschoben (iOS merkt sich teils die Höhe mit offener Tastatur), wird der Versatz
// gemessen und Fuß- und Kopfleiste werden passend verschoben (CSS-Variablen --vv-unten und --vv-oben).
// Bei offener Tastatur und beim Hineinzoomen bleibt alles, wie der Browser es macht.
function versatzMessen() {
  const vv = window.visualViewport;
  let unten = 0;
  let oben = 0;
  if (vv && !eingabeAktiv() && vv.scale <= 1.01) {
    unten = Math.round(vv.offsetTop + vv.height - window.innerHeight);
    oben = Math.round(vv.offsetTop);
    if (Math.abs(unten) <= 1) unten = 0;
    if (Math.abs(oben) <= 1) oben = 0;
  }
  const stil = document.documentElement.style;
  stil.setProperty('--vv-unten', `${unten}px`);
  stil.setProperty('--vv-oben', `${oben}px`);
}
let messungGeplant = false;
function versatzPlanen() {
  if (messungGeplant) return;
  messungGeplant = true;
  requestAnimationFrame(() => { messungGeplant = false; versatzMessen(); });
}
window.visualViewport?.addEventListener('resize', versatzPlanen);
window.visualViewport?.addEventListener('scroll', versatzPlanen);
window.addEventListener('scroll', versatzPlanen, { passive: true });
window.addEventListener('resize', versatzPlanen);
document.addEventListener('focusin', versatzPlanen);
document.addEventListener('focusout', () => setTimeout(versatzPlanen, 450));
document.addEventListener('visibilitychange', versatzPlanen);
window.addEventListener('pageshow', versatzPlanen);

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
