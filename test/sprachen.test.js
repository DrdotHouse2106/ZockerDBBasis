// Sprachen laut IGDB: Umwandlung, Speicherung am Katalogeintrag, Filter in Katalog und Sammlung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';
import { igdbSprachen, normSprachen, sprachBedingung, spracheTrifft, sprachListe, deutschKurz } from '../shared/sprachen.js';
import { spielZuEintrag, SPIEL_FELDER } from '../server/services/igdb.js';
import { zentralZuEintrag } from '../server/services/zentrale.js';

const IGDB = [
  { language: { locale: 'de-DE' }, language_support_type: { id: 1, name: 'Audio' } },
  { language: { locale: 'de-DE' }, language_support_type: { id: 3, name: 'Interface' } },
  { language: { locale: 'en-US' }, language_support_type: 1 },
  { language: { locale: 'en-GB' }, language_support_type: 2 },
  { language: { locale: 'ja-JP' }, language_support_type: { id: 2, name: 'Subtitles' } },
  { language: { locale: 'xx' }, language_support_type: 9 },
  { language: null, language_support_type: 1 },
];

test('IGDB-Sprachen → {code: [Arten]}: Name vor ID, Regionen zusammengefasst, Unbrauchbares verworfen', () => {
  assert.deepEqual(igdbSprachen(IGDB), { de: ['audio', 'menue'], en: ['audio', 'untertitel'], ja: ['untertitel'] });
  assert.equal(igdbSprachen([]), null);
  assert.equal(igdbSprachen(undefined), null);
  assert.match(SPIEL_FELDER, /language_supports\.language\.locale/);
  assert.deepEqual(spielZuEintrag({ id: 1, name: 'X', language_supports: IGDB }).sprachen.de, ['audio', 'menue']);
  // Daten von zockerdb.de werden streng geprüft
  assert.deepEqual(zentralZuEintrag({ id: 5, typ: 'spiel', titel: 'Y', sprachen: { de: ['audio', '<script>'], 'x"y': ['audio'] } }).sprachen, { de: ['audio'] });
});

test('Sprachen: Normierung, Anzeige, Filter (SQL und offline)', () => {
  assert.deepEqual(normSprachen('{"en":["menue","audio"],"de":["audio"]}'), { de: ['audio'], en: ['audio', 'menue'] });
  assert.equal(normSprachen('kaputt'), null);
  assert.equal(normSprachen({ de: [] }), null);
  assert.deepEqual(sprachListe({ ja: ['audio'], en: ['audio'], de: ['menue'], fr: ['audio'] }).map((s) => s.code), ['de', 'en', 'fr', 'ja']);
  assert.equal(deutschKurz({ de: ['audio', 'untertitel'] }), 'Deutsch: Sprachausgabe, Untertitel');
  assert.equal(deutschKurz({ en: ['audio'] }), 'Kein Deutsch (laut IGDB)');
  assert.equal(deutschKurz(null), null);
  assert.equal(sprachBedingung("de'; DROP TABLE x"), null, 'nur geprüfte Kürzel landen im SQL');
  assert.equal(sprachBedingung('de_audio', 'k.sprachen; x'), null);
  assert.match(sprachBedingung('de_text'), /'untertitel', 'menue'/);
  assert.equal(spracheTrifft({ de: ['menue'] }, 'de_audio'), false);
  assert.equal(spracheTrifft({ de: ['menue'] }, 'de_text'), true);
  assert.equal(spracheTrifft(null, 'de'), false);
  assert.equal(spracheTrifft(null, ''), true);
});

test('Sprachen am Katalogeintrag: gespeichert, auch bei von Hand bearbeiteten Einträgen aktualisiert, filterbar', async () => {
  const server = await starteTestServer();
  try {
    const { katalog } = server.kontext;
    const deutsch = katalog.speichere({ quelle: 'igdb', externe_id: 'game:901', typ: 'spiel', titel: 'Sprachtest Deutsch', plattformen: [], sprachen: { de: ['audio', 'menue'], en: ['audio'] } });
    assert.deepEqual(deutsch.sprachen, { de: ['audio', 'menue'], en: ['audio'] });
    const nurText = katalog.speichere({ quelle: 'igdb', externe_id: 'game:902', typ: 'spiel', titel: 'Sprachtest Texte', plattformen: [], sprachen: { de: ['untertitel'] } });
    katalog.speichere({ quelle: 'igdb', externe_id: 'game:903', typ: 'spiel', titel: 'Sprachtest Englisch', plattformen: [], sprachen: { en: ['audio'] } });

    // Von Hand bearbeitet: Titel bleibt, Sprachen kommen trotzdem aus IGDB
    server.db.prepare("UPDATE katalog SET manuell_bearbeitet = 1, titel = 'Eigener Titel' WHERE id = ?").run(nurText.id);
    const neu = katalog.speichere({ quelle: 'igdb', externe_id: 'game:902', typ: 'spiel', titel: 'IGDB-Titel', plattformen: [], sprachen: { de: ['untertitel', 'menue'] } });
    assert.equal(neu.titel, 'Eigener Titel');
    assert.deepEqual(neu.sprachen, { de: ['untertitel', 'menue'] });
    // Ohne Sprachangabe (z. B. ältere Suche) bleiben die bekannten erhalten
    assert.deepEqual(katalog.speichere({ quelle: 'igdb', externe_id: 'game:901', typ: 'spiel', titel: 'Sprachtest Deutsch', plattformen: [] }).sprachen.de, ['audio', 'menue']);

    const anna = await server.registriere('anna');
    const titel = async (pfad) => {
      const antwort = await anna.api(pfad);
      assert.equal(antwort.status, 200, antwort.text);
      return (antwort.json.eintraege ?? antwort.json).map((e) => e.titel).filter((t) => /Sprachtest|Eigener/.test(t)).sort();
    };
    assert.deepEqual(await titel('/api/katalog-liste?q=Sprachtest&sprache=de_audio&region=alle'), ['Sprachtest Deutsch']);
    assert.deepEqual(await titel('/api/katalog-liste?q=e&sprache=de_text&region=alle'), ['Eigener Titel', 'Sprachtest Deutsch']);
    assert.equal((await titel('/api/katalog-liste?q=Sprachtest&sprache=quatsch&region=alle')).length, 2, 'ungültiger Filter wird ignoriert');

    for (const k of [deutsch, nurText]) await anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', titel: k.titel, katalog_id: k.id } });
    assert.deepEqual(await titel('/api/artikel?sprache=de_audio'), ['Sprachtest Deutsch']);
    assert.deepEqual(await titel('/api/artikel?sprache=de'), ['Sprachtest Deutsch', 'Sprachtest Texte']);
    const liste = (await anna.api('/api/artikel')).json;
    assert.deepEqual(liste.find((a) => a.katalog_id === deutsch.id).katalog_sprachen.de, ['audio', 'menue']);
    const seite = (await anna.api(`/api/katalog-seite/${deutsch.id}`)).json;
    assert.deepEqual(seite.eintrag.sprachen.de, ['audio', 'menue']);
  } finally {
    await server.stoppe();
  }
});
