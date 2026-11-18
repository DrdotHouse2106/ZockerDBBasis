// Import aus CLZ Games, Tabellen (Excel/LibreOffice als CSV) oder dem eigenen CSV-Export
import { useEffect, useRef, useState } from 'react';
import { ARTIKELTYPEN, REGIONEN, ZUSTAENDE, VOLLSTAENDIGKEITEN, beschriftung } from '../../../shared/konstanten.js';
import { api } from '../api.js';
import Layout from '../komponenten/Layout.jsx';
import Symbol from '../komponenten/Symbole.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import { useSitzung } from '../sitzung.js';
import Nachzuordnung from '../komponenten/Nachzuordnung.jsx';
import { datumDe } from '../format.js';

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
      const r = await api.csvImport({ text, zuordnung, standardTyp, katalogAbgleich: abgleich, datei: name });
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
          <p className="rounded-lg border border-warnung/50 bg-warnung/10 p-2 text-sm" data-testid="import-experimentell">
            <strong>Noch experimentell:</strong> Der Import – besonders aus CLZ Games – ist noch in Erprobung. Bitte prüfe das Ergebnis danach
            in deiner Sammlung (Plattform, Ausgabe, Zustand, Kaufpreis und die Zuordnung zum Katalog). Geht etwas schief, lässt sich ein Import
            vollständig rückgängig machen.
          </p>
          <label className="knopf-primaer w-fit cursor-pointer">
            <Symbol name="hochladen" className="size-4" />{text ? 'Andere Datei wählen' : 'Datei wählen'}
            <input type="file" accept=".csv,text/csv,.txt" className="sr-only" onChange={dateiGewaehlt} />
          </label>
          {analyse && <p className="text-sm">{name}: <strong>{analyse.zeilen}</strong> Zeilen, Trennzeichen „{analyse.trennzeichen === '\t' ? 'Tab' : analyse.trennzeichen}“</p>}
        </section>

        {!analyse && !ergebnis && <UmzugClz />}
        {!analyse && !ergebnis && <VorlageAnfragen />}

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
            <p className="rounded-lg border border-warnung/50 bg-warnung/10 p-2 text-xs">
              Der Import ist noch experimentell – bitte stichprobenartig prüfen, ob Plattform, Ausgabe, Zustand, Kaufpreis und Katalogtreffer stimmen.
            </p>
            {ergebnis.nachzuordnung && <Nachzuordnung start={ergebnis.nachzuordnung} knopf={false} />}
            {ergebnis.importiert - ergebnis.verknuepft > 0 && (
              <p><a href="#/zuordnen" className="underline" data-testid="ohne-katalog-link">{ergebnis.importiert - ergebnis.verknuepft} {ergebnis.importiert - ergebnis.verknuepft === 1 ? 'Spiel' : 'Spiele'} ohne Katalogtreffer zuordnen</a></p>
            )}
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
            {ergebnis.import_id && <p className="text-sm text-leise">Ist vieles falsch zugeordnet? Unten unter „Letzte Importe“ kannst du den Import rückgängig machen.</p>}
            <div className="flex gap-2">
              <a href="#/sammlung" className="knopf-primaer">Zur Sammlung</a>
              <button type="button" className="knopf-sekundaer" onClick={() => { setText(null); setAnalyse(null); setErgebnis(null); }}>Weitere Datei</button>
            </div>
          </section>
        )}

        <LetzteImporte neu={ergebnis?.import_id} />
        <SteamImport fokus={route?.parameter?.quelle === 'steam'} />
      </div>
    </Layout>
  );
}

/** Schritt-für-Schritt-Anleitung für den Umzug aus CLZ Games (Web, app.clz.com) – aufklappbar, damit die Seite kurz bleibt. */
function UmzugClz() {
  return (
    <details className="karte p-4 text-sm" data-testid="umzug-clz">
      <summary className="cursor-pointer font-semibold">Umzug von CLZ Games – Schritt für Schritt</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>CLZ Games im Browser öffnen (<span className="font-mono">app.clz.com</span>), links im Menü unter <strong>Import / Export</strong> auf <strong>Export to CSV / TXT</strong>.</li>
        <li>Bei „Which Games“ <strong>All Games</strong> wählen.</li>
        <li>
          Bei „Visible Columns“ auf <strong>Manage</strong> tippen, dann auf <strong>+</strong> (neuer Spalten-Favorit). Einen Namen eingeben, z. B. „ZockerDB“,
          und am einfachsten <strong>alle Gruppen anhaken</strong> (Main, Value, Hardware, Toy, Edition, Personal, Loan) – überflüssige Spalten ignoriert ZockerDB.
          Mit <strong>Save</strong> speichern und den neuen Favoriten auswählen.
          <span className="mt-1 block text-leise">
            Wer es schlanker mag, braucht nur: Platform, Title · Box, Completeness, Condition, Manual, Purchase Date, Purchase Price, Purchase Store ·
            Hardware Type, Serial No. · Barcode, Edition, Format, Region · Collection Status, Completed, Completed Date, Location, Notes, Quantity,
            Storage Device, Storage Slot.
          </span>
          <span className="block text-leise">
            Nicht übernommen werden u. a. Description, Developer, Genre, Publisher, Release Date (kommen aus dem Katalog), Value (Schätzwerte von CLZ in
            US-Dollar – ZockerDB ermittelt eigene Werte), My Rating, Tags und die Loan-Spalten (Verliehenes bitte in ZockerDB unter „Verleihen“ neu eintragen).
          </span>
        </li>
        <li>Einstellungen so lassen: Trennzeichen <strong>Semicolon</strong>, Anführungszeichen <strong>Double Quote</strong>, „Include Field Names as First Row“ angehakt. Dann exportieren.</li>
        <li>Hier oben <strong>Datei wählen</strong>. ZockerDB ordnet die Spalten selbst zu – prüfe die Zuordnung und die Vorschau, lass „Mit dem Katalog verknüpfen“ an und tippe auf <strong>Importieren</strong>.</li>
        <li>Konsolen und Controller erkennt ZockerDB an der Spalte „Hardware Type“ – sie landen automatisch als Konsole bzw. Zubehör in der Sammlung.</li>
      </ol>
      <p className="mt-3 font-semibold">Gut zu wissen</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-leise">
        <li>Box und Manual werden zur Vollständigkeit: beides da = CIB, ohne Anleitung = „Fehlt Anleitung“, ohne Box = lose. Format „Download“ wird zum digitalen Spiel.</li>
        <li>Die Verknüpfung mit dem Katalog (Cover, Werte, Varianten) läuft über den Barcode und den Titel – auch den englischen Originaltitel. Was dabei nicht genau passt, ordnet ZockerDB danach im Hintergrund weiter zu – tolerant bei der Schreibweise und notfalls online, aber nur bei eindeutigem Treffer mit gleicher Plattform. Was danach noch offen ist, ordnest du selbst zu: Der Link „… Spiele ohne Katalogtreffer zuordnen“ nach dem Import (oder in der Sammlung Filter → „Nur ohne Katalogeintrag“ → „Einzeln zuordnen“) zeigt jedes dieser Exemplare mit Vorschlägen aus dem Katalog – ein Tipp auf „Das ist es“ genügt.</li>
        <li>Zustandsangaben, die ZockerDB nicht kennt (z. B. „Verkratzt“), stehen danach in den Notizen.</li>
        <li>„Wish List“-Einträge werden nicht in die Sammlung übernommen (du siehst sie in der Liste der übersprungenen Zeilen), „Sold“ landet unter „Verkauft & abgegeben“.</li>
        <li>Fotos und Cover exportiert CLZ nicht als Datei – die Cover kommen aus dem Katalog, sobald ein Eintrag verknüpft ist. Eigene Fotos kannst du später ergänzen.</li>
        <li>Kaufpreise übernimmt ZockerDB so, wie sie in CLZ stehen – hast du dort in Dollar erfasst, bitte nachträglich prüfen.</li>
        <li>„Purchase Store“ landet als „Gekauft bei: …“ in den Notizen, Location/Storage Device/Storage Slot im Lagerort (unter Konto → Zusätzliche Felder einschalten), „Completed“ als Spielstatus „Durchgespielt“.</li>
        <li>Nichts wird überschrieben: Ein zweiter Import legt die Einträge noch einmal an – importiere jede Datei also nur einmal.</li>
      </ul>
    </details>
  );
}

/** Steam-Bibliothek als digitale Spiele importieren (nur wenn der Server einen Steam-API-Schlüssel hat). */
function SteamImport({ fokus }) {
  const zeigeHinweis = useHinweis();
  const { benutzer } = useSitzung();
  const bereich = useRef(null);
  const [status, setStatus] = useState(null);
  const [profil, setProfil] = useState('');
  const [eigenerSchluessel, setEigenerSchluessel] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState(null);
  useEffect(() => { api.steamStatus().then((s) => { setStatus(s); setProfil(s.steam_id ?? ''); }).catch(() => {}); }, []);
  // Aus „Steam-Bibliothek importieren“ (Einstellungen) direkt zu diesem Abschnitt springen
  useEffect(() => { if (fokus && status?.aktiv) bereich.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [fokus, status?.aktiv]);
  if (status && !status.aktiv && benutzer?.rolle === 'admin') {
    return (
      <p className="karte p-4 text-sm text-leise" data-testid="steam-import-aus">
        Steam-Import ausgeblendet: Auf dem Server ist kein Steam-API-Schlüssel wirksam. Eintragen unter{' '}
        <a className="underline" href="#/admin?reiter=einstellungen">Administration → Einstellungen</a> (nur Admins sehen diesen Hinweis).
      </p>
    );
  }
  if (!status?.aktiv) return null;
  async function importieren(e) {
    e.preventDefault();
    setLaeuft(true);
    try {
      const r = await api.steamImport(profil, eigenerSchluessel.trim());
      setEigenerSchluessel(''); // nur für diesen Import – nicht behalten
      setErgebnis(r);
      setStatus(r);
      zeigeHinweis(`${r.neu} neue Spiele aus Steam übernommen.`);
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    } finally {
      setLaeuft(false);
    }
  }
  async function trennen(behalten) {
    const frage = behalten
      ? 'Verbindung zu Steam lösen? Deine importierten Steam-Spiele bleiben als digitale Spiele erhalten.'
      : `Steam trennen und alle ${status.anzahl} importierten Steam-Spiele entfernen?`;
    if (!window.confirm(frage)) return;
    try {
      const r = await api.steamTrennen(behalten);
      zeigeHinweis(behalten ? 'Verbindung gelöst – deine Steam-Spiele bleiben.' : `${r.entfernt} Steam-Spiele entfernt.`);
      setStatus({ ...status, steam_id: null, zuletzt: null, anzahl: behalten ? status.anzahl : 0 });
      setProfil('');
      setErgebnis(null);
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    }
  }
  async function abgleichen() {
    try {
      const r = await api.steamVerknuepfen();
      zeigeHinweis(r.verknuepft ? `${r.verknuepft} Spiele mit dem Katalog verknüpft${r.offen ? ` – ${r.offen} noch ohne Treffer` : ''}.`
        : r.geprueft ? `Für ${r.geprueft} Spiele gibt es noch keinen Katalogeintrag.` : 'Alle Steam-Spiele sind schon mit dem Katalog verknüpft.');
    } catch (err) {
      zeigeHinweis(err.message, 'fehler');
    }
  }
  return (
    <section ref={bereich} className="karte scroll-mt-20 space-y-3 p-4" data-testid="steam-import">
      <h2 className="font-semibold">Steam-Bibliothek (digitale Spiele)</h2>
      <p className="text-sm text-leise">
        Holt deine Steam-Spiele samt Spielzeit. Sie erscheinen unter dem Filter <strong className="text-text">„Digital“</strong>, sind über dem Cover
        deutlich mit <strong className="text-text">DIGITAL · STEAM</strong> gekennzeichnet und zählen nicht zu Sammlung, Sammlungswert und Statistik.
        Voraussetzung: In den Steam-Datenschutzeinstellungen sind „Spieldetails“ öffentlich – es reicht, sie für den Import kurz umzustellen –
        oder du gibst unten deinen eigenen Steam-API-Schlüssel an. Erneut importieren aktualisiert die Spielzeiten und ergänzt neue Spiele.
      </p>
      <form onSubmit={importieren} className="flex flex-wrap gap-2">
        <input className="eingabe min-w-0 flex-1" value={profil} onChange={(e) => setProfil(e.target.value)} required
          placeholder="https://steamcommunity.com/id/deinname oder Steam-ID" aria-label="Steam-Profil" />
        <button type="submit" className="knopf-primaer" disabled={laeuft}>{laeuft ? 'Wird importiert …' : status.anzahl ? 'Aktualisieren' : 'Importieren'}</button>
        <details className="w-full text-sm" data-testid="steam-eigener-schluessel">
          <summary className="cursor-pointer text-leise">Privates Profil? Mit eigenem Steam-API-Schlüssel importieren</summary>
          <div className="mt-2 space-y-2">
            <p className="text-leise">
              Mit deinem eigenen Schlüssel liefert Steam deine Bibliothek auch bei privatem Profil. So geht’s: unter{' '}
              <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener noreferrer" className="underline">steamcommunity.com/dev/apikey</a>{' '}
              mit deinem Steam-Konto anmelden, als Domain z. B. „zockerdb.de“ eintragen und den Schlüssel hier einfügen (Steam vergibt Schlüssel nur an Konten,
              die schon mindestens 5 $ ausgegeben haben). Oben muss dein eigenes Profil stehen.
            </p>
            <p className="text-leise">
              Der Schlüssel wird nur für diesen einen Import an Steam geschickt und <strong className="text-text">nicht gespeichert</strong> – zum Aktualisieren gibst du ihn
              erneut ein. Tipp: Nach dem Import kannst du ihn auf derselben Steam-Seite wieder widerrufen.
            </p>
            <input className="eingabe w-full font-mono" type="password" value={eigenerSchluessel} onChange={(e) => setEigenerSchluessel(e.target.value)}
              autoComplete="off" spellCheck="false" maxLength={64} placeholder="Steam-API-Schlüssel (32 Zeichen, optional)" aria-label="Eigener Steam-API-Schlüssel" />
          </div>
        </details>
      </form>
      {status.anzahl > 0 && (
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-leise">
          <span>{status.anzahl} Steam-Spiele{status.zuletzt ? ` · zuletzt am ${status.zuletzt.slice(0, 10).split('-').reverse().join('.')}` : ''}</span>
          <span className="flex gap-3">
            <a href="#/sammlung?bestand=digital" className="underline">Ansehen</a>
            <button type="button" className="underline" onClick={abgleichen} data-testid="steam-abgleichen">Mit Katalog neu abgleichen</button>
            {status.steam_id && <button type="button" className="underline" onClick={() => trennen(true)}>Nur trennen</button>}
            <button type="button" className="underline" onClick={() => trennen(false)}>Trennen & Spiele entfernen</button>
          </span>
        </p>
      )}
      {ergebnis && (
        <p className="text-sm">
          {ergebnis.gesamt} Spiele bei Steam · {ergebnis.neu} neu ({ergebnis.katalog} mit dem Katalog verknüpft, {ergebnis.eigene} als eigene Einträge)
          · {ergebnis.aktualisiert} schon vorhanden{ergebnis.nachverknuepft ? ` · ${ergebnis.nachverknuepft} nachträglich mit dem Katalog verknüpft` : ''}.
        </p>
      )}
    </section>
  );
}

/**
 * Import-Vorlage für eine andere App anfragen (statt eines „Universal-Imports“): landet als Idee im Bereich „Import & Umzug“,
 * gibt es die Anfrage schon, stimmt man stattdessen dafür. Kopfzeile und Beispielzeilen helfen beim Bau der Vorlage.
 */
function VorlageAnfragen() {
  const zeigeHinweis = useHinweis();
  const [app, setApp] = useState('');
  const [beispiel, setBeispiel] = useState('');
  const [anhaenge, setAnhaenge] = useState([]);
  const [modus, setModus] = useState(null); // 'brett' = zockerdb.de (Anhänge möglich), 'zentrale' = selbst gehostet
  const [vorhanden, setVorhanden] = useState([]);
  const [fertig, setFertig] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const titel = `Import-Vorlage: ${app.trim()}`;
  useEffect(() => { api.ideen().then((r) => setModus(r.modus ?? null)).catch(() => {}); }, []);
  useEffect(() => {
    if (app.trim().length < 3) { setVorhanden([]); return undefined; }
    const t = setTimeout(() => api.ideenAehnliche(titel).then((r) => setVorhanden((Array.isArray(r) ? r : []).filter((i) => /^Import-Vorlage/i.test(i.titel)).slice(0, 3))).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [app]); // eslint-disable-line react-hooks/exhaustive-deps
  async function senden(e) {
    e.preventDefault();
    setLaeuft(true);
    try {
      const idee = await api.ideeEinreichen({ titel, bereich: 'import', beschreibung: beispiel.trim() ? `Kopfzeile und Beispielzeilen des Exports:\n${beispiel.trim()}` : null });
      if (anhaenge.length && idee?.id && idee.ziel === 'hier') {
        try { await api.ideeAnhaenge(idee.id, anhaenge); } catch (err) { zeigeHinweis(`Anfrage gespeichert, aber die Dateien nicht: ${err.message}`, 'fehler'); }
      }
      setFertig(true);
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    } finally {
      setLaeuft(false);
    }
  }
  if (fertig) {
    return <p className="karte p-4 text-sm" data-testid="vorlage-angefragt">Danke! Deine Anfrage steht unter <a className="underline" href="#/ideen">Ideen &amp; Wünsche</a> – dort siehst du, wann die Vorlage kommt.</p>;
  }
  return (
    <details className="karte p-4 text-sm" data-testid="vorlage-anfragen">
      <summary className="cursor-pointer font-semibold">Umzug aus einer anderen App? Import-Vorlage anfragen</summary>
      <form className="mt-3 space-y-3" onSubmit={senden}>
        <p className="text-leise">Viele Apps exportieren als CSV, aber jede mit eigenen Spalten. Sag uns, aus welcher App du kommst – je mehr Sammler dieselbe brauchen, desto eher bauen wir eine fertige Vorlage, die alle Spalten richtig zuordnet. Bis dahin kannst du die Spalten oben selbst zuordnen.</p>
        <label className="block"><span className="beschriftung">Aus welcher App oder Website?</span>
          <input className="eingabe" value={app} onChange={(e) => setApp(e.target.value)} maxLength={80} placeholder="z. B. GameEye, Retroplace, VGCollect" required minLength={2} />
        </label>
        {vorhanden.length > 0 && (
          <div className="space-y-1 rounded-xl bg-karte-hover p-3" data-testid="vorlage-vorhanden">
            <p>Schon angefragt – stimm einfach mit dafür:</p>
            {vorhanden.map((i) => (
              <p key={i.id} className="flex items-center justify-between gap-2">
                <span>{i.titel}</span>
                {i.eigene || i.gestimmt ? <span className="text-xs text-leise">{i.eigene ? 'deine Anfrage' : 'schon dafür gestimmt'}</span> : (
                  <button type="button" className="knopf-sekundaer px-2 py-1 text-xs" onClick={async () => {
                    try { await api.ideeStimme(i.id); setFertig(true); } catch (err) { zeigeHinweis(err.message, 'fehler'); }
                  }}>👍 Brauche ich auch</button>
                )}
              </p>
            ))}
          </div>
        )}
        <label className="block"><span className="beschriftung">Kopfzeile und 1–2 Beispielzeilen des Exports (optional)</span>
          <textarea className="eingabe font-mono text-xs" rows={4} value={beispiel} onChange={(e) => setBeispiel(e.target.value)} maxLength={2500}
            placeholder={'Title;Platform;Region;Condition\nSuper Mario World;SNES;PAL;CIB'} />
          <span className="mt-1 block text-xs text-leise">Am besten die Datei mit einem Texteditor öffnen und die ersten Zeilen kopieren. Keine persönlichen Daten wie Namen oder Adressen.</span>
        </label>
        {modus === 'brett' && (
          <label className="block"><span className="beschriftung">Screenshots und Beispieldatei (optional)</span>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,.csv,.txt,.tsv,text/csv,text/plain" className="block text-xs" data-testid="vorlage-dateien"
              onChange={(e) => setAnhaenge([...(e.target.files ?? [])].slice(0, 4))} />
            <span className="mt-1 block text-xs text-leise">Bis zu 3 Screenshots, wie der Export in der App aussieht (Menü, Einstellungen, Ergebnis), und eine Export-Datei mit nur 2–3 Zeilen (höchstens 10). Sehen kann das nur das ZockerDB-Team; gelöscht wird es, sobald die Vorlage fertig ist.</span>
          </label>
        )}
        <button type="submit" className="knopf-primaer" disabled={laeuft || app.trim().length < 2}>Vorlage anfragen</button>
      </form>
    </details>
  );
}

/**
 * Letzte Importe mit „Rückgängig machen“: entfernt die Exemplare des Imports wieder – alle oder nur die seitdem
 * unveränderten (eigene Nacharbeit bleibt dann erhalten).
 */
function LetzteImporte({ neu }) {
  const zeigeHinweis = useHinweis();
  const [liste, setListe] = useState(null);
  const [frage, setFrage] = useState(null); // Import, für den gerade nachgefragt wird
  const laden = () => api.importListe().then((r) => setListe(r.importe)).catch(() => setListe([]));
  useEffect(() => { laden(); }, [neu]);
  if (!liste?.length) return null;
  async function rueckgaengig(imp, nurUnveraendert) {
    try {
      const r = await api.importRueckgaengig(imp.id, nurUnveraendert);
      zeigeHinweis(`${r.entfernt} ${r.entfernt === 1 ? 'Exemplar' : 'Exemplare'} entfernt${r.uebrig ? ` – ${r.uebrig} bearbeitete bleiben` : ''}.`);
      setFrage(null);
      laden();
    } catch (e) { zeigeHinweis(e.message, 'fehler'); }
  }
  return (
    <section className="karte space-y-2 p-4 text-sm" data-testid="letzte-importe">
      <h2 className="font-semibold">Letzte Importe</h2>
      <ul className="divide-y divide-rand">
        {liste.map((imp) => (
          <li key={imp.id} className="space-y-1 py-2" data-testid="import-eintrag">
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{imp.datei || 'CSV-Import'}</strong> · {datumDe(imp.erstellt_am.slice(0, 10))} · {imp.anzahl} importiert
                {imp.rueckgaengig_am ? <span className="text-leise"> · rückgängig gemacht</span>
                  : <span className="text-leise"> · {imp.vorhanden} noch da{imp.bearbeitet ? `, ${imp.bearbeitet} davon bearbeitet` : ''}{imp.ohne_katalog ? `, ${imp.ohne_katalog} ohne Katalogtreffer` : ''}</span>}
              </span>
              {!imp.rueckgaengig_am && imp.vorhanden > 0 && frage?.id !== imp.id && (
                <button type="button" className="knopf-sekundaer px-3 py-1 text-xs" onClick={() => setFrage(imp)}>Rückgängig machen</button>
              )}
            </p>
            {frage?.id === imp.id && (
              <div className="space-y-2 rounded-xl bg-karte-hover p-3" role="alertdialog" aria-label="Import rückgängig machen">
                <p>{imp.vorhanden} {imp.vorhanden === 1 ? 'Exemplar dieses Imports wird' : 'Exemplare dieses Imports werden'} aus deiner Sammlung entfernt.
                  {imp.bearbeitet > 0 && ` ${imp.bearbeitet} davon hast du seitdem bearbeitet – die kannst du behalten.`}</p>
                <div className="flex flex-wrap gap-2">
                  {imp.bearbeitet > 0 && <button type="button" className="knopf-primaer px-3 py-1.5" onClick={() => rueckgaengig(imp, true)}>Nur unveränderte entfernen ({imp.vorhanden - imp.bearbeitet})</button>}
                  <button type="button" className={`${imp.bearbeitet > 0 ? 'knopf-sekundaer' : 'knopf-primaer'} px-3 py-1.5 text-gefahr`} onClick={() => rueckgaengig(imp, false)}>Alle {imp.vorhanden} entfernen</button>
                  <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setFrage(null)}>Abbrechen</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
