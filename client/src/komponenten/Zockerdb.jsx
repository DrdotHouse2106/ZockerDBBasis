// Verbindung zu zockerdb.de (selbst gehostet): Sync der Sammlung, Datenspende, „Zu ZockerDB freigeben“,
// Sammlerzahlen und die Datenspende-Vorschau für Administratoren.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useSitzung } from '../sitzung.js';
import { datumDe, anzahl } from '../format.js';
import Symbol from './Symbole.jsx';
import { useHinweis } from './Hinweise.jsx';

const zeit = (t) => (t ? new Date(`${t.replace(' ', 'T')}Z`).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–');

/** Konto: eigene Sammlung mit dem Konto auf zockerdb.de synchronisieren und Datenspende. */
export function KontoZockerdb({ konto, onSpeichern }) {
  const { status } = useSitzung();
  const zeigeHinweis = useHinweis();
  const [sync, setSync] = useState(null);
  const [token, setToken] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { if (status?.zentrale) api.syncStatus().then(setSync).catch(() => {}); }, [status?.zentrale]);
  if (!status?.zentrale) return null;

  const ausfuehren = async (fn, erfolg) => {
    setLaeuft(true);
    try {
      const s = await fn();
      setSync(s);
      if (s.fehler) zeigeHinweis(s.fehler, 'fehler');
      else if (erfolg) zeigeHinweis(erfolg);
    } catch (e) {
      zeigeHinweis(e.message, 'fehler');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <section className="karte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Symbol name="community" className="size-5" />zockerdb.de</h2>
      {sync?.verbunden ? (
        <>
          <p className="text-sm">
            Verbunden mit <strong>{sync.konto}</strong> auf {new URL(sync.url).host}. Deine Sammlung wird alle 15 Minuten in beide Richtungen
            abgeglichen – so hast du sie unterwegs dabei und sammelst dort Erfolge.
          </p>
          <p className="text-xs text-leise">
            Zuletzt: {zeit(sync.letzterLauf)} · Scans bleiben immer hier. Fotos gehen nur mit, wenn du es beim Artikel einschaltest
            ({anzahl(sync.fotos)} ausgewählt) – sie zählen auf zockerdb.de zum Speicherplatz.
          </p>
          {sync.fehler && <p className="text-sm text-gefahr" role="alert">{sync.fehler}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="knopf-sekundaer" disabled={laeuft} onClick={() => ausfuehren(api.syncJetzt, 'Sammlung abgeglichen.')}>
              {laeuft ? 'Gleicht ab …' : 'Jetzt abgleichen'}
            </button>
            <button type="button" className="knopf-sekundaer" disabled={laeuft} onClick={() => ausfuehren(api.syncTrennen, 'Verbindung getrennt.')}>Trennen</button>
          </div>
        </>
      ) : (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); ausfuehren(() => api.syncVerbinden(token.trim()), 'Verbunden und abgeglichen.'); }}>
          <p className="text-sm">
            Deine Sammlung auch unterwegs und mit Freunden auf <a className="underline" href={status.zentrale} target="_blank" rel="noopener">zockerdb.de</a> –
            inklusive Erfolgen. Erstelle dort unter <em>Konto → Eigenen Server verbinden</em> einen Sync-Schlüssel und füge ihn hier ein.
          </p>
          <label className="block text-sm">
            <span className="mb-1 block text-leise">Sync-Schlüssel</span>
            <input className="eingabe w-full font-mono" value={token} onChange={(e) => setToken(e.target.value)} placeholder="zs_…" autoComplete="off" />
          </label>
          <button type="submit" className="knopf-primaer" disabled={laeuft || !token.trim()}>{laeuft ? 'Verbindet …' : 'Verbinden'}</button>
        </form>
      )}
      {konto.datenspendeAktiv && (
        <label className="flex items-start gap-2 border-t border-rand pt-3 text-sm">
          <input type="checkbox" className="mt-1" checked={konto.datenspende} onChange={(e) => onSpeichern({ datenspende: e.target.checked })} />
          <span>
            <strong>Anonym zur Statistik beitragen</strong>
            <span className="block text-leise">
              Dieser Server meldet zockerdb.de wöchentlich nur, wie viele Sammler hier einen Titel besitzen – ohne Namen, Preise oder Notizen.
              Dafür siehst du bei jedem Spiel, wie viele Sammler es insgesamt gibt.
            </span>
          </span>
        </label>
      )}
    </section>
  );
}

/** Katalogseite: Sammlerzahlen bei zockerdb.de bzw. „Zu ZockerDB freigeben“ für eigene Einträge. */
export function KatalogZockerdb({ eintrag: e, laden }) {
  const { status, benutzer } = useSitzung();
  const zeigeHinweis = useHinweis();
  const [statistik, setStatistik] = useState(null);
  const [sendet, setSendet] = useState(false);
  useEffect(() => {
    setStatistik(null);
    if (status?.zentrale && e.quelle === 'zockerdb') api.katalogZentral(e.id).then(setStatistik).catch(() => {});
  }, [e.id, e.quelle, status?.zentrale]);
  if (!status?.zentrale) return null;

  if (e.quelle === 'zockerdb') {
    if (!statistik) return null;
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-leise">
        <Symbol name="community" className="size-4" />
        Bei zockerdb.de: <strong className="text-text">{anzahl(statistik.sammler)}</strong> {statistik.sammler === 1 ? 'Sammler' : 'Sammler'}
        {statistik.url && <a className="underline hover:text-text" href={statistik.url} target="_blank" rel="noopener">Öffentliche Seite</a>}
        {benutzer?.rolle === 'admin' && status.zentraleSpende === false && (
          <a className="underline hover:text-text" href="#/admin">Dein Server zählt noch nicht mit – mitmachen?</a>
        )}
      </p>
    );
  }
  if (!e.eigener || e.quelle !== 'eigen') return null;
  if (e.zentral_status === 'eingereicht') return <p className="text-sm text-leise">Bei zockerdb.de eingereicht – wird dort geprüft.</p>;
  const einreichen = async () => {
    setSendet(true);
    try {
      await api.zentralEinreichen(e.id);
      zeigeHinweis('Bei zockerdb.de eingereicht. Nach der Prüfung wird der Eintrag hier automatisch übernommen.');
      laden();
    } catch (fehler) {
      zeigeHinweis(fehler.message, 'fehler');
    } finally {
      setSendet(false);
    }
  };
  return (
    <div className="space-y-1 text-sm">
      {e.zentral_status === 'abgelehnt' && <p className="text-gefahr">Von zockerdb.de abgelehnt{e.zentral_hinweis ? `: ${e.zentral_hinweis}` : '.'}</p>}
      <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={einreichen} disabled={sendet}>
        <Symbol name="community" className="size-4" />{sendet ? 'Wird gesendet …' : 'Zu ZockerDB freigeben'}
      </button>
      <p className="text-xs text-leise">Teilt den Eintrag (ohne deine Sammlung) mit allen – nach der Prüfung erhält er eine öffentliche Seite.</p>
    </div>
  );
}

/** Artikel: eigenes Foto (verkleinert) auch auf zockerdb.de zeigen. */
export function ArtikelFotoSync({ artikel, onGeaendert }) {
  const { status } = useSitzung();
  const [verbunden, setVerbunden] = useState(false);
  useEffect(() => { if (status?.zentrale) api.syncStatus().then((s) => setVerbunden(s.verbunden)).catch(() => {}); }, [status?.zentrale]);
  if (!verbunden || !artikel.bild_datei) return null;
  return (
    <label className="flex items-center justify-center gap-2 text-xs text-leise">
      <input type="checkbox" checked={Boolean(artikel.sync_bild)} onChange={async (e) => {
        await api.syncBild(artikel.id, e.target.checked);
        onGeaendert({ ...artikel, sync_bild: e.target.checked ? 1 : 0 });
      }} />
      Foto auch auf zockerdb.de (zählt dort zum Speicher)
    </label>
  );
}

/** Was die Datenspende bringt – gemeinsam für Frage und Hinweis. */
function SpendeErklaerung() {
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-sm text-leise">
      <li>Gesendet wird wöchentlich <strong className="text-text">nur, wie viele Sammler</strong> hier einen Titel besitzen (und gelernte Barcodes).</li>
      <li>Keine Benutzernamen, Preise, Notizen oder Fotos – du siehst vorher genau, was gesendet würde.</li>
      <li>Jeder Benutzer kann sich im Konto ausnehmen, du kannst es jederzeit wieder ausschalten.</li>
      <li>Dafür siehst du bei jedem Spiel, wie viele Sammler es bei ZockerDB insgesamt gibt – und hilfst, den Katalog für alle zu verbessern.</li>
    </ul>
  );
}

/**
 * Einmalige Frage an Administratoren (Startseite), ob der Server anonym zur Statistik beitragen soll.
 * Freiwillig: „Nein danke“ ist gleichwertig und wird nicht erneut gefragt.
 */
export function SpendeFrage() {
  const { benutzer, status } = useSitzung();
  const zeigeHinweis = useHinweis();
  const [d, setD] = useState(null);
  const [vorschau, setVorschau] = useState(false);
  const istAdmin = benutzer?.rolle === 'admin';
  useEffect(() => { if (istAdmin && status?.zentrale) api.adminZentrale().then(setD).catch(() => {}); }, [istAdmin, status?.zentrale]);
  if (!d?.aktiv || d.spende || d.spendeGefragt) return null;
  const entscheiden = async (an) => {
    try {
      setD(an ? await api.adminZentraleSpende(true) : { ...d, ...(await api.adminZentraleHinweisAus(true)) });
      if (an) zeigeHinweis('Danke! Dein Server trägt jetzt anonym zur ZockerDB-Statistik bei.');
    } catch (e) {
      zeigeHinweis(e.message, 'fehler');
    }
  };
  return (
    <section className="karte space-y-3 border-akzent/50 p-4" aria-labelledby="spende-frage">
      <h2 id="spende-frage" className="flex items-center gap-2 font-semibold"><Symbol name="community" className="size-5 text-akzent-hell" />Hilf ZockerDB – anonyme Datenspende</h2>
      <p className="text-sm">Möchtest du, dass dieser Server anonym zur Sammler-Statistik von zockerdb.de beiträgt?</p>
      <SpendeErklaerung />
      {vorschau && <pre className="max-h-48 overflow-auto rounded-lg bg-karte-hover p-2 text-xs">{JSON.stringify(d.vorschau, null, 1)}</pre>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="knopf-primaer" onClick={() => entscheiden(true)}>Ja, mitmachen</button>
        <button type="button" className="knopf-sekundaer" onClick={() => entscheiden(false)}>Nein danke</button>
        <button type="button" className="px-2 text-sm text-leise underline" onClick={() => setVorschau((v) => !v)} aria-expanded={vorschau}>
          {vorschau ? 'Vorschau ausblenden' : 'Was würde gesendet?'}
        </button>
      </div>
    </section>
  );
}

/** Administration: Verbindung zu zockerdb.de und Vorschau der Datenspende. */
export function AdminZockerdb() {
  const zeigeHinweis = useHinweis();
  const [d, setD] = useState(null);
  const [vorschau, setVorschau] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { api.adminZentrale().then(setD).catch(() => {}); }, []);
  if (!d?.aktiv) return null;
  const lauf = async (spende) => {
    setLaeuft(true);
    try {
      setD({ ...d, ...(await api.adminZentraleLauf(spende)) });
      zeigeHinweis(spende ? 'Datenspende gesendet.' : 'Abgleich abgeschlossen.');
    } catch (e) {
      zeigeHinweis(e.message, 'fehler');
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <section className="karte space-y-2 p-4 text-sm">
      <h2 className="font-semibold">Verbindung zu zockerdb.de</h2>
      <p>
        Zentraler Katalog: <strong>{new URL(d.url).host}</strong> · {d.angemeldet ? 'angemeldet' : 'noch nicht angemeldet'} ·
        {' '}{anzahl(d.eintraege)} Einträge mit ZockerDB-ID
      </p>
      {d.neueVersion && (
        <p className="rounded-lg border border-akzent/50 p-2">
          🆕 <strong>Neue Version {d.neueVersion.version}</strong> verfügbar (installiert: {d.version}).
          {' '}Installieren mit „Jetzt aktualisieren“ im Abschnitt Update weiter unten.
          {d.neueVersion.hinweise && <> · <a className="underline" href={d.neueVersion.hinweise} target="_blank" rel="noopener">Hinweise</a></>}
        </p>
      )}
      {d.spende && d.letzteSpende && (
        <p className="rounded-lg bg-erfolg/10 p-2">
          💜 Danke! Dein Server hat <strong>{anzahl(d.letzteSpende.eintraege)} Titel</strong> zur ZockerDB-Statistik beigetragen.
        </p>
      )}
      {!d.spende && !d.spendeHinweisAus && (
        <div className="space-y-2 rounded-lg border border-akzent/40 p-3">
          <p><strong>Anonym zur Statistik beitragen?</strong> Bisher zählt dieser Server bei zockerdb.de nicht mit.</p>
          <SpendeErklaerung />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="knopf-primaer px-3 py-1.5" onClick={async () => setD({ ...d, ...(await api.adminZentraleSpende(true)) })}>Mitmachen</button>
            <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={async () => setD({ ...d, ...(await api.adminZentraleHinweisAus(false)) })}>Hinweis ausblenden</button>
          </div>
        </div>
      )}
      <p className="text-leise">
        Datenspende: <strong>{d.spende ? 'an' : 'aus'}</strong>
        {d.letzteSpende && ` · zuletzt ${datumDe(d.letzteSpende.am)} (${anzahl(d.letzteSpende.eintraege)} Einträge)`}
        {' '}– ändern unter Einstellungen → Verbindung zu zockerdb.de.
      </p>
      {d.letzterFehler && <p className="text-gefahr">Letzter Fehler: {d.letzterFehler}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setVorschau((v) => !v)} aria-expanded={vorschau}>
          {vorschau ? 'Vorschau ausblenden' : 'Vorschau der Datenspende'}
        </button>
        <button type="button" className="knopf-sekundaer px-3 py-1.5" disabled={laeuft} onClick={() => lauf(false)}>Katalog abgleichen</button>
        {d.spende && <button type="button" className="knopf-sekundaer px-3 py-1.5" disabled={laeuft} onClick={() => lauf(true)}>Jetzt spenden</button>}
        {d.spende && <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={async () => setD({ ...d, ...(await api.adminZentraleSpende(false)) })}>Datenspende ausschalten</button>}
      </div>
      {vorschau && (
        <div className="space-y-1">
          <p className="text-xs text-leise">
            Genau das würde gesendet: je ZockerDB-ID die Anzahl der Sammler und Exemplare sowie gelernte Barcodes – ohne Namen, Preise,
            Notizen oder Fotos. Benutzer, die sich im Konto ausgenommen haben, zählen nicht mit.
          </p>
          <pre className="max-h-64 overflow-auto rounded-lg bg-karte-hover p-2 text-xs">{JSON.stringify(d.vorschau, null, 1)}</pre>
        </div>
      )}
    </section>
  );
}
