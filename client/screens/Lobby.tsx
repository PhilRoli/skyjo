import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { ALLOWED_TARGETS, BOT_LEVELS, type BotLevel } from '../../shared/types';
import type { ClientState } from '../../shared/view';
import { BOT_LEVEL_LABEL } from '../botLevels';

interface Props {
  state: ClientState;
  onStart: () => void;
  onRemove: (id: string) => void;
  onTarget: (target: number) => void;
  onAddBot: (level: BotLevel) => void;
  onLeave: () => void;
}

export function Lobby({ state, onStart, onRemove, onTarget, onAddBot, onLeave }: Props) {
  const [level, setLevel] = useState<BotLevel>('normal');
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
            {m.bot ? (
              <SmartToyIcon fontSize="small" sx={{ mr: 1 }} />
            ) : (
              <FiberManualRecordIcon fontSize="small" color={m.connected ? 'success' : 'disabled'} sx={{ mr: 1 }} />
            )}
            <ListItemText primary={m.name} />
            {m.bot && <Chip size="small" label={BOT_LEVEL_LABEL[m.bot.level]} sx={{ mr: 4 }} />}
            {m.id === room.hostId && <Chip size="small" label="Host" sx={{ mr: 4 }} />}
          </ListItem>
        ))}
      </List>
      {isHost && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Select size="small" value={level} onChange={(e) => setLevel(e.target.value as BotLevel)}>
            {BOT_LEVELS.map((l) => (
              <MenuItem key={l} value={l}>
                {BOT_LEVEL_LABEL[l]}
              </MenuItem>
            ))}
          </Select>
          <Button startIcon={<SmartToyIcon />} disabled={room.members.length >= 8} onClick={() => onAddBot(level)}>
            Bot hinzufügen
          </Button>
        </Stack>
      )}
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
