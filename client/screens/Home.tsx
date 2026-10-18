import { useState } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

const NAME_KEY = 'skyjo:name';

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    /* Speicher nicht verfügbar */
  }
}

interface Props {
  initialCode: string;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
}

export function Home({ initialCode, onCreate, onJoin }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(initialCode);
  const nameOk = name.trim().length > 0;
  return (
    <Stack spacing={3} sx={{ mt: 6 }}>
      <Typography variant="h3" component="h1" sx={{ fontWeight: 800 }}>
        Skyjo
      </Typography>
      <TextField
        label={t('home.name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 16 } }}
      />
      <Button variant="contained" size="large" disabled={!nameOk} onClick={() => {
          saveName(name);
          onCreate(name);
        }}>
        {t('home.create')}
      </Button>
      <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
        {t('home.join')}
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          label={t('home.code')}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          slotProps={{ htmlInput: { maxLength: 4 } }}
          sx={{ flex: 1 }}
        />
        <Button variant="outlined" disabled={!nameOk || code.trim().length !== 4} onClick={() => {
            saveName(name);
            onJoin(code, name);
          }}>
          {t('home.join')}
        </Button>
      </Stack>
    </Stack>
  );
}
