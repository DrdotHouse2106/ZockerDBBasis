// „Freistellungen prüfen“: alle freigestellten Fotos, die auf eine Entscheidung warten, auf einer Seite – Original und
// freigestellte Version nebeneinander, direkt übernehmen oder beim Original bleiben. Eigene Fotos; Moderatoren sehen
// zusätzlich die geteilten Fotos anderer. Unter „Übernommen“ lassen sich übernommene Freistellungen wieder zurücknehmen –
// einzeln oder mehrere auf einmal (z. B. alle Figuren, die mit Hintergrund besser aussehen).
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { anzahl } from '../format.js';
import Layout from '../komponenten/Layout.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import { useSitzung } from '../sitzung.js';
import { istModerator, ARTIKELTYPEN } from '../../../shared/konstanten.js';
import { fotoKurz } from '../komponenten/Fotos.jsx';

// Schachbrett hinter der freigestellten Version – so sieht man, was transparent geworden ist
const SCHACHBRETT = {
  backgroundImage: 'conic-gradient(rgb(128 128 128 / .25) 25%, transparent 0 50%, rgb(128 128 128 / .25) 0 75%, transparent 0)',
  backgroundSize: '16px 16px',
};

export default function FreistellenPruefen({ route }) {
  const zeigeHinweis = useHinweis();
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [beschaeftigt, setBeschaeftigt] = useState(new Set());
  const [alleLaufen, setAlleLaufen] = useState(false);
  const { benutzer } = useSitzung();
  const moderator = istModerator(benutzer);
  // Moderation: auch geteilte Fotos anderer zeigen (sonst nur eigene, ohne Fotografen und seit 30 Tagen ungeprüfte)
  const [fremde, setFremde] = useState(false);
  // „Übernommen“: schon übernommene Freistellungen zurücknehmen (Original wiederherstellen), mit Auswahl
  const [uebernommen, setUebernommen] = useState(route?.parameter?.ansicht === 'uebernommen');
  const [auswahl, setAuswahl] = useState(new Set());
  const [typ, setTyp] = useState('');

  const laden = () => api.freistellenPruefen(fremde, uebernommen).then((d) => { setDaten(d); setFehler(null); }).catch((e) => setFehler(e.message));
  useEffect(() => { setDaten(null); setAuswahl(new Set()); laden(); }, [fremde, uebernommen]);
  const sichtbar = (daten?.fotos ?? []).filter((f) => !typ || f.katalog_typ === typ);
  const typen = ARTIKELTYPEN.filter((t) => (daten?.fotos ?? []).some((f) => f.katalog_typ === t.value));
  const umschalten = (id) => setAuswahl((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function entscheide(foto, annehmen, { leise = false } = {}) {
    setBeschaeftigt((s) => new Set(s).add(foto.id));
    try {
      await api.freistellenEntscheiden(foto.id, annehmen);
      setDaten((d) => ({ gesamt: Math.max(0, d.gesamt - 1), fotos: d.fotos.filter((f) => f.id !== foto.id) }));
      setAuswahl((a) => { const n = new Set(a); n.delete(foto.id); return n; });
      if (!leise) zeigeHinweis(annehmen ? 'Übernommen – die freigestellte Version wird gezeigt.' : uebernommen ? 'Original wiederhergestellt.' : 'Es bleibt beim Original.');
      return true;
    } catch (e) {
      zeigeHinweis(`${foto.katalog_titel}: ${e.message}`, 'fehler');
      return false;
    } finally {
      setBeschaeftigt((s) => { const n = new Set(s); n.delete(foto.id); return n; });
    }
  }

  async function alleUebernehmen() {
    const liste = daten.fotos;
    if (!window.confirm(`Alle ${liste.length} angezeigten Freistellungen übernehmen?`)) return;
    setAlleLaufen(true);
    let ok = 0;
    for (const f of liste) if (await entscheide(f, true, { leise: true })) ok++;
    setAlleLaufen(false);
    zeigeHinweis(`${anzahl(ok)} Freistellungen übernommen.`);
  }

  async function auswahlZuruecknehmen() {
    const liste = (daten?.fotos ?? []).filter((f) => auswahl.has(f.id));
    if (!liste.length || !window.confirm(`Bei ${liste.length} ${liste.length === 1 ? 'Foto' : 'Fotos'} wieder das Original mit Hintergrund zeigen? Die freigestellte Version wird gelöscht.`)) return;
    setAlleLaufen(true);
    let ok = 0;
    for (const f of liste) if (await entscheide(f, false, { leise: true })) ok++;
    setAlleLaufen(false);
    zeigeHinweis(`${anzahl(ok)} ${ok === 1 ? 'Original' : 'Originale'} wiederhergestellt.`);
  }

  // Seite leer gearbeitet, aber es warten noch weitere: nachladen
  useEffect(() => {
    if (daten && !daten.fotos.length && daten.gesamt > 0 && !alleLaufen) laden();
  }, [daten, alleLaufen]);

  return (
    <Layout route={route} titel="Freistellungen prüfen" zurueck="/konto">
      <div className="mx-auto max-w-5xl space-y-3 pb-8" data-tour="freistellen-pruefen">
        <div className="flex gap-2" role="tablist" aria-label="Ansicht">
          {[[false, 'Zu prüfen'], [true, 'Übernommen']].map(([wert, text]) => (
            <button key={text} type="button" role="tab" aria-selected={uebernommen === wert} data-tour={wert ? 'freistellen-uebernommen' : undefined}
              className={`rounded-full px-3 py-1 text-sm ${uebernommen === wert ? 'bg-akzent text-akzent-text' : 'karte'}`} onClick={() => setUebernommen(wert)}>{text}</button>
          ))}
        </div>
        {moderator && (
          <label className="karte flex items-start gap-2 p-3 text-sm">
            <input type="checkbox" className="mt-1 size-4 accent-akzent" checked={fremde} onChange={(e) => setFremde(e.target.checked)} data-testid="freistellen-fremde" />
            <span>
              Auch Fotos anderer Sammler zeigen
              <span className="block text-xs text-leise">{uebernommen
                ? 'Sonst siehst du neben deinen eigenen nur Fotos ohne Fotografen (Konto gelöscht).'
                : 'Sonst siehst du neben deinen eigenen nur Fotos ohne Fotografen (Konto gelöscht) und solche, die seit 30 Tagen niemand geprüft hat – eigentlich entscheidet der Fotograf selbst.'}</span>
            </span>
          </label>
        )}
        {fehler && <p className="karte p-4 text-gefahr">{fehler}</p>}
        {!daten && !fehler && <p className="text-leise">Wird geladen …</p>}
        {daten && daten.gesamt === 0 && uebernommen && (
          <p className="karte p-6 text-center text-leise" data-testid="freistellen-uebernommen-leer">Keine übernommenen Freistellungen – überall wird das Original gezeigt.</p>
        )}
        {daten && uebernommen && daten.fotos.length > 0 && (
          <>
            <div className="karte space-y-2 p-3 text-sm">
              <p><strong>{anzahl(daten.gesamt)}</strong> {daten.gesamt === 1 ? 'Foto zeigt' : 'Fotos zeigen'} die freigestellte Version.
                <span className="text-leise"> Wähle die aus, bei denen wieder das Original mit Hintergrund erscheinen soll.</span></p>
              {typen.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {[{ value: '', label: 'Alle', icon: '' }, ...typen].map((t) => (
                    <button key={t.value} type="button" onClick={() => setTyp(t.value)}
                      className={`rounded-full px-2.5 py-0.5 text-xs ${typ === t.value ? 'bg-akzent text-akzent-text' : 'border border-rand'}`}>{t.icon ? `${t.icon} ` : ''}{t.mehrzahl ?? t.label}</button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="knopf-sekundaer px-3 py-1" onClick={() => setAuswahl(new Set(sichtbar.map((f) => f.id)))}>Alle {anzahl(sichtbar.length)} auswählen</button>
                {auswahl.size > 0 && <button type="button" className="text-xs text-leise underline" onClick={() => setAuswahl(new Set())}>Auswahl aufheben</button>}
                <span className="flex-1" />
                <button type="button" className="knopf-primaer px-3 py-1" disabled={!auswahl.size || alleLaufen} onClick={auswahlZuruecknehmen} data-testid="freistellen-zuruecknehmen">
                  {alleLaufen ? 'Wird wiederhergestellt …' : `Original wiederherstellen (${anzahl(auswahl.size)})`}
                </button>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {sichtbar.map((f) => (
                <li key={f.id} className={`karte space-y-1 p-2 ${auswahl.has(f.id) ? 'border-akzent' : ''}`} data-testid="freistellen-uebernommen-foto">
                  <label className="flex cursor-pointer items-start gap-1.5 text-xs">
                    <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-akzent" checked={auswahl.has(f.id)} onChange={() => umschalten(f.id)}
                      aria-label={`${f.katalog_titel} auswählen`} />
                    <span className="min-w-0"><span className="block truncate font-semibold">{f.katalog_titel}</span>
                      <span className="block truncate text-leise">{[fotoKurz(f.art), f.farbe ?? f.variante, f.titel].filter(Boolean).join(' · ')}</span></span>
                  </label>
                  <div className="grid grid-cols-2 gap-1" data-galerie>
                    <a href={f.frei_url} target="_blank" rel="noreferrer" aria-label="Freigestellt groß ansehen">
                      <img src={f.frei_url} alt="Freigestellt (wird gezeigt)" loading="lazy" className="aspect-square w-full rounded object-contain" style={SCHACHBRETT} />
                    </a>
                    <a href={f.url} target="_blank" rel="noreferrer" aria-label="Original groß ansehen">
                      <img src={f.url} alt="Original" loading="lazy" className="aspect-square w-full rounded bg-karte-hover object-contain" />
                    </a>
                  </div>
                  <p className="flex justify-between text-[10px] text-leise"><span>gezeigt</span><span>Original</span></p>
                </li>
              ))}
            </ul>
            {daten.gesamt > daten.fotos.length && <p className="text-center text-xs text-leise">Angezeigt werden die ersten {anzahl(daten.fotos.length)} – weitere erscheinen, sobald diese erledigt sind.</p>}
          </>
        )}
        {daten && daten.gesamt === 0 && !uebernommen && (
          <section className="karte space-y-2 p-8 text-center" data-testid="freistellen-pruefen-fertig">
            <p className="text-4xl" aria-hidden="true">✅</p>
            <h2 className="text-lg font-semibold">Alles erledigt</h2>
            <p className="text-leise">Es gibt keine freigestellten Fotos mehr zu prüfen. Neue Ergebnisse der Helfer-Geräte erscheinen hier – du bekommst dazu eine Benachrichtigung.</p>
          </section>
        )}
        {daten && !uebernommen && daten.fotos.length > 0 && (
          <>
            <div className="karte flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <p><strong data-testid="freistellen-pruefen-anzahl">{anzahl(daten.gesamt)}</strong> {daten.gesamt === 1 ? 'Foto wartet' : 'Fotos warten'} auf deine Entscheidung.
                <span className="text-leise"> Links das Original, rechts ohne Hintergrund.</span></p>
              {daten.fotos.length > 1 && (
                <button type="button" className="knopf-sekundaer px-3 py-1.5" disabled={alleLaufen} onClick={alleUebernehmen}>
                  {alleLaufen ? 'Wird übernommen …' : `Alle ${daten.fotos.length} übernehmen`}
                </button>
              )}
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {daten.fotos.map((f) => (
                <li key={f.id} className="karte space-y-2 p-3" data-testid="freistellen-pruefen-foto">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <a href={`#/katalog/${f.katalog_id}?foto=${f.id}`} className="font-semibold underline">{f.katalog_titel}</a>
                    <span className="text-xs text-leise">{[fotoKurz(f.art), f.farbe ?? f.variante, f.titel].filter(Boolean).join(' · ')}</span>
                    {!f.eigenes && (
                      <span className="abzeichen text-[10px]" title="Geteiltes Foto eines anderen Sammlers – du entscheidest als Moderator">
                        {f.ohne_fotograf ? 'ohne Fotograf' : f.liegt_lange ? 'anderer Sammler · seit 30 Tagen offen' : 'anderer Sammler'}
                      </span>
                    )}
                  </div>
                  {/* Antippen öffnet das Bild groß; in der Großansicht wischt man zwischen Original und freigestellter Version */}
                  <div className="grid grid-cols-2 gap-2" data-galerie>
                    <figure className="space-y-1">
                      <a href={f.url} target="_blank" rel="noreferrer" aria-label="Original groß ansehen" className="block">
                        <img src={f.url} alt="Original" loading="lazy" className="aspect-square w-full rounded-lg bg-karte-hover object-contain" />
                      </a>
                      <figcaption className="text-center text-xs text-leise">Original</figcaption>
                    </figure>
                    <figure className="space-y-1">
                      <a href={f.frei_url} target="_blank" rel="noreferrer" aria-label="Freigestellt groß ansehen" className="block">
                        <img src={f.frei_url} alt="Freigestellt" loading="lazy" className="aspect-square w-full rounded-lg object-contain" style={SCHACHBRETT} />
                      </a>
                      <figcaption className="text-center text-xs text-leise">Freigestellt · antippen für groß</figcaption>
                    </figure>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="knopf-primaer flex-1 justify-center px-2 py-1.5" disabled={beschaeftigt.has(f.id) || alleLaufen}
                      onClick={() => entscheide(f, true)}>Übernehmen</button>
                    <button type="button" className="knopf-sekundaer flex-1 justify-center px-2 py-1.5" disabled={beschaeftigt.has(f.id) || alleLaufen}
                      onClick={() => entscheide(f, false)}>Original behalten</button>
                  </div>
                </li>
              ))}
            </ul>
            {daten.gesamt > daten.fotos.length && <p className="text-center text-xs text-leise">Weitere {anzahl(daten.gesamt - daten.fotos.length)} erscheinen, sobald diese erledigt sind.</p>}
          </>
        )}
      </div>
    </Layout>
  );
}
