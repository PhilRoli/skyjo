import { useState } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

interface Props {
  initialCode: string;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
}

export function Home({ initialCode, onCreate, onJoin }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const nameOk = name.trim().length > 0;
  return (
    <Stack spacing={3} sx={{ mt: 6 }}>
      <Typography variant="h3" sx={{ fontWeight: 800 }}>
        Skyjo
      </Typography>
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 16 } }}
      />
      <Button variant="contained" size="large" disabled={!nameOk} onClick={() => onCreate(name)}>
        Raum erstellen
      </Button>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Beitreten
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          label="Raumcode"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          slotProps={{ htmlInput: { maxLength: 4 } }}
          sx={{ flex: 1 }}
        />
        <Button variant="outlined" disabled={!nameOk || code.trim().length !== 4} onClick={() => onJoin(code, name)}>
          Beitreten
        </Button>
      </Stack>
    </Stack>
  );
}
