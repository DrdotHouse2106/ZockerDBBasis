import { useEffect, useState } from 'react';
import {
  ARTIKELTYPEN, ZUSTAENDE, VOLLSTAENDIGKEITEN, REGIONEN, HERKUNFT, SPIELSTATUS, beschriftung,
} from '../../../shared/konstanten.js';
import { api } from '../api.js';
import { euro, anzahl, datumDe, euroMitVorzeichen } from '../format.js';
import Layout from '../komponenten/Layout.jsx';

export default function Statistik({ route }) {
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    api.statistik().then(setDaten).catch((e) => setFehler(e.message));
  }, []);

  return (
    <Layout route={route} titel="Statistik" zurueck="/einstellungen">
      {fehler && <p className="text-gefahr" role="alert">{fehler}</p>}
      {!daten && !fehler && <p className="text-leise">Wird geladen …</p>}
      {daten && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kachel titel="Einträge" wert={anzahl(daten.gesamt.eintraege)} />
            <Kachel titel="Stück gesamt" wert={anzahl(daten.gesamt.stueck)} />
            <Kachel titel="Kaufwert" wert={euro(daten.gesamt.kaufwert)} breit />
          </div>
          {daten.ohnePreis?.eintraege > 0 && (
            <p className="karte flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>
                <strong>{anzahl(daten.ohnePreis.stueck)} Stück ohne Kaufpreis</strong> – zählen nicht zum Kaufwert (z. B. lange her,
                geschenkt oder aus einem Konvolut ohne Gesamtpreis).
              </span>
              <a href="#/konvolute" className="underline">Konvolute{daten.konvolute?.anzahl ? ` (${anzahl(daten.konvolute.anzahl)})` : ''}</a>
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {ARTIKELTYPEN.map((t) => (
              <Kachel key={t.value} titel={t.mehrzahl} wert={anzahl(daten.nachTyp.find((z) => z.wert === t.value)?.stueck ?? 0)} klein />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Balkenliste titel="Nach Plattform" zeilen={daten.nachPlattform} beschrifte={(w) => w ?? 'Ohne Plattform'} />
            <Balkenliste titel="Nach Region" zeilen={daten.nachRegion} beschrifte={(w) => (w ? beschriftung(REGIONEN, w) : 'Keine Angabe')} />
            <Balkenliste titel="Nach Zustand" zeilen={daten.nachZustand} beschrifte={(w) => (w ? beschriftung(ZUSTAENDE, w) : 'Keine Angabe')} />
            <Balkenliste titel="Nach Vollständigkeit" zeilen={daten.nachVollstaendigkeit} beschrifte={(w) => (w ? beschriftung(VOLLSTAENDIGKEITEN, w) : 'Keine Angabe')} />
            {daten.nachHerkunft?.some((z) => z.wert) && (
              <Balkenliste titel="Nach Herkunft" zeilen={daten.nachHerkunft} beschrifte={(w) => (w ? beschriftung(HERKUNFT, w) : 'Keine Angabe')} />
            )}
          </div>

          {daten.spielstatus?.some((z) => z.wert !== 'ohne') && (
            <section className="karte space-y-2 p-4">
              <h2 className="font-semibold">Spielstatus</h2>
              {(() => {
                const n = (w) => daten.spielstatus.find((z) => z.wert === w)?.anzahl ?? 0;
                return (
                  <>
                    <p className="text-sm"><a href="#/?spielstatus=nicht_gespielt" className="underline"><strong>Pile of Shame: {anzahl(n('nicht_gespielt'))}</strong> Spiele noch nicht gespielt</a></p>
                    <div className="flex flex-wrap gap-2">
                      {SPIELSTATUS.map((s) => (
                        <a key={s.value} href={`#/?spielstatus=${s.value}`} className="chip">{s.icon} {s.label}: {anzahl(n(s.value))}</a>
                      ))}
                      {n('ohne') > 0 && <span className="chip opacity-70">ohne Angabe: {anzahl(n('ohne'))}</span>}
                    </div>
                  </>
                );
              })()}
            </section>
          )}

          {daten.digital?.eintraege > 0 && (
            <p className="karte flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>
                <strong>{anzahl(daten.digital.eintraege)} digitale Spiele</strong>
                {daten.digital.minuten > 0 && ` · ${anzahl(Math.round(daten.digital.minuten / 60))} Stunden gespielt`} – nicht in den Zahlen oben enthalten.
              </span>
              <a href="#/?bestand=digital" className="underline">Ansehen</a>
            </p>
          )}

          {(daten.verkauf?.stueck > 0 || daten.verkauf?.abgegeben > 0) && (
            <section className="karte space-y-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">Verkäufe</h2>
                <a href="#/?bestand=weg" className="text-sm text-akzent-hell hover:underline">Verkauft & abgegeben ansehen →</a>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kachel titel="Verkauft" wert={`${anzahl(daten.verkauf.stueck)} Stück`} klein />
                <Kachel titel="Erlös" wert={euro(daten.verkauf.erloes)} klein />
                <Kachel titel="Gewinn/Verlust" wert={euroMitVorzeichen(daten.verkauf.gewinn)} klein />
                <Kachel titel="Verschenkt/getauscht" wert={`${anzahl(daten.verkauf.abgegeben)} Stück`} klein />
              </div>
              <p className="text-xs text-leise">
                Gewinn/Verlust = Verkaufspreis minus Kaufpreis (bei Konvoluten der anteilige Preis); nur Stücke, bei denen beides bekannt ist.
                {daten.verkauf.ohne_kaufpreis > 0 && ` ${anzahl(daten.verkauf.ohne_kaufpreis)} verkaufte Stück ohne Kaufpreis zählen nur zum Erlös.`}
              </p>
              {daten.verkauf.jahre.length > 1 && (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-leise"><th className="py-1 font-normal">Jahr</th><th className="font-normal">Stück</th><th className="font-normal">Erlös</th><th className="font-normal">Gewinn/Verlust</th></tr></thead>
                  <tbody>
                    {daten.verkauf.jahre.map((j) => (
                      <tr key={j.jahr ?? '–'} className="border-t border-rand"><td className="py-1">{j.jahr ?? '–'}</td><td>{anzahl(j.stueck)}</td><td>{euro(j.erloes)}</td><td>{euroMitVorzeichen(j.gewinn)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {daten.zuletzt.length > 0 && (
            <section className="karte p-4">
              <h2 className="mb-2 font-semibold">Zuletzt hinzugefügt</h2>
              <ul className="divide-y divide-rand text-sm">
                {daten.zuletzt.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2 py-2">
                    <a href={`#/artikel/${a.id}`} className="truncate hover:underline">{a.titel}</a>
                    <span className="shrink-0 text-leise">{datumDe(a.erstellt_am)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Layout>
  );
}

function Kachel({ titel, wert, klein, breit }) {
  return (
    <div className={`karte p-4 ${breit ? 'col-span-2 md:col-span-1' : ''}`}>
      <p className="text-xs font-semibold tracking-wide text-leise uppercase">{titel}</p>
      <p className={`mt-1 font-bold tabular-nums ${klein ? 'text-xl' : 'text-2xl'}`}>{wert}</p>
    </div>
  );
}

/** Horizontale Balken (eine Datenreihe, eine Farbe) mit direkt beschrifteten Werten. */
function Balkenliste({ titel, zeilen, beschrifte }) {
  const maximum = Math.max(1, ...zeilen.map((z) => z.stueck));
  return (
    <section className="karte p-4">
      <h2 className="mb-3 font-semibold">{titel}</h2>
      {zeilen.length === 0 ? (
        <p className="text-sm text-leise">Noch keine Daten.</p>
      ) : (
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-2/5" />
            <col />
            <col className="hidden w-24 sm:table-column" />
          </colgroup>
          <caption className="sr-only">{titel}: Anzahl Stück und Kaufwert</caption>
          <thead className="sr-only">
            <tr><th>Kategorie</th><th>Stück</th><th>Kaufwert</th></tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.wert ?? 'leer'} title={`${beschrifte(z.wert)}: ${anzahl(z.stueck)} Stück · ${euro(z.kaufwert)}`}>
                <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                  <span className="line-clamp-1">{beschrifte(z.wert)}</span>
                </th>
                <td className="py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-3 flex-1">
                      <div className="h-full rounded-r bg-akzent" style={{ width: `${Math.max(2, (z.stueck / maximum) * 100)}%` }} />
                    </div>
                    <span className="w-8 text-right font-semibold tabular-nums">{anzahl(z.stueck)}</span>
                  </div>
                </td>
                <td className="hidden py-1.5 pl-3 text-right text-leise tabular-nums sm:table-cell">{euro(z.kaufwert)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
