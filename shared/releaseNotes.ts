export type Localized<T> = { de: T; en: T };

export interface ReleaseNote {
  version: string;
  title: Localized<string>;
  items: Localized<string[]>;
}

/** Newest first. Shown in the app when clicking the version. Every entry needs German and English. */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.8.0',
    title: { de: 'Neuer Bot: Extrem', en: 'New bot: Extreme' },
    items: {
      de: [
        'Neue Bot-Stufe Extrem: ein neuronales Netz, trainiert in vielen Partien gegen sich selbst und die anderen Bots.',
        'Extrem sieht wie alle Bots nur, was auch du siehst.',
        'Leicht ist jetzt besser als reiner Zufall: spielt wie Normal, macht aber oft Fehler.',
      ],
      en: [
        'New bot level Extreme: a neural network trained in many games against itself and the other bots.',
        'Like every bot, Extreme only sees what you can see.',
        'Easy is now better than pure chance: it plays like Normal but often makes mistakes.',
      ],
    },
  },
  {
    version: '1.7.0',
    title: { de: 'Jetzt auch auf Englisch', en: 'Now in English too' },
    items: {
      de: [
        'Skyjo gibt es jetzt auf Deutsch und Englisch. Jede Person wählt die Sprache für sich, unten links im Bildschirm.',
        'Die Sprache wird beim ersten Besuch aus dem Browser erkannt (Deutsch bei deutschem Browser, sonst Englisch) und gemerkt.',
        'Alles ist übersetzt: Spiel, Regeln, Fehlermeldungen und diese Neuigkeiten.',
      ],
      en: [
        'Skyjo is now available in German and English. Everyone picks their own language at the bottom left of the screen.',
        'The language is detected from your browser on the first visit (German for German browsers, English otherwise) and remembered.',
        'Everything is translated: the game, rules, error messages and these release notes.',
      ],
    },
  },
  {
    version: '1.6.5',
    title: { de: 'Chat-Fix', en: 'Chat fix' },
    items: {
      de: [
        'Der Chat lässt sich auf dem Handy wieder schließen.',
        'Besucherzählung mit Plausible, ohne Cookies und ohne personenbezogene Daten.',
      ],
      en: [
        'The chat can be closed again on phones.',
        'Visitor counting with Plausible, without cookies and without personal data.',
      ],
    },
  },
  {
    version: '1.6.4',
    title: { de: 'Aufgeräumt', en: 'Tidied up' },
    items: {
      de: [
        'Der Verlaufsgraph am Rundenende ist entfernt, die App lädt dadurch noch schneller.',
        'Link zum Quellcode auf GitHub bei den Neuigkeiten.',
      ],
      en: [
        'The progress graph at the end of a round is gone, so the app loads even faster.',
        'Link to the source code on GitHub in the release notes.',
      ],
    },
  },
  {
    version: '1.6.3',
    title: { de: 'Schneller laden', en: 'Faster loading' },
    items: {
      de: [
        'Die App lädt deutlich schneller, besonders auf dem Handy.',
        'Kleine Verbesserungen bei Barrierefreiheit und Suchmaschinen.',
      ],
      en: [
        'The app loads much faster, especially on phones.',
        'Small improvements to accessibility and search engines.',
      ],
    },
  },
  {
    version: '1.6.2',
    title: { de: 'Anstupsen und Anmeldungen', en: 'Nudges and sign-ups' },
    items: {
      de: [
        'Wer angestupst wird, bekommt einen blau leuchtenden Rand um den Bildschirm.',
        'Nach einem Anstupsen ist der Button für alle im Raum 10 Sekunden gesperrt.',
        'Alle Buttons und Icons haben einen Tooltip.',
        'Bei der Revanche wird die Sitzordnung neu gemischt.',
        'Die Zahl der angemeldeten Zuschauer sehen alle, im Hover sind sie mit Haken markiert.',
      ],
      en: [
        'Whoever gets nudged sees a glowing blue border around the screen.',
        'After a nudge, the button is locked for everyone in the room for 10 seconds.',
        'All buttons and icons have a tooltip.',
        'The seating order is reshuffled for a rematch.',
        'Everyone sees how many spectators have signed up; on hover they are marked with a check.',
      ],
    },
  },
  {
    version: '1.6.1',
    title: { de: 'Host-Markierung', en: 'Host marker' },
    items: {
      de: ['Der Host ist am Tisch mit einem Stern markiert.', 'Ein Hover über das Zuschauer-Symbol zeigt deren Namen.'],
      en: ['The host is marked with a star at the table.', 'Hovering the spectator icon shows their names.'],
    },
  },
  {
    version: '1.6.0',
    title: { de: 'Chat und Anmeldung', en: 'Chat and sign-up' },
    items: {
      de: [
        'Chat im Raum für Spieler und Zuschauer, mit Verlauf für neu Beigetretene.',
        'Zuschauer können sich jederzeit für die Revanche anmelden, nicht erst nach Spielende.',
      ],
      en: [
        'Room chat for players and spectators, with history for people who join later.',
        'Spectators can sign up for the rematch at any time, not only after the game ends.',
      ],
    },
  },
  {
    version: '1.5.1',
    title: { de: 'Zudrehen nur einmal bestätigen', en: 'Confirm ending the round only once' },
    items: {
      de: ['Nur wer als Erstes die letzte Karte aufdeckt, muss bestätigen. In der letzten Runde entfällt die Rückfrage.'],
      en: ['Only the first player to reveal their last card has to confirm. In the last round the confirmation is skipped.'],
    },
  },
  {
    version: '1.5.0',
    title: { de: 'Letzte Runde', en: 'Last round' },
    items: {
      de: [
        'Wer die letzte verdeckte Karte aufdecken und damit zudrehen will, muss das bestätigen.',
        'In der letzten Runde pulsiert ein roter Rand um den Bildschirm, die Anzeige oben ist rot.',
      ],
      en: [
        'Whoever is about to reveal their last face-down card and thereby end the round has to confirm it.',
        'In the last round a red border pulses around the screen and the header turns red.',
      ],
    },
  },
  {
    version: '1.4.0',
    title: { de: 'Rundenverlauf', en: 'Round history' },
    items: {
      de: [
        'Am Rundenende zeigt ein Graph den eigenen Punkteverlauf mit dem noch möglichen Maximum und Minimum (je nach Karten, die noch nicht zu sehen waren).',
        'Das Scoreboard ist immer nach Punkten sortiert (wenigste zuerst).',
        'Verlassen ist jetzt ein Icon oben links.',
        'Der zuletzt verwendete Name wird gemerkt.',
      ],
      en: [
        'At the end of a round, a graph shows your own score history with the maximum and minimum still possible (depending on cards not yet seen).',
        'The scoreboard is always sorted by points (fewest first).',
        'Leaving is now an icon at the top left.',
        'The last name you used is remembered.',
      ],
    },
  },
  {
    version: '1.3.1',
    title: { de: 'Raum verlassen', en: 'Leaving a room' },
    items: {
      de: ['Im laufenden Spiel kann man den Raum jetzt verlassen.'],
      en: ['You can now leave the room during a running game.'],
    },
  },
  {
    version: '1.3.0',
    title: { de: 'Zuschauer und Bots', en: 'Spectators and bots' },
    items: {
      de: [
        'Zuschauer: Wer einem laufenden Spiel beitritt, schaut zu. Nach Spielende kann man „Mitspielen" anfragen und rückt bei der Revanche nach.',
        'Bots: Der Host fügt im Warteraum Bots hinzu (Leicht, Normal, Stark). Der starke Bot zählt Karten.',
      ],
      en: [
        'Spectators: Anyone joining a running game watches. After the game ends you can ask to play along and join in the rematch.',
        'Bots: The host adds bots in the lobby (Easy, Normal, Hard). The hard bot counts cards.',
      ],
    },
  },
  {
    version: '1.2.0',
    title: { de: 'Komfort und Einstellungen', en: 'Comfort and settings' },
    items: {
      de: [
        'Zielpunktzahl wählbar (50, 100 oder 150).',
        'Anstupsen, wenn jemand beim Zug trödelt.',
        'Als App installierbar, der Bildschirm bleibt im Spiel an.',
        'Animationen beim Aufdecken und Tauschen, abschaltbar.',
        'Neues Favicon und App-Icon mit transparentem Hintergrund.',
        'Anzeige „Aktuell" für die Punkte der laufenden Runde.',
      ],
      en: [
        'Selectable target score (50, 100 or 150).',
        'Nudge someone who is slow to take their turn.',
        'Installable as an app; the screen stays on during a game.',
        'Animations when revealing and swapping cards, can be turned off.',
        'New favicon and app icon with a transparent background.',
        '"Current" display for the points of the running round.',
      ],
    },
  },
  {
    version: '1.1.0',
    title: { de: 'Mehr Überblick', en: 'Better overview' },
    items: {
      de: [
        'Live-Wertung der Runde pro Spieler.',
        'Regeln als Dialog, Zeile mit der letzten Aktion, Tab-Titel bei eigenem Zug.',
        'Entfernte Spalten pulsieren kurz auf.',
        'Mobiles Layout mit Auto-Scroll, Versionsanzeige.',
        'Räume werden gespeichert: Spiele überleben Updates.',
      ],
      en: [
        'Live score of the round per player.',
        'Rules as a dialog, a line with the latest action, tab title when it is your turn.',
        'Removed columns pulse briefly.',
        'Mobile layout with auto-scroll, version display.',
        'Rooms are saved: games survive updates.',
      ],
    },
  },
  {
    version: '1.0.0',
    title: { de: 'Erste Version', en: 'First version' },
    items: {
      de: ['Skyjo online für 2 bis 8 Spieler mit Raumcode.'],
      en: ['Skyjo online for 2 to 8 players with a room code.'],
    },
  },
];
