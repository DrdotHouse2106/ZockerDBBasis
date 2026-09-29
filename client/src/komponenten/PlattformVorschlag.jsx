// „Plattform vorschlagen“: Systeme, die in der Plattformliste fehlen (z. B. Radofin 1292, Interton VC 4000).
// Das Moderationsteam (bzw. selbst gehostet zockerdb.de) prüft den Vorschlag und legt die Plattform an.
import { useState } from 'react';
import { api } from '../api.js';

const TYPEN = [['konsole', 'Konsole'], ['handheld', 'Handheld'], ['computer', 'Computer'], ['sonstige', 'Sonstiges']];

export default function PlattformVorschlag({ name = '', zielName, onFertig, onAbbrechen }) {
  const [w, setW] = useState({ name, hersteller: '', erscheinungsjahr: '', typ: 'konsole', hinweis: '' });
  const [fehler, setFehler] = useState({});
  const [sendet, setSendet] = useState(false);
  const setze = (feld) => (e) => setW((x) => ({ ...x, [feld]: e.target.value }));

  async function absenden() {
    setSendet(true);
    setFehler({});
    try {
      const v = await api.plattformVorschlagen(w);
      onFertig?.(v);
    } catch (f) {
      setFehler(f.felder ?? { allgemein: f.message });
    } finally {
      setSendet(false);
    }
  }

  // Kein eigenes <form>: Die Komponente steht auch innerhalb des Titel-Vorschlags
  return (
    <div className="space-y-3 rounded-xl border border-akzent/40 p-3">
      <p className="text-sm font-semibold">Fehlende Plattform vorschlagen</p>
      <p className="text-xs text-leise">{zielName} prüft den Vorschlag und nimmt die Plattform in die Liste auf. Du bekommst eine Benachrichtigung.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-leise">Name der Plattform *</span>
          <input className="eingabe" value={w.name} onChange={setze('name')} maxLength={100} placeholder="z. B. Radofin 1292 Advanced Programmable Video System" />
          {fehler.name && <span className="text-gefahr">{fehler.name}</span>}
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-leise">Hersteller</span>
          <input className="eingabe" value={w.hersteller} onChange={setze('hersteller')} maxLength={60} placeholder="z. B. Radofin" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-leise">Erscheinungsjahr</span>
          <input className="eingabe" value={w.erscheinungsjahr} onChange={setze('erscheinungsjahr')} inputMode="numeric" maxLength={4} placeholder="z. B. 1978" />
          {fehler.erscheinungsjahr && <span className="text-gefahr">{fehler.erscheinungsjahr}</span>}
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-leise">Art</span>
          <select className="eingabe" value={w.typ} onChange={setze('typ')}>
            {TYPEN.map(([wert, label]) => <option key={wert} value={wert}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-leise">Hinweis (optional)</span>
          <input className="eingabe" value={w.hinweis} onChange={setze('hinweis')} maxLength={1000} placeholder="z. B. auch als Interton VC 4000 bekannt" />
        </label>
      </div>
      {fehler.allgemein && <p className="text-sm text-gefahr" role="alert">{fehler.allgemein}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="knopf-primaer" disabled={sendet || !w.name.trim()} onClick={absenden}>{sendet ? 'Wird gesendet …' : 'Plattform vorschlagen'}</button>
        {onAbbrechen && <button type="button" className="knopf-sekundaer" onClick={onAbbrechen}>Abbrechen</button>}
      </div>
    </div>
  );
}
