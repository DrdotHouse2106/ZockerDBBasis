// Erinnerung an fehlende Zustandsbewertungen: höchstens wöchentlich, nur wenn es mehr geworden sind; Filter „Zustand fehlt“.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starteTestServer } from './hilfen.js';

test('Fehlende Zustandsbewertungen: wöchentliche Erinnerung und Filter', async () => {
  const server = await starteTestServer();
  try {
    const anna = await server.registriere('anna');
    const neu = (daten) => anna.api('/api/artikel', { methode: 'POST', daten: { typ: 'spiel', plattform: 'PlayStation 2', ...daten } });
    await neu({ titel: 'Ohne alles' });
    await neu({ titel: 'Nur Disc bewertet', zustand: 'gut', vollstaendigkeit: 'cib' });
    await neu({ titel: 'Lose, Disc bewertet', zustand: 'gut', vollstaendigkeit: 'nur_geraet' });
    await neu({ titel: 'Komplett bewertet', zustand: 'gut', zustand_ovp: 'sehr_gut', vollstaendigkeit: 'cib' });

    const filter = (await anna.api('/api/artikel?zustand_fehlt=1')).json.map((a) => a.titel).sort();
    assert.deepEqual(filter, ['Nur Disc bewertet', 'Ohne alles']);

    const { zustandserinnerung, db } = server.kontext;
    const jetzt = Date.now();
    assert.equal(zustandserinnerung.erinnere({ jetzt }), 1);
    const meldung = (await anna.api('/api/benachrichtigungen')).json.eintraege.find((m) => /ohne Zustandsbewertung/.test(m.titel));
    assert.equal(meldung.titel, '2 Exemplare ohne Zustandsbewertung');
    assert.equal(meldung.link, '#/?einzeln=1&zustand_fehlt=1');
    // Innerhalb einer Woche nicht noch einmal – auch nicht, wenn neue dazukommen
    await neu({ titel: 'Noch eins' });
    assert.equal(zustandserinnerung.erinnere({ jetzt: jetzt + 60_000 }), 0);
    // Nach einer Woche mit mehr fehlenden: ja; gleich viele: nein
    assert.equal(zustandserinnerung.erinnere({ jetzt: jetzt + 8 * 86_400_000 }), 1);
    assert.equal(zustandserinnerung.erinnere({ jetzt: jetzt + 16 * 86_400_000 }), 0);

    // „Zustand Hülle/OVP“ ausgeblendet → nur der Datenträger zählt
    db.prepare('UPDATE benutzer SET ausgeblendete_felder = ? WHERE benutzername = ?').run(JSON.stringify(['zustand_ovp']), 'anna');
    assert.equal(zustandserinnerung.fehlend(db.prepare("SELECT id FROM benutzer WHERE benutzername = 'anna'").pluck().get(), false), 2);
  } finally {
    await server.stoppe();
  }
});
