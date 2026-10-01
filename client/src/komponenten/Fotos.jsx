// Fotos von Sammlern: Modul, Disc, Verpackung, Gerät … – damit man sieht, wie ein Spiel oder Gerät wirklich aussieht.
// Checkliste „Fotos gesucht“, Hochladen (Kamera oder Galerie) und – nur mit Einwilligung des Fotografen und nach Prüfung –
// Anzeige auf der öffentlichen Spieleseite (auch in der Bildersuche). Scans von Cover und Anleitung stehen unter „Scans & Dokumente“.
import { useEffect, useRef, useState } from 'react';
import { MEDIENARTEN, beschriftung, gesuchteFotos, istModerator } from '../../../shared/konstanten.js';
import { api } from '../api.js';
import { useSitzung } from '../sitzung.js';
import { Andockpunkt } from '../erweiterungen.jsx';
import StatusAbzeichen from './StatusAbzeichen.jsx';
import Symbol from './Symbole.jsx';
import { useHinweis } from './Hinweise.jsx';

export const FOTOARTEN = MEDIENARTEN.filter((a) => a.foto);
export const fotoKurz = (art) => beschriftung(MEDIENARTEN, art, 'kurz');

// Zuletzt gewählte Einstellungen beim Hochladen (nur in diesem Browser)
const SPEICHER = 'fotos-einstellungen';
function gemerkt() {
  try { return JSON.parse(localStorage.getItem(SPEICHER) ?? '{}') ?? {}; } catch { return {}; }
}
function merke(werte) {
  try { localStorage.setItem(SPEICHER, JSON.stringify(werte)); } catch { /* egal */ }
}
// Nach dem Hinzufügen schon nach Fotos gefragt (je Spiel einmal) bzw. „Nicht mehr fragen“
const GEFRAGT = 'fotos-gefragt';
function gefragteSpiele() {
  try {
    const w = JSON.parse(localStorage.getItem(GEFRAGT) ?? '{}') ?? {};
    return { aus: Boolean(w.aus), ids: Array.isArray(w.ids) ? w.ids : [] };
  } catch { return { aus: false, ids: [] }; }
}
function merkeGefragt(werte) {
  try { localStorage.setItem(GEFRAGT, JSON.stringify(werte)); } catch { /* egal */ }
}

/**
 * `artikelId`: eigenes Exemplar, an dem neue Fotos hängen (ohne → nur ansehen).
 * `oeffentliche`: öffentlich freigegebene Fotos für Besucher ohne Anmeldung (vom Zusatzmodul).
 * `vorauswahl`: Fotoart, die beim Öffnen gleich zum Hochladen vorgeschlagen wird (z. B. aus „Fotos gesucht“).
 * `varianten`: bekannte Varianten des Eintrags (Auswahl beim Hochladen). `variante`: Variante des eigenen Exemplars –
 * die Checkliste zählt dann nur Fotos dieser Variante (z. B. „PAL-Modul fehlt“). `standardVariante`: Vorauswahl im Formular.
 * `neu`: gerade hinzugefügt – einmal je Spiel fragen, ob ein fehlendes Foto gemacht werden soll.
 */
export default function Fotos({
  katalogId, typ, plattform, artikelId = null, oeffentliche = [], vorauswahl = null, hinscrollen = false, onKatalogVerknuepft,
  varianten = [], variante = null, standardVariante = null, neu = false,
}) {
  const { status, benutzer } = useSitzung();
  const zeigeHinweis = useHinweis();
  const abschnitt = useRef(null);
  const [fotos, setFotos] = useState(benutzer && katalogId ? null : []);
  const [formular, setFormular] = useState(vorauswahl && artikelId ? vorauswahl : null);

  const laden = () => {
    if (!benutzer || !katalogId) return;
    api.medien(katalogId).then((liste) => setFotos(liste.filter((m) => m.ist_foto))).catch((e) => zeigeHinweis(e.message, 'fehler'));
  };
  useEffect(() => { laden(); }, [katalogId, benutzer?.id]);
  useEffect(() => { if (vorauswahl && artikelId) setFormular(vorauswahl); }, [vorauswahl, artikelId]);

  // Angemeldet: alle sichtbaren Fotos (eigene, freigegebene); sonst nur die öffentlichen
  const liste = benutzer ? fotos : oeffentliche.map((f) => ({ ...f, darf_bearbeiten: false, eigenes: false, sichtbarkeit: 'freigegeben', oeffentlich: true }));
  const gesucht = gesuchteFotos(typ, plattform);
  const varianteName = variante ? varianten.find((v) => v.id === variante)?.bezeichnung ?? null : null;
  const stand = (art) => {
    const passend = (liste ?? []).filter((f) => f.art === art && (!varianteName || f.variante_id === variante));
    if (passend.some((f) => f.sichtbarkeit === 'freigegeben')) return 'vorhanden';
    if (passend.some((f) => f.eigenes && f.sichtbarkeit === 'eingereicht')) return 'pruefung';
    if (passend.some((f) => f.eigenes)) return 'privat';
    return 'fehlt';
  };
  const teilenErlaubt = Boolean(status?.fotosTeilenErlaubt);
  // Aus „Fotos gesucht“ oder „Hier melden“: gleich zum Abschnitt springen, sobald er geladen ist
  const geladen = liste !== null;
  useEffect(() => { if (hinscrollen && geladen) abschnitt.current?.scrollIntoView({ block: 'start' }); }, [hinscrollen, geladen]);
  const fehlt = gesucht.some((art) => stand(art) === 'fehlt');
  const ersteFehlende = gesucht.find((art) => stand(art) === 'fehlt') ?? null;
  // Nach dem Hinzufügen: einmal je Spiel fragen (abschaltbar)
  const [frage, setFrage] = useState(null);
  useEffect(() => {
    if (!neu || !artikelId || !katalogId || !geladen || !ersteFehlende || !status?.fotosTeilenErlaubt) return;
    const gefragt = gefragteSpiele();
    if (gefragt.aus || gefragt.ids.includes(katalogId)) return;
    merkeGefragt({ ...gefragt, ids: [...gefragt.ids, katalogId].slice(-500) });
    setFrage(ersteFehlende);
  }, [neu, artikelId, katalogId, geladen, Boolean(status?.fotosTeilenErlaubt)]);

  async function aendern(f, daten, text) {
    try {
      await api.mediumAendern(f.id, daten);
      zeigeHinweis(text);
      laden();
    } catch (e) {
      zeigeHinweis(Object.values(e.felder ?? {})[0] ?? e.message, 'fehler');
    }
  }

  async function loeschen(f) {
    if (!window.confirm(`Foto „${f.titel || fotoKurz(f.art)}“ wirklich löschen?`)) return;
    try {
      await api.mediumLoeschen(f.id);
      laden();
    } catch (e) {
      zeigeHinweis(e.message, 'fehler');
    }
  }

  const fotografieren = (art) => {
    setFrage(null);
    setFormular(art);
    abschnitt.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <section id="fotos" ref={abschnitt} className="karte scroll-mt-20 space-y-3 p-4" data-tour="fotos">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><Symbol name="kamera" className="size-5" />Fotos: So sieht es aus</h3>
        {artikelId && !formular && (
          <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setFormular(gesucht.find((a) => stand(a) === 'fehlt') ?? gesucht[0] ?? 'foto_vorne')}>
            <Symbol name="plus" className="size-4" />Foto
          </button>
        )}
      </div>

      {frage && (
        <div className="fixed inset-x-4 bottom-24 z-30 mx-auto max-w-md rounded-2xl border border-akzent/50 bg-karte p-4 shadow-xl" role="dialog" aria-label="Foto gesucht">
          <p className="flex items-start gap-2 text-sm">
            <Symbol name="kamera" className="mt-0.5 size-5 shrink-0 text-akzent-hell" />
            <span>Zu diesem Spiel fehlt noch ein Foto: <strong>{fotoKurz(frage)}{varianteName ? ` (${varianteName})` : ''}</strong>. Jetzt fotografieren? So sehen andere Sammler, wie es wirklich aussieht.</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="knopf-primaer px-3 py-1.5" onClick={() => fotografieren(frage)}>Jetzt fotografieren</button>
            <button type="button" className="knopf-sekundaer px-3 py-1.5" onClick={() => setFrage(null)}>Später</button>
            <button type="button" className="text-xs text-leise underline" onClick={() => { merkeGefragt({ ...gefragteSpiele(), aus: true }); setFrage(null); }}>
              Nicht mehr fragen
            </button>
          </div>
        </div>
      )}

      {varianteName && liste && <p className="text-xs text-leise">Checkliste für deine Variante <strong className="text-text">{varianteName}</strong></p>}
      {/* Checkliste: was gibt es schon, was fehlt noch? */}
      {gesucht.length > 0 && liste && (
        <ul className="flex flex-wrap gap-1.5 text-xs" aria-label="Gesuchte Fotos">
          {gesucht.map((art) => {
            const s = stand(art);
            const inhalt = (
              <>
                <span aria-hidden="true">{s === 'vorhanden' ? '✓' : s === 'pruefung' ? '⏳' : s === 'privat' ? '🔒' : '＋'}</span>
                {fotoKurz(art)}
                <span className="sr-only">{{ vorhanden: ' – vorhanden', pruefung: ' – in Prüfung', privat: ' – nur für dich', fehlt: ' – gesucht' }[s]}</span>
              </>
            );
            const klasse = `abzeichen gap-1 ${s === 'vorhanden' ? 'text-erfolg' : s === 'fehlt' ? 'border-akzent/50 text-akzent-hell' : 'text-leise'}`;
            return (
              <li key={art}>
                {s === 'fehlt' && artikelId
                  ? <button type="button" className={`${klasse} hover:bg-akzent/10`} onClick={() => setFormular(art)} title="Foto hinzufügen">{inhalt}</button>
                  : <span className={klasse} title={{ vorhanden: 'Vorhanden', pruefung: 'Dein Foto wird geprüft', privat: 'Nur für dich gespeichert', fehlt: 'Gesucht' }[s]}>{inhalt}</span>}
              </li>
            );
          })}
        </ul>
      )}

      {formular && (
        <FotoFormular
          artikelId={artikelId}
          art={formular}
          varianten={varianten}
          variante={variante ?? standardVariante}
          teilenErlaubt={teilenErlaubt}
          oeffentlichMoeglich={teilenErlaubt && Boolean(status?.oeffentlicheFotos)}
          moderator={istModerator(benutzer)}
          maxMb={status?.maxMedienMb}
          onFertig={(medium) => {
            setFormular(null);
            if (!medium) return;
            zeigeHinweis(medium.sichtbarkeit === 'eingereicht' ? 'Danke! Das Moderationsteam prüft dein Foto.' : 'Foto gespeichert.');
            if (!katalogId) onKatalogVerknuepft?.(medium.katalog_id);
            else laden();
          }}
        />
      )}

      {liste === null && <p className="text-sm text-leise">Wird geladen …</p>}
      {liste?.length === 0 && !formular && (
        <p className="text-sm text-leise">
          {artikelId
            ? 'Noch keine Fotos. Fotografiere dein Exemplar – Modul oder Disc, Verpackung vorne und hinten, alles zusammen. So sehen andere Sammler, wie es wirklich aussieht.'
            : benutzer
              ? 'Noch keine Fotos von Sammlern. Hast du es? Füge es deiner Sammlung hinzu – dann kannst du hier Fotos beitragen.'
              : 'Noch keine Fotos von Sammlern. Hast du es? Melde dich an, nimm es in deine Sammlung auf und fotografiere es.'}
        </p>
      )}
      {liste?.length > 0 && fehlt && !artikelId && (
        <p className="text-xs text-leise">
          {benutzer ? 'Fehlende Fotos kannst du beitragen, sobald es in deiner Sammlung ist.' : 'Fehlende Fotos kannst du nach der Anmeldung beitragen, wenn es in deiner Sammlung ist.'}
        </p>
      )}

      {liste?.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {liste.map((f) => (
            <li key={f.id} className="flex flex-col overflow-hidden rounded-xl border border-rand">
              <a href={f.url} target="_blank" rel="noreferrer" className="flex aspect-square items-center justify-center bg-karte-hover">
                <img src={f.vorschau_url ?? f.url} alt={`${fotoKurz(f.art)}${f.titel ? ` – ${f.titel}` : ''}`} loading="lazy" className="size-full object-contain" />
              </a>
              <div className="flex flex-1 flex-col gap-1 p-2 text-xs">
                <p className="font-semibold text-text">{fotoKurz(f.art)}</p>
                {f.variante && <p className="truncate text-leise">Variante: {f.variante}</p>}
                {f.titel && <p className="truncate text-leise">{f.titel}</p>}
                {!f.eigenes && (f.hochgeladen_von || f.quelle) && <p className="text-leise">Foto: {f.hochgeladen_von ?? f.quelle}</p>}
                <div className="flex flex-wrap gap-1">
                  {f.eigenes && <StatusAbzeichen status={f.sichtbarkeit} className="w-fit" />}
                  {f.oeffentlich && (
                    <span className="abzeichen gap-1 text-akzent-hell" title="Auch auf der öffentlichen Spieleseite und in Suchmaschinen zu sehen">
                      <Symbol name="welt" className="size-3" />Öffentlich
                    </span>
                  )}
                  {f.eigenes && f.oeffentlich_erlaubt && !f.oeffentlich && f.sichtbarkeit !== 'abgelehnt' && (
                    <span className="abzeichen text-leise" title="Du hast die öffentliche Anzeige erlaubt – das Moderationsteam entscheidet">Öffentlich gewünscht</span>
                  )}
                </div>
                {f.eigenes && f.sichtbarkeit === 'abgelehnt' && f.pruefung_notiz && <p className="text-gefahr">{f.pruefung_notiz}</p>}
                <div className="mt-auto flex flex-wrap gap-1 pt-1">
                  {f.eigenes && teilenErlaubt && ['privat', 'abgelehnt'].includes(f.sichtbarkeit) && (
                    <button type="button" className="rounded-lg p-1.5 text-leise hover:bg-karte-hover hover:text-text" title="Mit der Community teilen (nach Prüfung)"
                      aria-label="Mit der Community teilen" onClick={() => aendern(f, { sichtbarkeit: 'eingereicht' }, 'Eingereicht – das Moderationsteam prüft dein Foto.')}>
                      <Symbol name="hochladen" className="size-4" />
                    </button>
                  )}
                  {f.eigenes && teilenErlaubt && status?.oeffentlicheFotos && f.sichtbarkeit !== 'abgelehnt' && (
                    <button type="button" className={`rounded-lg p-1.5 hover:bg-karte-hover ${f.oeffentlich_erlaubt ? 'text-akzent-hell' : 'text-leise hover:text-text'}`}
                      title={f.oeffentlich_erlaubt ? 'Öffentliche Anzeige zurücknehmen' : 'Öffentliche Anzeige erlauben (Spieleseite, Suchmaschinen)'}
                      aria-label={f.oeffentlich_erlaubt ? 'Öffentliche Anzeige zurücknehmen' : 'Öffentliche Anzeige erlauben'} aria-pressed={Boolean(f.oeffentlich_erlaubt)}
                      onClick={() => (f.oeffentlich_erlaubt
                        ? aendern(f, { oeffentlich_erlaubt: false }, 'Das Foto wird nicht mehr öffentlich gezeigt.')
                        : window.confirm(OEFFENTLICH_TEXT) && aendern(f, { oeffentlich_erlaubt: true }, 'Danke! Nach der Prüfung erscheint das Foto auch öffentlich.'))}>
                      <Symbol name="welt" className="size-4" />
                    </button>
                  )}
                  {!f.eigenes && <Andockpunkt name="melden" bereich="medien" zielId={f.id} klein />}
                  {f.darf_bearbeiten && (
                    <button type="button" onClick={() => loeschen(f)} className="rounded-lg p-1.5 text-leise hover:bg-gefahr/10 hover:text-gefahr" title="Löschen" aria-label="Löschen">
                      <Symbol name="muell" className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const OEFFENTLICH_TEXT = 'Foto öffentlich zeigen?\n\nNach der Prüfung erscheint es auf der öffentlichen Seite des Spiels – auch für Besucher ohne Konto '
  + 'und in Suchmaschinen wie der Google-Bildersuche. Du bestätigst, dass du das Foto selbst gemacht hast und keine Personen darauf zu erkennen sind. '
  + 'Es bleibt dein Foto – es wird nur hier gezeigt und nicht verkauft. Du kannst die Erlaubnis jederzeit zurücknehmen.';

function FotoFormular({ artikelId, art, varianten, variante, teilenErlaubt, oeffentlichMoeglich, moderator, maxMb, onFertig }) {
  const vorher = gemerkt();
  const [datei, setDatei] = useState(null);
  const [vorschau, setVorschau] = useState(null);
  useEffect(() => {
    if (!datei) return setVorschau(null);
    const url = URL.createObjectURL(datei);
    setVorschau(url);
    return () => URL.revokeObjectURL(url);
  }, [datei]);
  const [werte, setWerte] = useState({
    art, titel: '', variante_id: variante ? String(variante) : '',
    teilen: teilenErlaubt && vorher.teilen !== false,
    oeffentlich: oeffentlichMoeglich && vorher.oeffentlich === true,
    name: vorher.name === true,
  });
  const [fortschritt, setFortschritt] = useState(null);
  const [fehler, setFehler] = useState(null);
  useEffect(() => { setWerte((w) => ({ ...w, art })); }, [art]);
  const haken = (f) => (e) => setWerte((w) => ({ ...w, [f]: e.target.checked }));

  async function absenden(e) {
    e.preventDefault();
    if (!datei) return setFehler('Bitte ein Foto aufnehmen oder auswählen.');
    setFehler(null);
    setFortschritt(0);
    const teilen = teilenErlaubt && werte.teilen;
    const oeffentlich = teilen && oeffentlichMoeglich && werte.oeffentlich;
    merke({ teilen: werte.teilen, oeffentlich: werte.oeffentlich, name: werte.name });
    try {
      onFertig(await api.mediumHochladen(artikelId, {
        art: werte.art,
        titel: werte.titel.trim(),
        variante_id: werte.variante_id,
        sichtbarkeit: teilen ? 'eingereicht' : 'privat',
        oeffentlich_erlaubt: oeffentlich ? 'true' : 'false',
        name_nennen: oeffentlich && werte.name ? 'true' : 'false',
      }, datei, setFortschritt));
    } catch (err) {
      setFehler(Object.values(err.felder ?? {})[0] ?? err.message);
      setFortschritt(null);
    }
  }

  return (
    <form onSubmit={absenden} className="space-y-3 rounded-xl border border-rand p-3" data-tour="foto-formular">
      <label className="block">
        <span className="beschriftung">Was ist auf dem Foto?</span>
        <select className="eingabe" value={werte.art} onChange={(e) => setWerte((w) => ({ ...w, art: e.target.value }))}>
          {FOTOARTEN.map((a) => <option key={a.value} value={a.value}>{a.kurz}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3">
        {vorschau && <img src={vorschau} alt="Ausgewähltes Foto" className="size-16 shrink-0 rounded-lg border border-rand object-cover" />}
        <label className="knopf-sekundaer min-w-0 flex-1 cursor-pointer justify-center focus-within:ring-2 focus-within:ring-akzent">
          <Symbol name="kamera" className="size-4 shrink-0" />
          <span className="truncate">{datei ? datei.name : 'Foto aufnehmen oder auswählen'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Foto aufnehmen oder auswählen"
            onChange={(e) => setDatei(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <p className="-mt-2 text-xs text-leise">JPG, PNG oder WebP{maxMb ? `, max. ${maxMb} MB` : ''}. Standort und Kameradaten werden beim Hochladen entfernt.</p>
      {varianten.length > 0 && (
        <label className="block">
          <span className="beschriftung">Variante (optional)</span>
          <select className="eingabe" value={werte.variante_id} onChange={(e) => setWerte((w) => ({ ...w, variante_id: e.target.value }))}>
            <option value="">– keine bestimmte –</option>
            {varianten.map((v) => <option key={v.id} value={v.id}>{v.bezeichnung}{v.region ? ` (${v.region})` : ''}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className="beschriftung">Bezeichnung (optional)</span>
        <input className="eingabe" value={werte.titel} onChange={(e) => setWerte((w) => ({ ...w, titel: e.target.value }))}
          placeholder="z. B. PAL-Version, Players Choice, Platinum" maxLength={200} />
      </label>
      <details className="rounded-lg bg-karte-hover/50 px-3 py-2 text-xs text-leise">
        <summary className="cursor-pointer font-semibold text-text">Tipps für gute Fotos</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Tageslicht oder helles, indirektes Licht – ohne Blitz (spiegelt auf Folie und Etikett).</li>
          <li>Ruhiger, einfarbiger Hintergrund; das ganze Teil gerade von vorne, formatfüllend.</li>
          <li>Etikett, Modulnummer und Alterskennzeichen scharf – dafür lieber etwas näher heran.</li>
          <li>Keine Personen, Hände mit Ringen oder Adressen im Bild – und nur eigene Fotos, keine aus dem Internet.</li>
        </ul>
      </details>
      {teilenErlaubt ? (
        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={werte.teilen} onChange={haken('teilen')} />
            <span>Mit der Community teilen <span className="block text-xs text-leise">{moderator ? 'Als Moderator gibst du es direkt frei.' : 'Nach der Prüfung für alle angemeldeten Sammler sichtbar.'} Es bleibt dein Foto; löschen kannst du es jederzeit.</span></span>
          </label>
          {oeffentlichMoeglich && werte.teilen && (
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={werte.oeffentlich} onChange={haken('oeffentlich')} />
              <span>
                Auch öffentlich zeigen – auf der Spieleseite und in Suchmaschinen (z. B. Google-Bildersuche)
                <span className="block text-xs text-leise">
                  Ich habe das Foto selbst gemacht, es zeigt keine Personen, und ich erlaube die öffentliche Anzeige. Es bleibt mein Foto –
                  es wird nur hier gezeigt und nicht verkauft. Die Erlaubnis kann ich jederzeit zurücknehmen; das Foto verschwindet dann von
                  den öffentlichen Seiten.
                </span>
              </span>
            </label>
          )}
          {oeffentlichMoeglich && werte.teilen && werte.oeffentlich && (
            <label className="flex items-start gap-2 pl-6">
              <input type="checkbox" className="mt-1" checked={werte.name} onChange={haken('name')} />
              <span>Meinen Anzeigenamen als Fotograf nennen <span className="block text-xs text-leise">Sonst steht dort „Sammler“.</span></span>
            </label>
          )}
        </div>
      ) : (
        <p className="text-xs text-leise">Das Foto wird nur für dich gespeichert.</p>
      )}
      {fortschritt !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-karte-hover" role="progressbar" aria-valuenow={Math.round(fortschritt * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-akzent transition-all" style={{ width: `${Math.round(fortschritt * 100)}%` }} />
        </div>
      )}
      {fehler && <p className="text-sm text-gefahr" role="alert">{fehler}</p>}
      <div className="flex gap-2">
        <button type="button" className="knopf-sekundaer" onClick={() => onFertig(null)} disabled={fortschritt !== null}>Abbrechen</button>
        <button type="submit" className="knopf-primaer" disabled={fortschritt !== null}>
          {fortschritt === null ? 'Hochladen' : fortschritt < 1 ? `Lädt hoch … ${Math.round(fortschritt * 100)} %` : 'Wird verarbeitet …'}
        </button>
      </div>
    </form>
  );
}
