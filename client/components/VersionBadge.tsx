import Typography from '@mui/material/Typography';

export function VersionBadge() {
  return (
    <Typography
      variant="caption"
      sx={{ position: 'fixed', right: 8, bottom: 4, opacity: 0.5, pointerEvents: 'none' }}
    >
      {__APP_VERSION__}
    </Typography>
  );
}
