# <img src="./client/public/icon.svg" alt="Skyjo Logo" height="32" align="top"> Skyjo

Skyjo im Browser für 2 bis 8 Spieler. Beitritt per 4-stelligem Raumcode, ohne Account.

Live: https://skyjo.rolinek.at

## Funktionen

- Alle Regeln: Dreier-Spalten, letzte Runde, Verdopplung, Zielpunktzahl (50, 100 oder 150)
- Zuschauer, die einem laufenden Spiel beitreten, und Bots in drei Stufen (Leicht, Normal, Stark)
- Live-Wertung, Anzeige der letzten Aktion, Anstupsen, abschaltbare Animationen
- Als App installierbar, Spiele überleben Server-Neustarts

## Entwicklung

Voraussetzung: [Bun](https://bun.sh).

```bash
bun install
bun run dev:server   # Server auf :4400
bun run dev:client   # Vite-Entwicklungsserver, leitet Socket.IO an :4400 weiter
```

| Befehl | Zweck |
| --- | --- |
| `bunx vitest run` | Unit-Tests (Regeln, Räume, Bots, Server) |
| `bun run test:e2e` | Ganze Spiele gegen den echten Serverprozess, inklusive Neustart |
| `bun run typecheck` | TypeScript prüfen |
| `bun run build` | Client nach `client/dist` bauen |
| `bun run start` | Server starten und gebauten Client ausliefern |

Umgebungsvariablen des Servers: `PORT` (4400), `DATA_DIR` (`data`, dort liegen die gespeicherten Räume), `BOT_DELAY_MS` (900, Denkpause der Bots).

## Aufbau

- `shared/` – Regeln als reine Funktionen, Bot-Entscheidungen, Typen, Release Notes
- `server/` – Express und Socket.IO, Räume im Speicher mit Speicherung auf Platte, Bot-Runner
- `client/` – React und MUI, Vite
- `e2e/` – End-to-End-Tests

Der Server ist maßgeblich: Clients schicken nur Aktionen und bekommen ihre eigene Sicht, verdeckte Karten verlassen den Server nie.

## Release und Deployment

`develop` nach `main` mergen und einen GitHub Release auf `main` veröffentlichen:

```bash
gh release create vX.Y.Z --target main
```

Der Workflow `Deploy` prüft Typen, Tests und Build, rsynct auf den Server und startet den Container neu. Die Release Notes für die App stehen in `shared/releaseNotes.ts` und werden vorher ergänzt.

## Hinweis zum Urheberrecht

Skyjo ist ein Kartenspiel von Magilano. Alle Rechte am Spiel, am Namen und an den Regeln liegen beim Originalhersteller. Dieses Projekt ist ein nicht-kommerzielles Fan-Projekt und steht in keiner Verbindung zum Hersteller.
