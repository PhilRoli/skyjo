import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined';
import AnimationIcon from '@mui/icons-material/Animation';
import MotionPhotosOffIcon from '@mui/icons-material/MotionPhotosOff';
import { useAnimations } from '../animations';
import { CardView } from './CardView';

const SECTION_IDS = ['goal', 'turn', 'triple', 'end', 'start'] as const;

const SAMPLES: { value: number; label: string }[] = [
  { value: 12, label: '10–12' },
  { value: 7, label: '5–9' },
  { value: 3, label: '1–4' },
  { value: 0, label: '0' },
  { value: -1, label: '−1, −2' },
];

export function RulesButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip title={t('rules.title')}>
        <IconButton aria-label={t('rules.title')} onClick={() => setOpen(true)}>
          <HelpOutlineIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 800 }}>
          {t('rules.title')}
          <Tooltip title={t('common.close')}>
            <IconButton aria-label={t('common.close')} onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {SECTION_IDS.map((id) => (
              <Stack key={id} spacing={0.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {t(`rules.${id}.title`)}
                </Typography>
                {(t(`rules.${id}.items`, { returnObjects: true }) as unknown as string[]).map((item) => (
                  <Typography key={item} variant="body2">
                    {item}
                  </Typography>
                ))}
              </Stack>
            ))}
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t('rules.colors')}
              </Typography>
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                {SAMPLES.map((s) => (
                  <Stack key={s.label} spacing={0.5} sx={{ alignItems: 'center' }}>
                    <CardView cell={{ up: true, value: s.value }} size="small" />
                    <Typography variant="caption">{s.label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AnimationsToggle() {
  const { t } = useTranslation();
  const { enabled, toggle } = useAnimations();
  const label = t(enabled ? 'rules.animationsOff' : 'rules.animationsOn');
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={toggle}>
        {enabled ? <AnimationIcon /> : <MotionPhotosOffIcon />}
      </IconButton>
    </Tooltip>
  );
}
