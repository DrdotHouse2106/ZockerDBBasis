// Links zu Impressum, Datenschutz, Nutzungsbedingungen und Sicherheit – auf jeder Seite. Dazu der Quellenhinweis für IGDB,
// der laut Nutzungsvereinbarung auf jeder Seite mit Spieldaten stehen muss (Wortlaut wie von IGDB vorgegeben).
import { MODUL } from '../erweiterungen.jsx';

export default function Fusszeile({ className = '' }) {
  const links = [
    ['impressum', 'Impressum'],
    ['datenschutz', 'Datenschutz'],
    ['nutzungsbedingungen', 'Nutzungsbedingungen'],
    // Weitere Seiten von Zusatzmodulen (z. B. Widerrufsbelehrung)
    ...(MODUL.fusszeilenLinks ?? []),
    ['sicherheit', 'Sicherheitslücke melden'],
  ];
  return (
    <footer className={`mx-auto max-w-6xl px-4 py-6 text-center text-xs text-leise ${className}`}>
      <nav aria-label="Rechtliches" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {links.map(([slug, label]) => <a key={slug} href={`#/seite/${slug}`} className="hover:text-text hover:underline">{label}</a>)}
      </nav>
      <p className="mt-2">
        <a href="https://www.igdb.com" target="_blank" rel="noopener noreferrer" className="hover:text-text hover:underline" data-testid="igdb-hinweis">
          Games metadata is powered by IGDB.com
        </a>
      </p>
    </footer>
  );
}
