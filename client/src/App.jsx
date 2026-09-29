import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { api, leereZwischenspeicher } from './api.js';
import { useRoute, passt, navigiere } from './router.js';
import { SitzungKontext } from './sitzung.js';
import { HinweisAnbieter } from './komponenten/Hinweise.jsx';
import Layout from './komponenten/Layout.jsx';
import Anmelden from './seiten/Anmelden.jsx';
import Sammlung from './seiten/Sammlung.jsx';
import { spaeter } from './spaeter.js';
import { MODUL } from './erweiterungen.jsx';

// ── Code-Splitting ─────────────────────────────────────────────
// Die Sammlung und die Anmeldung stecken im Start-Bundle, alle anderen Seiten werden erst bei Bedarf geladen.
// Nach dem Start werden sie im Leerlauf vorgeladen, damit sie der Service-Worker auch offline bereithält.
const SEITEN = {
  hinzufuegen: () => import('./seiten/Hinzufuegen.jsx'),
  artikelFormular: () => import('./seiten/ArtikelFormular.jsx'),
  artikelDetail: () => import('./seiten/ArtikelDetail.jsx'),
  statistik: () => import('./seiten/Statistik.jsx'),
  einstellungen: () => import('./seiten/Einstellungen.jsx'),
  konto: () => import('./seiten/Konto.jsx'),
  benachrichtigungen: () => import('./seiten/Benachrichtigungen.jsx'),
  import: () => import('./seiten/Import.jsx'),
  admin: () => import('./seiten/Admin.jsx'),
  druck: () => import('./seiten/Druck.jsx'),
  katalog: () => import('./seiten/Katalog.jsx'),
  katalogSeite: () => import('./seiten/KatalogSeite.jsx'),
  rechtlicheSeite: () => import('./seiten/RechtlicheSeite.jsx'),
  kontoLinks: () => import('./seiten/KontoLinks.jsx'),
  konvolute: () => import('./seiten/Konvolute.jsx'),
  ideen: () => import('./seiten/Ideen.jsx'),
  kalender: () => import('./seiten/Kalender.jsx'),
};

function vorladen() {
  const laden = [...Object.values(SEITEN), ...(MODUL.vorladen ?? [])];
  const alle = () => laden.reduce((kette, fn) => kette.then(() => fn().catch(() => {})), Promise.resolve());
  if ('requestIdleCallback' in window) window.requestIdleCallback(alle, { timeout: 8000 });
  else setTimeout(alle, 3000);
}

const Hinzufuegen = spaeter(SEITEN.hinzufuegen);
const ArtikelFormular = spaeter(SEITEN.artikelFormular);
const ArtikelDetail = spaeter(SEITEN.artikelDetail);
const Statistik = spaeter(SEITEN.statistik);
const Einstellungen = spaeter(SEITEN.einstellungen);
const Konto = spaeter(SEITEN.konto);
const Benachrichtigungen = spaeter(SEITEN.benachrichtigungen);
const Import = spaeter(SEITEN.import);
const Admin = spaeter(SEITEN.admin);
const Druck = spaeter(SEITEN.druck);
const Katalog = spaeter(SEITEN.katalog);
const KatalogSeite = spaeter(SEITEN.katalogSeite);
const RechtlicheSeite = spaeter(SEITEN.rechtlicheSeite);
const KonvoluteListe = spaeter(SEITEN.konvolute, 'KonvoluteListe');
const Ideen = spaeter(SEITEN.ideen);
const Kalender = spaeter(SEITEN.kalender);
const KonvolutSeite = spaeter(SEITEN.konvolute, 'KonvolutSeite');
const PasswortVergessen = spaeter(SEITEN.kontoLinks, 'PasswortVergessen');
const PasswortNeu = spaeter(SEITEN.kontoLinks, 'PasswortNeu');
const EmailBestaetigen = spaeter(SEITEN.kontoLinks, 'EmailBestaetigen');

const Laden = () => <div className="flex min-h-dvh items-center justify-center p-6 text-leise">Wird geladen …</div>;

function Seite({ route }) {
  const { pfad } = route;
  if (pfad === '/') return <Sammlung route={route} />;
  if (pfad === '/neu') return <Hinzufuegen route={route} />;
  if (pfad === '/neu/formular') return <ArtikelFormular key={JSON.stringify(route.parameter)} route={route} />;
  if (pfad === '/statistik') return <Statistik route={route} />;
  if (pfad === '/einstellungen') return <Einstellungen route={route} />;
  if (pfad === '/konto') return <Konto route={route} />;
  if (pfad === '/benachrichtigungen') return <Benachrichtigungen route={route} />;
  if (pfad === '/import') return <Import route={route} />;
  if (pfad === '/admin') return <Admin route={route} />;
  if (pfad === '/katalog') return <Katalog route={route} />;
  if (pfad === '/konvolute') return <KonvoluteListe route={route} />;
  if (pfad === '/ideen') return <Ideen route={route} />;
  if (pfad === '/kalender') return <Kalender route={route} />;
  let t = passt('/artikel/:id/bearbeiten', pfad);
  if (t) return <ArtikelFormular key={`b${t.id}`} route={route} artikelId={t.id} />;
  t = passt('/artikel/:id', pfad);
  if (t) return <ArtikelDetail key={t.id} route={route} id={t.id} />;
  t = passt('/katalog/:id', pfad);
  if (t) return <KatalogSeite key={t.id} route={route} id={t.id} />;
  t = passt('/konvolut/:id', pfad);
  if (t) return <KonvolutSeite key={t.id} route={route} id={t.id} />;
  t = passt('/seite/:slug', pfad);
  if (t) return <RechtlicheSeite key={t.slug} route={route} slug={t.slug} />;
  t = passt('/druck/:id', pfad);
  if (t) return <Druck key={t.id} route={route} id={t.id} />;
  // Seiten von Zusatzmodulen – feste Pfade oder Muster wie /boerse/angebot/:id
  for (const r of MODUL.routen ?? []) {
    const treffer = r.pfad ? (r.pfad === pfad ? {} : null) : passt(r.muster, pfad);
    if (treffer) return <r.Komponente key={JSON.stringify(treffer)} route={route} {...treffer} {...(r.props?.(treffer) ?? {})} />;
  }
  return (
    <Layout route={route} titel="Seite nicht gefunden">
      <p className="text-leise">Diese Seite gibt es nicht. <a href="#/" className="underline">Zur Sammlung</a></p>
    </Layout>
  );
}

export default function App() {
  const route = useRoute();
  const [auth, setAuth] = useState(null); // Antwort von /api/auth/status
  const [status, setStatus] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [fehler, setFehler] = useState(null);

  const aktualisiere = useCallback(async () => {
    try {
      const a = await api.authStatus();
      setAuth(a);
      setFehler(null);
      if (a.angemeldet) api.status().then(setStatus).catch(() => {});
    } catch (e) {
      setFehler(e.message);
    }
  }, []);

  const abmelden = useCallback(async () => {
    await api.abmelden().catch(() => {});
    await leereZwischenspeicher().catch(() => {});
    setStatus(null);
    navigiere('/');
    await aktualisiere();
  }, [aktualisiere]);

  useEffect(() => {
    aktualisiere();
    vorladen();
    const an = () => setOffline(false);
    const aus = () => setOffline(true);
    const abgemeldet = () => setAuth((a) => (a ? { ...a, angemeldet: false, benutzer: null } : a));
    const zweiFaktorPflicht = () => navigiere('/konto', { pflicht: '1' });
    window.addEventListener('online', an);
    window.addEventListener('offline', aus);
    window.addEventListener('vss:abgemeldet', abgemeldet);
    window.addEventListener('vss:2fa-pflicht', zweiFaktorPflicht);
    return () => {
      window.removeEventListener('online', an);
      window.removeEventListener('offline', aus);
      window.removeEventListener('vss:abgemeldet', abgemeldet);
      window.removeEventListener('vss:2fa-pflicht', zweiFaktorPflicht);
    };
  }, [aktualisiere]);

  const kontext = useMemo(() => ({ benutzer: auth?.benutzer ?? null, auth, status, aktualisiere, abmelden }), [auth, status, aktualisiere, abmelden]);

  let inhalt;
  if (!auth) {
    inhalt = (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center text-leise">
        {fehler ? <p role="alert">{fehler} <button type="button" className="underline" onClick={aktualisiere}>Erneut versuchen</button></p> : 'Wird geladen …'}
      </div>
    );
  } else if (route.pfad === '/passwort-vergessen') {
    inhalt = <PasswortVergessen />;
  } else if (route.pfad === '/passwort-neu') {
    inhalt = <PasswortNeu token={route.parameter.token} />;
  } else if (route.pfad === '/email-bestaetigen') {
    inhalt = <EmailBestaetigen token={route.parameter.token} />;
  } else if (!auth.angemeldet && passt('/seite/:slug', route.pfad)) {
    // Rechtliche Seiten sind immer ohne Anmeldung erreichbar
    const t = passt('/seite/:slug', route.pfad);
    inhalt = <RechtlicheSeite key={t.slug} route={route} slug={t.slug} />;
  } else if (!auth.angemeldet && auth.oeffentlicherKatalog && route.pfad.startsWith('/katalog')) {
    // Öffentlicher Katalog ohne Anmeldung
    // Alte Links (#/katalog/42) führen Besucher auf die öffentliche, für Suchmaschinen lesbare Seite.
    // ?app=1 (z. B. vom Knopf „In meine Sammlung“) bleibt in der App.
    const t = passt('/katalog/:id', route.pfad);
    // (nur wenn ein Zusatzmodul öffentliche Seiten liefert)
    if (t && !route.parameter.app && MODUL.oeffentlicheSeiten) inhalt = <Weiterleitung ziel={`/spiel/${encodeURIComponent(t.id)}`} />;
    else inhalt = t ? <KatalogSeite key={t.id} route={route} id={t.id} /> : <Katalog route={route} />;
  } else if (!auth.angemeldet) {
    inhalt = <Anmelden />;
  } else if (auth.zweiFaktorPflicht && !auth.benutzer.totp_aktiv) {
    inhalt = <Konto route={{ pfad: '/konto', parameter: { pflicht: '1' } }} />;
  } else {
    inhalt = <Seite route={route} />;
  }

  return (
    <SitzungKontext.Provider value={kontext}>
      <HinweisAnbieter>
        {offline && (
          <div className="bg-warnung px-4 py-1.5 text-center text-sm font-medium text-black" role="status">
            Offline – du siehst die zuletzt geladenen Daten. Änderungen sind erst wieder mit Verbindung möglich.
          </div>
        )}
        <Suspense fallback={<Laden />}>{inhalt}</Suspense>
      </HinweisAnbieter>
    </SitzungKontext.Provider>
  );
}

function Weiterleitung({ ziel }) {
  useEffect(() => { window.location.replace(ziel); }, [ziel]);
  return <div className="flex min-h-dvh items-center justify-center p-6 text-leise">Wird geladen …</div>;
}
