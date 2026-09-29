// Zuschaltbare Zusatzfelder: Lagerort (mit Übersicht, Filter, Sammelzuweisung), Zustand & Wartung, Beilagen & Seriennummern.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { standardWartungsmerkmale, passendeWartungsarten, seriennummerPasst } from '../shared/konstanten.js';

test('Standard-Wartungsmerkmale je Plattform und Seriennummer-Abgleich', () => {
  assert.deepEqual(standardWartungsmerkmale('SNES', 'spiel'), { speicherbatterie: null });
  assert.deepEqual(standardWartungsmerkmale('Saturn', 'konsole'), { speicherbatterie: true, optisches_laufwerk: true, elkos: true });
  assert.deepEqual(standardWartungsmerkmale('Switch', 'konsole'), {});
  const arten = passendeWartungsarten({ optisches_laufwerk: true, speicherbatterie: false }).map((a) => a.value);
  assert.ok(arten.includes('laufwerk') && arten.includes('mod') && !arten.includes('batterie') && !arten.includes('recap'));
  assert.equal(seriennummerPasst('SN 123-45', 'sn12345'), true);
  assert.equal(seriennummerPasst('SN1', 'SN2'), false);
  assert.equal(seriennummerPasst('SN1', ''), null);
});

test('Funktionen im Profil, Lagerort, Wartung und Beilagen', async () => {
  const server = await starteTestServer();
  try {
    const admin = await server.registriere('admin');
    const anna = await server.registriere('anna');

    // Standardmäßig alles aus; nur bekannte Schlüssel werden gespeichert
    assert.deepEqual((await anna.api('/api/konto')).json.funktionen, { lagerort: false, wartung: false, beilagen: false });
    const r0 = await anna.api('/api/konto', { methode: 'PUT', daten: { funktionen: { lagerort: true, wartung: true, boese: true } } });
    assert.deepEqual(r0.json.funktionen, { lagerort: true, wartung: true, beilagen: false });

    const neu = (daten) => anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', ...daten } }).then((r) => { assert.equal(r.status, 201, r.text); return r.json; });
    const zelda = await neu({ titel: 'Zelda', plattform: 'Super Nintendo', lagerort_ort: 'Wohnzimmer', lagerort_regal: 'Kallax', lagerort_fach: 'Fach 1' });
    const mario = await neu({ titel: 'Mario', plattform: 'Super Nintendo' });
    const konsole = await neu({
      typ: 'konsole', titel: 'Sega Saturn', plattform: 'Sega Saturn', seriennummer: 'AB-123', seriennummer_ovp: 'ab123',
      beilagen: { ovp: true, anleitung: false, netzteil: true, unbekannt: true },
    });
    assert.deepEqual(konsole.beilagen, { ovp: true, anleitung: false, netzteil: true });

    // Sammelzuweisung und Übersicht je Lagerort
    let r = await anna.api('/api/artikel/lagerort', { methode: 'POST', daten: { ids: [mario.id, konsole.id, 999999], ort: 'wohnzimmer', regal: 'Kallax', fach: 'Fach 2' } });
    assert.equal(r.json.geaendert, 2);
    const orte = (await anna.api('/api/artikel/lagerorte')).json;
    assert.equal(orte.length, 2);
    assert.deepEqual(orte.map((o) => [o.fach, o.anzahl]), [['Fach 1', 1], ['Fach 2', 2]]);
    assert.deepEqual((await anna.api('/api/artikel?lagerort_ort=Wohnzimmer&lagerort_fach=Fach%202')).json.map((a) => a.titel).sort(), ['Mario', 'Sega Saturn']);
    assert.deepEqual((await anna.api('/api/artikel?q=kallax')).json.length, 3);
    await anna.api('/api/artikel/lagerort', { methode: 'POST', daten: { ids: [mario.id], ort: '' } });
    assert.deepEqual((await anna.api('/api/artikel?ohne_lagerort=1')).json.map((a) => a.titel), ['Mario']);

    // Wartung: passende Arten je Plattform, Verlauf, Batterie-Hinweis
    let w = (await anna.api(`/api/artikel/${konsole.id}/wartung`)).json;
    assert.equal(w.merkmale_quelle, 'standard');
    assert.ok(w.arten.includes('laufwerk') && w.arten.includes('batterie') && w.arten.includes('recap'));
    assert.equal((await anna.api(`/api/artikel/${konsole.id}/wartung`, { methode: 'POST', daten: { art: 'quatsch' } })).status, 400);
    r = await anna.api(`/api/artikel/${konsole.id}/wartung`, { methode: 'POST', daten: { art: 'batterie', datum: '2005', notiz: 'CR2032' } });
    assert.equal(r.status, 201, r.text);
    await anna.api(`/api/artikel/${konsole.id}/wartung`, { methode: 'POST', daten: { art: 'mod', datum: '2024-05-01', notiz: 'Region-Mod' } });
    w = (await anna.api(`/api/artikel/${konsole.id}/wartung`)).json;
    assert.equal(w.eintraege.length, 2);
    assert.equal(w.batterie.seit_tausch, true);
    assert.ok(w.batterie.alter_jahre >= 20 && w.batterie.warnung);
    // Fremde Einträge lassen sich nicht löschen
    const ben = await server.registriere('ben');
    assert.equal((await ben.api(`/api/artikel/wartung/${w.eintraege[0].id}`, { methode: 'DELETE' })).status, 404);
    assert.equal((await ben.api(`/api/artikel/${konsole.id}/wartung`)).status, 404);

    // Merkmale am Katalog: Vorschlag von Nutzern, Übernahme durch das Moderationsteam
    const katalogId = (await anna.api(`/api/artikel/${konsole.id}`)).json.katalog_id;
    r = await anna.api(`/api/katalog/${katalogId}/wartungsmerkmale`, { methode: 'PUT', daten: { merkmale: { speicherbatterie: true, optisches_laufwerk: false } } });
    assert.equal(r.json.vorgeschlagen, true, r.text);
    assert.equal(r.json.quelle, 'standard');
    const offen = (await admin.api('/api/katalog/wartungsmerkmale/vorschlaege')).json;
    assert.equal(offen.length, 1);
    assert.equal((await anna.api('/api/katalog/wartungsmerkmale/vorschlaege')).status, 403);
    await admin.api(`/api/katalog/wartungsmerkmale/vorschlaege/${offen[0].id}`, { methode: 'POST', daten: { uebernehmen: true } });
    w = (await anna.api(`/api/artikel/${konsole.id}/wartung`)).json;
    assert.equal(w.merkmale_quelle, 'katalog');
    assert.ok(!w.arten.includes('laufwerk'));

    // Export/Import nimmt Lagerort, Beilagen und Wartungsverlauf mit
    const exp = (await anna.api('/api/export.json')).json;
    assert.equal(exp.wartungen.length, 2);
    const csv = (await anna.api('/api/export.csv')).text;
    assert.match(csv, /Wohnzimmer › Kallax › Fach 1/);
    const imp = await ben.api('/api/import', { methode: 'POST', daten: exp });
    assert.equal(imp.json.importiert, 3, imp.text);
    const benSaturn = (await ben.api('/api/artikel?q=Saturn')).json[0];
    assert.equal(benSaturn.lagerort_fach, 'Fach 2');
    assert.deepEqual(benSaturn.beilagen, { ovp: true, anleitung: false, netzteil: true });
    assert.equal((await ben.api(`/api/artikel/${benSaturn.id}/wartung`)).json.eintraege.length, 2);
  } finally {
    await server.stoppe();
  }
});
