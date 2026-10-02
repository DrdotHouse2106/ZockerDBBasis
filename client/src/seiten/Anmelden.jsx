import { useEffect, useState } from 'react';
import { MARKE } from '../../../shared/marke.js';
import { api, ApiFehler } from '../api.js';
import { useSitzung } from '../sitzung.js';
import Symbol from '../komponenten/Symbole.jsx';
import Fusszeile from '../komponenten/Fusszeile.jsx';
import { captchaNachweis, CaptchaHinweis } from '../captcha.jsx';
import { MODUL } from '../erweiterungen.jsx';

export default function Anmelden() {
  const { auth, aktualisiere } = useSitzung();
  const [modus, setModus] = useState(auth?.ersteinrichtung || (auth?.registrierungOffen && window.location.hash.includes('registrieren=1')) ? 'registrieren' : 'anmelden');
  const [werte, setWerte] = useState({ benutzername: '', passwort: '', passwort2: '', anzeigename: '', email: '', einrichtungscode: '' });
  const [akzeptiert, setAkzeptiert] = useState(false);
  const [captchaZustimmung, setCaptchaZustimmung] = useState(false);
  const [zweiFaktor, setZweiFaktor] = useState(null); // { token }
  const [code, setCode] = useState('');
  const [mitWiederherstellung, setMitWiederherstellung] = useState(false);
  const [fehler, setFehler] = useState(null);
  const [felder, setFelder] = useState({});
  const [laedt, setLaedt] = useState(false);

  const setze = (feld) => (e) => setWerte((w) => ({ ...w, [feld]: e.target.value }));

  // Einladungslink (#/?einladung=…): Registrieren auch bei geschlossener Registrierung
  const [einladung] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('einladung'));
  const [einladungGueltig, setEinladungGueltig] = useState(null);
  // Persönlicher Empfehlungslink (#/?werber=…) – wird bis zur Registrierung in diesem Tab gemerkt
  const [werber] = useState(() => {
    const code = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('werber');
    try {
      if (code) sessionStorage.setItem('zockerdb-werber', code);
      return code || sessionStorage.getItem('zockerdb-werber');
    } catch { return code; }
  });
  useEffect(() => { if (werber && auth?.registrierungOffen) setModus('registrieren'); }, [werber, auth?.registrierungOffen]);
  useEffect(() => {
    if (!einladung) return;
    api.einladungPruefen(einladung).then((r) => {
      setEinladungGueltig(r.gueltig);
      if (r.gueltig) setModus('registrieren');
    }).catch(() => setEinladungGueltig(false));
  }, [einladung]);

  async function absenden(e) {
    e.preventDefault();
    setFehler(null);
    setFelder({});
    if (modus === 'registrieren' && werte.passwort !== werte.passwort2) {
      setFelder({ passwort2: 'Die Passwörter stimmen nicht überein.' });
      return;
    }
    setLaedt(true);
    try {
      if (zweiFaktor) {
        await api.zweiterFaktor(mitWiederherstellung
          ? { token: zweiFaktor.token, wiederherstellungscode: code }
          : { token: zweiFaktor.token, code });
        await aktualisiere();
      } else if (modus === 'registrieren') {
        const mitEinladung = einladung && einladungGueltig;
        const captcha = auth?.ersteinrichtung || mitEinladung ? undefined : await captchaNachweis(auth?.captcha, 'registrieren', { zustimmung: captchaZustimmung });
        await api.registrieren({
          captcha, einladung: mitEinladung ? einladung : undefined, werber: !mitEinladung && werber ? werber : undefined,
          benutzername: werte.benutzername, passwort: werte.passwort, anzeigename: werte.anzeigename, email: werte.email, bedingungen_akzeptiert: akzeptiert,
          einrichtungscode: auth?.einrichtungscode ? werte.einrichtungscode : undefined,
        });
        await aktualisiere();
      } else {
        const antwort = await api.anmelden({ benutzername: werte.benutzername, passwort: werte.passwort });
        if (antwort.zweiFaktor) {
          setZweiFaktor({ token: antwort.token });
          setWerte((w) => ({ ...w, passwort: '' }));
        } else await aktualisiere();
      }
    } catch (err) {
      if (err instanceof ApiFehler && err.code === 'abgelaufen') {
        setZweiFaktor(null);
        setCode('');
      }
      setFehler(err.message);
      if (err.felder) setFelder(err.felder);
    } finally {
      setLaedt(false);
    }
  }

  const registrierungMoeglich = auth?.registrierungOffen || einladungGueltig;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/icons/icon.svg" alt="" className="size-16" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{MARKE.name}</h1>
            <p className="font-medium text-akzent-hell">{MARKE.untertitel}</p>
          </div>
          {MODUL.oeffentlicheSeiten && <p className="text-sm text-leise">Spiele, Konsolen und Zubehör verwalten – mit Barcode-Scanner und Wertübersicht.</p>}
        </div>

        {einladung && einladungGueltig && (
          <p className="rounded-xl border border-akzent/40 bg-akzent/10 p-3 text-sm">
            <strong>Du wurdest eingeladen!</strong> Wähle einen Benutzernamen und ein Passwort für dein Konto.
          </p>
        )}
        {einladung && einladungGueltig === false && (
          <p className="rounded-xl border border-gefahr/40 p-3 text-sm text-gefahr" role="alert">
            Dieser Einladungslink ist ungültig, abgelaufen oder wurde schon benutzt. Bitte um einen neuen Link.
          </p>
        )}
        {auth?.ersteinrichtung && (
          <p className="rounded-xl border border-akzent/40 bg-akzent/10 p-3 text-sm">
            <strong>Willkommen!</strong> Es gibt noch kein Konto. Das erste Konto wird automatisch Administrator.
            {auth.einrichtungscode && ' Weil du über das Internet bzw. einen Reverse-Proxy zugreifst, brauchst du dafür den Einrichtungscode aus dem Server-Protokoll – so kann sich kein Fremder zuerst anmelden.'}
          </p>
        )}

        <form onSubmit={absenden} className="karte space-y-4 p-5" noValidate>
          {zweiFaktor ? (
            <>
              <div className="flex items-center gap-2">
                <Symbol name="schild" className="size-6 text-akzent-hell" />
                <h2 className="text-lg font-semibold">Zwei-Faktor-Anmeldung</h2>
              </div>
              <p className="text-sm text-leise">
                {mitWiederherstellung
                  ? 'Gib einen deiner Wiederherstellungscodes ein. Jeder Code funktioniert nur einmal.'
                  : 'Gib den 6-stelligen Code aus deiner Authenticator-App ein.'}
              </p>
              <label className="block">
                <span className="beschriftung">{mitWiederherstellung ? 'Wiederherstellungscode' : 'Code'}</span>
                <input
                  className="eingabe text-center font-mono text-xl tracking-[0.3em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode={mitWiederherstellung ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  maxLength={mitWiederherstellung ? 12 : 6}
                  placeholder={mitWiederherstellung ? 'XXXX-XXXX' : '123456'}
                  autoFocus
                />
              </label>
              <button type="button" className="text-sm text-akzent-hell underline" onClick={() => { setMitWiederherstellung((m) => !m); setCode(''); }}>
                {mitWiederherstellung ? 'Doch Code aus der App verwenden' : 'Kein Zugriff auf die App? Wiederherstellungscode verwenden'}
              </button>
            </>
          ) : (
            <>
              {registrierungMoeglich && !auth?.ersteinrichtung && (
                <div className="grid grid-cols-2 gap-2" role="tablist">
                  {[['anmelden', 'Anmelden'], ['registrieren', 'Registrieren']].map(([wert, label]) => (
                    <button key={wert} type="button" role="tab" aria-selected={modus === wert}
                      className={`${modus === wert ? 'chip-aktiv' : 'chip'} justify-center rounded-xl py-2`}
                      onClick={() => { setModus(wert); setFehler(null); setFelder({}); }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <Feld label="Benutzername" fehler={felder.benutzername}>
                <input className="eingabe" value={werte.benutzername} onChange={setze('benutzername')} autoComplete="username" autoCapitalize="none" required autoFocus />
              </Feld>
              {modus === 'registrieren' && auth?.ersteinrichtung && auth?.einrichtungscode && (
                <Feld label="Einrichtungscode (steht im Server-Protokoll)" fehler={felder.einrichtungscode}>
                  <input className="eingabe font-mono" value={werte.einrichtungscode} onChange={setze('einrichtungscode')} autoComplete="off" autoCapitalize="characters"
                    placeholder="XXXX-XXXX-XXXX-XXXX" required />
                  <span className="mt-1 block text-xs text-leise">Anzeigen z. B. mit <code>docker compose logs zockerdb</code> – Zeile „Ersteinrichtung …“.</span>
                </Feld>
              )}
              {modus === 'registrieren' && (
                <Feld label="Anzeigename (optional)" fehler={felder.anzeigename}>
                  <input className="eingabe" value={werte.anzeigename} onChange={setze('anzeigename')} autoComplete="nickname" maxLength={60} />
                </Feld>
              )}
              {modus === 'registrieren' && auth?.emailAktiv && (
                <Feld label={auth.emailPflicht ? 'E-Mail-Adresse' : 'E-Mail-Adresse (optional, für „Passwort vergessen“)'} fehler={felder.email}>
                  <input type="email" className="eingabe" value={werte.email} onChange={setze('email')} autoComplete="email" inputMode="email" maxLength={254} required={auth.emailPflicht} />
                </Feld>
              )}
              <Feld label="Passwort" fehler={felder.passwort}>
                <input type="password" className="eingabe" value={werte.passwort} onChange={setze('passwort')}
                  autoComplete={modus === 'registrieren' ? 'new-password' : 'current-password'} required />
              </Feld>
              {modus === 'registrieren' && (
                <>
                  <Feld label="Passwort wiederholen" fehler={felder.passwort2}>
                    <input type="password" className="eingabe" value={werte.passwort2} onChange={setze('passwort2')} autoComplete="new-password" required />
                  </Feld>
                  <p className="text-xs text-leise">Mindestens 10 Zeichen. Nach der Registrierung kannst du unter „Konto“ die Zwei-Faktor-Anmeldung aktivieren.</p>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1 size-4 accent-akzent" checked={akzeptiert} onChange={(e) => setAkzeptiert(e.target.checked)} />
                    <span>
                      Ich akzeptiere die <a href="#/seite/nutzungsbedingungen" className="text-akzent-hell underline" target="_blank">Nutzungsbedingungen</a> und
                      habe die <a href="#/seite/datenschutz" className="text-akzent-hell underline" target="_blank">Datenschutzerklärung</a> gelesen.
                    </span>
                  </label>
                  {felder.bedingungen && <p className="text-sm text-gefahr">{felder.bedingungen}</p>}
                  {!auth?.ersteinrichtung && !einladungGueltig && <CaptchaHinweis info={auth?.captcha} zustimmung={captchaZustimmung} setZustimmung={setCaptchaZustimmung} />}
                </>
              )}
            </>
          )}

          {fehler && <p className="rounded-xl bg-gefahr/10 p-3 text-sm text-gefahr" role="alert">{fehler}</p>}

          <button type="submit" className="knopf-primaer w-full" disabled={laedt}>
            {laedt ? 'Bitte warten …' : zweiFaktor ? 'Bestätigen' : modus === 'registrieren' ? 'Konto erstellen' : 'Anmelden'}
          </button>
          {zweiFaktor && (
            <button type="button" className="knopf-sekundaer w-full" onClick={() => { setZweiFaktor(null); setCode(''); setFehler(null); }}>
              Abbrechen
            </button>
          )}
          {!zweiFaktor && modus === 'anmelden' && auth?.emailAktiv && (
            <p className="text-center text-sm"><a href="#/passwort-vergessen" className="text-akzent-hell underline">Passwort vergessen?</a></p>
          )}
        </form>

        {!registrierungMoeglich && !zweiFaktor && (
          auth?.zugangsanfragen ? <ZugangAnfragen auth={auth} /> : (
            <p className="text-center text-xs text-leise">Die Registrierung neuer Konten ist auf diesem Server geschlossen.</p>
          )
        )}
        {MODUL.oeffentlicheSeiten && auth?.oeffentlicherKatalog && !zweiFaktor && (
          <p className="text-center text-sm"><a href="/suche" className="text-akzent-hell underline">Spiele ohne Anmeldung suchen und stöbern</a></p>
        )}
        {/* Die Basis-Version zeigt nur die Anmeldemaske; rechtliche Seiten braucht erst ein öffentliches Angebot */}
        {MODUL.oeffentlicheSeiten && <Fusszeile className="py-2" />}
      </div>
    </div>
  );
}

/** Kurz vorstellen, was es gibt – sonst weiß niemand, wofür er einen Zugang anfragt. */
const MERKMALE = [
  { bild: '📷', titel: 'Barcode-Scanner', text: 'Spiel mit der Handykamera scannen, Titel, Plattform und Cover kommen automatisch.' },
  { bild: '🧩', titel: 'Varianten & Zustand', text: 'PAL/NTSC, Editionen, mit oder ohne Anleitung – jedes Exemplar genau erfasst.' },
  { bild: '🖼️', titel: 'Fotos & Scans', text: 'Eigene Fotos, Cover und Anleitungen in voller Auflösung zu jedem Spiel.' },
  // Zusatzmodule ergänzen ihre Funktionen
  ...(MODUL.anmeldungMerkmale ?? []),
  { bild: '🎮', titel: 'Spielstatus & Leihliste', text: 'Durchgespielt, angefangen, verliehen an … – nichts geht verloren.' },
  { bild: '🏆', titel: 'Erfolge & Sammlungsziele', text: 'Komplettiere Reihen und Plattformen und sieh, was noch fehlt.' },
  { bild: '📱', titel: 'Überall dabei', text: 'Als App aufs Handy, auch offline, und deine Sammlung per Link teilen.' },
];

/** Bei geschlossener Registrierung: Interessenten bitten um einen Zugang, ein Administrator lädt sie dann ein. */
function ZugangAnfragen({ auth }) {
  const [offen, setOffen] = useState(() => /[?&]zugang=1/.test(window.location.hash));
  const [werte, setWerte] = useState({ name: '', email: '', nachricht: '', webseite: '' });
  const [einwilligung, setEinwilligung] = useState(false);
  const [captchaZustimmung, setCaptchaZustimmung] = useState(false);
  const [felder, setFelder] = useState({});
  const [fehler, setFehler] = useState(null);
  const [laedt, setLaedt] = useState(false);
  const [fertig, setFertig] = useState(false);
  const setze = (feld) => (e) => setWerte((w) => ({ ...w, [feld]: e.target.value }));

  async function absenden(e) {
    e.preventDefault();
    setFehler(null);
    setFelder({});
    setLaedt(true);
    try {
      const captcha = await captchaNachweis(auth?.captcha, 'zugang', { zustimmung: captchaZustimmung });
      await api.zugangAnfragen({ ...werte, einwilligung, captcha });
      setFertig(true);
    } catch (f) {
      if (f instanceof ApiFehler && Object.keys(f.felder).length) setFelder(f.felder);
      else setFehler(f.message);
    } finally {
      setLaedt(false);
    }
  }

  if (fertig) {
    return (
      <p className="karte p-4 text-sm" role="status">
        <strong>Danke für dein Interesse!</strong> Deine Anfrage ist angekommen. Wenn ein Platz frei ist, bekommst du eine Einladung
        an {werte.email} – damit legst du dir dann dein Konto an.
      </p>
    );
  }
  if (!offen) {
    return (
      <section className="karte space-y-3 p-5" aria-labelledby="erwartet-titel">
        <h2 id="erwartet-titel" className="text-lg font-semibold">Was dich erwartet</h2>
        <ul className="space-y-2 text-sm">
          {MERKMALE.filter((m) => !m.nur || m.nur(auth)).map((m) => (
            <li key={m.titel} className="flex gap-2">
              <span aria-hidden="true">{m.bild}</span>
              <span><strong>{m.titel}</strong> <span className="text-leise">– {m.text}</span></span>
            </li>
          ))}
        </ul>
        {/* Zusatzmodul: ehrlicher Hinweis zu Kosten und Plänen (z. B. im nicht-kommerziellen Betrieb) */}
        {MODUL.anmeldungHinweis?.(auth) && <p className="text-sm text-leise">{MODUL.anmeldungHinweis(auth)}</p>}
        <p className="text-xs text-leise">
          Neue Konten gibt es gerade nur auf Einladung. Frag einfach an – du bekommst dann einen Link per E-Mail und legst dir dein Konto selbst an.
        </p>
        <button type="button" className="knopf-primaer w-full" onClick={() => setOffen(true)}>Zugang anfragen</button>
      </section>
    );
  }
  return (
    <form onSubmit={absenden} className="karte space-y-3 p-5" noValidate aria-labelledby="zugang-titel">
      <h2 id="zugang-titel" className="text-lg font-semibold">Zugang anfragen</h2>
      <p className="text-sm text-leise">
        Die Registrierung ist gerade geschlossen. Hinterlass deine E-Mail-Adresse – sobald es passt, schicken wir dir eine Einladung.
      </p>
      <Feld label="Name (optional)">
        <input className="eingabe" value={werte.name} onChange={setze('name')} maxLength={80} autoComplete="name" />
      </Feld>
      <Feld label="E-Mail-Adresse" fehler={felder.email}>
        <input className="eingabe" type="email" value={werte.email} onChange={setze('email')} maxLength={254} autoComplete="email" required />
      </Feld>
      <Feld label="Nachricht (optional)">
        <textarea className="eingabe min-h-20" value={werte.nachricht} onChange={setze('nachricht')} maxLength={1000}
          placeholder="Was sammelst du? Wie bist du auf uns gekommen?" />
      </Feld>
      {/* Für Menschen unsichtbar – Bots füllen es aus */}
      <input type="text" name="webseite" value={werte.webseite} onChange={setze('webseite')} tabIndex={-1} autoComplete="off"
        aria-hidden="true" className="absolute -left-[9999px] size-px opacity-0" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-akzent" checked={einwilligung} onChange={(e) => setEinwilligung(e.target.checked)} />
        <span>
          Meine Angaben dürfen gespeichert werden, um die Anfrage zu bearbeiten. Sie werden spätestens nach 90 Tagen gelöscht.
          {MODUL.oeffentlicheSeiten && <> Mehr in der <a href="#/seite/datenschutz" className="text-akzent-hell underline" target="_blank">Datenschutzerklärung</a>.</>}
        </span>
      </label>
      {felder.einwilligung && <p className="text-sm text-gefahr">{felder.einwilligung}</p>}
      <CaptchaHinweis info={auth?.captcha} zustimmung={captchaZustimmung} setZustimmung={setCaptchaZustimmung} />
      {fehler && <p className="rounded-xl bg-gefahr/10 p-3 text-sm text-gefahr" role="alert">{fehler}</p>}
      <button type="submit" className="knopf-primaer w-full" disabled={laedt}>{laedt ? 'Bitte warten …' : 'Anfrage senden'}</button>
    </form>
  );
}

function Feld({ label, fehler, children }) {
  return (
    <label className="block">
      <span className="beschriftung">{label}</span>
      {children}
      {fehler && <span className="mt-1 block text-sm text-gefahr">{fehler}</span>}
    </label>
  );
}
