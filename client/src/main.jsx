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
