// Zuschaltbare Zusatzfelder am Exemplar (Profil → Konto → „Zusätzliche Felder“): Lagerort, Beilagen & Seriennummer der OVP.
import { useEffect, useId, useState } from 'react';
import { beilagenFuer, ohneAnleitungUeblich, BEILAGE_OHNE, beilageOhne, beilageVorhanden, seriennummerPasst, normalisiereLieferumfang, lieferumfangText, lieferumfangStand } from '../../../shared/konstanten.js';
import { api } from '../api.js';

/** Lagerort in drei Stufen mit Vorschlägen aus den bereits verwendeten Orten. */
export function LagerortFelder({ werte, setze, fehler = {} }) {
  const id = useId();
  const [orte, setOrte] = useState([]);
  useEffect(() => { api.lagerorte().then(setOrte).catch(() => {}); }, []);
  const eindeutig = (liste) => [...new Set(liste.filter(Boolean))];
  const gleich = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
  const regale = eindeutig(orte.filter((o) => !werte.lagerort_ort || gleich(o.ort, werte.lagerort_ort)).map((o) => o.regal));
  const faecher = eindeutig(orte.filter((o) => (!werte.lagerort_ort || gleich(o.ort, werte.lagerort_ort))
    && (!werte.lagerort_regal || gleich(o.regal, werte.lagerort_regal))).map((o) => o.fach));
  const feld = (name, label, liste, platzhalter) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input className="eingabe" value={werte[name] ?? ''} onChange={setze(name)} list={`${id}-${name}`} placeholder={platzhalter} autoComplete="off" />
      <datalist id={`${id}-${name}`}>{liste.map((w) => <option key={w} value={w} />)}</datalist>
      {fehler[name] && <span className="mt-1 block text-gefahr">{fehler[name]}</span>}
    </label>
  );
  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
      {feld('lagerort_ort', 'Ort', eindeutig(orte.map((o) => o.ort)), 'z. B. Wohnzimmer')}
      {feld('lagerort_regal', 'Regal / Schrank', regale, 'z. B. Kallax links')}
      {feld('lagerort_fach', 'Fach / Kiste', faecher, 'z. B. Fach 3')}
    </div>
  );
}


/** Beilagen-Checkliste je Artikeltyp: Tippen wechselt zwischen „keine Angabe“, „vorhanden“, „fehlt“ und „gab es nicht“. */
export function BeilagenCheckliste({ typ, plattform, wert, onChange, lieferumfang = null, anleitungOnline = false }) {
  const alle = beilagenFuer(typ, plattform);
  const aktuell = wert && typeof wert === 'object' ? wert : {};
  // Ausgabe mit bekanntem Lieferumfang: genau diese Punkte stehen sofort in der Liste (nicht eingeklappt)
  const lu = normalisiereLieferumfang(lieferumfang);
  const stand = lu ? lieferumfangStand(aktuell, lu) : null;
  // Beilagen von Sonderausgaben (Schuber, Artbook, zweite Disc …) eingeklappt – offen, sobald eine davon erfasst ist
  const sonderErfasst = alle.some((b) => b.sonder && b.value in aktuell);
  const [sonderOffen, setSonderOffen] = useState(sonderErfasst);
  const liste = alle.filter((b) => !b.sonder || sonderOffen || sonderErfasst || (lu && b.value in lu));
  const hatSonder = alle.some((b) => b.sonder);
  const setze = (schluessel, w) => {
    const neu = { ...aktuell };
    if (w === undefined) delete neu[schluessel];
    else neu[schluessel] = w;
    onChange(Object.keys(neu).length ? neu : null);
  };
  // keine Angabe → vorhanden → fehlt → gab es nicht (z. B. keine Anleitung bei vielen PS4-Spielen) → keine Angabe
  // (eine Anzahl gilt als „vorhanden“; bei der OVP gibt es kein „gab es nicht“)
  const weiter = (schluessel) => {
    const w = aktuell[schluessel];
    setze(schluessel, w === undefined ? (lu?.[schluessel] > 1 ? lu[schluessel] : true) : beilageVorhanden(w) ? false
      : w === false && schluessel !== 'ovp' ? BEILAGE_OHNE : undefined);
  };
  // Anzahl (z. B. mehrere Werbebeilagen): 1 = einfach vorhanden
  const anzahl = (schluessel, delta) => {
    const n = Math.min(99, Math.max(1, (Number.isInteger(aktuell[schluessel]) ? aktuell[schluessel] : 1) + delta));
    setze(schluessel, n === 1 ? true : n);
  };
  // Ein Tipp: alles aus dem Lieferumfang samt OVP und Anleitung ist da
  const allesDa = () => {
    const neu = { ...aktuell, ovp: true };
    if (!beilageOhne(neu.anleitung)) neu.anleitung = true;
    for (const [k, n] of Object.entries(lu)) neu[k] = n > 1 ? n : true;
    onChange(neu);
  };
  return (
    <div className="sm:col-span-2">
      <span className="mb-1 block text-sm font-medium">Beilagen</span>
      {!anleitungOnline && typ === 'spiel' && ohneAnleitungUeblich(plattform) && aktuell.anleitung === BEILAGE_OHNE && (
        <p className="mb-2 rounded-lg bg-karte-hover p-2 text-xs" data-testid="anleitung-unueblich">
          Anleitung: „gab es nicht“ – bei dieser Plattform liegt meist keine gedruckte Anleitung bei, das Spiel zählt trotzdem als komplett (CIB).
          Hast du doch eine, tippe sie an.
        </p>
      )}
      {anleitungOnline && aktuell.anleitung === BEILAGE_OHNE && (
        <p className="mb-2 rounded-lg bg-karte-hover p-2 text-xs" data-testid="anleitung-online-vorbelegt">
          Anleitung: „gab es nicht“ – laut Rückseite nur online (Handbuch online verfügbar). Du kannst es ändern.
        </p>
      )}
      {lu && (
        <div className="mb-2 space-y-1 rounded-lg bg-karte-hover p-2 text-xs" data-testid="lieferumfang-hinweis">
          <p><strong>Lieferumfang dieser Ausgabe:</strong> {lieferumfangText(lu)}</p>
          {stand.text && <p data-testid="lieferumfang-stand" className={stand.cib ? 'font-medium text-erfolg' : 'font-medium text-warnung'}>{stand.text}</p>}
          <button type="button" className="chip" onClick={allesDa} data-testid="lieferumfang-alles">✓ Alles aus dem Lieferumfang ist vorhanden</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {liste.map((b) => {
          const w = aktuell[b.value];
          const da = beilageVorhanden(w);
          // Lange Bezeichnungen (z. B. „Beilagen (Kataloge, Werbung, Sicherheitshinweise)“) bekommen eine eigene,
          // volle Zeile statt eng neben dem +/- -Zähler zu stehen – wie schon die „Sonderausgabe“-Schaltfläche unten.
          // chip-basis setzt display:inline-flex; width:100%/flex-grow darauf blieb trotz mehrerer Varianten
          // wirkungslos (die Box wuchs weiter auf Inhaltsbreite). Eine echte max-width per Inline-Style ist der
          // einzige Weg, der die Box zuverlässig begrenzt hat – der Zähler steht bei langen Bezeichnungen darunter.
          const lang = b.label.length > 30;
          const knopf = (
            <button type="button" onClick={() => weiter(b.value)} aria-pressed={da} title={lang ? b.label : undefined}
              style={lang ? { maxWidth: 'calc(100vw - 80px)', textAlign: 'left' } : { flexShrink: 1, minWidth: 0 }}
              className={`truncate ${lang ? 'block' : ''} ${da ? 'chip-aktiv' : w === false ? 'chip border-gefahr/60 text-gefahr line-through' : beilageOhne(w) ? 'chip border-dashed text-leise' : 'chip'}`}>
              {da ? '✓ ' : w === false ? '✗ ' : beilageOhne(w) ? '– ' : ''}{Number.isInteger(w) && w > 1 ? `${w}× ` : ''}{b.label}{beilageOhne(w) ? ' (gab es nicht)' : ''}
            </button>
          );
          const zaehler = da && b.value !== 'ovp' && (
            <span className="inline-flex items-center rounded-full border border-rand text-xs">
              <button type="button" className="px-2 py-1 disabled:opacity-40" onClick={() => anzahl(b.value, -1)} disabled={!(Number.isInteger(w) && w > 1)}
                aria-label={`${b.label}: eins weniger`}>−</button>
              <button type="button" className="px-2 py-1" onClick={() => anzahl(b.value, 1)} aria-label={`${b.label}: eins mehr`}>+</button>
            </span>
          );
          return lang ? (
            <div key={b.value} className="w-full max-w-full space-y-1">
              {knopf}
              {zaehler}
            </div>
          ) : (
            <span key={b.value} className="inline-flex min-w-0 max-w-full items-center gap-1">
              {knopf}
              {zaehler}
            </span>
          );
        })}
        {hatSonder && !sonderOffen && !sonderErfasst && (
          <button type="button" className="chip border-dashed" onClick={() => setSonderOffen(true)} data-testid="beilagen-sonder">
            ＋ Sonderausgabe (Schuber, Artbook, 2. Disc …)
          </button>
        )}
      </div>
      <span className="mt-1 block text-xs text-leise">Antippen: einmal = vorhanden, zweimal = fehlt, dreimal = gab es nicht (z. B. keine Anleitung beigelegt – zählt trotzdem als komplett), viermal = keine Angabe. Mit + / − die Anzahl angeben, z. B. drei Werbebeilagen.</span>
    </div>
  );
}

/** „Passt“ / „passt nicht“ für Seriennummer von Gerät und OVP. */
export function SeriennummerAbgleich({ geraet, ovp }) {
  const passt = seriennummerPasst(geraet, ovp);
  if (passt === null) return null;
  return passt
    ? <span className="text-xs font-medium text-erfolg">✓ Seriennummer von Gerät und OVP passen zusammen</span>
    : <span className="text-xs font-medium text-warnung">⚠ Seriennummer von Gerät und OVP passen nicht zusammen</span>;
}

/** Lagerort als eine Zeile: „Wohnzimmer › Kallax › Fach 3“. */
export const lagerortText = (a) => [a?.lagerort_ort, a?.lagerort_regal, a?.lagerort_fach].filter(Boolean).join(' › ');
