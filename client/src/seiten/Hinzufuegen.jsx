import { useEffect, useState } from 'react';
import { ARTIKELTYPEN } from '../../../shared/konstanten.js';
import { api } from '../api.js';
import { navigiere } from '../router.js';
import Layout from '../komponenten/Layout.jsx';
import { useSitzung } from '../sitzung.js';
import BarcodeScanner from '../komponenten/BarcodeScanner.jsx';
import Cover from '../komponenten/Cover.jsx';
import Symbol from '../komponenten/Symbole.jsx';
import StatusAbzeichen from '../komponenten/StatusAbzeichen.jsx';
import { MODUL } from '../erweiterungen.jsx';
import { gueltigerBarcode } from '../../../shared/barcode.js';
import TitelVorschlag from '../komponenten/TitelVorschlag.jsx';
import PlattformVorschlag from '../komponenten/PlattformVorschlag.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import { MARKE } from '../../../shared/marke.js';

export default function Hinzufuegen({ route }) {
  const p = route.parameter;
  const { status } = useSitzung();
  const typ = p.typ ?? 'spiel';
  const [suchtext, setSuchtext] = useState(p.q ?? '');
  const [ergebnis, setErgebnis] = useState(null);
  const [sucht, setSucht] = useState(false);
  const [laedtMehr, setLaedtMehr] = useState(false);
  const [vorschlagOffen, setVorschlagOffen] = useState(false);
  const [plattformOffen, setPlattformOffen] = useState(false);
  const zeigeHinweis = useHinweis();
  // Wer nimmt Vorschläge auf? Das eigene Moderationsteam (zockerdb.de) oder – selbst gehostet – zockerdb.de
  const vorschlagZiel = MODUL.moderation ? 'Das Moderationsteam' : status?.zentrale ? 'zockerdb.de' : null;
  const [barcodeErgebnis, setBarcodeErgebnis] = useState(null);
  const [barcodeFehler, setBarcodeFehler] = useState(null);

  const setzeParameter = (aenderung) => navigiere('/neu', { ...p, ...aenderung });

  // Titelsuche (verzögert)
  useEffect(() => {
    const text = suchtext.trim();
    if (text.length < 2) {
      setErgebnis(null);
      return undefined;
    }
    // Eingetippte EAN/UPC: wie ein Scan als Barcode suchen (wird dabei gelernt) statt als Titel
    const code = gueltigerBarcode(text);
    if (code) {
      setSuchtext('');
      setErgebnis(null);
      navigiere('/neu', { ...p, barcode: code });
      return undefined;
    }
    const abbruch = new AbortController();
    const t = setTimeout(() => {
      setSucht(true);
      api.katalogSuche(text, typ, abbruch.signal)
        .then(setErgebnis)
        .catch((e) => { if (e.name !== 'AbortError') setErgebnis({ lokal: [], online: [], fehler: e.message }); })
        .finally(() => setSucht(false));
    }, 400);
    return () => { clearTimeout(t); abbruch.abort(); };
  }, [suchtext, typ]);

  // Weitere Treffer bei IGDB nachladen (erst auf Wunsch, seitenweise – spart API-Anfragen)
  const weitereLaden = async () => {
    if (!ergebnis) return;
    setLaedtMehr(true);
    try {
      const naechste = await api.katalogSuche(suchtext.trim(), typ, undefined, { online: true, seite: (ergebnis.seite ?? -1) + 1 });
      setErgebnis((alt) => {
        const bekannt = new Set([...alt.lokal, ...alt.online].map((e) => e.id));
        return {
          ...alt,
          online: [...alt.online, ...naechste.online.filter((e) => !bekannt.has(e.id))],
          fehler: naechste.fehler,
          mehrOnline: naechste.mehrOnline,
          seite: naechste.seite,
        };
      });
    } catch (e) {
      setErgebnis((alt) => ({ ...alt, fehler: e.message, mehrOnline: false }));
    } finally {
      setLaedtMehr(false);
    }
  };

  // Barcode-Suche
  useEffect(() => {
    if (!p.barcode) {
      setBarcodeErgebnis(null);
      return;
    }
    setBarcodeErgebnis(null);
    setBarcodeFehler(null);
    api.katalogBarcode(p.barcode).then(setBarcodeErgebnis).catch((e) => setBarcodeFehler(e.message));
  }, [p.barcode]);

  const waehle = (eintrag) => navigiere('/neu/formular', {
    katalog: eintrag.id, typ: eintrag.typ, barcode: p.barcode, konvolut: p.konvolut,
    // Plattform aus dem Barcode (z. B. „PS3“) übernehmen
    plattform_id: p.barcode && barcodeErgebnis?.plattform_id ? barcodeErgebnis.plattform_id : undefined,
  });
  const eigenerEintrag = () => navigiere('/neu/formular', {
    typ, barcode: p.barcode, titel: suchtext.trim() || barcodeErgebnis?.suchbegriff, konvolut: p.konvolut,
  });
  // Konvolut erfassen: Name anzeigen, damit klar ist, wohin die Artikel kommen
  const [konvolut, setKonvolut] = useState(null);
  useEffect(() => { if (p.konvolut) api.konvolut(p.konvolut).then(setKonvolut).catch(() => setKonvolut(null)); else setKonvolut(null); }, [p.konvolut]);

  return (
    <Layout route={route} titel={p.scan === '1' ? 'Barcode scannen' : 'Artikel hinzufügen'}>
      <div className="mx-auto max-w-3xl space-y-4">
        {konvolut && (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-akzent/50 bg-akzent/10 p-3 text-sm" role="status">
            <span>Du erfasst Artikel für das Konvolut <strong>{konvolut.name}</strong> ({konvolut.artikel.length} bisher).</span>
            <a href={`#/konvolut/${konvolut.id}`} className="underline">Fertig – zum Konvolut</a>
          </p>
        )}
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Artikeltyp">
          {ARTIKELTYPEN.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={typ === t.value}
              onClick={() => setzeParameter({ typ: t.value })}
              className={`${typ === t.value ? 'chip-aktiv' : 'chip'} justify-center rounded-xl py-2.5`}
            >
              <Symbol name={t.value} className="size-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Titel suchen</span>
            <Symbol name="suche" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-leise" />
            <input
              type="search"
              value={suchtext}
              onChange={(e) => setSuchtext(e.target.value)}
              placeholder={typ === 'spiel' ? 'Spieltitel oder EAN suchen …' : typ === 'konsole' ? 'Konsole suchen, z. B. „PlayStation“' : 'Zubehör suchen …'}
              className="eingabe pl-10"
              autoFocus={p.scan !== '1'}
            />
          </label>
          <button type="button" onClick={() => setzeParameter({ scan: '1' })} className="knopf-primaer px-3" aria-label="Barcode scannen">
            <Symbol name="scan" />
            <span className="hidden sm:inline">Scannen</span>
          </button>
        </div>

        {!status?.igdbKonfiguriert && typ !== 'zubehoer' && (
          <p className="flex gap-2 rounded-xl border border-rand p-3 text-sm text-leise">
            <Symbol name="info" className="size-5 shrink-0" />
            Die Online-Suche (IGDB) ist nicht eingerichtet. Es werden nur eigene Katalogeinträge durchsucht.
            Hinterlege TWITCH_CLIENT_ID und TWITCH_CLIENT_SECRET in der .env-Datei, um sie zu aktivieren.
          </p>
        )}

        {p.barcode && (
          <section className="karte space-y-3 p-4" aria-live="polite">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-leise uppercase">Gescannter Barcode</p>
                <p className="font-mono text-lg">{p.barcode}</p>
              </div>
              <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setzeParameter({ barcode: undefined })}>
                Verwerfen
              </button>
            </div>
            {!barcodeErgebnis && !barcodeFehler && <p className="text-sm text-leise">Barcode wird gesucht …</p>}
            {barcodeFehler && <p className="text-sm text-gefahr" role="alert">{barcodeFehler}</p>}
            {barcodeFehler && !navigator.onLine && (
              <button type="button" className="knopf-primaer" onClick={async () => {
                await api.artikelAnlegen({ typ: 'spiel', titel: `Gescannt (offline): ${p.barcode}`, barcode: p.barcode }, { beschreibung: `Barcode ${p.barcode} gescannt` });
                zeigeHinweis('Offline gemerkt – der Eintrag wird angelegt, sobald du wieder online bist. Titel und Details kannst du danach ergänzen.');
                navigiere('/');
              }}>Barcode offline merken</button>
            )}
            {barcodeErgebnis && (
              <>
                {barcodeErgebnis.vorhandeneArtikel.length > 0 && (
                  <div className="rounded-xl bg-warnung/10 p-3 text-sm">
                    <p className="font-semibold text-warnung">Dieser Barcode ist bereits in deiner Sammlung:</p>
                    <ul className="mt-1 list-disc pl-5">
                      {barcodeErgebnis.vorhandeneArtikel.map((a) => (
                        <li key={a.id}><a className="underline" href={`#/artikel/${a.id}`}>{a.titel}{a.plattform ? ` (${a.plattform})` : ''}</a></li>
                      ))}
                    </ul>
                  </div>
                )}
                {barcodeErgebnis.produktname ? (
                  <p className="text-sm">
                    Produkt: <strong>{barcodeErgebnis.produktname}</strong>
                    {barcodeErgebnis.quelle && barcodeErgebnis.quelle !== 'lokal' && <span className="text-leise"> (Quelle: {barcodeErgebnis.quelle})</span>}
                  </p>
                ) : barcodeErgebnis.quelle !== 'lokal' && (
                  <p className="text-sm text-leise">
                    Zu diesem Barcode wurde online nichts gefunden. Suche oben nach dem Titel oder lege einen eigenen Eintrag an –
                    der Barcode wird dabei gespeichert und beim nächsten Scan sofort erkannt.
                  </p>
                )}
                {barcodeErgebnis.plattform && <p className="text-sm">Plattform: <strong>{barcodeErgebnis.plattform}</strong> <span className="text-leise">(aus dem Barcode)</span></p>}
                {barcodeErgebnis.fehler && <p className="text-sm text-gefahr">{barcodeErgebnis.fehler}</p>}
                {barcodeErgebnis.treffer.length > 0 && (
                  <Trefferliste titel="Passende Einträge" eintraege={barcodeErgebnis.treffer} onWaehle={waehle} />
                )}
                {/* Unbekannter Barcode: die Zuordnung entsteht erst durch die Auswahl – dafür braucht es die Community */}
                {barcodeErgebnis.quelle !== 'lokal' && (
                  <p className="flex gap-2 rounded-xl bg-akzent/10 p-3 text-xs text-leise">
                    <span aria-hidden="true">🤝</span>
                    <span>
                      <strong className="text-text">Diesen Barcode kennen wir noch nicht.</strong> Spieldatenbanken wie IGDB führen keine Barcodes –
                      {' '}{MARKE.name} lernt sie von euch: Wähle den passenden Eintrag (und die Plattform), dann erkennen alle Sammler das Spiel
                      beim nächsten Scan sofort. Danke, dass du hilfst, die Datenbank aufzubauen!
                    </span>
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {sucht && <p className="text-sm text-leise">Suche läuft …</p>}
        {ergebnis?.fehler && <p className="rounded-xl bg-gefahr/10 p-3 text-sm text-gefahr" role="alert">{ergebnis.fehler}</p>}
        {ergebnis && (
          <>
            {ergebnis.lokal.length > 0 && <Trefferliste titel="Aus deinem Katalog" eintraege={ergebnis.lokal} onWaehle={waehle} />}
            {ergebnis.online.length > 0 && <Trefferliste titel="Online gefunden (IGDB)" eintraege={ergebnis.online} onWaehle={waehle} />}
            {!sucht && !ergebnis.lokal.length && !ergebnis.online.length && !ergebnis.fehler && (
              <p className="text-sm text-leise">Keine Treffer für „{suchtext.trim()}“.</p>
            )}
            {!sucht && ergebnis.mehrOnline && (
              <button type="button" className="knopf-sekundaer self-start" onClick={weitereLaden} disabled={laedtMehr}>
                <Symbol name="suche" className="size-4" />
                {laedtMehr ? 'Lädt …' : 'Weitere Ergebnisse bei IGDB laden'}
              </button>
            )}
          </>
        )}

        <section className="karte flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-semibold">Nicht gefunden?</p>
            <p className="text-sm text-leise">
              Lege einen eigenen Eintrag an – ideal für Hardware, Zubehör, Sondermodelle und seltene deutsche Veröffentlichungen.
              {vorschlagZiel && ' Oder schlage den Titel für den gemeinsamen Katalog vor – auch alte Spiele ohne Barcode.'}
              {vorschlagZiel && ' Der Katalog lebt von der Mithilfe der Community – jeder Vorschlag hilft allen Sammlern.'}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" className="knopf-sekundaer" onClick={eigenerEintrag}>
              <Symbol name="stift" className="size-4" />
              Eigenen Eintrag anlegen
            </button>
            {vorschlagZiel && !vorschlagOffen && (
              <button type="button" className="knopf-sekundaer" onClick={() => setVorschlagOffen(true)}>
                <Symbol name="plus" className="size-4" />
                Titel vorschlagen
              </button>
            )}
            {vorschlagZiel && !plattformOffen && (
              <button type="button" className="knopf-sekundaer" onClick={() => setPlattformOffen(true)}>
                <Symbol name="konsole" className="size-4" />
                Plattform fehlt?
              </button>
            )}
          </div>
        </section>
        {plattformOffen && (
          <section className="karte p-4">
            <PlattformVorschlag zielName={vorschlagZiel} onAbbrechen={() => setPlattformOffen(false)}
              onFertig={(v) => { setPlattformOffen(false); zeigeHinweis(`Danke! „${v.name}“ wird ${v.ziel === 'zockerdb.de' ? 'von zockerdb.de' : 'vom Moderationsteam'} geprüft.`); }} />
          </section>
        )}
        {vorschlagOffen && (
          <TitelVorschlag titel={suchtext.trim()} typ={typ} zielName={vorschlagZiel} onSchliessen={() => setVorschlagOffen(false)} />
        )}
      </div>

      {p.scan === '1' && (
        <BarcodeScanner
          onErkannt={(code) => navigiere('/neu', { ...p, scan: undefined, barcode: code })}
          onSchliessen={() => setzeParameter({ scan: undefined })}
        />
      )}
    </Layout>
  );
}

function Trefferliste({ titel, eintraege, onWaehle }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-leise uppercase">{titel}</h2>
      <ul className="karte divide-y divide-rand overflow-hidden">
        {eintraege.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onWaehle(e)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-karte-hover">
              <Cover url={e.cover_url} typ={e.typ} alt="" className="h-16 w-12 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{e.titel}</p>
                <p className="line-clamp-2 text-xs text-leise">
                  {[e.titel_original && `Original: ${e.titel_original}`, e.erscheinungsjahr, e.hersteller, e.plattformen.slice(0, 4).join(', ')].filter(Boolean).join(' · ')}
                </p>
                {e.status && e.status !== 'freigegeben'
                  ? <StatusAbzeichen status={e.status} className="mt-1" />
                  : e.quelle === 'eigen' && <span className="abzeichen mt-1">{MODUL.moderation ? 'Community-Katalog' : 'Eigener Katalog'}</span>}
              </div>
              <Symbol name="weiter" className="size-5 shrink-0 text-leise" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
