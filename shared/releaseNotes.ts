export interface ReleaseNote {
  version: string;
  title: string;
  items: string[];
}

/** Newest first. Shown in the app when clicking the version. */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.6.5',
    title: 'Chat-Fix',
    items: [
      'Der Chat lässt sich auf dem Handy wieder schließen.',
      'Besucherzählung mit Plausible, ohne Cookies und ohne personenbezogene Daten.',
    ],
  },
  {
    version: '1.6.4',
    title: 'Aufgeräumt',
    items: [
      'Der Verlaufsgraph am Rundenende ist entfernt, die App lädt dadurch noch schneller.',
      'Link zum Quellcode auf GitHub bei den Neuigkeiten.',
    ],
  },
  {
    version: '1.6.3',
    title: 'Schneller laden',
    items: [
      'Die App lädt deutlich schneller, besonders auf dem Handy.',
      'Kleine Verbesserungen bei Barrierefreiheit und Suchmaschinen.',
    ],
  },
  {
    version: '1.6.2',
    title: 'Anstupsen und Anmeldungen',
    items: [
      'Wer angestupst wird, bekommt einen blau leuchtenden Rand um den Bildschirm.',
      'Nach einem Anstupsen ist der Button für alle im Raum 10 Sekunden gesperrt.',
      'Alle Buttons und Icons haben einen Tooltip.',
      'Bei der Revanche wird die Sitzordnung neu gemischt.',
      'Die Zahl der angemeldeten Zuschauer sehen alle, im Hover sind sie mit Haken markiert.',
    ],
  },
  {
    version: '1.6.1',
    title: 'Host-Markierung',
    items: ['Der Host ist am Tisch mit einem Stern markiert.', 'Ein Hover über das Zuschauer-Symbol zeigt deren Namen.'],
  },
  {
    version: '1.6.0',
    title: 'Chat und Anmeldung',
    items: [
      'Chat im Raum für Spieler und Zuschauer, mit Verlauf für neu Beigetretene.',
      'Zuschauer können sich jederzeit für die Revanche anmelden, nicht erst nach Spielende.',
    ],
  },
  {
    version: '1.5.1',
    title: 'Zudrehen nur einmal bestätigen',
    items: ['Nur wer als Erstes die letzte Karte aufdeckt, muss bestätigen. In der letzten Runde entfällt die Rückfrage.'],
  },
  {
    version: '1.5.0',
    title: 'Letzte Runde',
    items: [
      'Wer die letzte verdeckte Karte aufdecken und damit zudrehen will, muss das bestätigen.',
      'In der letzten Runde pulsiert ein roter Rand um den Bildschirm, die Anzeige oben ist rot.',
    ],
  },
  {
    version: '1.4.0',
    title: 'Rundenverlauf',
    items: [
      'Am Rundenende zeigt ein Graph den eigenen Punkteverlauf mit dem noch möglichen Maximum und Minimum (je nach Karten, die noch nicht zu sehen waren).',
      'Das Scoreboard ist immer nach Punkten sortiert (wenigste zuerst).',
      'Verlassen ist jetzt ein Icon oben links.',
      'Der zuletzt verwendete Name wird gemerkt.',
    ],
  },
  {
    version: '1.3.1',
    title: 'Raum verlassen',
    items: ['Im laufenden Spiel kann man den Raum jetzt verlassen.'],
  },
  {
    version: '1.3.0',
    title: 'Zuschauer und Bots',
    items: [
      'Zuschauer: Wer einem laufenden Spiel beitritt, schaut zu. Nach Spielende kann man „Mitspielen" anfragen und rückt bei der Revanche nach.',
      'Bots: Der Host fügt im Warteraum Bots hinzu (Leicht, Normal, Stark). Der starke Bot zählt Karten.',
    ],
  },
  {
    version: '1.2.0',
    title: 'Komfort und Einstellungen',
    items: [
      'Zielpunktzahl wählbar (50, 100 oder 150).',
      'Anstupsen, wenn jemand beim Zug trödelt.',
      'Als App installierbar, der Bildschirm bleibt im Spiel an.',
      'Animationen beim Aufdecken und Tauschen, abschaltbar.',
      'Neues Favicon und App-Icon mit transparentem Hintergrund.',
      'Anzeige „Aktuell" für die Punkte der laufenden Runde.',
    ],
  },
  {
    version: '1.1.0',
    title: 'Mehr Überblick',
    items: [
      'Live-Wertung der Runde pro Spieler.',
      'Regeln als Dialog, Zeile mit der letzten Aktion, Tab-Titel bei eigenem Zug.',
      'Entfernte Spalten pulsieren kurz auf.',
      'Mobiles Layout mit Auto-Scroll, Versionsanzeige.',
      'Räume werden gespeichert: Spiele überleben Updates.',
    ],
  },
  {
    version: '1.0.0',
    title: 'Erste Version',
    items: ['Skyjo online für 2 bis 8 Spieler mit Raumcode.'],
  },
];
