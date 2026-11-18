// Fotos von Sammlern: Modul, Disc, Verpackung, Gerät … – damit man sieht, wie ein Spiel oder Gerät wirklich aussieht.
// Checkliste „Fotos gesucht“, Hochladen (Kamera oder Galerie) und – nur mit Einwilligung des Fotografen und nach Prüfung –
// Anzeige auf der öffentlichen Spieleseite (auch in der Bildersuche). Scans von Cover und Anleitung stehen unter „Scans & Dokumente“.
import { useEffect, useRef, useState } from 'react';
import { MEDIENARTEN, FREISTELL_ARTEN, REGIONEN, beilageVorhanden, beschriftung, gesuchteFotos, istModerator, neuauflagenFuer } from '../../../shared/konstanten.js';
import { nativesFreistellen } from '../nativ.js';
import { api } from '../api.js';
import { useSitzung } from '../sitzung.js';
import { navigiere } from '../router.js';
import { Andockpunkt } from '../erweiterungen.jsx';
import StatusAbzeichen from './StatusAbzeichen.jsx';
import Symbol from './Symbole.jsx';
import { useHinweis } from './Hinweise.jsx';
import { usePlattformen } from '../plattformen.js';
import Zuschnitt, { formatFuer, zuschneiden } from './Zuschnitt.jsx';
import { RegionHilfe } from './RegionHilfe.jsx';
import { exifAusJpeg, kameraAusExif } from '../../../shared/exif.js';

/** Hat das Original Kameradaten (Hersteller/Modell)? Zuschneiden im Browser verwirft sie – der Vermerk geht deshalb gesondert mit. */
async function hatKameradaten(datei) {
  try {
    if (!/jpe?g/i.test(datei?.type ?? '')) return false;
    return Boolean(kameraAusExif(exifAusJpeg(new Uint8Array(await datei.slice(0, 256 * 1024).arrayBuffer()))));
  } catch {
    return false;
  }
}

export const FOTOARTEN = MEDIENARTEN.filter((a) => a.foto);
export const fotoKurz = (art) => beschriftung(MEDIENARTEN, art, 'kurz');

// Zuletzt gewählte Einstellungen beim Hochladen (nur in diesem Browser)
const SPEICHER = 'fotos-einstellungen';
/** Fotos dieser Arten merken sich die Fassung bzw. Edition des Exemplars (z. B. Platinum, „Zelda 25th Anniversary“). */
const FASSUNG_TYPEN = ['spiel', 'konsole'];

function gemerkt() {
  try { return JSON.parse(localStorage.getItem(SPEICHER) ?? '{}') ?? {}; } catch { return {}; }
}
function merke(werte) {
  try { localStorage.setItem(SPEICHER, JSON.stringify(werte)); } catch { /* egal */ }
}
// Nach dem Hinzufügen schon nach Fotos gefragt (je Spiel einmal, in diesem Browser). „Nicht mehr fragen“ steht am Konto
// (Konto → „Nach dem Hinzufügen nach fehlenden Fotos fragen“).
const GEFRAGT = 'fotos-gefragt';
function gefragteSpiele() {
  try {
    const w = JSON.parse(localStorage.getItem(GEFRAGT) ?? '{}') ?? {};
    return { ids: Array.isArray(w.ids) ? w.ids : [] };
  } catch { return { ids: [] }; }
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
 * `fassung`: Fassung des eigenen Exemplars (z. B. „Platinum“) – wird beim Hochladen vom Server übernommen.
 * `nurVerpackung`: leere Verpackung bzw. „Nur OVP“ – keine Fotos von Datenträger, Figur oder Gerät gesucht.
 * `region`: Region des eigenen Exemplars (z. B. pal_de) – Fotos einer anderen Region (PAL-UK-Cover) gehören nicht dazu.
 * `versiegelt` (Zustand „Neu/OVP“) und `beilagen` des eigenen Exemplars bestimmen, welche Fotos dafür gesucht werden.
 */
// Beim Steelbook gleich wie bei der normalen Ausgabe
const GLEICHE_ARTEN = ['foto_modul', 'foto_disc', 'foto_diskette', 'foto_anleitung', 'foto_beilagen'];

export default function Fotos({
  katalogId, typ, plattform, artikelId = null, oeffentliche = [], vorauswahl = null, hinscrollen = false, onKatalogVerknuepft,
  varianten = [], variante = null, standardVariante = null, fassung = null, region = null, nurVerpackung = false, neu = false, versiegelt = false, beilagen = null, mitVerpackung = false, merchKategorie = null,
}) {
  const { status, benutzer, aktualisiere } = useSitzung();
  const zeigeHinweis = useHinweis();
  const abschnitt = useRef(null);
  const checkliste = useRef(null);
  const [fotos, setFotos] = useState(benutzer && katalogId ? null : []);
  const [formular, setFormular] = useState(vorauswahl && artikelId ? vorauswahl : null);

  const laden = () => {
    if (!benutzer || !katalogId) return;
    api.medien(katalogId).then((liste) => setFotos(liste.filter((m) => m.ist_foto))).catch((e) => zeigeHinweis(e.message, 'fehler'));
  };
  useEffect(() => { laden(); }, [katalogId, benutzer?.id]);
  useEffect(() => { if (vorauswahl && artikelId) setFormular(vorauswahl); }, [vorauswahl, artikelId]);

  // Angemeldet: alle sichtbaren Fotos (eigene, freigegebene); sonst nur die öffentlichen
  const alle = benutzer ? fotos : oeffentliche.map((f) => ({ ...f, darf_bearbeiten: false, eigenes: false, sichtbarkeit: 'freigegeben', oeffentlich: true }));
  // Plattform (eigenes Exemplar bzw. auf der Spieleseite gewählt): deren Fotos zuerst, dann ohne Plattform, dann andere
  const plattformId = plattform?.id ?? null;
  const rang = (f) => (!plattformId || f.plattform_id === plattformId ? 0 : f.plattform_id ? 2 : 1);
  // Region (PAL-DE, PAL-UK …): Cover und Hüllen unterscheiden sich je Land – Fotos ohne Region passen überall, andere Regionen nach hinten
  const passendeRegion = (f) => !region || !f.region || f.region === region;
  const regionRang = (f) => (passendeRegion(f) ? 0 : 1);
  const liste = alle && (plattformId || region) ? [...alle].sort((a, b) => rang(a) - rang(b) || regionRang(a) - regionRang(b)) : alle;
  const passendePlattform = (f) => !plattformId || !f.plattform_id || f.plattform_id === plattformId;
  // Fassung (Spiele, Konsolen) am eigenen Exemplar: Platinum-Fotos zählen nur bei Platinum, Fotos ohne Fassung nur bei Erstauflage/Standard
  const mitFassung = FASSUNG_TYPEN.includes(typ);
  const klein = (t) => String(t ?? '').trim().toLowerCase();
  const varianteName = variante ? varianten.find((v) => v.id === variante)?.bezeichnung ?? null : null;
  // Steelbook: Datenträger, Anleitung und Beilagen sind wie bei der normalen Ausgabe – deren Fotos gelten auch hier (auch ohne Variante
  // bzw. mit Fassung ohne „Steelbook“); nur das Steelbook selbst bekommt ein eigenes Foto
  const steelbook = typ === 'spiel' && Boolean(artikelId) && (beilageVorhanden(beilagen?.steelbook) || /steel ?book/i.test(`${fassung ?? ''} ${varianteName ?? ''}`));
  const gleichWieNormal = (f) => steelbook && GLEICHE_ARTEN.includes(f.art);
  const ohneSteelbook = (t) => klein(t).replace(/\bsteel ?book( edition)?\b/g, '').replace(/\s+/g, ' ').trim();
  const passendeFassung = (f) => !artikelId || !mitFassung || klein(f.edition) === klein(fassung)
    || (gleichWieNormal(f) && ohneSteelbook(f.edition) === ohneSteelbook(fassung));
  const passendeVariante = (f) => !varianteName || f.variante_id === variante || (gleichWieNormal(f) && !f.variante_id);
  // Am eigenen Exemplar nur dessen Fotos zeigen: eigene Fotos dieses Exemplars (ältere ohne Zuordnung, wenn Plattform, Fassung und
  // Variante passen). Community-Fotos und Fotos anderer Exemplare erst auf Wunsch – sonst wird die Leiste unnötig lang
  const [andereZeigen, setAndereZeigen] = useState(false);
  const zumExemplar = (f) => f.eigenes && (f.artikel_id ? f.artikel_id === artikelId
    : passendePlattform(f) && passendeFassung(f) && passendeRegion(f) && (!variante || !f.variante_id || f.variante_id === variante));
  // Für ein eigenes Exemplar: eingeschweißt → nichts, wofür man es öffnen müsste; mit Beilagen auch ein Foto davon
  const gesucht = gesuchteFotos(typ, plattform, artikelId ? { versiegelt, beilagen, mitVerpackung, merchKategorie, nurVerpackung } : { merchKategorie });
  const passt = (f) => passendeVariante(f) && passendePlattform(f) && passendeFassung(f) && passendeRegion(f);
  // Gesuchte Art ohne eigenes Foto, aber mit passendem freigegebenem (z. B. die Disc der normalen Ausgabe beim Steelbook): dieses zeigen,
  // damit „✓“ in der Checkliste nicht ins Leere zeigt
  const stellvertretend = new Set(artikelId && liste ? gesucht.flatMap((art) => {
    if (liste.some((f) => f.art === art && zumExemplar(f))) return [];
    const f = liste.find((x) => x.art === art && x.sichtbarkeit === 'freigegeben' && passt(x));
    return f ? [f.id] : [];
  }) : []);
  const anzeigen = artikelId && liste ? liste.filter((f) => andereZeigen || zumExemplar(f) || stellvertretend.has(f.id)) : liste;
  const anzahlAndere = artikelId && liste ? liste.filter((f) => !zumExemplar(f) && !stellvertretend.has(f.id)).length : 0;
  const stand = (art) => {
    // Ein PS4-Foto zählt beim PS5-Exemplar nicht als vorhanden (Fotos ohne Plattform zählen überall)
    const passend = (liste ?? []).filter((f) => f.art === art && passt(f));
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
    if (benutzer?.fotos_nachfragen === false || gefragt.ids.includes(katalogId)) return;
    merkeGefragt({ ...gefragt, ids: [...gefragt.ids, katalogId].slice(-500) });
    setFrage(ersteFehlende);
  }, [neu, artikelId, katalogId, geladen, Boolean(status?.fotosTeilenErlaubt)]);

  const [bearbeitet, setBearbeitet] = useState(null); // ID des Fotos, dessen Angaben gerade geändert werden
  async function aendern(f, daten, text) {
    try {
      const neu = await api.mediumAendern(f.id, daten);
      // Andere Region bzw. Plattform als das Exemplar: Das Foto gehört nicht mehr dazu (bleibt beim Spiel für die richtige Fassung)
      zeigeHinweis(f.artikel_id && neu?.artikel_id === null
        ? `${text} Das Foto passt nicht mehr zu diesem Exemplar und steht jetzt beim Spiel unter „weitere Fotos“.` : text);
      laden();
    } catch (e) {
      zeigeHinweis(Object.values(e.felder ?? {})[0] ?? e.message, 'fehler');
    }
  }

  // Hintergrund entfernen: Kann dieses Gerät es selbst (App mit eingebauter Freistellung), sofort hier – sonst in die
  // Warteschlange für Helfer-Geräte (z. B. Discs und Disc-Hüllen, die nicht automatisch drankommen)
  const [freistellenLaeuft, setFreistellenLaeuft] = useState(null);
  async function freistellenAnfordern(f) {
    const nativ = nativesFreistellen();
    setFreistellenLaeuft(f.id);
    try {
      if (nativ) {
        const maske = await nativ.maske(await api.datei(f.url));
        if (!maske) throw new Error('Auf diesem Foto wurde kein Motiv erkannt.');
        await api.mediumFreistellen(f.id, maske);
        zeigeHinweis('Hintergrund entfernt – vergleiche Original und Ergebnis und entscheide.');
      } else {
        await api.freistellenAnfordern(f.id);
        zeigeHinweis('Eingereiht – ein Helfer-Gerät entfernt den Hintergrund; danach kannst du das Ergebnis prüfen.');
      }
      laden();
    } catch (e) {
      zeigeHinweis(e.message, 'fehler');
    } finally {
      setFreistellenLaeuft(null);
    }
  }

  // Freigestellte Version (Hintergrund entfernt) übernehmen oder beim Original bleiben
  async function freistellenEntscheiden(f, annehmen) {
    try {
      await api.freistellenEntscheiden(f.id, annehmen);
      zeigeHinweis(annehmen ? 'Die freigestellte Version wird jetzt gezeigt.' : 'Es bleibt beim Original.');
      laden();
    } catch (e) {
      zeigeHinweis(e.message, 'fehler');
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
            <button type="button" className="text-xs text-leise underline" onClick={async () => {
              setFrage(null);
              try {
                await api.kontoAendern({ fotos_nachfragen: false });
                aktualisiere();
                zeigeHinweis('Wir fragen nicht mehr. Wieder einschalten kannst du das unter „Konto“.');
              } catch (e) { zeigeHinweis(e.message, 'fehler'); }
            }}>
              Nicht mehr fragen
            </button>
          </div>
        </div>
      )}

      {varianteName && liste && <p className="text-xs text-leise">Checkliste für deine Variante <strong className="text-text">{varianteName}</strong></p>}
      {/* Checkliste: was gibt es schon, was fehlt noch? */}
      {gesucht.length > 0 && liste && (
        <ul ref={checkliste} className="flex scroll-mt-24 flex-wrap gap-1.5 text-xs" aria-label="Gesuchte Fotos">
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
          fassung={mitFassung ? fassung : null}
          fassungWort={typ === 'konsole' ? 'Edition' : 'Fassung'}
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
            // Zurück zur Checkliste (was fehlt noch?) statt am unteren Ende des Kastens zu stehen, wenn das Formular verschwindet
            requestAnimationFrame(() => (checkliste.current ?? abschnitt.current)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
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
      {/* Ohne eigenes Exemplar: der Weg dorthin, statt dass „Foto hinzufügen“ ins Leere führt */}
      {!artikelId && katalogId && (fehlt || vorauswahl) && liste && (
        <div className="flex flex-wrap gap-2" data-testid="fotos-weg">
          {benutzer ? (
            <button type="button" className="knopf-sekundaer px-3 py-1.5 text-sm" onClick={() => navigiere('/neu/formular', { katalog: katalogId, typ })}>
              <Symbol name="plus" className="size-4" />Zur Sammlung hinzufügen und Foto beitragen
            </button>
          ) : (
            <a className="knopf-sekundaer px-3 py-1.5 text-sm" href="#/" onClick={() => {
              try { sessionStorage.setItem('zockerdb-nach-anmeldung', `#/katalog/${katalogId}${vorauswahl ? `?foto=${encodeURIComponent(vorauswahl)}` : '?fotos=1'}`); } catch { /* egal */ }
            }}>
              Anmelden oder kostenlos registrieren, um Fotos beizutragen
            </a>
          )}
        </div>
      )}

      {anzeigen?.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {anzeigen.map((f) => (
            <li key={f.id} className="flex flex-col overflow-hidden rounded-xl border border-rand">
              <a href={f.frei_url ?? f.url} target="_blank" rel="noreferrer" className="flex aspect-square items-center justify-center bg-karte-hover">
                <img src={f.frei_url ?? f.vorschau_url ?? f.url} alt={`${fotoKurz(f.art)}${f.titel ? ` – ${f.titel}` : ''}`} loading="lazy" className="size-full object-contain" />
              </a>
              <div className="flex flex-1 flex-col gap-1 p-2 text-xs">
                <p className="font-semibold text-text">{fotoKurz(f.art)}</p>
                {f.plattform && <p className={`truncate ${plattformId && f.plattform_id !== plattformId ? 'text-warnung' : 'text-leise'}`} data-testid="foto-plattform">Plattform: {f.plattform}</p>}
                {f.edition && <p className="truncate text-leise" data-testid="foto-fassung">{typ === 'konsole' ? 'Edition' : 'Fassung'}: {f.edition}</p>}
                {stellvertretend.has(f.id) && <p className="text-leise" data-testid="foto-stellvertretend">{gleichWieNormal(f) ? 'Wie bei der normalen Ausgabe' : 'Passendes Foto eines anderen Exemplars'}</p>}
                {f.region && <p className={`truncate ${passendeRegion(f) ? 'text-leise' : 'text-warnung'}`} data-testid="foto-region">Region: {REGIONEN.find((r) => r.value === f.region)?.kurz ?? f.region}</p>}
                {f.variante && klein(f.variante) !== klein(f.edition) && <p className="truncate text-leise" data-testid="foto-variante">Variante: {f.variante}</p>}
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
                  {f.frei_url && <span className="abzeichen text-leise" title="Hintergrund entfernt – das Original bleibt gespeichert">Freigestellt</span>}
                </div>
                {f.eigenes && f.sichtbarkeit === 'abgelehnt' && f.pruefung_notiz && <p className="text-gefahr">{f.pruefung_notiz}</p>}
                {f.frei_pruefen_url && (
                  <div className="space-y-1 rounded-lg border border-akzent/40 p-2" data-testid="frei-pruefen">
                    <p className="font-semibold">Freigestellte Version prüfen</p>
                    <div className="grid grid-cols-2 gap-1" data-galerie>
                      <a href={f.url} target="_blank" rel="noreferrer" aria-label="Original groß ansehen">
                        <img src={f.vorschau_url ?? f.url} alt="Original" loading="lazy" className="aspect-square w-full bg-karte-hover object-contain" />
                      </a>
                      <a href={f.frei_pruefen_url} target="_blank" rel="noreferrer" aria-label="Freigestellt groß ansehen">
                        <img src={f.frei_pruefen_url} alt="Freigestellt" loading="lazy" className="aspect-square w-full bg-karte-hover object-contain" />
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="knopf-primaer px-2 py-1" onClick={() => freistellenEntscheiden(f, true)}>Übernehmen</button>
                      <button type="button" className="knopf-sekundaer px-2 py-1" onClick={() => freistellenEntscheiden(f, false)}>Original behalten</button>
                    </div>
                  </div>
                )}
                {f.frei_in_arbeit && <p className="text-xs text-leise">Hintergrund wird entfernt – du wirst benachrichtigt.</p>}
                {/* Auf fähigen Geräten sofort hier freistellen (auch, wenn das Foto schon in der Warteschlange wartet), sonst einreihen */}
                {(f.frei_anfordern || (f.frei_in_arbeit && nativesFreistellen())) && (
                  <button type="button" className="w-fit text-leise underline" data-testid="freistellen-anfordern" disabled={freistellenLaeuft === f.id}
                    onClick={() => freistellenAnfordern(f)}
                    title={nativesFreistellen() ? 'Dein Gerät entfernt den Hintergrund sofort; danach entscheidest du, ob die freigestellte Version gezeigt wird'
                      : 'Ein Helfer-Gerät entfernt den Hintergrund; danach entscheidest du, ob die freigestellte Version gezeigt wird'}>
                    {freistellenLaeuft === f.id ? 'Hintergrund wird entfernt …' : nativesFreistellen() ? 'Hintergrund jetzt entfernen' : 'Hintergrund entfernen lassen'}
                  </button>
                )}
                {f.frei_url && (f.eigenes || f.darf_bearbeiten) && (
                  <button type="button" className="w-fit text-leise underline" onClick={() => freistellenEntscheiden(f, false)}>Freistellung verwerfen</button>
                )}
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
                  {benutzer && !f.eigenes && f.oeffentlich && <Andockpunkt name="foto.aktionen" foto={f} />}
                  {!f.eigenes && <Andockpunkt name="melden" bereich="medien" zielId={f.id} klein />}
                  {f.darf_bearbeiten && (
                    <button type="button" onClick={() => setBearbeitet(bearbeitet === f.id ? null : f.id)} className="rounded-lg p-1.5 text-leise hover:bg-karte-hover hover:text-text"
                      title="Fotoart, Plattform, Variante oder Bezeichnung ändern" aria-label="Foto bearbeiten" aria-expanded={bearbeitet === f.id} data-testid="foto-bearbeiten">
                      <Symbol name="stift" className="size-4" />
                    </button>
                  )}
                  {f.darf_bearbeiten && (
                    <button type="button" onClick={() => loeschen(f)} className="rounded-lg p-1.5 text-leise hover:bg-gefahr/10 hover:text-gefahr" title="Löschen" aria-label="Löschen">
                      <Symbol name="muell" className="size-4" />
                    </button>
                  )}
                </div>
                {bearbeitet === f.id && (
                  <FotoBearbeiten foto={f} varianten={varianten} moderator={istModerator(benutzer)} fassungFeld={mitFassung ? typ : null} plattform={plattform}
                    onSpeichern={(daten) => aendern(f, daten, istModerator(benutzer) || f.sichtbarkeit !== 'freigegeben' ? 'Gespeichert.' : 'Gespeichert – das Moderationsteam prüft die Änderung.').then(() => setBearbeitet(null))}
                    onAbbrechen={() => setBearbeitet(null)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {anzahlAndere > 0 && (
        <button type="button" className="text-sm text-leise underline" data-testid="fotos-andere-exemplare" onClick={() => setAndereZeigen((z) => !z)}>
          {andereZeigen ? 'Nur Fotos zu diesem Exemplar zeigen'
            : `${anzahlAndere} weitere${anzahlAndere === 1 ? 's Foto' : ' Fotos'} zeigen (Community und andere Exemplare)`}
        </button>
      )}
    </section>
  );
}

/** Angaben eines Fotos ändern (falsche Fotoart, Variante bzw. Farbe, Bezeichnung) – für den Fotografen und die Moderation. */
function FotoBearbeiten({ foto, varianten, moderator, fassungFeld, plattform, onSpeichern, onAbbrechen }) {
  const spiel = fassungFeld === 'spiel';
  const [w, setW] = useState({ art: foto.art, variante_id: foto.variante_id ? String(foto.variante_id) : '', titel: foto.titel ?? '', plattform_id: foto.plattform_id ? String(foto.plattform_id) : '', edition: foto.edition ?? '', region: foto.region ?? '' });
  const arten = MEDIENARTEN.filter((a) => (foto.ist_foto ? a.foto : !a.foto));
  const plattformen = usePlattformen();
  return (
    <form className="space-y-1.5 border-t border-rand pt-2" data-testid="foto-bearbeiten-formular"
      onSubmit={(e) => { e.preventDefault(); onSpeichern({ art: w.art, titel: w.titel, variante_id: w.variante_id || null, plattform_id: w.plattform_id || null, region: w.region || null, ...(fassungFeld ? { edition: w.edition } : {}) }); }}>
      <label className="block"><span className="text-leise">Art</span>
        <select className="eingabe py-1 text-xs" value={w.art} onChange={(e) => setW((x) => ({ ...x, art: e.target.value }))} aria-label="Fotoart">
          {arten.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </label>
      {plattformen.length > 0 && (
        <label className="block"><span className="text-leise">Plattform (welche Fassung zeigt das Foto?)</span>
          <select className="eingabe py-1 text-xs" value={w.plattform_id} onChange={(e) => setW((x) => ({ ...x, plattform_id: e.target.value }))} aria-label="Plattform">
            <option value="">– unbekannt –</option>
            {plattformen.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      <label className="block"><span className="text-leise">Region (Cover unterscheiden sich je Land)</span>
        <select className="eingabe py-1 text-xs" value={w.region} onChange={(e) => setW((x) => ({ ...x, region: e.target.value }))} aria-label="Region">
          <option value="">– unbekannt –</option>
          {REGIONEN.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
      <RegionHilfe />
      {fassungFeld && (
        <label className="block"><span className="text-leise">{spiel ? 'Fassung (leer = Erstauflage / Standard)' : 'Edition (leer = Standard)'}</span>
          <input className="eingabe py-1 text-xs" value={w.edition} maxLength={60} list={`fassungen-${foto.id}`} placeholder={spiel ? 'z. B. Platinum' : 'z. B. Zelda 25th Anniversary'}
            onChange={(e) => setW((x) => ({ ...x, edition: e.target.value }))} aria-label={spiel ? 'Fassung' : 'Edition'} />
          <datalist id={`fassungen-${foto.id}`}>{(spiel ? neuauflagenFuer(foto.plattform ?? plattform?.name ?? '') : []).map((n) => <option key={n} value={n} />)}</datalist>
        </label>
      )}
      {varianten.length > 0 && (
        <label className="block"><span className="text-leise">Variante / Farbe</span>
          <select className="eingabe py-1 text-xs" value={w.variante_id} onChange={(e) => setW((x) => ({ ...x, variante_id: e.target.value }))} aria-label="Variante">
            <option value="">– keine –</option>
            {varianten.map((v) => <option key={v.id} value={v.id}>{v.bezeichnung}{v.region ? ` (${v.region})` : ''}</option>)}
          </select>
        </label>
      )}
      <label className="block"><span className="text-leise">Bezeichnung</span>
        <input className="eingabe py-1 text-xs" value={w.titel} maxLength={200} onChange={(e) => setW((x) => ({ ...x, titel: e.target.value }))} aria-label="Bezeichnung" />
      </label>
      {!moderator && foto.sichtbarkeit === 'freigegeben' && <p className="text-leise">Nach einer Änderung prüft das Moderationsteam das Foto erneut.</p>}
      <div className="flex gap-1">
        <button type="submit" className="knopf-primaer px-2 py-1 text-xs">Speichern</button>
        <button type="button" className="knopf-sekundaer px-2 py-1 text-xs" onClick={onAbbrechen}>Abbrechen</button>
      </div>
    </form>
  );
}

const OEFFENTLICH_TEXT = 'Foto öffentlich zeigen?\n\nNach der Prüfung erscheint es auf der öffentlichen Seite des Spiels – auch für Besucher ohne Konto '
  + 'und in Suchmaschinen wie der Google-Bildersuche. Du bestätigst, dass du das Foto selbst gemacht hast und keine Personen darauf zu erkennen sind. '
  + 'Es bleibt dein Foto – es wird nur hier gezeigt und nicht verkauft. Du kannst die Erlaubnis jederzeit zurücknehmen.';

function FotoFormular({ artikelId, art, varianten, variante, fassung, fassungWort = 'Fassung', teilenErlaubt, oeffentlichMoeglich, moderator, maxMb, onFertig }) {
  const vorher = gemerkt();
  // Im Konto eingeschaltet: „öffentlich zeigen“ ist bei jedem Upload vorausgewählt (je Foto abwählbar)
  const immerOeffentlich = useSitzung().benutzer?.fotos_oeffentlich === true;
  const [datei, setDatei] = useState(null);
  const zuschnitt = useRef(null); // { bild, zuschnitt } aus <Zuschnitt>
  const [werte, setWerte] = useState({
    art, titel: '', variante_id: variante ? String(variante) : '',
    teilen: teilenErlaubt && (immerOeffentlich || vorher.teilen !== false),
    oeffentlich: oeffentlichMoeglich && (immerOeffentlich || vorher.oeffentlich === true),
    name: vorher.name === true,
  });
  const [fortschritt, setFortschritt] = useState(null);
  const [freistellen, setFreistellen] = useState(false);
  const [fehler, setFehler] = useState(null);
  useEffect(() => { setWerte((w) => ({ ...w, art })); }, [art]);
  const haken = (f) => (e) => setWerte((w) => ({ ...w, [f]: e.target.checked }));

  // App (iOS ab 17): Hintergrund gleich auf dem Gerät entfernen – das Ergebnis erscheint danach in der Liste zum Prüfen
  // („Übernehmen“ / „Original behalten“). Schlägt es fehl, bleibt einfach das Original.
  async function freistellenAnbieten(medium, bild) {
    const nativ = nativesFreistellen();
    if (!nativ || !medium?.id || !FREISTELL_ARTEN.includes(medium.art ?? werte.art)) return;
    // Discs und Disc-Hüllen nur auf Wunsch („Hintergrund entfernen lassen“ am Foto) – der Server sagt, ob automatisch
    if (medium.frei_automatisch === false) return;
    setFreistellen(true);
    try {
      const maske = await nativ.maske(bild);
      if (maske) await api.mediumFreistellen(medium.id, maske);
    } catch { /* Original bleibt */ } finally {
      setFreistellen(false);
    }
  }

  async function absenden(e) {
    e.preventDefault();
    if (!datei) return setFehler('Bitte ein Foto aufnehmen oder auswählen.');
    setFehler(null);
    setFortschritt(0);
    const teilen = teilenErlaubt && werte.teilen;
    const oeffentlich = teilen && oeffentlichMoeglich && werte.oeffentlich;
    merke({ teilen: werte.teilen, oeffentlich: werte.oeffentlich, name: werte.name });
    try {
      const hochladen = await zuschneiden(datei, zuschnitt.current?.bild, zuschnitt.current?.zuschnitt);
      const kameraOriginal = hochladen !== datei && await hatKameradaten(datei);
      const medium = await api.mediumHochladen(artikelId, {
        ...(kameraOriginal ? { kamera_original: '1' } : {}),
        art: werte.art,
        titel: werte.titel.trim(),
        variante_id: werte.variante_id,
        sichtbarkeit: teilen ? 'eingereicht' : 'privat',
        oeffentlich_erlaubt: oeffentlich ? 'true' : 'false',
        name_nennen: oeffentlich && werte.name ? 'true' : 'false',
      }, hochladen, setFortschritt);
      await freistellenAnbieten(medium, hochladen);
      onFertig(medium);
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
        <label className="knopf-sekundaer min-w-0 flex-1 cursor-pointer justify-center focus-within:ring-2 focus-within:ring-akzent">
          <Symbol name="kamera" className="size-4 shrink-0" />
          <span className="truncate">{datei ? datei.name : 'Foto aufnehmen oder auswählen'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="sr-only" aria-label="Foto aufnehmen oder auswählen"
            onChange={(e) => setDatei(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <p className="-mt-2 text-xs text-leise">JPG, PNG oder WebP{maxMb ? `, max. ${maxMb} MB` : ''}. Standort und Kameradaten werden beim Hochladen entfernt.</p>
      {datei && <Zuschnitt datei={datei} startFormat={formatFuer(werte.art)} onAenderung={(z) => { zuschnitt.current = z; }} />}
      {varianten.length > 0 && (
        <label className="block">
          <span className="beschriftung">Variante (optional)</span>
          <select className="eingabe" value={werte.variante_id} onChange={(e) => setWerte((w) => ({ ...w, variante_id: e.target.value }))}>
            <option value="">– keine bestimmte –</option>
            {varianten.map((v) => <option key={v.id} value={v.id}>{v.bezeichnung}{v.region ? ` (${v.region})` : ''}</option>)}
          </select>
        </label>
      )}
      {fassung && <p className="text-xs text-leise" data-testid="foto-fassung-hinweis">{fassungWort} <strong className="text-text">{fassung}</strong> wird von deinem Exemplar übernommen – sie muss nicht in die Bezeichnung.</p>}
      <label className="block">
        <span className="beschriftung">Bezeichnung (optional)</span>
        <input className="eingabe" value={werte.titel} onChange={(e) => setWerte((w) => ({ ...w, titel: e.target.value }))}
          placeholder={werte.art === 'foto_beilagen' ? 'z. B. Club-Nintendo-Katalog 1998, Poster – je Beilage ein eigenes Foto' : fassung ? 'z. B. Rückseite mit USK-Logo' : 'z. B. PAL-Version, Players Choice, Platinum'} maxLength={200} />
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
          {fortschritt === null ? 'Hochladen' : freistellen ? 'Hintergrund wird entfernt …' : fortschritt < 1 ? `Lädt hoch … ${Math.round(fortschritt * 100)} %` : 'Wird verarbeitet …'}
        </button>
      </div>
    </form>
  );
}
