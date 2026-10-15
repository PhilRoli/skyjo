import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { describeEvents } from '../../shared/events';
import { visibleSum } from '../../shared/score';
import type { Action } from '../../shared/types';
import type { ClientState } from '../../shared/view';
import { CardView } from '../components/CardView';
import { GridView } from '../components/GridView';
import { Scoreboard } from './Scoreboard';

interface Props {
  state: ClientState;
  act: (a: Action) => void;
  remove: (id: string) => void;
  next: () => void;
  rematch: () => void;
  leave: () => void;
}

export function GameTable({ state, act, remove, next, rematch, leave }: Props) {
  const g = state.game!;
  const isHost = state.room.hostId === state.me;
  const me = g.players.find((p) => p.id === g.me)!;
  const others = g.players.filter((p) => p.id !== g.me);
  const myTurn = g.current === g.me;
  const myUp = me.grid.filter((c) => c?.up).length;
  const nameOf = (id: string | null) => g.players.find((p) => p.id === id)?.name ?? '';
  const over = g.phase === 'roundOver' || g.phase === 'gameOver';
  const eventLine = describeEvents(g.events, nameOf);
  const clearedBy = (id: string) => g.events.filter((e) => e.kind === 'clear' && e.by === id).map((e) => (e as { column: number }).column);

  // On phones the thumb sits at the bottom: keep the own cards (and the scoreboard) in view.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia('(max-width: 899px)').matches) return;
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [myTurn, g.round, over]);

  useEffect(() => {
    document.title = myTurn ? '● Du bist dran – Skyjo' : 'Skyjo';
    return () => {
      document.title = 'Skyjo';
    };
  }, [myTurn]);

  let hint = '';
  let clickable: (i: number) => boolean = () => false;
  let onSlot: (i: number) => void = () => {};
  const hidden = (i: number) => me.grid[i] !== null && !me.grid[i]!.up;
  switch (g.phase) {
    case 'initialFlip':
      hint = myUp < 2 ? `Decke 2 Karten auf (${myUp}/2)` : 'Warte auf die anderen';
      clickable = (i) => myUp < 2 && hidden(i);
      onSlot = (slot) => act({ type: 'flipInitial', slot });
      break;
    case 'draw':
      hint = myTurn ? 'Du bist dran' : `${nameOf(g.current)} ist dran`;
      break;
    case 'place':
      hint = myTurn
        ? g.drawnFrom === 'deck'
          ? 'Tauschen oder ablegen'
          : 'Karte tauschen'
        : `${nameOf(g.current)} ist dran`;
      clickable = (i) => myTurn && me.grid[i] !== null;
      onSlot = (slot) => act({ type: 'swap', slot });
      break;
    case 'flipAfterDiscard':
      hint = myTurn ? 'Decke eine Karte auf' : `${nameOf(g.current)} ist dran`;
      clickable = (i) => myTurn && hidden(i);
      onSlot = (slot) => act({ type: 'flipHidden', slot });
      break;
  }
  if (g.finisher && !over) hint += ` · ${nameOf(g.finisher)}: letzte Runde`;

  const canDraw = myTurn && g.phase === 'draw';

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.default', py: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {over ? (g.phase === 'gameOver' ? 'Spiel beendet' : `Runde ${g.round} beendet`) : hint}
          <Typography component="span" variant="caption" sx={{ ml: 1, fontWeight: 400, opacity: 0.7 }}>
            Ziel {g.target}
          </Typography>
        </Typography>
        {eventLine && (
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            {eventLine}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {others.map((p) => {
          const member = state.room.members.find((m) => m.id === p.id);
          return (
            <Paper key={p.id} sx={{ p: 1, outline: g.current === p.id ? '2px solid #ff9800' : 'none' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {p.name}
              </Typography>
              <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                Aktuell <b>{visibleSum(p.grid)}</b> · Gesamt {p.total}
              </Typography>
              {p.left ? (
                <Typography variant="caption">ausgeschieden</Typography>
              ) : (
                <GridView grid={p.grid} size="small" pulseColumns={clearedBy(p.id)} pulseKey={g.eventSeq} />
              )}
              {isHost && !p.left && member && !member.connected && (
                <Button size="small" color="warning" onClick={() => remove(p.id)}>
                  Überspringen
                </Button>
              )}
            </Paper>
          );
        })}
      </Box>

      <Stack direction="row" spacing={3} sx={{ justifyContent: 'center', alignItems: 'center' }}>
        <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
          <CardView
            cell={{ up: false, value: null }}
            onClick={canDraw ? () => act({ type: 'drawFromDeck' }) : undefined}
            highlight={canDraw}
          />
          <Typography variant="caption">{g.deckCount}</Typography>
        </Stack>
        <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
          <CardView
            cell={g.discardTop === null ? null : { up: true, value: g.discardTop }}
            onClick={canDraw && g.discardTop !== null ? () => act({ type: 'takeDiscard' }) : undefined}
            highlight={canDraw && g.discardTop !== null}
          />
          <Typography variant="caption">Ablage</Typography>
        </Stack>
        {g.drawn !== null && (
          <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
            <CardView cell={{ up: true, value: g.drawn }} />
            {g.drawnFrom === 'deck' ? (
              <Button size="small" variant="outlined" onClick={() => act({ type: 'discardDrawn' })}>
                Ablegen
              </Button>
            ) : (
              <Typography variant="caption">Gezogen</Typography>
            )}
          </Stack>
        )}
      </Stack>

      <Paper sx={{ p: 2, outline: myTurn ? '2px solid #ff9800' : 'none', alignSelf: 'center' }}>
        <Typography sx={{ fontWeight: 700 }}>{me.name}</Typography>
        <Typography variant="body2" component="div" sx={{ mb: 1 }}>
          Aktuell <b>{visibleSum(me.grid)}</b> · Gesamt {me.total}
        </Typography>
        <GridView grid={me.grid} canClick={clickable} onSlot={onSlot} pulseColumns={clearedBy(me.id)} pulseKey={g.eventSeq} />
      </Paper>

      {over && <Scoreboard game={g} isHost={isHost} next={next} rematch={rematch} leave={leave} />}
      <div ref={endRef} />
    </Stack>
  );
}
