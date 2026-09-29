import { useState } from 'react';
import { nachHersteller, usePlattformen } from '../plattformen.js';

const ANDERE = '__andere';

/**
 * Auswahlfeld mit allen Plattformen, gruppiert nach Hersteller.
 * `nur`: Plattform-IDs, für die es den Titel gibt (aus dem Katalogeintrag) – dann stehen nur diese zur Wahl,
 * alle übrigen erst nach „Andere Plattform …“ (z. B. bei unvollständigen Katalogdaten).
 */
export default function PlattformAuswahl({ id, wert, onChange, leerText = '– Plattform wählen –', className = 'eingabe', nur = null }) {
  const plattformen = usePlattformen();
  const [alle, setAlle] = useState(false);
  const eingeschraenkt = !alle && nur?.length > 0 && (!wert || nur.includes(wert));
  const liste = eingeschraenkt ? plattformen.filter((p) => nur.includes(p.id)) : plattformen;
  return (
    <select id={id} className={className} value={wert ?? ''}
      onChange={(e) => (e.target.value === ANDERE ? setAlle(true) : onChange(e.target.value ? Number(e.target.value) : null))}>
      <option value="">{leerText}</option>
      {eingeschraenkt && liste.map((p) => <option key={p.id} value={p.id}>{p.name}{p.kurz !== p.name ? ` (${p.kurz})` : ''}</option>)}
      {eingeschraenkt && <option value={ANDERE}>Andere Plattform …</option>}
      {!eingeschraenkt && nachHersteller(liste).map(([hersteller, liste]) => (
        <optgroup key={hersteller} label={hersteller}>
          {liste.map((p) => <option key={p.id} value={p.id}>{p.name}{p.kurz !== p.name ? ` (${p.kurz})` : ''}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
