# Datenpakete

Stammdaten wie Figurenserien kommen als **Datenpaket** in die Datenbank, nicht als Migration. Jedes Paket wird beim
Start des Servers einmal eingespielt. Ändert sich die Datei, wird es erneut abgeglichen. Eingespielt wird nur, was
fehlt: Vorhandene Serien, Figuren und Farben bleiben unverändert, auch wenn die Community sie schon gepflegt hat.

## Neue Serie hinzufügen

1. Datei in diesem Ordner anlegen, z. B. `funko-pop-games.js` (Aufbau siehe unten).
2. In `index.js` importieren und in `DATENPAKETE` eintragen.
3. `npm test` laufen lassen, committen, pushen. Beim nächsten Start auf dem Server ist die Serie da.
4. Optional, nach dem Update auf dem Server: Paket wieder entfernen (Datei löschen, Zeile in `index.js` streichen).
   Die Daten bleiben in der Datenbank. Neue Installationen bekommen sie dann allerdings nicht mehr.

## Aufbau

```js
export default {
  name: 'funko-pop-games',          // eindeutig, nie ändern (daran merkt sich der Server, was eingespielt ist)
  serie: {                          // Hauptserie – wird angelegt, falls es sie noch nicht gibt
    name: 'Funko Pop! Games',
    hersteller: 'Funko',
    merch_kategorie: 'figur',
    mit_farben: false,              // true nur, wenn es Figuren in verschiedenen Farben gibt (z. B. Monster in my Pocket)
    liste: '',                      // Figuren direkt in der Hauptserie (meist leer, wenn es Unterserien gibt)
  },
  unterserien: [
    {
      name: 'Welle 1',
      jahr: 2017,
      nummer_praefix: '#',          // optional, z. B. 'W' bei „W12“
      nummer_von: 1, nummer_bis: 20, // optional – fehlende Nummern erscheinen als „noch nicht erfasst“
      nicht_erschienen: '7, 12-14', // optional – zählen nicht zum Fortschritt
      farben: ['Rot', { name: 'Grün', hex: '#33aa33' }], // nur bei mit_farben; Reihenfolge = Spalten der Liste
      liste: `
1; Mario
2; Link`,
    },
  ],
};
```

**Liste:** je Zeile `Nr; Name; Farben`. Die Farben stehen in der Reihenfolge von `farben`, durch Leerzeichen getrennt:
`x` = gab es, `-` = gab es nicht, `?` = unbekannt (die Community ergänzt es später). Zeilen ohne Namen oder mit dem
Namen `?` werden übersprungen.

**Nur Fakten** (Nummer, Name, Farbe) übernehmen, keine fremden Beschreibungstexte oder Bilder. Offensichtliche
Tippfehler korrigieren, Unsicheres lieber weglassen und über die Community ergänzen lassen.

Das erste Paket (Monster in my Pocket, 267 Figuren) liegt in der Git-Historie: Commit `7d3cf77`, Datei
`server/stammdaten/mimp.js`.
