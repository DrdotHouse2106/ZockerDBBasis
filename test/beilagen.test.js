// Vollständigkeit ↔ Beilagen: aus dem einen wird das andere vorbelegt; Anzahlen bleiben erhalten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beilagenAusVollstaendigkeit, vollstaendigkeitAusBeilagen, beilageText } from '../shared/konstanten.js';
import { starteTestServer } from './hilfen.js';

test('Vollständigkeit → Beilagen (andere Beilagen bleiben, Anzahlen auch)', () => {
  assert.deepEqual(beilagenAusVollstaendigkeit('cib', null), { ovp: true, anleitung: true });
  assert.deepEqual(beilagenAusVollstaendigkeit('cib', { beilagen: 3, anleitung: 2 }), { beilagen: 3, anleitung: 2, ovp: true });
  assert.deepEqual(beilagenAusVollstaendigkeit('nur_geraet', { ovp: true, poster: true }), { ovp: false, anleitung: false, poster: true });
  assert.deepEqual(beilagenAusVollstaendigkeit('fehlt_anleitung', {}), { ovp: true, anleitung: false });
  assert.deepEqual(beilagenAusVollstaendigkeit('', { poster: true }), { poster: true }, 'keine Angabe ändert nichts');
});

test('Beilagen → Vollständigkeit', () => {
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: true, anleitung: 2 }), 'cib');
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: true, anleitung: false }), 'fehlt_anleitung');
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: false }), 'nur_geraet');
  // „Nur OVP“ (leere Hülle ohne Disc) bleibt, auch wenn alle Beilagen angehakt werden – nur ohne OVP nicht mehr
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: true, anleitung: true, inlay: true, beilagen: 2 }, 'nur_ovp'), 'nur_ovp');
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: false }, 'nur_ovp'), 'nur_geraet');
  // Keine Anleitung beigelegt (gab es nicht, z. B. PS4) → trotzdem komplett; „CIB“ überschreibt das nicht
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: true, anleitung: 'ohne' }), 'cib');
  assert.deepEqual(beilagenAusVollstaendigkeit('cib', { anleitung: 'ohne' }), { anleitung: 'ohne', ovp: true });
  assert.equal(beilageText('Anleitung', 'ohne'), '– Anleitung (nicht beigelegt)');
  // Game-Boy-Modul in der Schutzhülle, Karton fehlt
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: false, inlay: true }), 'mit_huelle');
  assert.deepEqual(beilagenAusVollstaendigkeit('mit_huelle', { anleitung: true }), { anleitung: true, ovp: false, inlay: true });
  assert.equal(vollstaendigkeitAusBeilagen({ ovp: true }), null, 'ohne Angabe zur Anleitung nicht sicher');
  assert.equal(beilageText('Werbebeilagen', 3), '✓ 3× Werbebeilagen');
  assert.equal(beilageText('Poster', false), '✗ Poster');
});

test('Inlay (Cover) löst kein Foto „Beilagen“ aus, andere Beilagen schon', async () => {
  const { gesuchteFotos } = await import('../shared/konstanten.js');
  const ps4 = { kurz: 'PS4', name: 'PlayStation 4' };
  assert.ok(!gesuchteFotos('spiel', ps4, { beilagen: { ovp: true, inlay: true } }).includes('foto_beilagen'));
  assert.ok(gesuchteFotos('spiel', ps4, { beilagen: { ovp: true, inlay: true, poster: true } }).includes('foto_beilagen'));
});

test('Steelbook: eigenes Foto „Steelbook“ statt „Beilagen“', async () => {
  const { gesuchteFotos } = await import('../shared/konstanten.js');
  const ps3 = { kurz: 'PS3', name: 'PlayStation 3' };
  const liste = gesuchteFotos('spiel', ps3, { beilagen: { ovp: true, steelbook: true } });
  assert.ok(liste.includes('foto_steelbook'));
  assert.ok(!liste.includes('foto_beilagen'));
  assert.ok(gesuchteFotos('spiel', ps3, { beilagen: { steelbook: true, poster: true } }).includes('foto_beilagen'));
  assert.ok(!gesuchteFotos('spiel', ps3, { beilagen: { ovp: true } }).includes('foto_steelbook'));
});

test('Leere Verpackung / Nur OVP: keine Disc, keine Figur – nur Verpackung und was drin liegt', async () => {
  const { gesuchteFotos } = await import('../shared/konstanten.js');
  const gc = { kurz: 'GC', name: 'Nintendo GameCube' };
  assert.deepEqual(gesuchteFotos('spiel', gc, { nurVerpackung: true, beilagen: { ovp: true } }), ['foto_vorne', 'foto_hinten']);
  assert.deepEqual(gesuchteFotos('spiel', gc, { nurVerpackung: true, beilagen: { ovp: true, anleitung: true, beilagen: true } }), ['foto_vorne', 'foto_hinten', 'foto_anleitung', 'foto_beilagen']);
  assert.deepEqual(gesuchteFotos('merch', null, { nurVerpackung: true }), ['foto_vorne', 'foto_hinten']);
});

test('Inlay: Beschriftung je Datenträger, eigener Zustand mit Mängeln, Steelbook als Beilage', async () => {
  const { beilagenFuer, hatInlayZustand } = await import('../shared/konstanten.js');
  const label = (p) => beilagenFuer('spiel', p).find((b) => b.value === 'inlay').label;
  assert.equal(label('PlayStation 4'), 'Inlay / Cover-Einleger');
  assert.equal(label('Nintendo 64'), 'Schutzhülle / Einsatz');
  assert.equal(label(null), 'Inlay / Schutzhülle');
  assert.ok(beilagenFuer('spiel').some((b) => b.value === 'steelbook'));
  assert.equal(hatInlayZustand({ typ: 'spiel', plattform: 'PlayStation 2', vollstaendigkeit: 'cib' }), true);
  assert.equal(hatInlayZustand({ typ: 'spiel', plattform: 'Game Boy', vollstaendigkeit: 'cib' }), false);
  assert.equal(hatInlayZustand({ typ: 'spiel', plattform: 'PlayStation 2', vollstaendigkeit: 'nur_geraet' }), false);

  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const r = await anna.api('/api/artikel', { methode: 'POST', daten: {
      typ: 'spiel', titel: 'Gran Turismo 4', plattform: 'PlayStation 2', zustand_inlay: 'gut',
      inlay_maengel: ['wasserschaden', 'quatsch', 'eingerissen'], beilagen: { steelbook: true },
    } });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.zustand_inlay, 'gut');
    assert.equal(r.json.inlay_maengel, 'eingerissen,wasserschaden', 'nur bekannte Mängel, feste Reihenfolge');
    assert.equal(r.json.beilagen.steelbook, true);
    const falsch = await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'X', zustand_inlay: 'kaputt' } });
    assert.equal(falsch.status, 400);
  } finally {
    await server.stoppe();
  }
});

test('„Nur OVP“ ist eine leere Verpackung: nicht in der Sammlung, eigener Filter, zurück bei anderer Vollständigkeit', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const huelle = (await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Leere Hülle', vollstaendigkeit: 'nur_ovp' } })).json;
    assert.equal(huelle.bestand, 'verpackung');
    await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Echtes Spiel', vollstaendigkeit: 'cib' } });
    assert.deepEqual((await anna.api('/api/artikel')).json.map((a) => a.titel), ['Echtes Spiel']);
    assert.deepEqual((await anna.api('/api/artikel?bestand=verpackung')).json.map((a) => a.titel), ['Leere Hülle']);
    assert.equal((await anna.api('/api/artikel/anzahl')).json.verpackung, 1);
    // Fotos gehen weiterhin (Upload hängt am eigenen Exemplar)
    // Nachträglich doch mit Spiel → wieder in der Sammlung
    const r = await anna.api(`/api/artikel/${huelle.id}`, { methode: 'PUT', daten: { vollstaendigkeit: 'cib' } });
    assert.equal(r.json.bestand, 'besitz');
    const zurueck = await anna.api(`/api/artikel/${huelle.id}`, { methode: 'PUT', daten: { vollstaendigkeit: 'nur_ovp' } });
    assert.equal(zurueck.json.bestand, 'verpackung');
  } finally {
    await server.stoppe();
  }
});

test('Beilagen für Sonderausgaben: Schuber, zweite Disc, Artbook & Co. – als „sonder“ markiert, CIB unberührt', async () => {
  const { beilagenFuer } = await import('../shared/konstanten.js');
  const liste = beilagenFuer('spiel', 'PlayStation 4');
  const sonder = liste.filter((b) => b.sonder).map((b) => b.value);
  assert.deepEqual(sonder, ['schuber', 'zweite_disc', 'artbook', 'code', 'soundtrack', 'figur', 'extras']);
  assert.ok(!beilagenFuer('konsole').some((b) => b.sonder), 'nur bei Spielen');
  assert.ok(!liste.find((b) => b.value === 'ovp').sonder);
});

test('Inlay „gab es nicht“ (z. B. Steelbook-Edition): keine Inlay-Bewertung', async () => {
  const { hatInlayZustand, BEILAGE_OHNE } = await import('../shared/konstanten.js');
  const basis = { typ: 'spiel', plattform: 'PlayStation 4', bestand: 'besitz', vollstaendigkeit: 'cib' };
  assert.equal(hatInlayZustand(basis), true);
  assert.equal(hatInlayZustand({ ...basis, beilagen: { inlay: true } }), true);
  assert.equal(hatInlayZustand({ ...basis, beilagen: { inlay: BEILAGE_OHNE, steelbook: true } }), false);
});

test('Sammlungssuche: Modellnummern ohne Bindestrich/Leerzeichen, mehrere Discs', async () => {
  const server = await starteTestServer();
  try {
    const c = await server.registriere('sammlerin');
    await c.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: 'Horizon Forbidden West', modellnummer: 'CUSA-24705, CUSA-24706' } });
    const treffer = async (q) => (await c.api(`/api/artikel?q=${encodeURIComponent(q)}`)).json.map((a) => a.titel);
    for (const q of ['CUSA-24706', 'CUSA24706', 'cusa 24705', 'Horizon']) assert.deepEqual(await treffer(q), ['Horizon Forbidden West'], q);
    assert.deepEqual(await treffer('CUSA-99999'), []);
  } finally {
    await server.stoppe();
  }
});

test('Plattformen ohne gedruckte Anleitung: CIB mit „gab es nicht“, Anleitung bleibt antippbar', async () => {
  const k = await import('../shared/konstanten.js');
  for (const p of ['PlayStation 4', 'PS5', 'Xbox One', 'Xbox Series X|S', 'Nintendo Switch', { name: 'PlayStation 5', kurz: 'PS5' }]) assert.equal(k.ohneAnleitungUeblich(p), true, JSON.stringify(p));
  for (const p of ['PlayStation 3', 'PlayStation 2', 'Xbox 360', 'Super Nintendo', 'Wii U', null]) assert.equal(k.ohneAnleitungUeblich(p), false, String(p));
  // CIB auf PS4: OVP vorhanden, Anleitung „gab es nicht“ – und das ist komplett
  const ps4 = k.beilagenAusVollstaendigkeit('cib', {}, 'PlayStation 4');
  assert.deepEqual(ps4, { ovp: true, anleitung: k.BEILAGE_OHNE, inlay: true }, 'Disc-Spiel: CIB mit Inlay');
  assert.equal(k.vollstaendigkeitAusBeilagen(ps4), 'cib');
  // Hat jemand doch eine Anleitung, bleibt sie erhalten
  assert.equal(k.beilagenAusVollstaendigkeit('cib', { anleitung: true }, 'PlayStation 4').anleitung, true);
  // Ältere Plattformen wie bisher: CIB heißt Anleitung vorhanden
  assert.equal(k.beilagenAusVollstaendigkeit('cib', {}, 'PlayStation 2').anleitung, true);
  // Inlay „gab es nicht“ (z. B. Steelbook) bleibt; Modul-Spiele bekommen kein Inlay vorbelegt
  assert.equal(k.beilagenAusVollstaendigkeit('cib', { inlay: k.BEILAGE_OHNE }, 'PlayStation 4').inlay, k.BEILAGE_OHNE);
  assert.equal(k.beilagenAusVollstaendigkeit('cib', {}, 'PlayStation 2').inlay, true);
  assert.equal('inlay' in k.beilagenAusVollstaendigkeit('cib', {}, 'Game Boy'), false);
});

test('Fehlt Inlay: eigene Stufe, aus den Beilagen abgeleitet, kein Inlay-Zustand, CSV-Import', async () => {
  const k = await import('../shared/konstanten.js');
  const { vollstaendigkeitVon } = await import('../server/services/csvimport.js');
  assert.ok(k.ALLE_WERTE.vollstaendigkeit.includes('fehlt_inlay'));
  assert.equal(k.vollstaendigkeitAusBeilagen({ ovp: true, anleitung: k.BEILAGE_OHNE, inlay: false }), 'fehlt_inlay');
  assert.equal(k.vollstaendigkeitAusBeilagen({ ovp: true, anleitung: true, inlay: true }), 'cib');
  assert.deepEqual(k.beilagenAusVollstaendigkeit('fehlt_inlay', {}, 'PlayStation 4'), { ovp: true, inlay: false });
  assert.equal(k.hatInlayZustand({ typ: 'spiel', plattform: 'PlayStation 4', vollstaendigkeit: 'fehlt_inlay' }), false);
  assert.equal(vollstaendigkeitVon('ohne Inlay'), 'fehlt_inlay');
  assert.equal(vollstaendigkeitVon('missing cover'), 'fehlt_inlay');
});
