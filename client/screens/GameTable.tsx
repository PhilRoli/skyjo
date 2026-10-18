import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import StarIcon from '@mui/icons-material/Star';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAnimations } from '../animations';
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
  nudge: () => void;
  next: () => void;
  rematch: () => void;
  play: () => void;
  leave: () => void;
}

const LAST_ROUND_RED = '#f44336';

export function GameTable({ state, act, remove, nudge, next, rematch, play, leave }: Props) {
  const { t } = useTranslation();
  const g = state.game!;
  const dev = state.dev;
  /** Dev mode: sum of all cards incl. face-down ones, shown faded as `( X )`. */
  const trueSum = (id: string) => {
    const sum = (dev?.grids[id] ?? []).reduce<number>((a, v) => a + (v ?? 0), 0);
    return dev && (
      <Typography component="span" variant="caption" sx={{ ml: 0.5, opacity: 0.45 }}>
        ( {sum} )
      </Typography>
    );
  };
  const isHost = state.room.hostId === state.me;
  const spectator = state.role === 'spectator';
  const spectatorNames = state.room.members.filter((m) => m.spectator && m.name.trim()).map((m) => (m.wantsToPlay ? `${m.name} ✓` : m.name));
  const signedUp = state.room.members.filter((m) => m.spectator && m.wantsToPlay).length;
  const hostMark = (id: string) =>
    id === state.room.hostId && <StarIcon titleAccess={t('common.host')} sx={{ fontSize: 14, verticalAlign: 'text-bottom', mr: 0.5, color: 'warning.main' }} />;
  const me = g.players.find((p) => p.id === g.me); // undefined for spectators
  const others = g.players.filter((p) => p.id !== g.me);
  const myTurn = !spectator && g.current === g.me;
  const myUp = me ? me.grid.filter((c) => c?.up).length : 2;
  const nameOf = (id: string | null) => g.players.find((p) => p.id === id)?.name ?? '';
  const over = g.phase === 'roundOver' || g.phase === 'gameOver';
  const { enabled: animations } = useAnimations();
  const [pendingClose, setPendingClose] = useState<Action | null>(null);
  const [nudgeCooling, setNudgeCooling] = useState(false);
  const isBot = (id: string | null) => !!state.room.members.find((m) => m.id === id)?.bot;
  const canNudge = !spectator && !myTurn && g.current !== null && !over && !isBot(g.current);
  const nudgeNow = () => nudge();
  const cooldownMs = state.room.nudgeCooldownMs;
  useEffect(() => {
    setNudgeCooling(cooldownMs > 0);
    if (cooldownMs <= 0) return;
    const t = setTimeout(() => setNudgeCooling(false), cooldownMs);
    return () => clearTimeout(t);
  }, [cooldownMs]);
  const eventLine = describeEvents(g.events, nameOf, (key, options) => String(t(key as never, options as never)));
  const clearedBy = (id: string) => g.events.filter((e) => e.kind === 'clear' && e.by === id).map((e) => (e as { column: number }).column);

  // On phones the thumb sits at the bottom: keep the own cards (and the scoreboard) in view.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia('(max-width: 899px)').matches) return;
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [myTurn, g.round, over]);

  useEffect(() => {
    document.title = myTurn ? t('table.pageTitle') : 'Skyjo';
    return () => {
      document.title = 'Skyjo';
    };
  }, [myTurn, t]);

  /** Only the first player to reveal their last hidden card closes the round, so only they are asked. */
  const hiddenCount = me ? me.grid.filter((c) => c !== null && !c.up).length : 0;
  const closes = (slot: number) => !g.finisher && hiddenCount === 1 && !!me && me.grid[slot] !== null && !me.grid[slot]!.up;
  const closeOrAct = (a: Extract<Action, { slot: number }>) => (closes(a.slot) ? setPendingClose(a) : act(a));
  const lastRound = !!g.finisher && !over;

  let hint = '';
  let clickable: (i: number) => boolean = () => false;
  let onSlot: (i: number) => void = () => {};
  const hidden = (i: number) => !!me && me.grid[i] !== null && !me.grid[i]!.up;
  switch (g.phase) {
    case 'initialFlip':
      hint = myUp < 2 ? t('table.flipTwo', { count: myUp }) : t('table.waitOthers');
      clickable = (i) => myUp < 2 && hidden(i);
      onSlot = (slot) => act({ type: 'flipInitial', slot });
      break;
    case 'draw':
      hint = myTurn ? t('table.yourTurn') : t('table.turnOf', { name: nameOf(g.current) });
      break;
    case 'place':
      hint = myTurn
        ? g.drawnFrom === 'deck'
          ? t('table.swapOrDiscard')
          : t('table.swapCard')
        : t('table.turnOf', { name: nameOf(g.current) });
      clickable = (i) => myTurn && !!me && me.grid[i] !== null;
      onSlot = (slot) => closeOrAct({ type: 'swap', slot });
      break;
    case 'flipAfterDiscard':
      hint = myTurn ? t('table.flipOne') : t('table.turnOf', { name: nameOf(g.current) });
      clickable = (i) => myTurn && hidden(i);
      onSlot = (slot) => closeOrAct({ type: 'flipHidden', slot });
      break;
  }
  if (g.finisher && !over) hint += ` · ${t('table.lastRound', { name: nameOf(g.finisher) })}`;
  if (spectator) hint = g.current ? t('table.turnOf', { name: nameOf(g.current) }) : t('table.watching');

  const canDraw = myTurn && g.phase === 'draw';

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      {lastRound && (
        <Box
          aria-hidden
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            pointerEvents: 'none',
            boxShadow: `inset 0 0 0 4px ${LAST_ROUND_RED}`,
            animation: animations ? 'skyjo-last-round 1.6s ease-in-out infinite' : 'none',
            '@keyframes skyjo-last-round': {
              '0%, 100%': { boxShadow: `inset 0 0 0 4px ${LAST_ROUND_RED}, inset 0 0 12px 2px rgba(244,67,54,0.35)` },
              '50%': { boxShadow: `inset 0 0 0 4px ${LAST_ROUND_RED}, inset 0 0 48px 14px rgba(244,67,54,0.75)` },
            },
          }}
        />
      )}
      <Dialog open={pendingClose !== null} onClose={() => setPendingClose(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('table.closeTitle')}</DialogTitle>
        <DialogContent>
          {t('table.closeBody')}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setPendingClose(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            color="warning"
            onClick={() => {
              if (pendingClose) act(pendingClose);
              setPendingClose(null);
            }}
          >
            {t('table.closeConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.default', py: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: lastRound ? LAST_ROUND_RED : undefined }}>
          {over ? (g.phase === 'gameOver' ? t('table.gameOver') : t('table.roundOver', { round: g.round })) : hint}
          <Typography component="span" variant="caption" sx={{ ml: 1, fontWeight: 400, opacity: 0.7 }}>
            {t('table.target', { target: g.target })}
          </Typography>
          {state.room.spectatorCount > 0 && (
            <Typography component="span" variant="caption" sx={{ ml: 1, fontWeight: 400, opacity: 0.7 }}>
              <Tooltip title={spectatorNames.join(', ')} disableHoverListener={spectatorNames.length === 0}>
              <span>
                  <VisibilityIcon sx={{ fontSize: 14, verticalAlign: 'text-bottom', mr: 0.25 }} />
                  {state.room.spectatorCount}
                </span>
              </Tooltip>
              {!over && signedUp > 0 && ` · ${t('table.signedUp', { count: signedUp })}`}
            </Typography>
          )}
          {canNudge && (
            <Button size="small" sx={{ ml: 1 }} disabled={nudgeCooling} onClick={nudgeNow}>
              {t('table.nudge')}
            </Button>
          )}
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
                {member?.bot && <SmartToyIcon sx={{ fontSize: 14, verticalAlign: 'text-bottom', mr: 0.5 }} />}
                {hostMark(p.id)}
                {p.name}
              </Typography>
              <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                {t('table.current')} <b>{visibleSum(p.grid)}</b>{trueSum(p.id)} · {t('table.total')} {p.total}
              </Typography>
              {p.left ? (
                <Typography variant="caption">{t('table.out')}</Typography>
              ) : (
                <GridView grid={p.grid} size="small" peek={dev?.grids[p.id]} pulseColumns={clearedBy(p.id)} pulseKey={g.eventSeq} />
              )}
              {isHost && !p.left && member && !member.connected && (
                <Button size="small" color="warning" onClick={() => remove(p.id)}>
                  {t('table.skip')}
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
          <Typography variant="caption">{t('table.discardPile')}</Typography>
        </Stack>
        {g.drawn !== null && (
          <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
            <CardView cell={{ up: true, value: g.drawn }} />
            {g.drawnFrom === 'deck' ? (
              <Button size="small" variant="outlined" onClick={() => act({ type: 'discardDrawn' })}>
                {t('table.discard')}
              </Button>
            ) : (
              <Typography variant="caption">{t('table.drawn')}</Typography>
            )}
          </Stack>
        )}
      </Stack>

      {dev && (
        <Paper sx={{ p: 1, alignSelf: 'center' }}>
          <Typography variant="caption" component="div" sx={{ fontWeight: 700 }}>
            {t('table.devPile', { count: g.deckCount, next: dev.next ?? '–' })}
            {dev.drawn !== null && g.drawn === null && t('table.devDrawn', { value: dev.drawn })}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {dev.deck.map((d) => (
              <Chip key={d.value} size="small" label={`${d.value} × ${d.count}`} />
            ))}
          </Box>
        </Paper>
      )}

      {me && (
        <Paper sx={{ p: 2, outline: myTurn ? '2px solid #ff9800' : 'none', alignSelf: 'center' }}>
          <Typography sx={{ fontWeight: 700 }}>
            {hostMark(me.id)}
            {me.name}
          </Typography>
          <Typography variant="body2" component="div" sx={{ mb: 1 }}>
            {t('table.current')} <b>{visibleSum(me.grid)}</b>{trueSum(me.id)} · {t('table.total')} {me.total}
          </Typography>
          <GridView grid={me.grid} peek={dev?.grids[me.id]} canClick={clickable} onSlot={onSlot} pulseColumns={clearedBy(me.id)} pulseKey={g.eventSeq} />
        </Paper>
      )}

      {spectator && !over && (
        <Button variant="outlined" sx={{ alignSelf: 'center' }} onClick={play}>
          {state.room.members.find((m) => m.id === state.me)?.wantsToPlay ? t('table.withdraw') : t('table.signUp')}
        </Button>
      )}
      {over && (
        <Scoreboard
          game={g}
          isHost={isHost}
          spectator={spectator}
          wantsToPlay={!!state.room.members.find((m) => m.id === state.me)?.wantsToPlay}
          playRequests={state.room.members.filter((m) => m.spectator && m.wantsToPlay).length}
          next={next}
          rematch={rematch}
          play={play}
          leave={leave}
        />
      )}
      <div ref={endRef} />
    </Stack>
  );
}
