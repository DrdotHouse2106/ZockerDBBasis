// Sprachen eines Spiels laut IGDB: Sprachausgabe, Untertitel, Menü/Texte – Deutsch und Englisch zuerst.
import { SPRACH_ARTEN, sprachListe } from '../../../shared/sprachen.js';

const ARTNAME = Object.fromEntries(SPRACH_ARTEN);

function Zeile({ s }) {
  return (
    <li className="flex flex-wrap items-center gap-1.5">
      <span className="w-28 shrink-0 font-medium">{s.name}</span>
      {SPRACH_ARTEN.map(([art, name]) => (
        <span key={art} className={`abzeichen ${s.arten.includes(art) ? '' : 'line-through opacity-40'}`}
          title={s.arten.includes(art) ? `${name} auf ${s.name}` : `Keine ${name} auf ${s.name} bekannt`}>
          {ARTNAME[art]}
        </span>
      ))}
    </li>
  );
}

export default function Sprachen({ sprachen, kompakt = false }) {
  const liste = sprachListe(sprachen);
  if (!liste.length) return null;
  const vorne = liste.filter((s) => s.code === 'de' || s.code === 'en');
  const rest = liste.filter((s) => s.code !== 'de' && s.code !== 'en');
  const deutsch = liste.find((s) => s.code === 'de');
  return (
    <section className={kompakt ? 'space-y-1.5 text-sm' : 'karte space-y-2 p-4 text-sm'} data-testid="sprachen">
      <h3 className="font-semibold">Sprachen</h3>
      {!deutsch && <p className="text-leise">Laut IGDB ohne deutsche Sprachausgabe oder Texte.</p>}
      <ul className="space-y-1">{vorne.map((s) => <Zeile key={s.code} s={s} />)}</ul>
      {rest.length > 0 && (
        <details>
          <summary className="cursor-pointer text-leise">Weitere Sprachen ({rest.length})</summary>
          <ul className="mt-1 space-y-1">{rest.map((s) => <Zeile key={s.code} s={s} />)}</ul>
        </details>
      )}
      <p className="text-xs text-leise">Laut IGDB für das Spiel insgesamt – einzelne Fassungen (z. B. PAL/NTSC) können abweichen.</p>
    </section>
  );
}
