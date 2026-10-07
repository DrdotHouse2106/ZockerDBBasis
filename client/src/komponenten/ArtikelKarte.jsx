import { DIGITAL_QUELLEN, titelUndAusgabe } from '../../../shared/konstanten.js';
import Cover from './Cover.jsx';
import Abzeichen from './Abzeichen.jsx';
import Symbol from './Symbole.jsx';

/** Schriftzug für digitale Spiele: „DIGITAL · STEAM“, „DIGITAL · PLAYSTATION“ … */
export const digitalBand = (a) => {
  if (a?.bestand !== 'digital') return null;
  const kurz = DIGITAL_QUELLEN.find((q) => q.value === a.digital_quelle)?.kurz;
  return `Digital${kurz ? ` · ${kurz}` : ''}`;
};

export default function ArtikelKarte({ artikel, href, exemplare }) {
  // „Horizon Zero Dawn: Complete Edition“ erscheint als „Horizon Zero Dawn“ mit der Ausgabe darunter (wie eine erfasste Edition)
  const { titel, ausgabe } = titelUndAusgabe(artikel.titel);
  const edition = artikel.edition || ausgabe;
  const variante = [edition, artikel.farbe, artikel.modellnummer].filter(Boolean).join(' · ');
  return (
    <a
      href={href ?? `#/artikel/${artikel.id}`}
      className="karte group flex flex-col overflow-hidden transition hover:border-akzent/60 hover:bg-karte-hover"
    >
      <Cover url={artikel.bild_url} typ={artikel.typ} alt={artikel.titel} className="aspect-[3/4] w-full" band={digitalBand(artikel)} />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold">
          {Boolean(artikel.privat) && <Symbol name="schloss" className="mr-1 inline size-3.5 align-[-2px] text-leise" titel="Privat – nur für dich sichtbar" />}
          {titel}
        </h3>
        {artikel.plattform && (
          <p className="flex items-center gap-1.5 truncate text-xs text-leise">
            {artikel.plattform_kurz && <span className="abzeichen shrink-0 px-1 py-0 text-akzent-hell">{artikel.plattform_kurz}</span>}
            <span className="truncate">{artikel.plattform}</span>
          </p>
        )}
        {artikel.verliehen_an && <p className="truncate text-xs font-semibold text-sky-500">Verliehen an {artikel.verliehen_an}</p>}
        {artikel.bestand && !['besitz', 'digital'].includes(artikel.bestand) && (
          <p className="text-xs font-semibold text-warnung">
            {artikel.bestand === 'verkauft' ? 'Verkauft' : artikel.bestand === 'verpackung' ? 'Leere Hülle' : 'Abgegeben'}{artikel.abgang_am ? ` am ${artikel.abgang_am.split('-').reverse().join('.')}` : ''}
          </p>
        )}
        {exemplare > 1
          ? <p className="text-xs font-semibold text-akzent-hell">{exemplare} {artikel.bestand === 'digital' ? 'Einträge' : 'Exemplare / Varianten'}</p>
          : variante && <p className="text-xs break-words text-akzent-hell">{variante}</p>}
        <div className="mt-auto pt-1">
          <Abzeichen artikel={artikel} />
        </div>
      </div>
    </a>
  );
}
