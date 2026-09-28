// „Titel vorschlagen“: fehlende Titel – z. B. alte Spiele ohne Barcode oder seltene Exoten – für den gemeinsamen
// Katalog einreichen, ohne sie gleich in die eigene Sammlung aufzunehmen. Das Moderationsteam (bzw. bei selbst
// gehosteten Servern zockerdb.de) prüft den Vorschlag und nimmt ihn in den Katalog auf.
import { useEffect, useState } from 'react';
import { ARTIKELTYPEN } from '../../../shared/konstanten.js';
import { api } from '../api.js';
import { navigiere } from '../router.js';
import Symbol from './Symbole.jsx';

export default function TitelVorschlag({ titel = '', typ = 'spiel', zielName, onSchliessen }) {
  const [w, setW] = useState({ typ, titel, plattform: '', erscheinungsjahr: '', hersteller: '', beschreibung: '' });
  const [plattformen, setPlattformen] = useState([]);
  const [fehler, setFehler] = useState({});
  const [fertig, setFertig] = useState(null);
  const [sendet, setSendet] = useState(false);
  useEffect(() => { api.plattformenAlle().then(setPlattformen).catch(() => {}); }, []);
  const setze = (feld) => (e) => setW((x) => ({ ...x, [feld]: e.target.value }));

  async function absenden(e) {
    e.preventDefault();
    setSendet(true);
    setFehler({});
    try {
      const eintrag = await api.katalogAnlegen({ ...w, plattformen: w.plattform ? [w.plattform] : [], einreichen: true });
      setFertig(eintrag);
    } catch (f) {
      setFehler(f.felder ?? { allgemein: f.message });
    } finally {
      setSendet(false);
    }
  }

  if (fertig) {
    return (
      <section className="karte space-y-3 border-erfolg/50 p-4" role="status">
        <p className="font-semibold">Danke für deinen Vorschlag!</p>
        <p className="text-sm text-leise">
          {fertig.zentral_fehler ? `Gespeichert, aber zockerdb.de war nicht erreichbar (${fertig.zentral_fehler}) – du kannst ihn später auf der Katalogseite erneut freigeben.`
            : `„${fertig.titel}“ wird von ${zielName} geprüft und danach in den Katalog aufgenommen. Bis dahin siehst nur du den Eintrag.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="knopf-primaer" onClick={() => navigiere('/neu/formular', { katalog: fertig.id, typ: fertig.typ })}>
            <Symbol name="plus" className="size-4" />Auch zur Sammlung hinzufügen
          </button>
          <button type="button" className="knopf-sekundaer" onClick={onSchliessen}>Fertig</button>
        </div>
      </section>
    );
  }

  return (
    <form className="karte space-y-3 p-4" onSubmit={absenden}>
      <h2 className="flex items-center gap-2 font-semibold"><Symbol name="dokument" className="size-5" />Titel für den Katalog vorschlagen</h2>
      <p className="text-sm text-leise">
        Für Titel, die nirgends zu finden sind – z. B. alte Spiele ohne Barcode, Sonderauflagen oder Exoten. {zielName} prüft
        den Vorschlag und nimmt ihn in den gemeinsamen Katalog auf.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-leise">Titel (wie auf der Verpackung) *</span>
          <input className="eingabe" value={w.titel} onChange={setze('titel')} required maxLength={200} />
          {fehler.titel && <span className="text-gefahr">{fehler.titel}</span>}
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-leise">Art</span>
          <select className="eingabe" value={w.typ} onChange={setze('typ')}>
            {ARTIKELTYPEN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-leise">Plattform</span>
          <select className="eingabe" value={w.plattform} onChange={setze('plattform')}>
            <option value="">– bitte wählen –</option>
            {plattformen.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-leise">Erscheinungsjahr</span>
          <input className="eingabe" value={w.erscheinungsjahr} onChange={setze('erscheinungsjahr')} inputMode="numeric" maxLength={4} placeholder="z. B. 1987" />
          {fehler.erscheinungsjahr && <span className="text-gefahr">{fehler.erscheinungsjahr}</span>}
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-leise">Hersteller / Publisher</span>
          <input className="eingabe" value={w.hersteller} onChange={setze('hersteller')} maxLength={200} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-leise">Besonderheiten (optional)</span>
          <textarea className="eingabe min-h-20" value={w.beschreibung} onChange={setze('beschreibung')} maxLength={5000}
            placeholder="z. B. deutsche Erstauflage im Pappkarton, kein Barcode, nur über Versandhandel erhältlich" />
        </label>
      </div>
      {fehler.allgemein && <p className="text-sm text-gefahr" role="alert">{fehler.allgemein}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="knopf-primaer" disabled={sendet}>{sendet ? 'Wird gesendet …' : 'Vorschlag senden'}</button>
        <button type="button" className="knopf-sekundaer" onClick={onSchliessen}>Abbrechen</button>
      </div>
    </form>
  );
}
