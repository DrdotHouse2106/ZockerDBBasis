// Erfahrungsberichte zu einem Spiel: für angemeldete Benutzer sichtbar (mit Namen), freiwillig und jederzeit zurückziehbar.
// Schreiben kann nur, wer das Spiel in der Sammlung hat; das Moderationsteam kann gemeldete Berichte ausblenden.
import { useState } from 'react';
import { api } from '../api.js';
import { datumDe } from '../format.js';
import { Andockpunkt } from '../erweiterungen.jsx';
import { useHinweis } from './Hinweise.jsx';

const Sterne = ({ wert }) => (wert ? <span className="text-warnung" aria-label={`${wert} von 5 Sternen`}>{'★'.repeat(wert)}<span className="text-leise/40">{'★'.repeat(5 - wert)}</span></span> : null);

export default function Erfahrungsberichte({ katalogId, berichte = [], darfSchreiben, moderator, onGeaendert }) {
  const zeigeHinweis = useHinweis();
  const eigener = berichte.find((b) => b.eigener);
  const andere = berichte.filter((b) => !b.eigener);
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState(eigener?.text ?? '');
  const [wertung, setWertung] = useState(eigener?.wertung ?? null);
  if (!darfSchreiben && !berichte.length) return null;

  const ausfuehren = async (fn, meldung) => {
    try {
      await fn();
      zeigeHinweis(meldung);
      setOffen(false);
      onGeaendert?.();
    } catch (e) {
      zeigeHinweis(Object.values(e.felder ?? {})[0] ?? e.message, 'fehler');
    }
  };

  return (
    <section className="karte space-y-3 p-4">
      <h3 className="font-semibold">Erfahrungsberichte von Sammlern {andere.length > 0 && <span className="text-sm font-normal text-leise">· {andere.length}</span>}</h3>
      {andere.length === 0 && !eigener && <p className="text-sm text-leise">Noch keine Berichte.</p>}
      <ul className="space-y-3">
        {andere.map((b) => (
          <li key={b.id} className="space-y-1 border-t border-rand pt-2 text-sm">
            <p className="flex flex-wrap items-center gap-2"><strong>{b.name}</strong><Sterne wert={b.wertung} /><span className="text-xs text-leise">{datumDe(b.aktualisiert_am)}</span></p>
            <p className="whitespace-pre-wrap">{b.text}</p>
            <div className="flex gap-3 text-xs">
              <Andockpunkt name="melden" bereich="bericht" zielId={b.id} klein />
              {moderator && <button type="button" className="text-leise underline" onClick={() => ausfuehren(() => api.berichtSichtbarkeit(b.id, true), 'Bericht ausgeblendet.')}>Ausblenden</button>}
            </div>
          </li>
        ))}
      </ul>
      {darfSchreiben && (eigener && !offen ? (
        <div className="space-y-1 rounded-xl bg-karte-hover p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2"><strong>Dein Bericht</strong><Sterne wert={eigener.wertung} />
            {eigener.status === 'ausgeblendet' && <span className="abzeichen text-warnung">vom Moderationsteam ausgeblendet</span>}</p>
          <p className="whitespace-pre-wrap">{eigener.text}</p>
          <div className="flex gap-3 text-xs">
            <button type="button" className="underline" onClick={() => setOffen(true)}>Bearbeiten</button>
            <button type="button" className="underline" onClick={() => window.confirm('Deinen Erfahrungsbericht zurückziehen (löschen)?')
              && ausfuehren(() => api.berichtLoeschen(katalogId), 'Bericht zurückgezogen.')}>Zurückziehen</button>
          </div>
        </div>
      ) : offen ? (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); ausfuehren(() => api.berichtSpeichern(katalogId, { text, wertung }), 'Danke für deinen Bericht!'); }}>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Wertung">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={wertung === n} className={`text-2xl ${wertung >= n ? 'text-warnung' : 'text-leise/40'}`}
                onClick={() => setWertung(wertung === n ? null : n)}>★</button>
            ))}
            <span className="ml-2 text-xs text-leise">optional</span>
          </div>
          <textarea className="eingabe min-h-28" value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} required
            placeholder="Wie spielt es sich heute? Worauf sollte man beim Kauf achten? Was macht die PAL-Version anders?" />
          <p className="text-xs text-leise">Sichtbar für angemeldete Benutzer mit deinem Namen. Du kannst ihn jederzeit bearbeiten oder zurückziehen.</p>
          <div className="flex gap-2">
            <button type="submit" className="knopf-primaer">Veröffentlichen</button>
            <button type="button" className="knopf-sekundaer" onClick={() => setOffen(false)}>Abbrechen</button>
          </div>
        </form>
      ) : (
        <button type="button" className="knopf-sekundaer" onClick={() => setOffen(true)}>Eigenen Erfahrungsbericht schreiben</button>
      ))}
    </section>
  );
}
