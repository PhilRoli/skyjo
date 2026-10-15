export interface ReleaseNote {
  version: string;
  title: string;
  items: string[];
}

/** Newest first. Shown in the app when clicking the version. */
export const RELEASE_NOTES: ReleaseNote[] = [
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
