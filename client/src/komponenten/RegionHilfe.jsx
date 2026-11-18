// Hilfe zur Region (PAL-DE, PAL-UK …): woran man sie an Hülle und Datenträger erkennt, und ein Vorschlag aus der Produktnummer.
import { useState } from 'react';
import { REGIONEN } from '../../../shared/konstanten.js';
import { REGION_MERKMALE, regionAusProduktnummer } from '../../../shared/nummernhilfe.js';

/** „ⓘ Woran erkenne ich die Region?“ – aufklappbar. */
export function RegionHilfe() {
  const [offen, setOffen] = useState(false);
  return (
    <div className="mt-1 text-xs">
      <button type="button" className="font-medium text-akzent-hell underline" aria-expanded={offen} onClick={() => setOffen((o) => !o)} data-testid="region-info">
        ⓘ Woran erkenne ich die Region?
      </button>
      {offen && (
        <div className="mt-2 space-y-1 rounded-lg bg-karte-hover p-2" role="note" data-testid="region-hilfe">
          {REGION_MERKMALE.map(([titel, text]) => <p key={titel}><strong>{titel}:</strong> {text}</p>)}
        </div>
      )}
    </div>
  );
}

/** Vorschlag aus der Produktnummer (z. B. „SNSP-MW-NOE“ → PAL-DE), wenn er von der gewählten Region abweicht. */
export function RegionAusNummer({ nummer, region, onUebernehmen }) {
  const treffer = regionAusProduktnummer(nummer);
  if (!treffer) return null;
  if (!treffer.region) {
    // Nur „Europa“ bekannt: passt eine PAL-Region, ist nichts zu tun
    if (String(region ?? '').startsWith('pal')) return null;
    return <p className="mt-1 text-xs text-leise" data-testid="region-aus-nummer">Laut Produktnummer ({treffer.grund}): {treffer.hinweis}</p>;
  }
  if (treffer.region === region) return null;
  const name = REGIONEN.find((r) => r.value === treffer.region)?.label ?? treffer.region;
  return (
    <p className="mt-1 text-xs" data-testid="region-aus-nummer">
      Laut Produktnummer ({treffer.grund}): <strong>{name}</strong>{' '}
      <button type="button" className="font-medium text-akzent-hell underline" onClick={() => onUebernehmen(treffer.region)}>übernehmen</button>
    </p>
  );
}
