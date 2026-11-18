// Figurenserien (Merch): MIMP-Stammdaten, Unterserien mit Nummernbereich, nie erschienene Nummern, Figuren mit Farben (nur erschienene zählen),
// Fortschritt, Rechte (privat → eingereicht → freigegeben), Filter und Anzeige in der Sammlung.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import sharp from 'sharp';
import { nummernAusText, normaleNummer } from '../server/services/serien.js';
import { paketEinspielen, datenpaketeEinspielen } from '../server/stammdaten/datenpakete.js';

let server;
let mod;
let anna;
let bernd;
before(async () => {
  server = await starteTestServer();
  mod = await server.registriere('admin');
  anna = await server.registriere('anna');
  bernd = await server.registriere('bernd');
});
after(async () => { await server.stoppe(); });

/** Eigene, freigegebene Test-Unterserie unter MIMP (die echten Unterserien sind mit Figuren vorbelegt). */
async function testSerie(name, daten = {}) {
  const mimp = (await mod.api('/api/serien')).json.find((s) => s.name === 'Monster in my Pocket');
  return (await mod.api('/api/serien', { methode: 'POST', daten: { name, ueber_id: mimp.id, status: 'freigegeben', ...daten } })).json;
}

test('Hilfen: Nummernbereiche und Nummern ohne Präfix', () => {
  assert.deepEqual([...nummernAusText('82-96, 100')].length, 16);
  assert.ok(nummernAusText('82–84').has(83));
  assert.equal(normaleNummer('#4', '#'), '4');
  assert.equal(normaleNummer('W12', 'W'), '12');
  assert.equal(normaleNummer(' 7 ', null), '7');
});

test('Stammdaten: Monster in my Pocket mit Unterserien, Nummernbereichen und nie erschienenen Nummern', async () => {
  const liste = (await anna.api('/api/serien')).json;
  const mimp = liste.find((s) => s.name === 'Monster in my Pocket');
  assert.ok(mimp);
  assert.equal(mimp.kinder.length, 11, 'ohne „Serie 1 – Secret Monster“ und „Serie 6b“ (nur Hinweis- bzw. Raritätenseiten)');
  assert.ok(!mimp.kinder.some((k) => /^Serie 6b/.test(k.name)));
  assert.ok(!mimp.kinder.some((k) => /Secret Monster/.test(k.name)));
  const s3 = mimp.kinder.find((k) => k.name === 'Serie 3');
  assert.deepEqual([s3.nummer_von, s3.nummer_bis, s3.fortschritt.figuren.gesamt], [73, 96, 9], '#82–96 nie erschienen');
  const w = mimp.kinder.find((k) => k.name.startsWith('Monster Wrestlers'));
  assert.equal(w.nummer_praefix, 'W');
  assert.equal(mimp.kinder.find((k) => k.name === 'Serie 1').farben.length, 8);
  assert.equal(mimp.fortschritt.figuren.besitz, 0);
});

test('Figuren und Farben: Moderation pflegt, nur erschienene Farben zählen, Sammeln über die Farbe', async () => {
  const mimp = (await mod.api('/api/serien')).json.find((s) => s.name === 'Monster in my Pocket');
  const s1 = await testSerie('Testserie A', { nummer_praefix: '#', nummer_von: 1, nummer_bis: 48 });
  // Figur anlegen (Moderation, freigegebene Serie → freigegeben)
  let r = await mod.api(`/api/serien/${s1.id}/figuren`, { methode: 'POST', daten: { nummer: '#1', titel: 'Great Beast' } });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.status, 'freigegeben');
  const beast = r.json.katalog_id;
  await mod.api(`/api/serien/figur/${beast}/farbe`, { methode: 'PUT', daten: { farbe: 'Hellolive', zustand: 'ja' } });
  await mod.api(`/api/serien/figur/${beast}/farbe`, { methode: 'PUT', daten: { farbe: 'Hellrot', zustand: 'ja' } });
  const hydra = (await mod.api(`/api/serien/${s1.id}/figuren`, { methode: 'POST', daten: { nummer: '2', titel: 'Hydra' } })).json.katalog_id;
  await mod.api(`/api/serien/figur/${hydra}/farbe`, { methode: 'PUT', daten: { farbe: 'Neongrün', zustand: 'ja' } });

  // Eine schon erfasste Farbe können Sammler nicht entfernen (nur vorschlagen, was fehlt)
  assert.equal((await anna.api(`/api/serien/figur/${beast}/farbe`, { methode: 'PUT', daten: { farbe: 'Hellolive', zustand: 'nein' } })).status, 400);

  // Serienseite: 48 Zeilen (je Nummer), Farbspalten, Fortschritt
  let seite = (await anna.api(`/api/serien/${s1.id}`)).json;
  assert.equal(seite.zeilen.length, 48);
  assert.equal(seite.zeilen[0].figuren[0].titel, 'Great Beast');
  assert.deepEqual(seite.zeilen[0].figuren[0].farben.map((f) => f.farbe).sort(), ['Hellolive', 'Hellrot']);
  assert.equal(seite.mit_farben, true);
  assert.equal(seite.zeilen[0].figuren[0].farben[0].selten, undefined, 'kein „selten“ mehr');
  assert.equal(seite.zeilen[5].figuren.length, 0, 'noch nicht erfasste Nummer');
  assert.deepEqual(seite.fortschritt, { figuren: { besitz: 0, gesamt: 48 }, farben: { besitz: 0, gesamt: 3 } });

  // Sammeln: Anna hat Great Beast in Hellolive
  const variante = seite.zeilen[0].figuren[0].farben.find((f) => f.farbe === 'Hellolive').variante_id;
  r = await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'merch', titel: 'Great Beast', katalog_id: beast, variante_id: variante, farbe: 'Hellolive', merch_kategorie: 'figur' } });
  assert.equal(r.status, 201, r.text);
  seite = (await anna.api(`/api/serien/${s1.id}`)).json;
  assert.deepEqual(seite.fortschritt, { figuren: { besitz: 1, gesamt: 48 }, farben: { besitz: 1, gesamt: 3 } });
  const gesamt = (await anna.api('/api/serien')).json.find((s) => s.name === 'Monster in my Pocket').fortschritt;
  assert.equal(gesamt.figuren.besitz, 1);

  // Farbe in einer Sammlung lässt sich nicht entfernen
  assert.equal((await mod.api(`/api/serien/figur/${beast}/farbe`, { methode: 'PUT', daten: { farbe: 'Hellolive', zustand: 'nein' } })).status, 400);

  // Sammlung: Anzeige und Filter nach Serie (Hauptserie schließt Unterserien ein), Suche über den Seriennamen
  const liste = (await anna.api(`/api/artikel?serie_id=${mimp.id}`)).json;
  const eintraege = liste.artikel ?? liste;
  assert.equal(eintraege.length, 1);
  assert.deepEqual([eintraege[0].serie_name, eintraege[0].serie_ueber_name, eintraege[0].serien_nummer], ['Testserie A', 'Monster in my Pocket', '1']);
  const suche = (await anna.api('/api/artikel?q=Monster%20in%20my')).json;
  assert.equal((suche.artikel ?? suche).length, 1);
});

test('Eigene Serien: privat anlegen, einreichen, Moderation gibt frei; Fremde sehen private Serien nicht', async () => {
  let r = await bernd.api('/api/serien', { methode: 'POST', daten: { name: 'Funko Pop! Games', nummer_praefix: '#' } });
  assert.equal(r.status, 201, r.text);
  const funko = r.json;
  assert.equal(funko.status, 'privat');
  r = await bernd.api('/api/serien', { methode: 'POST', daten: { name: 'Welle 1', ueber_id: funko.id, nummer_von: 1, nummer_bis: 10, farben: ['Standard', 'Chase'] } });
  assert.equal(r.status, 201, r.text);
  const welle = r.json;
  // Funko Pop!: keine Farbvarianten – neue Serien sind ohne, Unterserien übernehmen das von der Hauptserie
  assert.deepEqual([funko.mit_farben, welle.mit_farben, welle.farben.length], [false, false, 0]);
  assert.equal((await anna.api(`/api/serien/${funko.id}`)).status, 404, 'privat');
  // Unterserie unter einer Unterserie geht nicht (zwei Ebenen)
  assert.equal((await bernd.api('/api/serien', { methode: 'POST', daten: { name: 'Zu tief', ueber_id: welle.id } })).status, 400);
  // Eigene Figur in eigener Serie: privat, Farben frei pflegbar
  const figur = (await bernd.api(`/api/serien/${welle.id}/figuren`, { methode: 'POST', daten: { nummer: '#3', titel: 'Mario' } })).json;
  assert.equal(figur.status, 'privat');
  const farbe = await bernd.api(`/api/serien/figur/${figur.katalog_id}/farbe`, { methode: 'PUT', daten: { farbe: 'Chase', zustand: 'ja' } });
  assert.equal(farbe.status, 400);
  assert.match(farbe.json.felder.farbe, /keine Farbvarianten/);
  // Sammeln ohne Farbe: Figur zählt im Fortschritt (nur Figuren)
  await bernd.api('/api/artikel', { methode: 'POST', daten: { typ: 'merch', titel: 'Mario', katalog_id: figur.katalog_id, merch_kategorie: 'figur' } });
  assert.deepEqual((await bernd.api(`/api/serien/${welle.id}`)).json.fortschritt, { figuren: { besitz: 1, gesamt: 10 }, farben: { besitz: 0, gesamt: 0 } });
  // Farben lassen sich bei Bedarf einschalten
  assert.equal((await bernd.api(`/api/serien/${welle.id}`, { methode: 'PUT', daten: { mit_farben: true } })).json.mit_farben, true);
  // Einreichen und Freigabe
  r = await bernd.api(`/api/serien/${funko.id}`, { methode: 'PUT', daten: { status: 'freigegeben' } });
  assert.equal(r.json.status, 'privat', 'Sammler können nicht selbst freigeben');
  r = await bernd.api(`/api/serien/${funko.id}`, { methode: 'PUT', daten: { status: 'eingereicht' } });
  assert.equal(r.json.status, 'eingereicht');
  r = await mod.api(`/api/serien/${funko.id}`, { methode: 'PUT', daten: { status: 'freigegeben' } });
  assert.equal(r.json.status, 'freigegeben');
  assert.equal((await anna.api(`/api/serien/${funko.id}`)).status, 200);
  assert.equal((await anna.api(`/api/serien/${welle.id}`)).json.status, 'freigegeben', 'Unterserien werden mit freigegeben');
  assert.equal((await bernd.api(`/api/serien/${funko.id}`, { methode: 'PUT', daten: { name: 'Umbenannt' } })).status, 400, 'freigegeben: nur Moderation');
  // Datenauskunft enthält eigene Serien
  const auskunft = (await bernd.api('/api/export/datenauskunft.json')).json;
  assert.ok(auskunft.eigene_serien.some((s) => s.name === 'Funko Pop! Games'));
});

test('Die Liste wächst mit der Community: Vorschlag zählt erst für den Vorschlagenden, nach Freigabe für alle', async () => {
  const s2 = await testSerie('Testserie B', { nummer_von: 49, nummer_bis: 72, farben: ['Rot', 'Blau'] });
  const figur = (await mod.api(`/api/serien/${s2.id}/figuren`, { methode: 'POST', daten: { nummer: '49', titel: 'Figur 49' } })).json.katalog_id;
  await mod.api(`/api/serien/figur/${figur}/farbe`, { methode: 'PUT', daten: { farbe: 'Rot', zustand: 'ja' } });
  const farbenGesamt = async (c) => (await c.api(`/api/serien/${s2.id}`)).json.fortschritt.farben.gesamt;
  assert.equal(await farbenGesamt(bernd), 1);

  // Anna kennt die Figur auch in Blau → Vorschlag, zählt für sie, für Bernd noch nicht. Er bleibt privat, bis ein Foto als Beleg dabei ist.
  const moderiert = server.kontext.katalog.moderiert();
  let r = await anna.api(`/api/serien/figur/${figur}/farbe`, { methode: 'PUT', daten: { farbe: 'Blau', zustand: 'ja' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.status, 'privat');
  assert.equal(r.json.beleg_noetig, moderiert, 'ohne Moderation (selbst gehostet) gibt es niemanden, der prüft');
  assert.equal(await farbenGesamt(anna), 2);
  assert.equal(await farbenGesamt(bernd), 1);
  const zelle = (await anna.api(`/api/serien/${s2.id}`)).json.zeilen[0].figuren[0].farben.find((f) => f.farbe === 'Blau');
  assert.equal(zelle.eigener_vorschlag, true);
  assert.equal(zelle.beleg_fehlt, moderiert);
  // Eigenen Vorschlag zurückziehen und wieder vorschlagen geht
  assert.equal((await anna.api(`/api/serien/figur/${figur}/farbe`, { methode: 'PUT', daten: { farbe: 'Blau', zustand: 'nein' } })).status, 200);
  assert.equal(await farbenGesamt(anna), 1);
  const blau = (await anna.api(`/api/serien/figur/${figur}/farbe`, { methode: 'PUT', daten: { farbe: 'Blau', zustand: 'ja' } })).json.variante_id;
  // Neue Figur einer freigegebenen Serie: ebenfalls zuerst privat
  const neu = (await anna.api(`/api/serien/${s2.id}/figuren`, { methode: 'POST', daten: { nummer: '50', titel: 'Figur 50' } })).json;
  assert.deepEqual([neu.status, neu.beleg_noetig], ['privat', moderiert]);

  // Foto als Beleg → Vorschlag geht an die Moderation (nur der Einsender darf es hinzufügen)
  const beleg = async (client, katalogId, varianteId) => {
    const formular = new FormData();
    formular.append('foto', new Blob([await sharp({ create: { width: 60, height: 60, channels: 3, background: '#2244cc' } }).jpeg().toBuffer()], { type: 'image/jpeg' }), 'beleg.jpg');
    if (varianteId) formular.append('variante_id', String(varianteId));
    return client.api(`/api/serien/figur/${katalogId}/beleg`, { methode: 'POST', formular });
  };
  if (moderiert) {
    assert.equal((await beleg(bernd, figur, blau)).status, 404, 'fremder Vorschlag');
    r = await beleg(anna, figur, blau);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.status, 'eingereicht');
    assert.equal(server.db.prepare('SELECT status FROM katalog_varianten WHERE id = ?').get(blau).status, 'eingereicht');
    r = await beleg(anna, neu.katalog_id);
    assert.equal(r.status, 200, r.text);
    assert.equal(server.db.prepare('SELECT status FROM katalog WHERE id = ?').get(neu.katalog_id).status, 'eingereicht');
    // Die Moderation sieht die Fotos am Vorschlag; das Foto der Farbe hängt nicht am Titelvorschlag der Figur
    const schlange = (await mod.api('/api/moderation/warteschlange')).json;
    const v = schlange.varianten.find((x) => x.id === blau);
    assert.equal(v.belegfotos.length, 1);
    assert.equal(v.serie.name, 'Testserie B');
    assert.equal(schlange.katalog.find((k) => k.id === neu.katalog_id).belegfotos.length, 1);
    assert.equal((await mod.api(v.belegfotos[0].url)).status, 200);
    assert.equal((await bernd.api(v.belegfotos[0].url)).status, 404, 'Foto nur für Einsender und Moderation');
    const seite = (await anna.api(`/api/serien/${s2.id}`)).json;
    assert.equal(seite.zeilen[0].figuren[0].farben.find((f) => f.farbe === 'Blau').beleg_fehlt, false);
  } else {
    assert.equal((await beleg(anna, figur, blau)).status, 400, 'ohne Moderation kein Beleg nötig');
  }

  // Moderation gibt frei (wie bei allen Ausgaben über die Warteschlange) → zählt für alle: aus 1 wird 2
  server.db.prepare("UPDATE katalog_varianten SET status = 'freigegeben' WHERE katalog_id = ? AND farbe = 'Blau'").run(figur);
  assert.equal(await farbenGesamt(bernd), 2);
  assert.equal((await anna.api(`/api/serien/figur/${figur}/farbe`, { methode: 'PUT', daten: { farbe: 'Blau', zustand: 'nein' } })).status, 400, 'freigegeben: nur Moderation');
});

test('Meine Serien: folgen, eigene Figuren und eigene Serien stehen oben', async () => {
  const c = await server.registriere('carla');
  let liste = (await c.api('/api/serien')).json;
  assert.ok(liste.every((s) => !s.meine && !s.folge), 'neu: noch keine eigenen Serien');
  const mimp = liste.find((s) => s.name === 'Monster in my Pocket');
  // Folgen über eine Unterserie gilt der Hauptserie
  let r = await c.api(`/api/serien/${mimp.kinder[0].id}/folgen`, { methode: 'PUT', daten: { folgen: true } });
  assert.deepEqual(r.json, { serie_id: mimp.id, folge: true });
  liste = (await c.api('/api/serien')).json;
  assert.deepEqual([liste[0].name, liste[0].folge, liste[0].meine], ['Monster in my Pocket', true, true]);
  assert.equal((await c.api('/api/export/datenauskunft.json')).json.gefolgte_serien[0].name, 'Monster in my Pocket');
  await c.api(`/api/serien/${mimp.id}/folgen`, { methode: 'PUT', daten: { folgen: false } });
  assert.equal((await c.api('/api/serien')).json.find((s) => s.id === mimp.id).meine, false);
  // Eigene Serie steht oben; Anna hat Figuren aus MIMP → für sie automatisch „meine“
  const eigene = (await c.api('/api/serien', { methode: 'POST', daten: { name: 'Carlas Serie' } })).json;
  liste = (await c.api('/api/serien')).json;
  assert.equal(liste[0].id, eigene.id);
  assert.equal((await anna.api('/api/serien')).json.find((s) => s.id === mimp.id).meine, true);
  assert.equal((await c.api('/api/serien/999999/folgen', { methode: 'PUT', daten: { folgen: true } })).status, 404);
});

test('Liste einfügen: Figuren mit Farben in Spaltenreihenfolge (x, R, -), vorhandene werden ergänzt', async () => {
  const s4 = await testSerie('Testserie C', { nummer_von: 97, nummer_bis: 120, farben: ['Grün', 'Rot', 'Gelb'] });
  let r = await mod.api(`/api/serien/${s4.id}/liste`, { methode: 'POST', daten: { text: '97; Erste Figur; x - R\n#98;Zweite Figur;- x x\n99\tDritte\tx\tx\t-\n;\n' } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.neu, r.json.ergaenzt, r.json.farben], [3, 0, 6]);
  assert.equal(r.json.fehler.length, 1, 'Zeile ohne Namen');
  r = await mod.api(`/api/serien/${s4.id}/liste`, { methode: 'POST', daten: { text: '97; Erste Figur; x x R' } });
  assert.deepEqual([r.json.neu, r.json.ergaenzt], [0, 1]);
  const seite = (await mod.api(`/api/serien/${s4.id}`)).json;
  const erste = seite.zeilen.find((z) => z.nummer === '97').figuren[0];
  assert.deepEqual(erste.farben.map((f) => f.farbe).sort(), ['Gelb', 'Grün', 'Rot'], '„R“ zählt als „gibt es“');
  assert.equal(seite.zeilen.find((z) => z.nummer === '99').figuren[0].farben.length, 2);
  // Sammler können in freigegebenen Serien keine Listen einfügen
  assert.equal((await anna.api(`/api/serien/${s4.id}/liste`, { methode: 'POST', daten: { text: '100; X; x' } })).status, 400);
});

test('Datenpakete: neue Serie mit Unterserien, Figuren und Farben – nur einmal, ohne Gepflegtes zu überschreiben', async () => {
  const db = server.db;
  const paket = {
    name: 'test-paket',
    serie: { name: 'Testpaket-Serie', hersteller: 'Testwerk', mit_farben: true },
    unterserien: [
      { name: 'Welle 1', jahr: 1991, nummer_praefix: '#', nummer_von: 1, nummer_bis: 4, nicht_erschienen: '3', farben: ['Rot', { name: 'Blau', hex: '#2244cc' }],
        liste: '1; Alpha; x -\n#2; Beta; ? x\n4; ?\n; Ohne Nummer; x x' },
      { name: 'Welle 2', liste: '5; Gamma' },
    ],
  };
  let r = datenpaketeEinspielen(db, [paket]);
  assert.deepEqual(r, [{ name: 'test-paket', serien: 3, figuren: 4, farben: 4 }]);
  assert.deepEqual(datenpaketeEinspielen(db, [paket]), [], 'unverändert: nicht erneut');
  const haupt = (await anna.api('/api/serien')).json.find((s) => s.name === 'Testpaket-Serie');
  assert.equal(haupt.status, 'freigegeben');
  const welle = (await anna.api(`/api/serien/${haupt.kinder.find((k) => k.name === 'Welle 1').id}`)).json;
  assert.deepEqual([welle.mit_farben, welle.hersteller, welle.spalten.map((x) => x.name)], [true, 'Testwerk', ['Rot', 'Blau']]);
  assert.deepEqual(welle.fortschritt, { figuren: { besitz: 0, gesamt: 4 }, farben: { besitz: 0, gesamt: 4 } }, '#3 nie erschienen, Figur ohne Nummer zählt');
  const alpha = welle.zeilen.find((z) => z.nummer === '1').figuren[0];
  assert.deepEqual([alpha.titel, alpha.farben.map((f) => f.farbe)], ['Alpha', ['Rot']]);

  // Geändertes Paket: nur Neues kommt dazu, von Hand gepflegte Farben der Serie bleiben
  await mod.api(`/api/serien/${welle.id}`, { methode: 'PUT', daten: { farben: ['Rot', 'Blau', 'Grün'] } });
  paket.unterserien[0].farben = ['Rot'];
  paket.unterserien[1].liste += '\n6; Delta';
  r = datenpaketeEinspielen(db, [paket]);
  assert.deepEqual(r, [{ name: 'test-paket', serien: 0, figuren: 1, farben: 0 }]);
  assert.equal((await anna.api(`/api/serien/${welle.id}`)).json.spalten.length, 3);
  assert.equal(paketEinspielen(db, paket).figuren, 0, 'idempotent');
});

test('Serie ↔ Spiel: Moderation verknüpft, Sammler nicht; Spieleseite zeigt die Serie mit Figurenzahl', async () => {
  const db = server.db;
  const spiel = db.prepare(`INSERT INTO katalog (quelle, typ, titel, plattformen, status, erscheinungsjahr) VALUES ('eigen', 'spiel', 'Monster-Spiel (Test)', '["NES"]', 'freigegeben', 1992) RETURNING id`).pluck().get();
  const merch = db.prepare(`INSERT INTO katalog (quelle, typ, titel, plattformen, status) VALUES ('eigen', 'merch', 'Kein Spiel', '[]', 'freigegeben') RETURNING id`).pluck().get();
  const serie = await testSerie('Spiel-Testserie');
  const ueber = serie.ueber_id;

  // Sammler dürfen eine freigegebene Serie nicht verknüpfen
  assert.equal((await anna.api(`/api/serien/${serie.id}/spiele`, { methode: 'PUT', daten: { spiele: [spiel] } })).status, 400);
  // Moderation: über eine Unterserie gesetzt, gilt für die Hauptserie; Merch wird ignoriert
  const r = await mod.api(`/api/serien/${serie.id}/spiele`, { methode: 'PUT', daten: { spiele: [spiel, merch, 999999] } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.spiele.map((g) => [g.id, g.titel, g.plattformen]), [[spiel, 'Monster-Spiel (Test)', ['NES']]]);
  assert.deepEqual((await anna.api(`/api/serien/${ueber}`)).json.spiele.map((g) => g.id), [spiel], 'Hauptserie zeigt das Spiel');

  // Spieleseite: Serie mit Figurenzahl und eigenem Besitz
  await mod.api(`/api/serien/${serie.id}/figuren`, { methode: 'POST', daten: { nummer: '1', titel: 'Spiel-Figur' } });
  const figur = db.prepare("SELECT id FROM katalog WHERE titel = 'Spiel-Figur'").pluck().get();
  await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'merch', titel: 'Spiel-Figur', katalog_id: figur } });
  const seite = (await anna.api(`/api/katalog-seite/${spiel}`)).json.eintrag.figurenserien;
  assert.equal(seite.length, 1);
  assert.equal(seite[0].id, ueber);
  assert.ok(seite[0].figuren >= 1);
  assert.ok(seite[0].besitz >= 1, 'eigene Figuren der Serie (auch aus früheren Tests)');

  // Entfernen
  assert.deepEqual((await mod.api(`/api/serien/${ueber}/spiele`, { methode: 'PUT', daten: { spiele: [] } })).json.spiele, []);
  assert.deepEqual((await anna.api(`/api/katalog-seite/${spiel}`)).json.eintrag.figurenserien, []);
});

test('Monster in my Pocket: wird beim Start mit dem Spiel verknüpft, sobald es im Katalog steht – nur einmal', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { oeffneDatenbank } = await import('../server/db.js');
  const datei = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mimp-')), 'test.db');
  let db = oeffneDatenbank(datei);
  const mimp = db.prepare("SELECT id FROM serien WHERE name = 'Monster in my Pocket' AND ueber_id IS NULL").pluck().get();
  assert.equal(db.prepare('SELECT COUNT(*) FROM serien_spiele').pluck().get(), 0, 'Spiel noch nicht im Katalog');
  const spiel = db.prepare(`INSERT INTO katalog (quelle, typ, titel, plattformen, status) VALUES ('igdb', 'spiel', 'Monster in My Pocket', '["NES"]', 'freigegeben') RETURNING id`).pluck().get();
  db.close();
  db = oeffneDatenbank(datei);
  assert.deepEqual(db.prepare('SELECT serie_id, katalog_id FROM serien_spiele').all(), [{ serie_id: mimp, katalog_id: spiel }]);
  db.prepare('DELETE FROM serien_spiele').run(); // von der Moderation bewusst entfernt
  db.close();
  db = oeffneDatenbank(datei);
  assert.equal(db.prepare('SELECT COUNT(*) FROM serien_spiele').pluck().get(), 0, 'bleibt entfernt');
  db.close();
});

test('Monster in my Pocket: Spiel wird gleich beim Speichern verknüpft, Titel ohne Satzzeichen/Großschreibung verglichen', async () => {
  const db = server.db;
  const mimp = db.prepare("SELECT id FROM serien WHERE name = 'Monster in my Pocket' AND ueber_id IS NULL").pluck().get();
  db.prepare("DELETE FROM datenpakete WHERE name = 'spiel-zu-serie:Monster in my Pocket'").run();
  db.prepare('DELETE FROM serien_spiele WHERE serie_id = ?').run(mimp);
  const e = server.kontext.katalog.speichere({ quelle: 'igdb', externe_id: 'game:mimp-test', typ: 'spiel', titel: 'Monster In My Pocket!', plattformen: ['NES'] });
  assert.deepEqual(db.prepare('SELECT katalog_id FROM serien_spiele WHERE serie_id = ?').pluck().all(mimp), [e.id]);
  // Ein anderes Spiel mit ähnlichem Titel wird nicht verknüpft
  server.kontext.katalog.speichere({ quelle: 'igdb', externe_id: 'game:mimp-2', typ: 'spiel', titel: 'Monster in My Pocket 2', plattformen: ['NES'] });
  assert.equal(db.prepare('SELECT COUNT(*) FROM serien_spiele WHERE serie_id = ?').pluck().get(mimp), 1);
});

test('Monster in my Pocket: fehlendes Spiel wird vorab online gesucht und verknüpft – danach nicht mehr', async () => {
  const db = server.db;
  const { bekannteSpieleHolen } = await import('../server/services/serienspiele.js');
  const mimp = db.prepare("SELECT id FROM serien WHERE name = 'Monster in my Pocket' AND ueber_id IS NULL").pluck().get();
  db.prepare("DELETE FROM datenpakete WHERE name = 'spiel-zu-serie:Monster in my Pocket'").run();
  db.prepare('DELETE FROM serien_spiele WHERE serie_id = ?').run(mimp);
  db.prepare("DELETE FROM katalog WHERE typ = 'spiel' AND titel LIKE 'Monster in My Pocket%'").run();
  const suchen = [];
  // Online-Suche (IGDB): legt den Treffer im Katalog ab
  const katalog = { suche: async (begriff) => { suchen.push(begriff); server.kontext.katalog.speichere({ quelle: 'igdb', externe_id: 'game:mimp-online', typ: 'spiel', titel: 'Monster in My Pocket', plattformen: ['NES'] }); } };
  assert.equal(await bekannteSpieleHolen(db, katalog), 1);
  assert.deepEqual(suchen, ['Monster in My Pocket']);
  assert.equal(db.prepare('SELECT COUNT(*) FROM serien_spiele WHERE serie_id = ?').pluck().get(mimp), 1);
  assert.equal(await bekannteSpieleHolen(db, katalog), 0);
  assert.equal(suchen.length, 1, 'verknüpft: keine weitere Suche');
});

test('Jugendschutz: Moderation pflegt Indizierung, Sammler nicht; Katalogfilter', async () => {
  const db = server.db;
  const id = db.prepare(`INSERT INTO katalog (quelle, typ, titel, plattformen, status) VALUES ('eigen', 'spiel', 'Indiziertes Testspiel', '[]', 'freigegeben') RETURNING id`).pluck().get();
  // Sammler können nichts ändern (freigegebener Eintrag)
  assert.equal((await anna.api(`/api/katalog/${id}`, { methode: 'PUT', daten: { jugendschutz: 'indiziert' } })).status, 403);
  // Moderation: indiziert seit 1997, später gestrichen 2019
  let r = await mod.api(`/api/katalog/${id}`, { methode: 'PUT', daten: { jugendschutz: 'gestrichen', jugendschutz_seit: 1997, jugendschutz_bis: 2019 } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.jugendschutz, r.json.jugendschutz_seit, r.json.jugendschutz_bis], ['gestrichen', 1997, 2019]);
  assert.equal((await mod.api(`/api/katalog/${id}`, { methode: 'PUT', daten: { jugendschutz: 'gestrichen', jugendschutz_seit: 2019, jugendschutz_bis: 1997 } })).status, 400);
  // Andere Änderungen lassen den Jugendschutz stehen
  r = await mod.api(`/api/katalog/${id}`, { methode: 'PUT', daten: { hersteller: 'Testverlag' } });
  assert.equal(r.json.jugendschutz, 'gestrichen');
  // Filter in der Katalogliste
  const liste = async (q) => (await anna.api(`/api/katalog-liste?typ=spiel&region=alle&q=Indiziertes&jugendschutz=${q}`)).json.eintraege.map((e) => e.id);
  assert.deepEqual(await liste('gestrichen'), [id]);
  assert.deepEqual(await liste('alle'), [id]);
  assert.deepEqual(await liste('indiziert'), []);
  // Zurücksetzen
  r = await mod.api(`/api/katalog/${id}`, { methode: 'PUT', daten: { jugendschutz: '' } });
  assert.deepEqual([r.json.jugendschutz, r.json.jugendschutz_seit], [null, null]);
});

test('Datenpaket amiibo: vollständig eingespielt, Smash mit Nummern, doppelte Nummer ohne Verlust', async () => {
  const { oeffneDatenbank } = await import('../server/db.js');
  const { DATENPAKETE } = await import('../server/stammdaten/pakete/index.js');
  const db = oeffneDatenbank(':memory:');
  assert.deepEqual(datenpaketeEinspielen(db, DATENPAKETE.filter((p) => p.name === 'amiibo')), [{ name: 'amiibo', serien: 43, figuren: 951, farben: 0 }]);
  const haupt = db.prepare("SELECT * FROM serien WHERE name = 'amiibo' AND ueber_id IS NULL").get();
  assert.deepEqual([haupt.merch_kategorie, haupt.hersteller], ['spielfigur', 'Nintendo']);
  const smash = db.prepare("SELECT * FROM serien WHERE ueber_id = ? AND name = 'Super Smash Bros.'").get(haupt.id);
  assert.deepEqual([smash.nummer_von, smash.nummer_bis, smash.jahr], [1, 93, 2014]);
  const figuren = db.prepare('SELECT titel, serien_nummer FROM katalog WHERE serie_id = ?').all(smash.id);
  assert.equal(figuren.length, 96);
  assert.equal(figuren.find((f) => f.titel === 'Steve').serien_nummer, '89');
  assert.equal(figuren.find((f) => f.titel === 'Alex').serien_nummer, null, 'zweite Figur mit Nummer 89 ohne Nummer');
  db.close();
});

test('Monster in my Pocket: „Serie 1 – Secret Monster“ wird mit Nr. 12 der Serie 1 zusammengeführt', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { oeffneDatenbank } = await import('../server/db.js');
  const datei = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mimp-geheim-')), 'test.db');
  let db = oeffneDatenbank(datei);
  // Stand vor dem Aufräumen nachbauen: Unterserie mit einer doppelten Nr. 12, auf die ein Exemplar zeigt
  const mimp = db.prepare("SELECT id FROM serien WHERE name = 'Monster in my Pocket' AND ueber_id IS NULL").pluck().get();
  const serie1 = db.prepare("SELECT id FROM serien WHERE ueber_id = ? AND name = 'Serie 1'").pluck().get(mimp);
  const troll = db.prepare(`INSERT INTO katalog (quelle, externe_id, typ, titel, plattformen, status, serie_id, serien_nummer)
    VALUES ('eigen', 'test:serie1:12', 'merch', 'Jotun Troll', '[]', 'freigegeben', ?, '12') RETURNING id`).pluck().get(serie1);
  db.prepare('UPDATE serien SET hinweis = NULL WHERE id = ?').run(serie1);
  const geheim = db.prepare("INSERT INTO serien (name, ueber_id, status) VALUES ('Serie 1 – Secret Monster', ?, 'freigegeben') RETURNING id").pluck().get(mimp);
  const doppelt = db.prepare(`INSERT INTO katalog (quelle, externe_id, typ, titel, plattformen, status, serie_id, serien_nummer)
    VALUES ('eigen', 'test:geheim:12', 'merch', 'Jotun Troll', '[]', 'freigegeben', ?, '12') RETURNING id`).pluck().get(geheim);
  const benutzer = db.prepare("INSERT INTO benutzer (benutzername, passwort_hash) VALUES ('sammler', 'x') RETURNING id").pluck().get();
  const exemplar = db.prepare("INSERT INTO artikel (benutzer_id, typ, titel, katalog_id) VALUES (?, 'merch', 'Jotun Troll', ?) RETURNING id").pluck().get(benutzer, doppelt);
  // Die beiden Aufräum-Migrationen noch einmal laufen lassen (vor den letzten sechs des Kerns: Plattform, Fassung und Kameradaten am Foto,
  // vier Freistell-Migrationen, Avatar, Exemplar am Foto)
  db.pragma(`user_version = ${db.pragma('user_version', { simple: true }) - 12}`);
  db.close();
  db = oeffneDatenbank(datei);
  assert.equal(db.prepare('SELECT COUNT(*) FROM serien WHERE id = ?').pluck().get(geheim), 0, 'Unterserie entfernt');
  assert.equal(db.prepare('SELECT katalog_id FROM artikel WHERE id = ?').pluck().get(exemplar), troll, 'Exemplar hängt jetzt an Nr. 12 der Serie 1');
  assert.equal(db.prepare('SELECT COUNT(*) FROM katalog WHERE id = ?').pluck().get(doppelt), 0, 'doppelte Figur gelöscht');
  assert.match(db.prepare('SELECT hinweis FROM serien WHERE id = ?').pluck().get(serie1), /Secret Monster/);
  db.close();
});

test('Monster in my Pocket: „Serie 6b – Secret Skeleton Dinosaurs“ wird als Skelett-Farben in Serie 6 übernommen', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { oeffneDatenbank } = await import('../server/db.js');
  const datei = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mimp-6b-')), 'test.db');
  let db = oeffneDatenbank(datei);
  const mimp = db.prepare("SELECT id FROM serien WHERE name = 'Monster in my Pocket' AND ueber_id IS NULL").pluck().get();
  const serie6 = db.prepare("SELECT id FROM serien WHERE ueber_id = ? AND name LIKE 'Serie 6 %'").pluck().get(mimp);
  const serie6b = db.prepare("INSERT INTO serien (name, ueber_id, status, mit_farben, farben) VALUES ('Serie 6b – Secret Skeleton Dinosaurs', ?, 'freigegeben', 1, ?) RETURNING id")
    .pluck().get(mimp, JSON.stringify([{ name: 'Gelb' }, { name: 'Grün' }]));
  const figur = (serie, extern) => db.prepare(`INSERT INTO katalog (quelle, externe_id, typ, titel, plattformen, status, serie_id, serien_nummer)
    VALUES ('eigen', ?, 'merch', 'Tyrannosaurus Rex', '[]', 'freigegeben', ?, '145') RETURNING id`).pluck().get(extern, serie);
  const rex = figur(serie6, 'test:6:145');
  const skelettRex = figur(serie6b, 'test:6b:145');
  const gelb = db.prepare("INSERT INTO katalog_varianten (katalog_id, bezeichnung, farbe, status) VALUES (?, 'Gelb', 'Gelb', 'freigegeben') RETURNING id").pluck().get(skelettRex);
  const benutzer = db.prepare("INSERT INTO benutzer (benutzername, passwort_hash) VALUES ('dino', 'x') RETURNING id").pluck().get();
  const exemplar = db.prepare("INSERT INTO artikel (benutzer_id, typ, titel, katalog_id, variante_id) VALUES (?, 'merch', 'T-Rex', ?, ?) RETURNING id").pluck().get(benutzer, skelettRex, gelb);
  db.pragma(`user_version = ${db.pragma('user_version', { simple: true }) - 11}`);
  db.close();
  db = oeffneDatenbank(datei);
  assert.equal(db.prepare('SELECT COUNT(*) FROM serien WHERE id = ?').pluck().get(serie6b), 0, 'Unterserie 6b entfernt');
  const a = db.prepare('SELECT katalog_id, variante_id FROM artikel WHERE id = ?').get(exemplar);
  assert.equal(a.katalog_id, rex, 'Exemplar hängt jetzt an Nr. 145 der Serie 6');
  assert.equal(db.prepare('SELECT farbe FROM katalog_varianten WHERE id = ?').pluck().get(a.variante_id), 'Skelett Gelb');
  const s6 = db.prepare('SELECT mit_farben, farben, hinweis FROM serien WHERE id = ?').get(serie6);
  assert.equal(s6.mit_farben, 1);
  assert.deepEqual(JSON.parse(s6.farben).map((f) => f.name), ['Skelett Gelb', 'Skelett Grün']);
  assert.match(s6.hinweis, /Secret Skeleton/);
  assert.equal(db.prepare('SELECT COUNT(*) FROM katalog WHERE id = ?').pluck().get(skelettRex), 0, 'doppelte Figur gelöscht');
  db.close();
});

test('amiibo-Karten sind Sammelkarten (eigene Kategorie, Exemplare ziehen mit)', async () => {
  const { oeffneDatenbank } = await import('../server/db.js');
  const { DATENPAKETE } = await import('../server/stammdaten/pakete/index.js');
  const db = oeffneDatenbank(':memory:');
  datenpaketeEinspielen(db, DATENPAKETE.filter((p) => p.name === 'amiibo'));
  const kategorie = (name) => db.prepare("SELECT merch_kategorie FROM serien WHERE name = ? AND ueber_id IS NOT NULL").pluck().get(name);
  assert.equal(kategorie('Animal Crossing Cards - Series 1'), 'karte');
  assert.equal(kategorie('Super Smash Bros.'), 'spielfigur');
  db.close();
});
