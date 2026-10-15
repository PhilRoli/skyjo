import Box from '@mui/material/Box';
import { cardColor, type CardColor } from '../../shared/colors';
import type { PublicCell } from '../../shared/view';

const COLORS: Record<CardColor, { bg: string; fg: string }> = {
  red: { bg: '#e53935', fg: '#ffffff' },
  yellow: { bg: '#fdd835', fg: '#222222' },
  green: { bg: '#43a047', fg: '#ffffff' },
  lightblue: { bg: '#81d4fa', fg: '#222222' },
  darkblue: { bg: '#1e4fa3', fg: '#ffffff' },
};

interface Props {
  cell: PublicCell | null;
  size?: 'normal' | 'small';
  onClick?: () => void;
  highlight?: boolean;
  pulse?: boolean;
}

export function CardView({ cell, size = 'normal', onClick, highlight, pulse }: Props) {
  const small = size === 'small';
  const base = {
    width: small ? 30 : 56,
    height: small ? 42 : 80,
    borderRadius: 1.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: small ? 14 : 26,
    userSelect: 'none',
  } as const;
  if (!cell) {
    return (
      <Box
        sx={{
          ...base,
          border: '2px dashed',
          borderColor: 'divider',
          animation: pulse ? 'skyjo-pulse 1.2s ease-out 2' : 'none',
          '@keyframes skyjo-pulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(255,152,0,0.9)', borderColor: '#ff9800' },
            '100%': { boxShadow: '0 0 0 14px rgba(255,152,0,0)' },
          },
        }}
      />
    );
  }
  const face = cell.up && cell.value !== null ? COLORS[cardColor(cell.value)] : null;
  return (
    <Box
      onClick={onClick}
      sx={{
        ...base,
        bgcolor: face?.bg ?? '#37474f',
        color: face?.fg ?? '#90a4ae',
        cursor: onClick ? 'pointer' : 'default',
        outline: highlight ? '3px solid #ff9800' : 'none',
        boxShadow: 2,
        transition: 'transform .1s',
        '&:hover': onClick ? { transform: 'translateY(-3px)' } : {},
      }}
    >
      {face ? cell.value : '?'}
    </Box>
  );
}
