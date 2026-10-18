import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTranslation } from 'react-i18next';

interface Props {
  spectator: boolean;
  onLeave: () => void;
}

export function LeaveButton({ spectator, onLeave }: Props) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Tooltip title={t('common.leave')}>
        <IconButton aria-label={t('common.leave')} onClick={spectator ? onLeave : () => setConfirm(true)}>
          <LogoutIcon sx={{ transform: 'scaleX(-1)' }} />
        </IconButton>
      </Tooltip>
      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('leave.title')}</DialogTitle>
        <DialogContent>{t('leave.body')}</DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirm(false)}>
            {t('common.cancel')}
          </Button>
          <Button color="warning" onClick={onLeave}>
            {t('common.leave')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
