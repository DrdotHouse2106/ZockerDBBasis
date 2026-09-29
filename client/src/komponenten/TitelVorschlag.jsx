// „Titel vorschlagen“: fehlende Titel – z. B. alte Spiele ohne Barcode oder seltene Exoten – für den gemeinsamen
// Katalog einreichen, ohne sie gleich in die eigene Sammlung aufzunehmen. Das Moderationsteam (bzw. bei selbst
// gehosteten Servern zockerdb.de) prüft den Vorschlag und nimmt ihn in den Katalog auf.
import { useEffect, useMemo, useState } from 'react';
import { ARTIKELTYPEN } from '../../../shared/konstanten.js';
import { api } from '../api.js';
import { navigiere } from '../router.js';
import Symbol from './Symbole.jsx';
import PlattformVorschlag from './PlattformVorschlag.jsx';

const MAX_FOTOS = 4;
const NEUE_PLATTFORM = '__neu';

export default function TitelVorschlag({ titel = '', typ = 'spiel', zielName, onSchliessen }) {
  const [w, setW] = useState({ typ, titel, plattform: '', erscheinungsjahr: '', hersteller: '', beschreibung: '' });
  const [plattformen, setPlattformen] = useState([]);
  const [fehler, setFehler] = useState({});
  const [fertig, setFertig] = useState(null);
  const [sendet, setSendet] = useState(false);
  // Fotos helfen der Moderation beim Erkennen – sie werden nicht veröffentlicht
  const [fotos, setFotos] = useState([]);
  // Selbst vorgeschlagene Plattform (noch nicht in der Liste)
  const [neuePlattform, setNeuePlattform] = useState(null);
  useEffect(() => { api.plattformenAlle().then(setPlattformen).catch(() => {}); }, []);
  const vorschauen = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => () => vorschauen.forEach((u) => URL.revokeObjectURL(u)), [vorschauen]);
  const setze = (feld) => (e) => setW((x) => ({ ...x, [feld]: e.target.value }));

  const fotosWaehlen = (e) => {
    const neu = [...e.target.files].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    setFotos((alt) => [...alt, ...neu].slice(0, MAX_FOTOS));
    e.target.value = '';
  };

  async function absenden(e) {
    e.preventDefault();
    if (w.plattform === NEUE_PLATTFORM) {
      setFehler({ plattform: 'Bitte den Plattform-Vorschlag erst absenden oder eine Plattform aus der Liste wählen.' });
      return;
    }
    setSendet(true);
    setFehler({});
    try {
      const eintrag = await api.katalogAnlegen({ ...w, plattformen: w.plattform ? [w.plattform] : [], einreichen: true });
      // Fotos nacheinander hochladen – ein fehlerhaftes Foto hält den Vorschlag nicht auf
      let fehlgeschlagen = 0;
      for (const foto of fotos) {
        try { await api.belegfotoHochladen(eintrag.id, foto); } catch { fehlgeschlagen += 1; }
      }
      setFertig({ ...eintrag, fotos: fotos.length - fehlgeschlagen, fotosFehler: fehlgeschlagen });
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
            : `„${fertig.titel}“ wird ${zielName === 'zockerdb.de' ? 'von zockerdb.de' : 'vom Moderationsteam'} geprüft und danach in den Katalog aufgenommen. Bis dahin siehst nur du den Eintrag.`}
          {fertig.fotos > 0 && ` ${fertig.fotos === 1 ? 'Dein Foto hilft' : `Deine ${fertig.fotos} Fotos helfen`} dabei.`}
          {fertig.fotosFehler > 0 && ` ${fertig.fotosFehler} Foto(s) konnten nicht hochgeladen werden.`}
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
            {neuePlattform && <option value={neuePlattform}>{neuePlattform} (vorgeschlagen)</option>}
            <option value={NEUE_PLATTFORM}>➕ Plattform fehlt – vorschlagen …</option>
          </select>
          {fehler.plattform && <span className="text-gefahr">{fehler.plattform}</span>}
        </label>
        {w.plattform === NEUE_PLATTFORM && (
          <div className="sm:col-span-2">
            <PlattformVorschlag zielName={zielName} onAbbrechen={() => setW((x) => ({ ...x, plattform: '' }))}
              onFertig={(v) => { setNeuePlattform(v.name); setW((x) => ({ ...x, plattform: v.name })); setFehler({}); }} />
          </div>
        )}
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
        <div className="text-sm sm:col-span-2">
          <span className="mb-1 block text-leise">Fotos (optional, bis zu {MAX_FOTOS})</span>
          <p className="mb-2 text-xs text-leise">
            Vorder- und Rückseite, Modul oder Etikett helfen beim Erkennen. Die Fotos sieht nur die Moderation – sie werden
            nicht veröffentlicht und nach der Prüfung gelöscht. Standortdaten werden vorher entfernt.
          </p>
          <div className="flex flex-wrap gap-2">
            {vorschauen.map((url, i) => (
              <div key={url} className="relative size-20 overflow-hidden rounded-lg border border-rand">
                <img src={url} alt={`Foto ${i + 1}`} className="size-full object-cover" />
                <button type="button" className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 text-white" aria-label={`Foto ${i + 1} entfernen`}
                  onClick={() => setFotos((alt) => alt.filter((_, j) => j !== i))}>
                  <Symbol name="schliessen" className="size-4" />
                </button>
              </div>
            ))}
            {fotos.length < MAX_FOTOS && (
              <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-rand text-xs text-leise hover:border-akzent">
                <Symbol name="kamera" className="size-5" />Foto
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={fotosWaehlen} />
              </label>
            )}
          </div>
        </div>
      </div>
      {fehler.allgemein && <p className="text-sm text-gefahr" role="alert">{fehler.allgemein}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="knopf-primaer" disabled={sendet}>{sendet ? 'Wird gesendet …' : 'Vorschlag senden'}</button>
        <button type="button" className="knopf-sekundaer" onClick={onSchliessen}>Abbrechen</button>
      </div>
    </form>
  );
}
