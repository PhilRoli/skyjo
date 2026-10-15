import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import type { PlayerView } from '../../shared/view';
import { RoundChart } from '../components/RoundChart';

interface Props {
  game: PlayerView;
  isHost: boolean;
  spectator: boolean;
  wantsToPlay: boolean;
  playRequests: number;
  next: () => void;
  rematch: () => void;
  play: () => void;
  leave: () => void;
}

export function Scoreboard({ game, isHost, spectator, wantsToPlay, playRequests, next, rematch, play, leave }: Props) {
  const over = game.phase === 'gameOver';
  const last = game.lastRound;
  const rows = [...game.players].sort((a, b) => a.total - b.total);
  const winnerNames = game.players.filter((p) => game.winners.includes(p.id)).map((p) => p.name);
  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {over ? 'Spiel beendet' : `Runde ${game.round} beendet`}
        </Typography>
        {over && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <EmojiEventsIcon color="warning" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {winnerNames.join(', ')}
            </Typography>
          </Stack>
        )}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Spieler</TableCell>
              <TableCell align="right">Runde</TableCell>
              <TableCell align="right">Gesamt</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell align="right">
                  {last?.scores[p.id] ?? '–'}
                  {last?.doubled && last.finisher === p.id && <Chip size="small" label="×2" sx={{ ml: 1 }} />}
                </TableCell>
                <TableCell align="right">{p.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {last?.trace && last.trace.length > 1 && <RoundChart me={game.me} trace={last.trace} />}
        {isHost ? (
          <>
            {over && playRequests > 0 && (
              <Typography variant="body2">{playRequests} Zuschauer möchten mitspielen</Typography>
            )}
            <Button variant="contained" onClick={over ? rematch : next}>
              {over ? 'Revanche' : 'Nächste Runde'}
            </Button>
          </>
        ) : spectator && over ? (
          <Button variant="outlined" onClick={play}>
            {wantsToPlay ? 'Anfrage zurückziehen' : 'Mitspielen'}
          </Button>
        ) : (
          <Typography>Warte auf den Host</Typography>
        )}
        {over && (
          <Button color="inherit" onClick={leave}>
            Verlassen
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
