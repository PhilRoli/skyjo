import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined';
import { CardView } from './CardView';

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Ziel',
    items: ['Am Ende möglichst wenig Punkte sammeln. Das Spiel endet, sobald jemand über 100 Punkte hat. Wer dann die wenigsten hat, gewinnt.'],
  },
  {
    title: 'Dein Zug',
    items: [
      'Entweder die oberste Ablagekarte nehmen und gegen eine deiner Karten tauschen (auch gegen eine verdeckte).',
      'Oder eine Karte vom Nachziehstapel ziehen: gegen eine deiner Karten tauschen, oder ablegen und danach eine verdeckte Karte aufdecken.',
      'Die ausgetauschte Karte kommt offen auf die Ablage.',
    ],
  },
  {
    title: 'Dreier-Spalte',
    items: ['Drei gleiche offene Karten in einer Spalte werden entfernt und kommen auf die Ablage.'],
  },
  {
    title: 'Rundenende',
    items: [
      'Hat jemand alle Karten aufgedeckt, ist jeder andere noch einmal dran. Dann werden alle Karten aufgedeckt und gezählt.',
      'Wer die Runde beendet hat, muss die strikt niedrigste Punktzahl haben. Sonst werden seine Punkte verdoppelt (nur wenn sie positiv sind).',
    ],
  },
  {
    title: 'Rundenstart',
    items: ['Jeder deckt zu Beginn 2 Karten auf. Die höchste Summe beginnt.'],
  },
];

const SAMPLES: { value: number; label: string }[] = [
  { value: 12, label: '10 bis 12' },
  { value: 7, label: '5 bis 9' },
  { value: 3, label: '1 bis 4' },
  { value: 0, label: '0' },
  { value: -1, label: '−1 und −2' },
];

export function RulesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton aria-label="Regeln" onClick={() => setOpen(true)}>
        <HelpOutlineIcon />
      </IconButton>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 800 }}>
          Regeln
          <IconButton aria-label="Schließen" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {SECTIONS.map((s) => (
              <Stack key={s.title} spacing={0.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {s.title}
                </Typography>
                {s.items.map((t) => (
                  <Typography key={t} variant="body2">
                    {t}
                  </Typography>
                ))}
              </Stack>
            ))}
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Kartenfarben
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
