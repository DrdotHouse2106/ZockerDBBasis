// Hinweis mit Link zur Seite „Freistellungen prüfen“ (Konto, Administration).
import { anzahl } from '../format.js';
import Symbol from './Symbole.jsx';

/** Kleiner Hinweis mit Link, solange freigestellte Fotos auf eine Entscheidung warten (Konto, Administration). */
export default function FreistellenPruefenHinweis({ zuPruefen }) {
  if (!zuPruefen) return null;
  return (
    <a href="#/freistellen-pruefen" className="karte flex items-center gap-2 p-3 text-sm hover:opacity-80" data-testid="freistellen-pruefen-link">
      <Symbol name="kamera" className="size-5" />
      <span className="flex-1"><strong>{anzahl(zuPruefen)}</strong> freigestellte {zuPruefen === 1 ? 'Foto wartet' : 'Fotos warten'} auf deine Prüfung</span>
      <span className="text-akzent-hell">Jetzt prüfen →</span>
    </a>
  );
}
