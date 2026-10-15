import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { RELEASE_NOTES } from '../../shared/releaseNotes';

export function VersionBadge() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="small"
        color="inherit"
        onClick={() => setOpen(true)}
        aria-label="Release Notes"
        sx={{ position: 'fixed', right: 4, bottom: 0, opacity: 0.5, minWidth: 0, textTransform: 'none', fontSize: 12 }}
      >
        {__APP_VERSION__}
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
