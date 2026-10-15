import { useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { RELEASE_NOTES } from '../../shared/releaseNotes';

interface Props {
  devAllowed: boolean;
  devOn: boolean;
  onToggleDev: (on: boolean) => void;
}

const DEV_TAPS = 5;

export function VersionBadge({ devAllowed, devOn, onToggleDev }: Props) {
  const [open, setOpen] = useState(false);
  const taps = useRef({ n: 0, last: 0 });
  // Hidden dev toggle: tap the badge five times in quick succession (only works when the server allows it).
  const click = () => {
    const now = Date.now();
    taps.current = { n: now - taps.current.last < 800 ? taps.current.n + 1 : 1, last: now };
    if (devAllowed && taps.current.n >= DEV_TAPS) {
      taps.current.n = 0;
      onToggleDev(!devOn);
      return;
    }
    if (taps.current.n === 1) setTimeout(() => taps.current.n === 1 && setOpen(true), 850);
  };
  return (
    <>
      <Button
        size="small"
        color="inherit"
        onClick={click}
        aria-label="Release Notes"
        sx={{ position: 'fixed', right: 4, bottom: 0, opacity: 0.5, minWidth: 0, textTransform: 'none', fontSize: 12 }}
      >
        {__APP_VERSION__}
        {devOn && ' · dev'}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 800 }}>
          Neuigkeiten
          <IconButton aria-label="Schließen" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {RELEASE_NOTES.map((r) => (
              <Stack key={r.version} spacing={0.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {r.version} · {r.title}
                </Typography>
                {r.items.map((t) => (
                  <Typography key={t} variant="body2">
                    • {t}
                  </Typography>
                ))}
              </Stack>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
