// Import aus CLZ Games, Tabellen (Excel/LibreOffice als CSV) oder dem eigenen CSV-Export
import { useEffect, useState } from 'react';
import { ARTIKELTYPEN, REGIONEN, ZUSTAENDE, VOLLSTAENDIGKEITEN, beschriftung } from '../../../shared/konstanten.js';
import { api } from '../api.js';
import Layout from '../komponenten/Layout.jsx';
import Symbol from '../komponenten/Symbole.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';

async function leseDatei(datei) {
  const puffer = await datei.arrayBuffer();
  // UTF-8 bevorzugen, bei Fehlern (z. B. Excel unter Windows) als Windows-1252 lesen
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(puffer);
  } catch {
    return new TextDecoder('windows-1252').decode(puffer);
  }
}

export default function Import({ route }) {
  const zeigeHinweis = useHinweis();
  const [text, setText] = useState(null);
  const [name, setName] = useState('');
  const [analyse, setAnalyse] = useState(null);
  const [zuordnung, setZuordnung] = useState({});
  const [standardTyp, setStandardTyp] = useState('spiel');
  const [abgleich, setAbgleich] = useState(true);
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState(null);

  async function dateiGewaehlt(e) {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei) return;
    if (datei.size > 10 * 1024 * 1024) return zeigeHinweis('Die Datei ist größer als 10 MB. Bitte aufteilen.', 'fehler');
    try {
      const inhalt = await leseDatei(datei);
      const a = await api.csvAnalyse(inhalt);
      setText(inhalt); setName(datei.name); setAnalyse(a); setZuordnung(a.zuordnung); setErgebnis(null);
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    }
  }

  async function starten() {
    setLaeuft(true);
    try {
      const r = await api.csvImport({ text, zuordnung, standardTyp, katalogAbgleich: abgleich });
      setErgebnis(r);
      zeigeHinweis(`${r.importiert} Artikel importiert.`);
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Layout route={route} titel="Sammlung importieren" zurueck="/einstellungen">
      <div className="mx-auto max-w-4xl space-y-4 pb-8">
        <section className="karte space-y-3 p-4">
          <h2 className="font-semibold">CSV-Datei auswählen</h2>
          <p className="text-sm text-leise">
            Unterstützt werden CSV-Dateien aus <strong className="text-text">CLZ Games</strong> (Export → CSV), aus Excel/LibreOffice
            („Speichern unter → CSV“) und der CSV-Export dieser App. Die erste Zeile muss die Spaltenüberschriften enthalten.
            Bis zu 5.000 Zeilen pro Datei. Importierte Artikel werden ergänzt – nichts wird überschrieben.
          </p>
          <label className="knopf-primaer w-fit cursor-pointer">
            <Symbol name="hochladen" className="size-4" />{text ? 'Andere Datei wählen' : 'Datei wählen'}
            <input type="file" accept=".csv,text/csv,.txt" className="sr-only" onChange={dateiGewaehlt} />
          </label>
          {analyse && <p className="text-sm">{name}: <strong>{analyse.zeilen}</strong> Zeilen, Trennzeichen „{analyse.trennzeichen === '\t' ? 'Tab' : analyse.trennzeichen}“</p>}
        </section>

        {analyse && !ergebnis && (
          <>
            <section className="karte space-y-3 p-4">
              <h2 className="font-semibold">Spalten zuordnen</h2>
              <p className="text-xs text-leise">Automatisch erkannt – bitte kurz prüfen. Nicht benötigte Felder auf „– nicht importieren –“ lassen.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {analyse.felder.map((f) => (
                  <label key={f.feld} className="block">
                    <span className="beschriftung">{f.titel}{f.pflicht ? ' *' : ''}</span>
                    <select className="eingabe" value={zuordnung[f.feld] ?? ''} onChange={(e) => setZuordnung({ ...zuordnung, [f.feld]: e.target.value === '' ? undefined : Number(e.target.value) })}>
                      <option value="">– nicht importieren –</option>
                      {analyse.kopf.map((k, i) => <option key={i} value={i}>{k || `Spalte ${i + 1}`}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="beschriftung">Artikeltyp, wenn nicht angegeben</span>
                  <select className="eingabe" value={standardTyp} onChange={(e) => setStandardTyp(e.target.value)}>
                    {ARTIKELTYPEN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <label className="flex items-start gap-2 pt-6 text-sm">
                  <input type="checkbox" className="mt-1 size-4 accent-akzent" checked={abgleich} onChange={(e) => setAbgleich(e.target.checked)} />
                  <span>Mit dem Katalog verknüpfen, wenn Titel und Plattform eindeutig passen (für Cover, Werte und Varianten)</span>
                </label>
              </div>
            </section>

            <section className="karte space-y-2 overflow-x-auto p-4">
              <h2 className="font-semibold">Vorschau (erste Zeilen, vor der Anpassung)</h2>
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-xs text-leise"><tr><th className="py-1">Titel</th><th>Plattform</th><th>Typ</th><th>Region</th><th>Zustand</th><th>Vollst.</th><th>Anz.</th><th>Kaufpreis</th></tr></thead>
                <tbody className="divide-y divide-rand">
                  {analyse.vorschau.map((a, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-2">{a.titel || <span className="text-gefahr">fehlt</span>}</td>
                      <td className="pr-2">{a.plattform ?? '–'}</td>
                      <td className="pr-2">{beschriftung(ARTIKELTYPEN, a.typ)}</td>
                      <td className="pr-2">{a.region ? beschriftung(REGIONEN, a.region, 'kurz') : '–'}</td>
                      <td className="pr-2">{a.zustand ? beschriftung(ZUSTAENDE, a.zustand) : '–'}</td>
                      <td className="pr-2">{a.vollstaendigkeit ? beschriftung(VOLLSTAENDIGKEITEN, a.vollstaendigkeit, 'kurz') : '–'}</td>
                      <td className="pr-2">{a.anzahl}</td>
                      <td>{a.kaufpreis ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <button type="button" className="knopf-primaer" disabled={laeuft || zuordnung.titel === undefined} onClick={starten}>
              {laeuft ? 'Wird importiert …' : `${analyse.zeilen} Zeilen importieren`}
            </button>
          </>
        )}

        {ergebnis && (
          <section className="karte space-y-2 p-4">
            <h2 className="font-semibold">Import abgeschlossen</h2>
            <p><strong>{ergebnis.importiert}</strong> Artikel importiert, davon <strong>{ergebnis.verknuepft}</strong> mit dem Katalog verknüpft.</p>
            {ergebnis.fehlerGesamt > 0 && (
              <div className="rounded-xl bg-warnung/10 p-3 text-sm">
                <p className="font-semibold text-warnung">{ergebnis.fehlerGesamt} Zeilen wurden übersprungen:</p>
                <ul className="mt-1 list-disc pl-5">
                  {ergebnis.fehlerhaft.slice(0, 30).map((f) => (
                    <li key={f.zeile}>Zeile {f.zeile}{f.titel ? ` („${f.titel}“)` : ''}: {Object.values(f.fehler).join(' ')}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <a href="#/" className="knopf-primaer">Zur Sammlung</a>
              <button type="button" className="knopf-sekundaer" onClick={() => { setText(null); setAnalyse(null); setErgebnis(null); }}>Weitere Datei</button>
            </div>
          </section>
        )}

        <SteamImport />
      </div>
    </Layout>
  );
}

/** Steam-Bibliothek als digitale Spiele importieren (nur wenn der Server einen Steam-API-Schlüssel hat). */
function SteamImport() {
  const zeigeHinweis = useHinweis();
  const [status, setStatus] = useState(null);
  const [profil, setProfil] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState(null);
  useEffect(() => { api.steamStatus().then((s) => { setStatus(s); setProfil(s.steam_id ?? ''); }).catch(() => {}); }, []);
  if (!status?.aktiv) return null;
  async function importieren(e) {
    e.preventDefault();
    setLaeuft(true);
    try {
      const r = await api.steamImport(profil);
      setErgebnis(r);
      setStatus(r);
      zeigeHinweis(`${r.neu} neue Spiele aus Steam übernommen.`);
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    } finally {
      setLaeuft(false);
    }
  }
  async function trennen() {
    if (!window.confirm(`Steam trennen und alle ${status.anzahl} importierten Steam-Spiele entfernen?`)) return;
    try {
      const r = await api.steamTrennen();
      zeigeHinweis(`${r.entfernt} Steam-Spiele entfernt.`);
      setStatus({ ...status, steam_id: null, zuletzt: null, anzahl: 0 });
      setProfil('');
      setErgebnis(null);
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    }
  }
  return (
    <section className="karte space-y-3 p-4">
      <h2 className="font-semibold">Steam-Bibliothek (digitale Spiele)</h2>
      <p className="text-sm text-leise">
        Holt deine Steam-Spiele samt Spielzeit. Sie erscheinen unter dem Filter <strong className="text-text">„Digital“</strong>, sind über dem Cover
        deutlich mit <strong className="text-text">DIGITAL · STEAM</strong> gekennzeichnet und zählen nicht zu Sammlung, Sammlungswert und Statistik.
        Voraussetzung: In den Steam-Datenschutzeinstellungen sind „Spieldetails“ öffentlich. Erneut importieren aktualisiert die Spielzeiten
        und ergänzt neue Spiele.
      </p>
      <form onSubmit={importieren} className="flex flex-wrap gap-2">
        <input className="eingabe min-w-0 flex-1" value={profil} onChange={(e) => setProfil(e.target.value)} required
          placeholder="https://steamcommunity.com/id/deinname oder Steam-ID" aria-label="Steam-Profil" />
        <button type="submit" className="knopf-primaer" disabled={laeuft}>{laeuft ? 'Wird importiert …' : status.anzahl ? 'Aktualisieren' : 'Importieren'}</button>
      </form>
      {status.anzahl > 0 && (
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-leise">
          <span>{status.anzahl} Steam-Spiele{status.zuletzt ? ` · zuletzt am ${status.zuletzt.slice(0, 10).split('-').reverse().join('.')}` : ''}</span>
          <span className="flex gap-3">
            <a href="#/?bestand=digital" className="underline">Ansehen</a>
            <button type="button" className="underline" onClick={trennen}>Trennen & entfernen</button>
          </span>
        </p>
      )}
      {ergebnis && (
        <p className="text-sm">
          {ergebnis.gesamt} Spiele bei Steam · {ergebnis.neu} neu ({ergebnis.katalog} mit dem Katalog verknüpft, {ergebnis.eigene} als eigene Einträge)
          · {ergebnis.aktualisiert} schon vorhanden.
        </p>
      )}
    </section>
  );
}
