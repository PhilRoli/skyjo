import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Snackbar from '@mui/material/Snackbar';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { GameTable } from './screens/GameTable';
import { RulesButton } from './components/RulesDialog';
import { VersionBadge } from './components/VersionBadge';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { useGame } from './useGame';

const theme = createTheme({ palette: { mode: 'dark' } });

export function App() {
  const g = useGame();
  const initialCode = new URLSearchParams(location.search).get('raum')?.toUpperCase() ?? '';
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ pb: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <RulesButton />
        </div>
        {!g.connected && !g.booting && <Alert severity="warning">Verbindung getrennt</Alert>}
        {g.booting ? null : g.state === null ? (
          <Home initialCode={initialCode} onCreate={g.create} onJoin={g.join} />
        ) : g.state.game === null ? (
          <Lobby state={g.state} onStart={g.start} onRemove={g.remove} onTarget={g.setTarget} onLeave={g.leave} />
        ) : (
          <GameTable state={g.state} act={g.act} remove={g.remove} next={g.next} rematch={g.rematch} leave={g.leave} />
        )}
      </Container>
      <VersionBadge />
      <Snackbar open={g.error !== null} autoHideDuration={4000} onClose={g.clearError}>
        <Alert severity="error" onClose={g.clearError}>
          {g.error}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
