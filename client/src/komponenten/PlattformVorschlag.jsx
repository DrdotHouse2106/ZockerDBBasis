// „Plattform vorschlagen“: Systeme, die in der Plattformliste fehlen (z. B. Radofin 1292, Interton VC 4000).
// Das Moderationsteam (bzw. selbst gehostet zockerdb.de) prüft den Vorschlag und legt die Plattform an.
import { useEffect, useState } from 'react';
import { api } from '../api.js';

const TYPEN = [['konsole', 'Konsole'], ['handheld', 'Handheld'], ['computer', 'Computer'], ['sonstige', 'Sonstiges']];

export default function PlattformVorschlag({ name = '', zielName, onFertig, onAbbrechen }) {
  const leer = { name, hersteller: '', erscheinungsjahr: '', typ: 'konsole', hinweis: '' };
  const [w, setW] = useState(leer);
  const [fehler, setFehler] = useState({});
  const [sendet, setSendet] = useState(false);
  // Eigene offene Vorschläge lassen sich ändern, bis sie entschieden sind
  const [offene, setOffene] = useState([]);
  const [bearbeitet, setBearbeitet] = useState(null);
  const setze = (feld) => (e) => setW((x) => ({ ...x, [feld]: e.target.value }));
  const offeneLaden = () => api.eigenePlattformVorschlaege().then((l) => setOffene(l.filter((v) => v.status === 'offen'))).catch(() => {});
  useEffect(() => { offeneLaden(); }, []);

  async function absenden() {
    setSendet(true);
    setFehler({});
    try {
      if (bearbeitet) {
        await api.plattformVorschlagAendern(bearbeitet, w);
        setBearbeitet(null);
        setW(leer);
        offeneLaden();
        return;
      }
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
      <p className="text-sm font-semibold">{bearbeitet ? 'Vorschlag bearbeiten' : 'Fehlende Plattform vorschlagen'}</p>
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
        <button type="button" className="knopf-primaer" disabled={sendet || !w.name.trim()} onClick={absenden}>
          {sendet ? 'Wird gesendet …' : bearbeitet ? 'Änderung speichern' : 'Plattform vorschlagen'}
        </button>
        {bearbeitet ? <button type="button" className="knopf-sekundaer" onClick={() => { setBearbeitet(null); setW(leer); setFehler({}); }}>Bearbeiten abbrechen</button>
          : onAbbrechen && <button type="button" className="knopf-sekundaer" onClick={onAbbrechen}>Abbrechen</button>}
      </div>
      {offene.length > 0 && (
        <div className="space-y-1 border-t border-rand pt-2 text-sm" data-testid="offene-plattform-vorschlaege">
          <p className="text-xs text-leise">Deine offenen Vorschläge (änderbar, bis sie geprüft sind):</p>
          {offene.map((v) => (
            <div key={v.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{v.name}{v.hersteller ? ` (${v.hersteller})` : ''}</span>
              <button type="button" className="text-xs text-akzent-hell underline" onClick={() => {
                setBearbeitet(v.id);
                setFehler({});
                setW({ name: v.name, hersteller: v.hersteller ?? '', erscheinungsjahr: v.erscheinungsjahr ?? '', typ: v.typ, hinweis: v.hinweis ?? '' });
              }}>Bearbeiten</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
