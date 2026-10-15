import Box from '@mui/material/Box';
import type { PublicCell } from '../../shared/view';
import { CardView } from './CardView';

interface Props {
  grid: (PublicCell | null)[];
  size?: 'normal' | 'small';
  canClick?: (slot: number) => boolean;
  onSlot?: (slot: number) => void;
}

export function GridView({ grid, size = 'normal', canClick, onSlot }: Props) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridAutoFlow: 'column',
        gridTemplateRows: 'repeat(3, auto)',
        gap: size === 'small' ? 0.5 : 1,
        width: 'fit-content',
      }}
    >
      {grid.map((cell, i) => {
        const clickable = canClick?.(i) ?? false;
        return (
          <CardView
            key={i}
            cell={cell}
            size={size}
            highlight={clickable}
            onClick={clickable ? () => onSlot?.(i) : undefined}
          />
        );
      })}
    </Box>
  );
}
