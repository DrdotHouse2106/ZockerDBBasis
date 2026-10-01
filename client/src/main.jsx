import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// iOS (installierte App): Nach dem Schließen der Tastatur bleibt die Ansicht manchmal verkleinert – die Fußleiste
// steht dann mitten im Bild. Ein minimales Scrollen lässt Safari die Ansicht neu berechnen.
document.addEventListener('focusout', () => {
  setTimeout(() => {
    const fokus = document.activeElement;
    if (fokus && /^(INPUT|TEXTAREA|SELECT)$/.test(fokus.tagName)) return;
    window.scrollTo(window.scrollX, window.scrollY);
  }, 120);
});

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
