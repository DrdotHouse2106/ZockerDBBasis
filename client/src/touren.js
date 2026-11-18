// Inhalte der geführten Touren (Ablauf siehe tour.jsx).
// Schritt: { id, route?, ziel? (data-tour-Name), titel, text (Text oder Absätze), klick? (auf Tipp warten),
//           bedienbar? (markiertes Element darf ausprobiert werden), vorher?, sichtbar?, ende? }
// route, ziel, titel und text dürfen Funktionen sein – sie bekommen Sitzung und Tour-Kontext (z. B. beispielId).
import { api } from './api.js';
import { MARKE } from '../../shared/marke.js';

const BEISPIEL = {
  typ: 'spiel', titel: 'Super Mario World (Beispiel)', plattform: 'Super Nintendo', zustand: 'gut', vollstaendigkeit: 'cib', region: 'pal_de',
  kaufpreis: 25, notizen: 'Beispieleintrag aus der Tour „Erste Schritte“ – du kannst ihn jederzeit löschen.',
};

/** Beispielspiel anlegen (einmal je Tour); klappt das nicht (z. B. offline), fallen die Schritte dazu weg. */
async function beispielAnlegen(k) {
  if (k.beispielId || k.beispielFehler) return null;
  const a = await api.artikelAnlegen(BEISPIEL, { beschreibung: 'Beispiel aus der Tour' });
  if (!Number.isInteger(a?.id)) return { beispielFehler: true };
  return { beispielId: a.id };
}
const mitBeispiel = (k) => !k.beispielFehler;
const beispielSeite = (k) => (k.beispielId ? `/artikel/${k.beispielId}` : '/sammlung');

/** Figurenserien-Tour: Monster in my Pocket (oder die erste Serie mit Unterserien) und eine Unterserie mit Farben als Beispiel. */
async function serieFuerTour(k) {
  if (k.tourHauptserie !== undefined) return null;
  const liste = await api.serien();
  const haupt = liste.find((x) => x.name === 'Monster in my Pocket') ?? liste.find((x) => x.kinder.length > 0) ?? null;
  const unter = haupt?.kinder.find((x) => x.mit_farben) ?? haupt?.kinder[0] ?? null;
  return { tourHauptserie: haupt?.id ?? null, tourSerie: unter?.id ?? null };
}

export const TOUREN = [
  {
    id: 'erste-schritte',
    titel: 'Erste Schritte',
    beschreibung: 'Sammlung durchsuchen, Spiele hinzufügen und scannen, Einträge pflegen, Katalog und Kalender – in etwa drei Minuten.',
    schritte: [
      {
        id: 'willkommen', route: '/sammlung', titel: `Willkommen bei ${MARKE.name}! 👋`,
        text: ['In ein paar Schritten zeigen wir dir, wie du deine Sammlung anlegst und pflegst. Die markierten Stellen zeigen dir, wo du tippen musst.',
          'Mit „Weiter“ geht es voran, mit ✕ oder Esc kannst du jederzeit aufhören.'],
      },
      { id: 'suche', route: '/sammlung', ziel: 'sammlung-suche', titel: 'Deine Sammlung durchsuchen', text: 'Hier findest du alles wieder – nach Titel, Plattform, Farbe oder Edition. Die Wörter dürfen in beliebiger Reihenfolge stehen, kleine Tippfehler verzeiht die Suche („Zelad Ocarnia“).' },
      {
        id: 'typen', route: '/sammlung', ziel: 'sammlung-typen', titel: 'Schnell filtern',
        text: 'Nur Spiele, Konsolen, Zubehör oder Merch zeigen – oder was du verkauft, verliehen oder digital (z. B. aus Steam) hast.',
      },
      { id: 'filter', route: '/sammlung', ziel: 'sammlung-filter', titel: 'Mehr Filter und Sortierung', text: 'Region, Zustand, Vollständigkeit (CIB), Spielstatus, „Nur ohne Katalogeintrag“ (Exemplare ohne Katalogtreffer, z. B. nach einem Import – „Automatisch zuordnen“ erledigt die eindeutigen, „Einzeln zuordnen“ zeigt Vorschläge für den Rest), Sortierung nach Preis oder Datum …' },
      { id: 'hinzufuegen', route: '/sammlung', ziel: 'nav-plus', klick: true, titel: 'Etwas hinzufügen', text: 'Über „Hinzufügen“ kommt Neues in deine Sammlung. Tippe drauf!' },
      { id: 'art', route: '/neu', ziel: 'neu-typ', titel: 'Was möchtest du erfassen?', text: ['Wähle zuerst: Spiel, Konsole, Zubehör oder Merch.', 'Merch sind Figuren, Funko Pops, Amiibo, Bücher, Soundtracks und andere Sammlerstücke – ohne Plattform, aber mit Kategorie und Verpackung (OVP ungeöffnet, geöffnet oder lose).'] },
      {
        id: 'titelsuche', route: '/neu', ziel: 'neu-suche', titel: 'Titel suchen',
        text: ['Tippe den Namen ein – gesucht wird im Katalog und in der großen Spieldatenbank IGDB, mit Cover und Erscheinungsjahr. Auch die Produktnummer vom Rücken (z. B. BLES-00909) geht, sobald sie bei einer Fassung hinterlegt ist.',
          'Tippe auf einen Treffer, dann wählst du Plattform, Fassung (z. B. Platinum oder Essentials), Zustand, Region und Kaufpreis.',
          'Unsicher bei der Region? „ⓘ Woran erkenne ich die Region?“ am Feld erklärt die Merkmale (USK-Logo = PAL-DE); aus einer Nintendo-Produktnummer wie „SNSP-MW-NOE“ wird sie vorgeschlagen.'],
      },
      {
        id: 'scannen', route: '/neu', ziel: 'neu-scan', titel: 'Am schnellsten: Barcode scannen 📷',
        text: ['Halte die Kamera auf den Strichcode auf der Rückseite der Hülle – das Spiel wird erkannt, Plattform inklusive.',
          'Einen neuen Barcode ordnest du einmal zu – danach erkennen ihn alle Sammler sofort.'],
      },
      {
        id: 'eigener', route: '/neu', ziel: 'neu-eigen', titel: 'Nicht gefunden?',
        text: 'Lege einen eigenen Eintrag an (ideal für Sondermodelle und Zubehör) oder schlage den Titel für den gemeinsamen Katalog vor.',
      },
      {
        id: 'beispiel', vorher: beispielAnlegen, sichtbar: mitBeispiel, route: beispielSeite, ziel: 'artikel-kopf', titel: 'So sieht ein Eintrag aus',
        text: ['Damit du alles ausprobieren kannst, haben wir ein Beispiel angelegt: Super Mario World fürs Super Nintendo.',
          'Am Ende der Tour kannst du es mit einem Tipp wieder löschen.'],
      },
      { id: 'spielstatus', sichtbar: mitBeispiel, route: beispielSeite, ziel: 'artikel-spielstatus', bedienbar: true, titel: 'Spielstatus', text: 'Ungespielt, am Spielen, durchgespielt oder abgebrochen – mit einem Tipp gesetzt. Probier es ruhig aus.' },
      {
        id: 'aktionen', sichtbar: mitBeispiel, route: beispielSeite, ziel: 'artikel-aktionen', titel: 'Weitere Aktionen',
        text: 'Ein weiteres Exemplar oder eine Variante anlegen, einen anderen Katalogeintrag wählen, verleihen, als verkauft markieren, ein eigenes Foto hochladen (vorher zuschneiden – z. B. nur das deutsche Cover aus einem Foto der Hülle) oder löschen.',
      },
      { id: 'bearbeiten', sichtbar: mitBeispiel, route: beispielSeite, ziel: 'artikel-bearbeiten', titel: 'Bearbeiten', text: 'Mit dem Stift änderst du alle Angaben – Zustand, Vollständigkeit, Kaufpreis, Notizen und mehr.' },
      { id: 'angaben', sichtbar: mitBeispiel, route: beispielSeite, ziel: 'artikel-angaben', titel: 'Alle Angaben auf einen Blick', text: 'Zustand, Region, Kaufpreis, Barcode … Was du nicht ausfüllst, bleibt einfach weg.' },
      {
        id: 'fotos', sichtbar: mitBeispiel, route: beispielSeite, ziel: 'fotos', titel: 'Fotos: So sieht es aus 📷',
        text: (k) => ['Fotografiere Modul oder Disc, die Verpackung vorne und hinten und alles zusammen – die Checkliste zeigt, was noch fehlt. Jedes Foto gehört zur Plattform und Fassung deines Exemplars (PS4-Fotos zählen nicht für die PS5-Fassung, ein Platinum-Foto wird nicht zum Cover der Erstauflage).',
          k.status?.fotosTeilenErlaubt
            ? 'Teilst du deine Fotos, sehen andere Sammler, wie das Spiel wirklich aussieht. Das Moderationsteam prüft sie vorher.'
            : 'So ist deine Sammlung auch fürs Archiv oder die Versicherung dokumentiert.'],
      },
      {
        id: 'mehr-details', sichtbar: mitBeispiel, route: beispielSeite, ziel: 'artikel-mehr', titel: 'Kommentare, Handbücher, Scans',
        text: 'Seltener Gebrauchtes ist eingeklappt: Kommentare anderer Sammler, Links zu Handbüchern und deine eigenen Scans.',
      },
      {
        id: 'katalog', route: '/katalog', ziel: 'katalog-suche', titel: 'Der Katalog',
        text: ['Stöbere in allen Spielen, Konsolen und Zubehör nach Plattform – auch in dem, was du (noch) nicht besitzt.',
          'Mit dem Filter „Jugendschutz“ findest du indizierte, beschlagnahmte und vom Index gestrichene Spiele – auf der Spieleseite steht das als Hinweis mit Jahr.',
          'Cover nach Region: Gibt es ein Spiel mit unterschiedlichen Covern (z. B. PAL-DE, PAL-EU, NTSC-U, NTSC-J), schaltest du unter dem Cover der Spieleseite um. Deine Exemplare zeigen automatisch das Cover ihrer Region bzw. Ausgabe – ein eigenes Foto oder eigenes Cover geht immer vor.'],
      },
      {
        id: 'lieferumfang', route: '/katalog', titel: 'Sonderausgaben: Lieferumfang',
        text: ['Bei einer Ausgabe (z. B. „Special Edition“) steht auf der Spieleseite der Lieferumfang – etwa „Steelbook, Artbook, Schuber, 2 Discs, DLC-Code“. Fehlt er, kannst du ihn vorschlagen, auf Wunsch mit einem Foto der Beilagen; das Moderationsteam bestätigt.',
          'Wählst du beim Hinzufügen diese Ausgabe, zeigt die Beilagen-Checkliste genau diese Punkte. „Vollständig (CIB)“ gilt dann nur, wenn alles dabei ist – sonst steht dort z. B. „Unvollständig – Artbook fehlt“.',
          'Fehlt deine Ausgabe im Katalog, trag sie am Exemplar unter „Edition / Variante“ ein und hak „als Variante dieses Spiels anlegen“ an – nur für dich oder zur Aufnahme eingereicht.'],
      },
      {
        id: 'kalender', route: '/kalender', ziel: 'kalender-auswahl', titel: 'Erscheint demnächst',
        text: '„Highlights“ zeigt die gefragtesten neuen Spiele für deine Systeme, „Alle Titel“ den ganzen Kalender.',
      },
      { id: 'glocke', route: '/sammlung', ziel: 'glocke', titel: 'Benachrichtigungen', text: 'Hier erfährst du, was es Neues gibt – z. B. Antworten auf deine Vorschläge.' },
      { id: 'mehr', route: '/sammlung', ziel: 'nav-einstellungen', klick: true, titel: 'Alles Weitere unter „Mehr“', text: 'Tippe auf „Mehr“.' },
      {
        id: 'mehr-liste', route: '/einstellungen', ziel: 'mehr-liste', titel: 'Mehr',
        text: 'Konto & Sicherheit (Avatar mit Symbol, Farbe oder eigenem Bild, Zwei-Faktor-Anmeldung), Leihliste, Figurenserien (z. B. Monster in my Pocket – mit eigener Tour), Freistellungen prüfen (Fotos ohne Hintergrund vergleichen und übernehmen), Statistik, Konvolute, Import aus CLZ Games (noch experimentell – Ergebnis prüfen; mit Umzugsanleitung und Link zu den Spielen ohne Katalogtreffer), Excel oder der Steam-Bibliothek, Datensicherung, Ideen & Fehler melden … Dein Avatar oben rechts führt direkt zum Konto.',
      },
      { id: 'touren', route: '/einstellungen', ziel: 'mehr-touren', titel: 'Hilfe & Touren', text: 'Hier kannst du jede Tour jederzeit erneut starten.' },
      {
        id: 'ende', ende: true, titel: 'Geschafft! 🎉',
        text: (k) => [
          'Jetzt bist du dran: Füge dein erstes Spiel hinzu – am schnellsten per Barcode-Scan.',
          k.beispielId ? 'Soll das Beispiel „Super Mario World“ wieder aus deiner Sammlung verschwinden?' : null,
        ],
      },
    ],
  },
  {
    id: 'figurenserien',
    titel: 'Figurenserien',
    beschreibung: 'Serien wie Monster in my Pocket oder Funko Pop!: sehen, was dir fehlt, Figuren abhaken, Farben und fehlende Figuren ergänzen.',
    schritte: [
      {
        id: 'uebersicht', vorher: serieFuerTour, route: '/serien', ziel: 'serien-liste', titel: 'Deine Figurenserien 🧸',
        text: ['Jede Serie mit ihren Unterserien und deinem Fortschritt – etwa „32 von 48 Figuren · 95 von 210 Farben“.',
          'Mit ☆ folgst du einer Serie: Sie steht dann oben bei „Meine Serien“ – genau wie Serien, aus denen du schon Figuren hast. Alle anderen findest du eingeklappt unter „Weitere Serien“.',
          'Gezählt wird nur, was es wirklich gab: nie erschienene Nummern und Farben, in denen eine Figur nicht herauskam, zählen nicht mit.'],
      },
      {
        id: 'unterserien', sichtbar: (k) => Boolean(k.tourHauptserie), route: (k) => `/serien/${k.tourHauptserie}`, ziel: 'serie-unterserien', titel: 'Unterserien',
        text: 'Eine Serie besteht aus Unterserien (z. B. Serie 1 bis 7 und Monster Wrestlers), jede mit Nummernbereich, Hersteller und Jahr.',
      },
      {
        id: 'kopf', sichtbar: (k) => Boolean(k.tourSerie), route: (k) => `/serien/${k.tourSerie}`, ziel: 'serie-kopf', titel: 'Eine Unterserie',
        text: ['Oben siehst du Nummernbereich, nie erschienene Nummern und deinen Fortschritt.',
          '„In meiner Sammlung“ zeigt deine Figuren dieser Serie in der Sammlungsliste – dort kannst du auch nach Serie filtern.',
          'Gibt es ein Spiel zur Serie (z. B. Monster in My Pocket auf dem NES), steht es unter „Zum Spiel“ – und auf der Spieleseite umgekehrt die Figurenserie.',
          'Fotos der Figuren: Gibt es Fotos einzelner Farben, schaltest du unter dem Bild um. Besitzt du eine Figur, trägst du über 📷 ein eigenes Foto bei („Foto: Figur“, mit Farbe) – es wird nach der Prüfung auch das Bild deines Exemplars in dieser Farbe.'],
      },
      {
        id: 'modus', sichtbar: (k) => Boolean(k.tourSerie), route: (k) => `/serien/${k.tourSerie}`, ziel: 'serien-modus', titel: 'Ansehen, Sammeln, Pflegen',
        text: ['Die Seite startet in „Ansehen“: Antippen ändert nichts – so landet beim Scrollen nichts aus Versehen in deiner Sammlung.',
          'Schalte „Sammeln“ ein, um Figuren abzuhaken: Ein Tipp auf einen Farbpunkt (bzw. „+ In die Sammlung“ bei Serien ohne Farben) übernimmt die Figur. Hast du dich vertippt, hilft „Rückgängig“ im Hinweis. Mit „Farben pflegen / vorschlagen“ markierst du fehlende oder falsche Farben – nochmal tippen nimmt eine Markierung zurück, erst „Speichern“ übernimmt sie.'],
      },
      {
        id: 'punkte', sichtbar: (k) => Boolean(k.tourSerie), route: (k) => `/serien/${k.tourSerie}`, ziel: 'figuren-filter', titel: 'Farbpunkte und Filter',
        text: ['Jede Figur ist eine Karte mit Punkten in den Farben, in denen es sie gab: gefüllter Punkt mit ✓ = hast du, heller Ring = fehlt dir, ? = vorgeschlagen.',
          'Filtere nach „Fehlt mir“ oder „Habe ich“ und nach einer Farbe – z. B. „Was fehlt mir in Neongrün?“. Die Farbchips sind zugleich die Legende.'],
      },
      {
        id: 'anlegen', sichtbar: (k) => Boolean(k.tourSerie), route: (k) => `/serien/${k.tourSerie}`, ziel: 'figur-anlegen', titel: 'Fehlt eine Figur?',
        text: ['Gestrichelte Karten sind Nummern, die noch niemand erfasst hat – mit „+ anlegen“ trägst du die Figur ein. Figuren ohne Nummer ergänzt du unten mit „+ Figur ohne Nummer im Bereich“.',
          'Ergänzungen in einer freigegebenen Serie zählen sofort für dich – für alle erst, wenn sie geprüft sind.'],
      },
      {
        id: 'eigene', route: '/serien', ziel: 'serie-neu', titel: 'Eigene Serie anlegen',
        text: ['Deine Serie fehlt? Lege sie an – sie ist zuerst nur für dich sichtbar. Unter „Angaben bearbeiten“ ergänzt du Unterserien, Nummernbereich und ob es die Figuren in verschiedenen Farben gibt (bei Funko Pop! z. B. nicht).',
          'Mit „Zur Freigabe einreichen“ kann die Serie nach der Prüfung für alle sichtbar werden.'],
      },
      { id: 'ende', ende: true, titel: 'Viel Spaß beim Sammeln! 🎉', text: 'Die Tour findest du jederzeit unter „Mehr → Hilfe & Touren“.' },
    ],
  },
  {
    id: 'administration',
    titel: 'Administration',
    beschreibung: 'Benutzer und Rollen, Einstellungen, Rechtstexte und Sicherungen – für Administratoren.',
    fuer: ({ benutzer }) => benutzer?.rolle === 'admin',
    schritte: [
      { id: 'uebersicht', route: '/admin', ziel: 'admin-reiter', titel: 'Die Administration', text: 'Alle Bereiche als Reiter. Die Übersicht zeigt Kennzahlen, Speicher, anstehende Updates und die Warteschlange „Fotos freistellen“ (Helfer-Handys entfernen den Hintergrund von Figuren- und Gerätefotos).' },
      {
        id: 'freistellen-pruefen', route: '/freistellen-pruefen', ziel: 'freistellen-pruefen', titel: 'Freistellungen prüfen',
        text: 'Alle freigestellten Fotos, die auf eine Entscheidung warten, auf einer Seite: links das Original, rechts ohne Hintergrund. „Übernehmen“ zeigt die freigestellte Version, „Original behalten“ verwirft sie. Du siehst deine eigenen und die geteilten Fotos anderer – ist alles erledigt, steht hier „Alles erledigt“.',
      },
      {
        id: 'freistellen-uebernommen', route: '/freistellen-pruefen?ansicht=uebernommen', ziel: 'freistellen-uebernommen', titel: 'Freistellung zurücknehmen',
        text: 'Unter „Übernommen“ stehen alle Fotos, die gerade ohne Hintergrund gezeigt werden. Auswählen (oder „Alle auswählen“, z. B. nur Merch) und „Original wiederherstellen“ – dann erscheint wieder das Foto mit Hintergrund.',
      },
      {
        id: 'benutzer', route: '/admin?reiter=benutzer', ziel: 'admin-reiter-benutzer', titel: 'Benutzer & Rollen',
        text: ['Konten anlegen, Einladungslinks erstellen, sperren oder löschen und Rollen vergeben: Moderatoren prüfen Einreichungen und Meldungen, Administratoren dürfen alles. „Darf beim Freistellen helfen“ schaltet das Handy eines Benutzers als Helfer-Gerät frei.',
          'Wer eine neue Rolle bekommt, wird benachrichtigt – Moderatoren bekommen ihre eigene Tour angeboten.'],
      },
      {
        id: 'einstellungen', route: '/admin?reiter=einstellungen', ziel: 'admin-reiter-einstellungen', titel: 'Einstellungen',
        text: 'Registrierung, E-Mail-Versand, Spamschutz, IGDB-Zugang und mehr – haben Vorrang vor der .env und wirken sofort. API-Schlüssel werden verschlüsselt gespeichert und nie wieder vollständig angezeigt.',
      },
      { id: 'rechtliches', route: '/admin?reiter=rechtliches', ziel: 'admin-reiter-rechtliches', titel: 'Rechtliches', text: 'Impressum, Datenschutzerklärung und Nutzungsbedingungen – mit Vorlagen zum Anpassen.' },
      {
        id: 'sicherungen', route: '/admin?reiter=sicherungen', ziel: 'admin-reiter-sicherungen', titel: 'Sicherungen',
        text: 'Die Datenbank wird automatisch täglich gesichert (aufbewahrt: Tage und Monate), „Jetzt sichern“ erstellt sofort eine. Fotos und Scans im Upload-Ordner bitte zusätzlich sichern.',
      },
      { id: 'ende', ende: true, titel: 'Alles im Griff 👍', text: 'Tipp: Unter „Mehr“ siehst du als Admin zusätzlich den Serverstatus (Online-Suche, Barcode-Datenbanken, Kamera).' },
    ],
  },
];
