import { useEffect, useState } from 'react';
import { MARKE } from '../../../shared/marke.js';
import { FUNKTIONEN, AUSBLENDBARE_FELDER, AVATAR_SYMBOLE, AVATAR_FARBEN } from '../../../shared/konstanten.js';
import Avatar, { avatarVergessen } from '../komponenten/Avatar.jsx';
import { api } from '../api.js';
import { apiUrl, FREISTELL_SYSTEME } from '../zugang.js';
import { nativesFreistellen } from '../nativ.js';
import FreistellenPruefenHinweis from '../komponenten/FreistellenPruefenHinweis.jsx';
import { useSitzung } from '../sitzung.js';
import { datumDe } from '../format.js';
import Layout from '../komponenten/Layout.jsx';
import Symbol from '../komponenten/Symbole.jsx';
import SpeicherAnzeige from '../komponenten/SpeicherAnzeige.jsx';
import { useHinweis } from '../komponenten/Hinweise.jsx';
import { Andockpunkt } from '../erweiterungen.jsx';
import { KontoZockerdb } from '../komponenten/Zockerdb.jsx';

export default function Konto({ route }) {
  const { auth, status, aktualisiere, abmelden } = useSitzung();
  const zeigeHinweis = useHinweis();
  const [konto, setKonto] = useState(null);
  const pflicht = route.parameter.pflicht === '1' && !konto?.totp_aktiv;

  const laden = () => api.konto().then(setKonto).catch((e) => zeigeHinweis(e.message, 'fehler'));
  useEffect(() => { laden(); }, []);

  async function speichereProfil(aenderung) {
    try {
      setKonto({ ...konto, ...(await api.kontoAendern(aenderung)) });
      zeigeHinweis('Gespeichert.');
      aktualisiere();
    } catch (e) {
      zeigeHinweis(e.message, 'fehler');
    }
  }

  return (
    <Layout route={route} titel="Konto & Sicherheit" zurueck={pflicht ? undefined : '/einstellungen'}>
      <div className="mx-auto max-w-2xl space-y-4 pb-8">
        {pflicht && (
          <p className="flex gap-2 rounded-xl border border-warnung/50 bg-warnung/10 p-3 text-sm" role="alert">
            <Symbol name="schild" className="size-5 shrink-0 text-warnung" />
            Auf diesem Server ist die Zwei-Faktor-Anmeldung Pflicht. Bitte richte sie ein, um die Sammlung zu nutzen.
          </p>
        )}
        {!konto ? <p className="text-leise">Wird geladen …</p> : (
          <>
            <Profil konto={konto} onSpeichern={speichereProfil} />
            {!pflicht && <AvatarAuswahl konto={konto} onSpeichern={speichereProfil} onBild={(avatar) => { setKonto((k) => ({ ...k, avatar })); avatarVergessen(konto.id); aktualisiere(); }} />}
            {!pflicht && <EmailAdresse konto={konto} onGeaendert={laden} onSpeichern={speichereProfil} />}
            {!pflicht && <Benachrichtigungen emailAn={konto.benachrichtigung_email} email={konto.email} />}
            <ZweiFaktor konto={konto} pflicht={auth?.zweiFaktorPflicht} onGeaendert={() => { laden(); aktualisiere(); }} />
            {!pflicht && (
              <>
                <Sichtbarkeit konto={konto} onSpeichern={speichereProfil} />
                {status?.fotosTeilenErlaubt && <FotosNachfragen konto={konto} onSpeichern={speichereProfil} oeffentlichMoeglich={Boolean(status?.oeffentlicheFotos)} />}
                <FreistellenPruefenHinweis zuPruefen={konto.freistellen?.zuPruefen} />
                <FreistellenHelfer konto={konto} onSpeichern={speichereProfil} />
                <ZusatzFelder konto={konto} onSpeichern={speichereProfil} />
                <KontoZockerdb konto={konto} onSpeichern={speichereProfil} />
                <Andockpunkt name="konto.einstellungen" konto={konto} onSpeichern={speichereProfil} />
                <section className="karte space-y-3 p-4">
                  <h2 className="flex items-center gap-2 font-semibold"><Symbol name="dokument" className="size-5" />Speicherplatz</h2>
                  <SpeicherAnzeige info={konto.speicher} />
                </section>
                <PasswortAendern />
                <section className="karte space-y-3 p-4">
                  <h2 className="font-semibold">Sitzungen</h2>
                  <p className="text-sm text-leise">Du bist angemeldet seit {datumDe(konto.letzte_anmeldung)}. Ein Gerät, das du nicht kennst oder verloren hast? Melde es hier ab.</p>
                  <Geraete />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="knopf-sekundaer" onClick={async () => {
                      await api.ueberallAbmelden();
                      zeigeHinweis('Alle anderen Geräte wurden abgemeldet.');
                      window.dispatchEvent(new Event('vss:geraete'));
                    }}>Andere Geräte abmelden</button>
                    <button type="button" className="knopf-sekundaer" onClick={abmelden}><Symbol name="abmelden" className="size-4" />Abmelden</button>
                  </div>
                </section>
                <SammlungLeeren />
                <KontoLoeschen geteilteFotos={konto.geteilte_fotos ?? 0} />
              </>
            )}
            {pflicht && <button type="button" className="knopf-sekundaer" onClick={abmelden}><Symbol name="abmelden" className="size-4" />Abmelden</button>}
          </>
        )}
      </div>
    </Layout>
  );
}

/** Avatar: Symbol und Farbe wählen oder ein eigenes Bild hochladen (ersetzt das Symbol). */
function AvatarAuswahl({ konto, onSpeichern, onBild }) {
  const zeigeHinweis = useHinweis();
  const [laedt, setLaedt] = useState(false);
  const avatar = konto.avatar ?? {};
  async function bildGewaehlt(e) {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei) return;
    setLaedt(true);
    try {
      onBild((await api.avatarBild(datei)).avatar);
      zeigeHinweis('Profilbild gespeichert.');
    } catch (fehler) {
      zeigeHinweis(fehler.message, 'fehler');
    } finally {
      setLaedt(false);
    }
  }
  async function bildEntfernen() {
    try {
      onBild((await api.avatarBildEntfernen()).avatar);
      zeigeHinweis('Profilbild entfernt – jetzt wird dein Symbol gezeigt.');
    } catch (fehler) { zeigeHinweis(fehler.message, 'fehler'); }
  }
  const waehle = (aenderung) => { avatarVergessen(konto.id); onSpeichern(aenderung); };
  return (
    <section className="karte space-y-3 p-4" data-testid="avatar-auswahl" data-tour="konto-avatar">
      <h2 className="flex items-center gap-2 font-semibold"><Symbol name="benutzer" className="size-5" />Avatar</h2>
      <div className="flex items-center gap-4">
        <Avatar avatar={avatar} name={konto.anzeigename} groesse="gross" />
        <div className="space-y-2 text-sm">
          <label className={`knopf-sekundaer w-fit cursor-pointer px-3 py-1.5 ${laedt ? 'opacity-60' : ''}`}>
            <Symbol name="kamera" className="size-4" />{laedt ? 'Wird hochgeladen …' : avatar.url ? 'Anderes Bild' : 'Eigenes Bild hochladen'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={laedt} onChange={bildGewaehlt} data-testid="avatar-datei" />
          </label>
          {avatar.url && <button type="button" className="block text-leise underline" onClick={bildEntfernen}>Bild entfernen</button>}
        </div>
      </div>
      <p className="text-xs text-leise">
        Dein Avatar erscheint oben in der Kopfleiste und überall neben deinem Namen, wo andere Sammler dich sehen. Ein eigenes Bild sehen nur angemeldete
        Sammler; es wird auf 256 × 256 Pixel zugeschnitten, Kameradaten werden entfernt. Bitte keine Fotos anderer Personen und nichts Anstößiges –
        unpassende Bilder entfernt die Administration. Auf geteilten Sammlungsseiten (ohne Anmeldung) erscheint nur dein Symbol.
      </p>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Symbol {avatar.url && <span className="text-xs font-normal text-leise">(wird statt eines Bildes gezeigt)</span>}</legend>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={!avatar.symbol} title="Anfangsbuchstabe" onClick={() => waehle({ avatar_symbol: '' })}
            className={`grid size-9 place-items-center rounded-full border text-sm font-bold ${!avatar.symbol ? 'border-akzent ring-2 ring-akzent' : 'border-rand'}`}>
            {String(konto.anzeigename ?? '?').slice(0, 1).toUpperCase()}
          </button>
          {AVATAR_SYMBOLE.map((s) => (
            <button key={s} type="button" aria-pressed={avatar.symbol === s} aria-label={`Symbol ${s}`} onClick={() => waehle({ avatar_symbol: s })}
              className={`grid size-9 place-items-center rounded-full border text-lg ${avatar.symbol === s ? 'border-akzent ring-2 ring-akzent' : 'border-rand'}`}>
              {s}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Farbe</legend>
        <div className="flex flex-wrap gap-1.5">
          {AVATAR_FARBEN.map((f) => (
            <button key={f.hex} type="button" aria-pressed={avatar.farbe === f.hex} aria-label={`Farbe ${f.name}`} title={f.name}
              onClick={() => waehle({ avatar_farbe: f.hex })}
              className={`size-8 rounded-full border-2 ${avatar.farbe === f.hex ? 'border-text ring-2 ring-akzent' : 'border-transparent'}`} style={{ backgroundColor: f.hex }} />
          ))}
        </div>
      </fieldset>
    </section>
  );
}

function Profil({ konto, onSpeichern }) {
  const [name, setName] = useState(konto.anzeigename ?? '');
  return (
    <section className="karte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Symbol name="benutzer" className="size-5" />Profil</h2>
      <p className="text-sm text-leise">
        Benutzername: <strong className="text-text">{konto.benutzername}</strong>
        {konto.rolle === 'admin' && <span className="abzeichen ml-2">Administrator</span>}
      </p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onSpeichern({ anzeigename: name }); }}>
        <label className="flex-1">
          <span className="sr-only">Anzeigename</span>
          <input className="eingabe" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Anzeigename" />
        </label>
        <button type="submit" className="knopf-sekundaer">Speichern</button>
      </form>
    </section>
  );
}

/** Zuschaltbare Zusatzfelder – standardmäßig aus, damit das Eintragen einfach bleibt. */
function ZusatzFelder({ konto, onSpeichern }) {
  // Sofort umschalten, nicht erst nach der Antwort des Servers
  const [an, setAn] = useState(konto.funktionen ?? {});
  useEffect(() => { setAn(konto.funktionen ?? {}); }, [konto.funktionen]);
  return (
    <section className="karte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Symbol name="einstellungen" className="size-5" />Zusätzliche Felder</h2>
      <p className="text-sm text-leise">Für Sammler, die mehr festhalten möchten. Ausgeschaltete Felder tauchen beim Eintragen nicht auf – gespeicherte Angaben bleiben erhalten.</p>
      {FUNKTIONEN.map((f) => (
        <label key={f.value} className="flex items-start gap-3">
          <input type="checkbox" className="mt-1" checked={Boolean(an[f.value])}
            onChange={(e) => { setAn({ ...an, [f.value]: e.target.checked }); onSpeichern({ funktionen: { [f.value]: e.target.checked } }); }} />
          <span><span className="font-medium">{f.label}</span><span className="block text-sm text-leise">{f.beschreibung}</span></span>
        </label>
      ))}
      <FelderAusblenden konto={konto} onSpeichern={onSpeichern} />
    </section>
  );
}

/** Felder, die man beim Eintragen nie braucht (z. B. Seriennummer) – ausgefüllte bleiben trotzdem sichtbar. */
function FelderAusblenden({ konto, onSpeichern }) {
  const [aus, setAus] = useState(konto.ausgeblendete_felder ?? []);
  useEffect(() => { setAus(konto.ausgeblendete_felder ?? []); }, [konto.ausgeblendete_felder]);
  const umschalten = (feld, zeigen) => {
    const neu = zeigen ? aus.filter((f) => f !== feld) : [...aus, feld];
    setAus(neu);
    onSpeichern({ ausgeblendete_felder: neu });
  };
  return (
    <details className="rounded-lg border border-rand/60 p-3" open={aus.length > 0}>
      <summary className="cursor-pointer text-sm font-medium">Felder beim Eintragen ausblenden{aus.length ? ` (${aus.length})` : ''}</summary>
      <p className="mt-2 text-sm text-leise">Abgehakte Felder werden angezeigt. Ein ausgeblendetes Feld erscheint trotzdem, wenn bei einem Exemplar schon etwas darin steht.</p>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        {AUSBLENDBARE_FELDER.map((f) => (
          <label key={f.value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-akzent" checked={!aus.includes(f.value)} onChange={(e) => umschalten(f.value, e.target.checked)} />
            {f.label}
          </label>
        ))}
      </div>
    </details>
  );
}

const FOTOS_OEFFENTLICH_TEXT = 'Neue Fotos standardmäßig öffentlich zeigen?\n\nBeim Hochladen ist „Auch öffentlich zeigen“ dann vorausgewählt. '
  + 'Nach der Prüfung erscheinen deine Fotos auf der öffentlichen Seite des Spiels – auch für Besucher ohne Konto und in Suchmaschinen wie der Google-Bildersuche. '
  + 'Du bestätigst, dass du deine Fotos selbst machst und keine Personen darauf zu erkennen sind. Es bleiben deine Fotos – sie werden nur hier gezeigt und nicht verkauft. '
  + 'Du kannst das je Foto abwählen und die Erlaubnis jederzeit zurücknehmen.';

/** Nach dem Hinzufügen nach fehlenden Fotos fragen – sofort umschalten, gespeichert wird im Hintergrund. */
function FotosNachfragen({ konto, onSpeichern, oeffentlichMoeglich }) {
  const [an, setAn] = useState(konto.fotos_nachfragen !== false);
  useEffect(() => { setAn(konto.fotos_nachfragen !== false); }, [konto.fotos_nachfragen]);
  const [oeffentlich, setOeffentlich] = useState(konto.fotos_oeffentlich === true);
  useEffect(() => { setOeffentlich(konto.fotos_oeffentlich === true); }, [konto.fotos_oeffentlich]);
  const oeffentlichSetzen = (wert) => {
    if (wert && !window.confirm(FOTOS_OEFFENTLICH_TEXT)) return;
    setOeffentlich(wert);
    onSpeichern({ fotos_oeffentlich: wert });
  };
  return (
    <section className="karte space-y-2 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Symbol name="kamera" className="size-5" />Fotos beitragen</h2>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-akzent" checked={an}
          onChange={(e) => { setAn(e.target.checked); onSpeichern({ fotos_nachfragen: e.target.checked }); }} />
        <span>Nach dem Hinzufügen nach fehlenden Fotos fragen (z. B. Disc, Verpackung) – je Spiel nur einmal</span>
      </label>
      {oeffentlichMoeglich && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-akzent" checked={oeffentlich} onChange={(e) => oeffentlichSetzen(e.target.checked)} />
          <span>
            Neue Fotos standardmäßig auch öffentlich zeigen – auf der Spieleseite und in Suchmaschinen (z. B. Google-Bildersuche)
            <span className="block text-xs text-leise">Beim Hochladen ist das Häkchen dann schon gesetzt; je Foto lässt es sich abwählen. Gezeigt wird jedes Foto erst nach der Prüfung.</span>
          </span>
        </label>
      )}
    </section>
  );
}

/** Helfer-Gerät fürs Freistellen: nur, wenn die Funktion an ist und das Konto freigeschaltet wurde (Admins und Moderatoren immer). */
function FreistellenHelfer({ konto, onSpeichern }) {
  const freistellen = konto.freistellen;
  const [hilft, setHilft] = useState(freistellen?.hilft === true);
  useEffect(() => { setHilft(freistellen?.hilft === true); }, [freistellen?.hilft]);
  const [limit, setLimit] = useState(String(freistellen?.limit ?? 50));
  useEffect(() => { setLimit(String(freistellen?.limit ?? 50)); }, [freistellen?.limit]);
  if (!freistellen?.aktiv || !freistellen.freigeschaltet) return null;
  return (
    <section className="karte space-y-2 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Symbol name="kamera" className="size-5" />Beim Freistellen helfen</h2>
      <label className="flex items-start gap-2 text-sm" data-testid="freistellen-helfer">
        <input type="checkbox" className="mt-1 size-4 accent-akzent" checked={hilft}
          onChange={(e) => { setHilft(e.target.checked); onSpeichern({ freistellen_hilft: e.target.checked }); }} />
        <span>
          Mein Handy hilft beim Freistellen von Fotos
          <span className="block text-xs text-leise">
            Nur in der App{FREISTELL_SYSTEME ? ` (${FREISTELL_SYSTEME})` : ''}: Sie holt sich Fotos von Figuren, Karten und Geräten aus der Warteschlange und entfernt den Hintergrund
            auf dem Gerät – am besten am Ladegerät über „Freistellen nachholen“. Die Fotos werden dabei nicht angezeigt. Der Fotograf entscheidet danach selbst,
            ob das Ergebnis gezeigt wird.
          </span>
        </span>
      </label>
      {hilft && (
        <label className="flex flex-wrap items-center gap-2 text-sm" data-testid="freistellen-limit">
          <span>Höchstens</span>
          <select className="eingabe py-1" value={limit} onChange={(e) => { setLimit(e.target.value); onSpeichern({ freistellen_limit: Number(e.target.value) }); }}>
            {[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100'], ['250', '250'], ['0', 'unbegrenzt viele']].map(([w, t]) => <option key={w} value={w}>{t}</option>)}
          </select>
          <span>Fotos am Tag{freistellen.heute ? ` · heute schon ${freistellen.heute}` : ''}</span>
          <span className="block w-full text-xs text-leise">Danach bekommt dein Handy bis zum nächsten Tag keine weiteren Aufträge – so läuft es nicht ewig, nur weil wenige Helfer da sind.</span>
        </label>
      )}
      {hilft && nativesFreistellen() && (
        <a className="knopf-sekundaer w-fit" href="#/freistellen-nachholen" data-tour="freistellen-nachholen">
          <Symbol name="kamera" className="size-4" />Freistellen nachholen
        </a>
      )}
    </section>
  );
}

function Sichtbarkeit({ konto, onSpeichern }) {
  return (
    <section className="karte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Symbol name="community" className="size-5" />Sammlung teilen</h2>
      <Andockpunkt name="konto.sichtbarkeit" konto={konto} onSpeichern={onSpeichern} />
      <FreigabeLink konto={konto} />
    </section>
  );
}

function Wiederherstellungscodes({ codes, onFertig }) {
  const text = `${MARKE.name} – Wiederherstellungscodes\nJeder Code funktioniert genau einmal.\n\n${codes.join('\n')}\n`;
  const herunterladen = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'wiederherstellungscodes.txt' });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3 rounded-xl border border-warnung/50 bg-warnung/10 p-4">
      <p className="text-sm"><strong>Bewahre diese Codes sicher auf!</strong> Wenn du dein Handy verlierst, kommst du nur damit wieder in dein Konto. Sie werden nur jetzt angezeigt.</p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((c) => <li key={c} className="rounded-lg bg-karte px-2 py-1 text-center">{c}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="knopf-sekundaer" onClick={herunterladen}><Symbol name="herunterladen" className="size-4" />Als Datei speichern</button>
        <button type="button" className="knopf-sekundaer" onClick={() => navigator.clipboard?.writeText(text)}>Kopieren</button>
        <button type="button" className="knopf-primaer" onClick={onFertig}>Ich habe die Codes gesichert</button>
      </div>
    </div>
  );
}

function ZweiFaktor({ konto, pflicht, onGeaendert }) {
  const zeigeHinweis = useHinweis();
  const [schritt, setSchritt] = useState(null); // null | 'passwort' | 'qr' | 'codes' | 'deaktivieren' | 'neue-codes'
  const [passwort, setPasswort] = useState('');
  const [code, setCode] = useState('');
  const [einrichtung, setEinrichtung] = useState(null);
  const [codes, setCodes] = useState(null);
  const [fehler, setFehler] = useState(null);

  const zuruecksetzen = () => { setSchritt(null); setPasswort(''); setCode(''); setFehler(null); setEinrichtung(null); };
  const ausfuehren = (fn) => async (e) => {
    e.preventDefault();
    setFehler(null);
    try { await fn(); } catch (err) { setFehler(Object.values(err.felder ?? {})[0] ?? err.message); }
  };

  return (
    <section className="karte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Symbol name="schild" className="size-5" />Zwei-Faktor-Anmeldung (2FA)</h2>
      <p className="flex items-center gap-2 text-sm">
        <span className={`size-2 rounded-full ${konto.totp_aktiv ? 'bg-erfolg' : 'bg-warnung'}`} aria-hidden="true" />
        {konto.totp_aktiv
          ? `Aktiv – noch ${konto.wiederherstellungscodesUebrig} Wiederherstellungscodes übrig.`
          : 'Nicht aktiv. Empfohlen, wenn die App im Internet erreichbar ist.'}
      </p>

      {codes && <Wiederherstellungscodes codes={codes} onFertig={() => { setCodes(null); onGeaendert(); }} />}

      {!schritt && !codes && (
        <div className="flex flex-wrap gap-2">
          {!konto.totp_aktiv && <button type="button" className="knopf-primaer" onClick={() => setSchritt('passwort')}>2FA einrichten</button>}
          {konto.totp_aktiv && <button type="button" className="knopf-sekundaer" onClick={() => setSchritt('neue-codes')}>Neue Wiederherstellungscodes</button>}
          {konto.totp_aktiv && !pflicht && <button type="button" className="knopf-gefahr" onClick={() => setSchritt('deaktivieren')}>2FA deaktivieren</button>}
        </div>
      )}

      {schritt === 'passwort' && (
        <form className="space-y-3" onSubmit={ausfuehren(async () => {
          setEinrichtung(await api.totpEinrichten(passwort));
          setPasswort('');
          setSchritt('qr');
        })}>
          <p className="text-sm text-leise">Du brauchst eine Authenticator-App, z. B. Aegis, 2FAS, Google Authenticator, Microsoft Authenticator oder einen Passwortmanager mit TOTP-Funktion.</p>
          <PasswortFeld wert={passwort} onChange={setPasswort} label="Zur Bestätigung: dein Passwort" />
          <Aktionen fehler={fehler} onAbbrechen={zuruecksetzen} text="Weiter" />
        </form>
      )}

      {schritt === 'qr' && einrichtung && (
        <form className="space-y-3" onSubmit={ausfuehren(async () => {
          const antwort = await api.totpBestaetigen(code);
          setCodes(antwort.wiederherstellungscodes);
          zeigeHinweis('Zwei-Faktor-Anmeldung aktiviert.');
          zuruecksetzen();
        })}>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Scanne den QR-Code mit deiner Authenticator-App.</li>
            <li>Gib den angezeigten 6-stelligen Code ein.</li>
          </ol>
          {/* SVG wird vom eigenen Server erzeugt (Bibliothek „qrcode“) */}
          <div className="mx-auto w-52 rounded-xl bg-white p-2 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: einrichtung.qrSvg }} />
          <details className="text-sm">
            <summary className="cursor-pointer text-leise">QR-Code lässt sich nicht scannen? Schlüssel manuell eingeben</summary>
            <p className="mt-2 font-mono break-all select-all">{einrichtung.geheimnis.match(/.{1,4}/g).join(' ')}</p>
            <a className="mt-1 inline-block text-akzent-hell underline" href={einrichtung.otpauthUrl}>Auf diesem Gerät in der App öffnen</a>
          </details>
          <label className="block">
            <span className="beschriftung">Code aus der App</span>
            <input className="eingabe text-center font-mono text-xl tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value)}
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" autoFocus />
          </label>
          <Aktionen fehler={fehler} onAbbrechen={zuruecksetzen} text="Aktivieren" />
        </form>
      )}

      {schritt === 'neue-codes' && (
        <form className="space-y-3" onSubmit={ausfuehren(async () => {
          setCodes((await api.neueWiederherstellungscodes(passwort)).wiederherstellungscodes);
          zuruecksetzen();
        })}>
          <p className="text-sm text-leise">Alle bisherigen Wiederherstellungscodes werden ungültig.</p>
          <PasswortFeld wert={passwort} onChange={setPasswort} label="Passwort" />
          <Aktionen fehler={fehler} onAbbrechen={zuruecksetzen} text="Neue Codes erzeugen" />
        </form>
      )}

      {schritt === 'deaktivieren' && (
        <form className="space-y-3" onSubmit={ausfuehren(async () => {
          await api.totpDeaktivieren({ passwort, code });
          zeigeHinweis('Zwei-Faktor-Anmeldung deaktiviert.');
          zuruecksetzen();
          onGeaendert();
        })}>
          <PasswortFeld wert={passwort} onChange={setPasswort} label="Passwort" />
          <label className="block">
            <span className="beschriftung">Aktueller Code aus der App</span>
            <input className="eingabe font-mono" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
          </label>
          <Aktionen fehler={fehler} onAbbrechen={zuruecksetzen} text="Deaktivieren" gefahr />
        </form>
      )}
    </section>
  );
}

function PasswortAendern() {
  const zeigeHinweis = useHinweis();
  const [werte, setWerte] = useState({ altesPasswort: '', neuesPasswort: '', wiederholung: '' });
  const [fehler, setFehler] = useState(null);
  const setze = (f) => (v) => setWerte((w) => ({ ...w, [f]: v }));
  async function absenden(e) {
    e.preventDefault();
    setFehler(null);
    if (werte.neuesPasswort !== werte.wiederholung) return setFehler('Die neuen Passwörter stimmen nicht überein.');
    try {
      await api.passwortAendern({ altesPasswort: werte.altesPasswort, neuesPasswort: werte.neuesPasswort });
      setWerte({ altesPasswort: '', neuesPasswort: '', wiederholung: '' });
      zeigeHinweis('Passwort geändert. Andere Geräte wurden abgemeldet.');
    } catch (err) {
      setFehler(Object.values(err.felder ?? {})[0] ?? err.message);
    }
  }
  return (
    <form className="karte space-y-3 p-4" onSubmit={absenden}>
      <h2 className="flex items-center gap-2 font-semibold"><Symbol name="schloss" className="size-5" />Passwort ändern</h2>
      <PasswortFeld wert={werte.altesPasswort} onChange={setze('altesPasswort')} label="Bisheriges Passwort" />
      <div className="grid gap-3 sm:grid-cols-2">
        <PasswortFeld wert={werte.neuesPasswort} onChange={setze('neuesPasswort')} label="Neues Passwort (min. 10 Zeichen)" neu />
        <PasswortFeld wert={werte.wiederholung} onChange={setze('wiederholung')} label="Neues Passwort wiederholen" neu />
      </div>
      <Aktionen fehler={fehler} text="Passwort ändern" />
    </form>
  );
}

/** Grobe Gerätebezeichnung aus der Browserkennung, z. B. „Firefox unter Windows“ bzw. „App · iPhone“. */
function geraetName(ua = '', art = 'web') {
  const system = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : null;
  if (art === 'freistellen') return `Freistellen im Hintergrund · ${system ?? 'Handy'}`;
  if (art === 'app') return `App · ${system ?? 'Handy'}`;
  if (browser && system) return `${browser} unter ${system}`;
  return browser ?? system ?? 'Unbekanntes Gerät';
}

/** Angemeldete Geräte (Browser und Apps), einzeln abmeldbar. */
function Geraete() {
  const zeigeHinweis = useHinweis();
  const [liste, setListe] = useState(null);
  const laden = () => api.sitzungen().then(setListe).catch(() => setListe([]));
  useEffect(() => {
    laden();
    window.addEventListener('vss:geraete', laden);
    return () => window.removeEventListener('vss:geraete', laden);
  }, []);
  if (!liste?.length) return null;
  return (
    <ul className="divide-y divide-rand text-sm">
      {liste.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{geraetName(s.geraet ?? '', s.art)}
              {s.aktuell && <span className="ml-2 text-xs text-akzent-hell">dieses Gerät</span>}</p>
            <p className="text-xs text-leise">Angemeldet am {datumDe(s.erstellt_am)} · zuletzt aktiv am {datumDe(s.zuletzt_aktiv)}</p>
          </div>
          {!s.aktuell && (
            <button type="button" className="knopf-sekundaer shrink-0 px-3 py-1 text-xs" onClick={async () => {
              try {
                await api.sitzungBeenden(s.id);
                zeigeHinweis('Das Gerät wurde abgemeldet.');
                laden();
              } catch (e) { zeigeHinweis(e.message, 'fehler'); }
            }}>Abmelden</button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Alle eigenen Einträge löschen und bei null anfangen – das Konto, Einstellungen, Freunde und Fotos bleiben. */
function SammlungLeeren() {
  const zeigeHinweis = useHinweis();
  const [offen, setOffen] = useState(false);
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState(null);
  return (
    <section className="karte space-y-3 border-gefahr/40 p-4" data-testid="sammlung-leeren">
      <h2 className="font-semibold text-gefahr">Sammlung leeren</h2>
      <p className="text-sm text-leise">
        Löscht alle Einträge deiner Sammlung – auch Verkauftes, Abgegebenes und Verliehenes – samt Konvoluten, um bei null anzufangen.
        Konto, Einstellungen, Wunschliste, Freunde und Fotos bleiben erhalten; geteilte Fotos bleiben beim Katalogeintrag.
      </p>
      {!offen ? (
        <button type="button" className="knopf-gefahr" onClick={() => setOffen(true)}>Alle Einträge löschen …</button>
      ) : (
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (!window.confirm('Wirklich alle Einträge endgültig löschen? Das lässt sich nicht rückgängig machen.')) return;
          try {
            const { geloescht } = await api.sammlungLeeren(passwort);
            zeigeHinweis(geloescht === 1 ? 'Ein Eintrag gelöscht – deine Sammlung ist leer.' : `${geloescht} Einträge gelöscht – deine Sammlung ist leer.`);
            setOffen(false);
            setPasswort('');
            setFehler(null);
          } catch (err) {
            setFehler(Object.values(err.felder ?? {})[0] ?? err.message);
          }
        }}>
          <p className="text-sm">
            Tipp: Sichere vorher alles unter „Mehr → Datensicherung“: <a className="underline" href={apiUrl('/api/export.json')} download>JSON-Export herunterladen</a> (lässt sich wieder importieren).
          </p>
          <PasswortFeld wert={passwort} onChange={setPasswort} label="Passwort zur Bestätigung" />
          <Aktionen fehler={fehler} onAbbrechen={() => { setOffen(false); setFehler(null); }} text="Alle Einträge löschen" gefahr />
        </form>
      )}
    </section>
  );
}

function KontoLoeschen({ geteilteFotos = 0 }) {
  const { aktualisiere } = useSitzung();
  const [offen, setOffen] = useState(false);
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState(null);
  // Geteilte Fotos: löschen (Standard) oder anonym der Community überlassen – Einwilligung genau hier
  const [ueberlassen, setUeberlassen] = useState(false);
  return (
    <>
    <section className="karte space-y-2 p-4">
      <h2 className="font-semibold">Meine Daten (Datenauskunft)</h2>
      <p className="text-sm text-leise">
        Alle zu deinem Konto gespeicherten Daten als Datei (maschinenlesbar, Art. 15 und 20 DSGVO).
      </p>
      <a className="knopf-sekundaer w-fit" href={apiUrl('/api/export/datenauskunft.json')} download>Datenauskunft herunterladen</a>
    </section>
    <Andockpunkt name="konto.vertraege" />
    <section className="karte space-y-3 border-gefahr/40 p-4">
      <h2 className="font-semibold text-gefahr">Konto löschen</h2>
      {!offen ? (
        <button type="button" className="knopf-gefahr" onClick={() => setOffen(true)}>Konto und alle Daten löschen …</button>
      ) : (
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const fotoHinweis = geteilteFotos && ueberlassen ? ` Deine ${geteilteFotos} geteilten Fotos bleiben ohne deinen Namen in der Community.` : '';
          if (!window.confirm(`Wirklich endgültig löschen? Alle Artikel, Fotos und Scans gehen verloren.${fotoHinweis}`)) return;
          try {
            await api.kontoLoeschen(passwort, { fotosUeberlassen: Boolean(geteilteFotos && ueberlassen) });
            await aktualisiere();
          } catch (err) {
            setFehler(Object.values(err.felder ?? {})[0] ?? err.message);
          }
        }}>
          <p className="text-sm text-leise">
            Tipp: Erstelle vorher unter „Mehr → Datensicherung“ einen Export.
          </p>
          {geteilteFotos > 0 && (
            <fieldset className="space-y-2 rounded-lg border border-rand p-3 text-sm" data-testid="loeschen-fotos">
              <legend className="px-1 font-medium">
                Du hast {geteilteFotos === 1 ? 'ein Foto' : `${geteilteFotos} Fotos`} mit der Community geteilt. Was soll damit passieren?
              </legend>
              <label className="flex items-start gap-2">
                <input type="radio" name="fotos" className="mt-1" checked={!ueberlassen} onChange={() => setUeberlassen(false)} />
                <span>Mit meinem Konto löschen</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="fotos" className="mt-1" checked={ueberlassen} onChange={() => setUeberlassen(true)} />
                <span>
                  Der Community überlassen – ohne meinen Namen
                  <span className="block text-xs text-leise">
                    Die Fotos bleiben im bisherigen Umfang sichtbar (öffentlich nur, wenn du das erlaubt hattest), aber ohne Bezug zu dir.
                    Du räumst dafür das zeitlich unbeschränkte Recht ein, sie weiter zu zeigen. Private und noch nicht geprüfte Fotos werden immer gelöscht.
                  </span>
                </span>
              </label>
            </fieldset>
          )}
          <PasswortFeld wert={passwort} onChange={setPasswort} label="Passwort zur Bestätigung" />
          <Aktionen fehler={fehler} onAbbrechen={() => setOffen(false)} text="Endgültig löschen" gefahr />
        </form>
      )}
    </section>
    </>
  );
}

function PasswortFeld({ wert, onChange, label, neu }) {
  return (
    <label className="block">
      <span className="beschriftung">{label}</span>
      <input type="password" className="eingabe" value={wert} onChange={(e) => onChange(e.target.value)} autoComplete={neu ? 'new-password' : 'current-password'} />
    </label>
  );
}

function Aktionen({ fehler, onAbbrechen, text, gefahr }) {
  return (
    <>
      {fehler && <p className="text-sm text-gefahr" role="alert">{fehler}</p>}
      <div className="flex gap-2">
        {onAbbrechen && <button type="button" className="knopf-sekundaer" onClick={onAbbrechen}>Abbrechen</button>}
        <button type="submit" className={gefahr ? 'knopf-gefahr' : 'knopf-primaer'}>{text}</button>
      </div>
    </>
  );
}

function EmailAdresse({ konto, onGeaendert, onSpeichern }) {
  const zeigeHinweis = useHinweis();
  const [offen, setOffen] = useState(false);
  const [w, setW] = useState({ email: '', passwort: '' });
  const [fehler, setFehler] = useState(null);

  async function speichern(e) {
    e.preventDefault();
    setFehler(null);
    try {
      await api.emailSetzen(w.email, w.passwort);
      zeigeHinweis('Wir haben dir einen Bestätigungslink geschickt. Die Adresse gilt, sobald du ihn öffnest.');
      setOffen(false);
      setW({ email: '', passwort: '' });
      onGeaendert();
    } catch (err) {
      setFehler(Object.values(err.felder ?? {})[0] ?? err.message);
    }
  }
  async function entfernen() {
    const passwort = window.prompt('Zum Entfernen bitte dein Passwort eingeben:');
    if (!passwort) return;
    try {
      await api.emailEntfernen(passwort);
      zeigeHinweis('E-Mail-Adresse entfernt.');
      onGeaendert();
    } catch (err) {
      zeigeHinweis(Object.values(err.felder ?? {})[0] ?? err.message, 'fehler');
    }
  }

  return (
    <section className="karte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Symbol name="dokument" className="size-5" />E-Mail-Adresse</h2>
      {!konto.emailAktiv ? (
        <p className="text-sm text-leise">Der E-Mail-Versand ist auf diesem Server nicht eingerichtet.</p>
      ) : (
        <>
          <p className="text-sm">
            {konto.email ? <>Bestätigt: <strong className="break-all">{konto.email}</strong></> : 'Noch keine E-Mail-Adresse hinterlegt.'}
          </p>
          {konto.ausstehendeEmail && (
            <p className="text-sm text-warnung">Wartet auf Bestätigung: <span className="break-all">{konto.ausstehendeEmail}</span> – bitte den Link in der E-Mail öffnen.</p>
          )}
          <p className="text-xs text-leise">Wird nur für „Passwort vergessen“, Sicherheitshinweise und – wenn du es möchtest – Benachrichtigungen verwendet. Nie für Werbung, nie für andere sichtbar.</p>
          {konto.email && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 size-4 accent-akzent" checked={konto.benachrichtigung_email}
                onChange={(e) => onSpeichern({ benachrichtigung_email: e.target.checked })} />
              <span>Benachrichtigungen auch per E-Mail erhalten – welche genau, legst du unter „Benachrichtigungen“ fest</span>
            </label>
          )}
          {offen ? (
            <form className="space-y-2" onSubmit={speichern}>
              <input type="email" className="eingabe" placeholder="neue@adresse.de" value={w.email} onChange={(e) => setW({ ...w, email: e.target.value })} autoComplete="email" required />
              <input type="password" className="eingabe" placeholder="Dein Passwort zur Bestätigung" value={w.passwort} onChange={(e) => setW({ ...w, passwort: e.target.value })} autoComplete="current-password" required />
              {fehler && <p className="text-sm text-gefahr" role="alert">{fehler}</p>}
              <div className="flex gap-2">
                <button type="button" className="knopf-sekundaer" onClick={() => setOffen(false)}>Abbrechen</button>
                <button type="submit" className="knopf-primaer">Bestätigungslink senden</button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="knopf-sekundaer" onClick={() => setOffen(true)}>{konto.email ? 'Adresse ändern' : 'Adresse hinzufügen'}</button>
              {konto.email && !konto.emailPflicht && <button type="button" className="knopf-sekundaer" onClick={entfernen}>Entfernen</button>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Benachrichtigungen({ emailAn, email }) {
  const zeigeHinweis = useHinweis();
  const [daten, setDaten] = useState(null);
  useEffect(() => {
    api.benachrichtigungsAuswahl().then(setDaten).catch((e) => zeigeHinweis(e.message, 'fehler'));
  }, [emailAn, email]);
  if (!daten) return null;

  const { kanaele } = daten;
  const mitEmail = kanaele.email && kanaele.email_an;
  const spalten = [
    { id: 'app', label: 'In der App' },
    ...(mitEmail ? [{ id: 'email', label: 'E-Mail' }] : []),
    ...(kanaele.push ? [{ id: 'push', label: 'Push' }] : []),
  ];

  async function umschalten(kategorie, kanal, wert) {
    const vorher = daten;
    setDaten({ ...daten, kategorien: daten.kategorien.map((k) => (k.id === kategorie ? { ...k, [kanal]: wert } : k)) });
    try {
      setDaten(await api.benachrichtigungsAuswahlSetzen({ [kategorie]: { [kanal]: wert } }));
    } catch (e) {
      setDaten(vorher);
      zeigeHinweis(e.message, 'fehler');
    }
  }

  return (
    <section className="karte space-y-3 p-4" aria-labelledby="benachrichtigungen-titel">
      <h2 id="benachrichtigungen-titel" className="flex items-center gap-2 font-semibold"><Symbol name="glocke" className="size-5" />Benachrichtigungen</h2>
      <p className="text-sm text-leise">Lege fest, worüber du informiert wirst und auf welchem Weg. Jede Änderung gilt sofort.</p>
      {!mitEmail && (
        <p className="text-xs text-leise">
          {kanaele.email
            ? 'E-Mail-Benachrichtigungen sind ausgeschaltet. Du kannst sie oben unter „E-Mail-Adresse“ einschalten.'
            : 'Für E-Mail-Benachrichtigungen brauchst du eine bestätigte E-Mail-Adresse (sofern der Server E-Mails versendet).'}
        </p>
      )}
      <ul className="divide-y divide-rand">
        {daten.kategorien.map((k) => (
          <li key={k.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium">{k.label}</p>
              <p className="text-xs text-leise">{k.beschreibung}</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {spalten.filter((s) => !(s.id === 'email' && k.ohne_email)).map((s) => {
                const gesperrt = s.id === 'app' && k.app_pflicht;
                return (
                  <label key={s.id} className={`flex items-center gap-2 text-sm ${gesperrt ? 'text-leise' : ''}`}>
                    <input type="checkbox" className="size-4 accent-akzent" checked={gesperrt ? true : Boolean(k[s.id])} disabled={gesperrt}
                      aria-label={`${k.label}: ${s.label}`}
                      onChange={(e) => umschalten(k.id, s.id, e.target.checked)} />
                    {s.label}
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FreigabeLink({ konto }) {
  const zeigeHinweis = useHinweis();
  const [f, setF] = useState(konto.freigabe);
  const url = f.aktiv ? (f.url ?? `${window.location.origin}${f.pfad}`) : null;
  const aendern = async (daten) => {
    try { setF(await api.freigabeSetzen(daten)); } catch (e) { zeigeHinweis(e.message, 'fehler'); }
  };
  const teilen = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Meine Spielesammlung', url }); return; } catch { /* abgebrochen */ }
    }
    try { await navigator.clipboard.writeText(url); zeigeHinweis('Link kopiert.'); } catch { window.prompt('Link kopieren:', url); }
  };
  return (
    <div className="space-y-2 border-t border-rand pt-3">
      <p className="text-sm"><strong>Per Link teilen – auch mit Leuten ohne Konto</strong></p>
      <p className="text-xs text-leise">
        Wer den Link kennt, sieht deine Sammlung (ohne Kaufpreise, Seriennummern, Notizen und eigene Fotos). Der Link ist nicht erratbar
        und erscheint nicht in Suchmaschinen. Du kannst ihn jederzeit ungültig machen.
      </p>
      {!f.aktiv ? (
        <button type="button" className="knopf-sekundaer" onClick={() => aendern({})}>Link erstellen</button>
      ) : (
        <>
          <div className="flex gap-2">
            <input className="eingabe min-w-0 flex-1 font-mono text-xs" value={url} readOnly onFocus={(e) => e.target.select()} aria-label="Link zu deiner Sammlung" />
            <button type="button" className="knopf-primaer px-3" onClick={teilen}>Teilen</button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-akzent" checked={f.wert_zeigen} onChange={(e) => aendern({ wert_zeigen: e.target.checked })} />
            Geschätzten Gesamtwert anzeigen
          </label>
          <div className="flex flex-wrap gap-2 text-sm">
            <a className="text-akzent-hell underline" href={f.pfad} target="_blank" rel="noreferrer">Ansehen</a>
            <button type="button" className="underline" onClick={() => window.confirm('Neuen Link erstellen? Der bisherige funktioniert dann nicht mehr.') && aendern({ neu: true })}>Neuen Link erstellen</button>
            <button type="button" className="text-gefahr underline" onClick={async () => { setF(await api.freigabeBeenden()); zeigeHinweis('Teilen beendet – der Link funktioniert nicht mehr.'); }}>Teilen beenden</button>
          </div>
        </>
      )}
    </div>
  );
}
