import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { ALLOWED_TARGETS } from '../../shared/types';
import type { ClientState } from '../../shared/view';

interface Props {
  state: ClientState;
  onStart: () => void;
  onRemove: (id: string) => void;
  onTarget: (target: number) => void;
  onLeave: () => void;
}

export function Lobby({ state, onStart, onRemove, onTarget, onLeave }: Props) {
  const { room, me } = state;
  const isHost = room.hostId === me;
  const copyLink = () => {
    void navigator.clipboard?.writeText(`${location.origin}/?raum=${room.code}`);
  };
  return (
    <Stack spacing={2} sx={{ mt: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>
        Raum {room.code}
      </Typography>
      <Button startIcon={<ContentCopyIcon />} onClick={copyLink} sx={{ alignSelf: 'flex-start' }}>
        Link kopieren
      </Button>
      <List>
        {room.members.map((m) => (
          <ListItem
            key={m.id}
            secondaryAction={
              isHost && m.id !== me ? (
                <IconButton aria-label="Entfernen" onClick={() => onRemove(m.id)}>
                  <CloseIcon />
                </IconButton>
              ) : null
            }
          >
            <FiberManualRecordIcon fontSize="small" color={m.connected ? 'success' : 'disabled'} sx={{ mr: 1 }} />
            <ListItemText primary={m.name} />
            {m.id === room.hostId && <Chip size="small" label="Host" sx={{ mr: 4 }} />}
          </ListItem>
        ))}
      </List>
      <Stack spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Ziel
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={room.target}
          disabled={!isHost}
          onChange={(_e, v: number | null) => v !== null && onTarget(v)}
        >
          {ALLOWED_TARGETS.map((t) => (
            <ToggleButton key={t} value={t}>
              {t}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      {isHost ? (
        <Button variant="contained" size="large" disabled={room.members.length < 2} onClick={onStart}>
          Spiel starten
        </Button>
      ) : (
        <Typography>Warte auf den Host</Typography>
      )}
      <Button color="inherit" onClick={onLeave}>
        Verlassen
      </Button>
    </Stack>
  );
}
