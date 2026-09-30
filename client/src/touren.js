// Inhalte der geführten Touren (Ablauf siehe tour.jsx).
// Schritt: { id, route?, ziel? (data-tour-Name), titel, text (Text oder Absätze), klick? (auf Tipp warten), vorher?, sichtbar?, ende? }
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
const beispielSeite = (k) => (k.beispielId ? `/artikel/${k.beispielId}` : '/');

export const TOUREN = [
  {
    id: 'erste-schritte',
    titel: 'Erste Schritte',
    beschreibung: 'Sammlung durchsuchen, Spiele hinzufügen und scannen, Einträge pflegen, Katalog und Kalender – in etwa drei Minuten.',
    schritte: [
      {
        id: 'willkommen', route: '/', titel: `Willkommen bei ${MARKE.name}! 👋`,
        text: ['In ein paar Schritten zeigen wir dir, wie du deine Sammlung anlegst und pflegst. Die markierten Stellen zeigen dir, wo du tippen musst.',
          'Mit „Weiter“ geht es voran, mit ✕ oder Esc kannst du jederzeit aufhören.'],
      },
      { id: 'suche', route: '/', ziel: 'sammlung-suche', titel: 'Deine Sammlung durchsuchen', text: 'Hier findest du alles wieder – nach Titel, Plattform, Farbe oder Edition.' },
      {
        id: 'typen', route: '/', ziel: 'sammlung-typen', titel: 'Schnell filtern',
        text: 'Nur Spiele, Konsolen oder Zubehör zeigen – oder was du verkauft, verliehen oder digital (z. B. aus Steam) hast.',
      },
      { id: 'filter', route: '/', ziel: 'sammlung-filter', titel: 'Mehr Filter und Sortierung', text: 'Region, Zustand, Vollständigkeit (CIB), Spielstatus, Sortierung nach Preis oder Datum …' },
      { id: 'hinzufuegen', route: '/', ziel: 'nav-plus', klick: true, titel: 'Etwas hinzufügen', text: 'Über „Hinzufügen“ kommt Neues in deine Sammlung. Tippe drauf!' },
      { id: 'art', route: '/neu', ziel: 'neu-typ', titel: 'Was möchtest du erfassen?', text: 'Wähle zuerst: Spiel, Konsole oder Zubehör.' },
      {
        id: 'titelsuche', route: '/neu', ziel: 'neu-suche', titel: 'Titel suchen',
        text: ['Tippe den Namen ein – gesucht wird im Katalog und in der großen Spieldatenbank IGDB, mit Cover und Erscheinungsjahr.',
          'Tippe auf einen Treffer, dann wählst du Plattform, Zustand, Region und Kaufpreis.'],
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
      { id: 'spielstatus', sichtbar: mitBeispiel, route: beispielSeite, ziel: 'artikel-spielstatus', titel: 'Spielstatus', text: 'Ungespielt, am Spielen, durchgespielt oder abgebrochen – mit einem Tipp gesetzt. Probier es ruhig aus.' },
      {
        id: 'aktionen', sichtbar: mitBeispiel, route: beispielSeite, ziel: 'artikel-aktionen', titel: 'Weitere Aktionen',
        text: 'Ein weiteres Exemplar oder eine Variante anlegen, verleihen, als verkauft markieren, ein eigenes Foto hochladen oder löschen.',
      },
      { id: 'bearbeiten', sichtbar: mitBeispiel, route: beispielSeite, ziel: 'artikel-bearbeiten', titel: 'Bearbeiten', text: 'Mit dem Stift änderst du alle Angaben – Zustand, Vollständigkeit, Kaufpreis, Notizen und mehr.' },
      { id: 'angaben', sichtbar: mitBeispiel, route: beispielSeite, ziel: 'artikel-angaben', titel: 'Alle Angaben auf einen Blick', text: 'Zustand, Region, Kaufpreis, Barcode … Was du nicht ausfüllst, bleibt einfach weg.' },
      {
        id: 'fotos', sichtbar: mitBeispiel, route: beispielSeite, ziel: 'fotos', titel: 'Fotos: So sieht es aus 📷',
        text: (k) => ['Fotografiere Modul oder Disc, die Verpackung vorne und hinten und alles zusammen – die Checkliste zeigt, was noch fehlt.',
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
        text: 'Stöbere in allen Spielen, Konsolen und Zubehör nach Plattform – auch in dem, was du (noch) nicht besitzt.',
      },
      {
        id: 'kalender', route: '/kalender', ziel: 'kalender-auswahl', titel: 'Erscheint demnächst',
        text: '„Highlights“ zeigt die gefragtesten neuen Spiele für deine Systeme, „Alle Titel“ den ganzen Kalender.',
      },
      { id: 'glocke', route: '/', ziel: 'glocke', titel: 'Benachrichtigungen', text: 'Hier erfährst du, was es Neues gibt – z. B. Antworten auf deine Vorschläge.' },
      { id: 'mehr', route: '/', ziel: 'nav-einstellungen', klick: true, titel: 'Alles Weitere unter „Mehr“', text: 'Tippe auf „Mehr“.' },
      {
        id: 'mehr-liste', route: '/einstellungen', ziel: 'mehr-liste', titel: 'Mehr',
        text: 'Konto & Sicherheit (Zwei-Faktor-Anmeldung), Leihliste, Statistik, Konvolute, Import aus CLZ oder Excel, Datensicherung …',
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
    id: 'administration',
    titel: 'Administration',
    beschreibung: 'Benutzer und Rollen, Einstellungen, Rechtstexte und Sicherungen – für Administratoren.',
    fuer: ({ benutzer }) => benutzer?.rolle === 'admin',
    schritte: [
      { id: 'uebersicht', route: '/admin', ziel: 'admin-reiter', titel: 'Die Administration', text: 'Alle Bereiche als Reiter. Die Übersicht zeigt Kennzahlen, Speicher und anstehende Updates.' },
      {
        id: 'benutzer', route: '/admin?reiter=benutzer', ziel: 'admin-reiter-benutzer', titel: 'Benutzer & Rollen',
        text: ['Konten anlegen, Einladungslinks erstellen, sperren oder löschen und Rollen vergeben: Moderatoren prüfen Einreichungen und Meldungen, Administratoren dürfen alles.',
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
