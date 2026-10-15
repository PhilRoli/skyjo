import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';
import type { TracePoint } from '../../shared/types';

interface Props {
  me: string;
  trace: TracePoint[];
}

export function RoundChart({ me, trace }: Props) {
  if (!trace.some((t) => t[me])) return null;
  const series = (f: (t: TracePoint[string]) => number) => trace.map((t) => (t[me] ? f(t[me]) : null));
  return (
    <Stack spacing={1}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Verlauf
      </Typography>
      <LineChart
        height={260}
        xAxis={[{ data: trace.map((_, i) => i + 1), scaleType: 'point', label: 'Zug' }]}
        series={[
          { label: 'Maximum', data: series((t) => t.max), showMark: false, curve: 'stepAfter', color: '#D55E00' },
          { label: 'Aktuell', data: series((t) => t.sum), curve: 'stepAfter', color: '#F0E442' },
          { label: 'Minimum', data: series((t) => t.min), showMark: false, curve: 'stepAfter', color: '#0072B2' },
        ]}
        margin={{ left: 8, right: 8 }}
      />
    </Stack>
  );
}
