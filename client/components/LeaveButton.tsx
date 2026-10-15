import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LogoutIcon from '@mui/icons-material/Logout';

interface Props {
  spectator: boolean;
  onLeave: () => void;
}

export function LeaveButton({ spectator, onLeave }: Props) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <IconButton aria-label="Verlassen" onClick={spectator ? onLeave : () => setConfirm(true)}>
        <LogoutIcon sx={{ transform: 'scaleX(-1)' }} />
      </IconButton>
      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Raum verlassen?</DialogTitle>
        <DialogContent>Du scheidest aus dem laufenden Spiel aus.</DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirm(false)}>
            Abbrechen
          </Button>
          <Button color="warning" onClick={onLeave}>
            Verlassen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
