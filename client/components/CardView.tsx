import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { cardColor, type CardColor } from '../../shared/colors';
import type { PublicCell } from '../../shared/view';
import { useAnimations } from '../animations';

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
  /** Dev mode: value of a face-down card, shown faded. */
  peek?: number | null;
}

const KEYFRAMES = {
  '@keyframes skyjo-pulse': {
    '0%': { boxShadow: '0 0 0 0 rgba(255,152,0,0.9)', borderColor: '#ff9800' },
    '100%': { boxShadow: '0 0 0 14px rgba(255,152,0,0)' },
  },
  '@keyframes skyjo-flip': {
    '0%': { transform: 'rotateY(90deg)' },
    '100%': { transform: 'rotateY(0deg)' },
  },
  '@keyframes skyjo-pop': {
    '0%': { transform: 'scale(1.3)' },
    '100%': { transform: 'scale(1)' },
  },
} as const;

export function CardView({ cell, size = 'normal', onClick, highlight, pulse, peek }: Props) {
  const { enabled } = useAnimations();
  const prev = useRef(cell);
  const [anim, setAnim] = useState<'flip' | 'pop' | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = cell;
    if (!enabled || !before || !cell) return;
    if (!before.up && cell.up) setAnim('flip');
    else if (before.up && cell.up && before.value !== cell.value) setAnim('pop');
  }, [cell, enabled]);
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
          animation: pulse && enabled ? 'skyjo-pulse 1.2s ease-out 2' : 'none',
          ...KEYFRAMES,
        }}
      />
    );
  }
  const face = cell.up && cell.value !== null ? COLORS[cardColor(cell.value)] : null;
  return (
    <Box
      onClick={onClick}
      onAnimationEnd={() => setAnim(null)}
      sx={{
        ...base,
        animation: anim === 'flip' ? 'skyjo-flip 0.45s ease-out' : anim === 'pop' ? 'skyjo-pop 0.35s ease-out' : 'none',
        ...KEYFRAMES,
        bgcolor: face?.bg ?? '#37474f',
        color: face?.fg ?? '#90a4ae',
        cursor: onClick ? 'pointer' : 'default',
        outline: highlight ? '3px solid #ff9800' : 'none',
        boxShadow: 2,
        transition: 'transform .1s',
        '&:hover': onClick ? { transform: 'translateY(-3px)' } : {},
      }}
    >
      {face ? cell.value : peek != null ? <span style={{ opacity: 0.6 }}>{peek}</span> : '?'}
    </Box>
  );
}
