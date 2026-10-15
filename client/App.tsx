import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Snackbar from '@mui/material/Snackbar';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { GameTable } from './screens/GameTable';
import { LeaveButton } from './components/LeaveButton';
import { AnimationsToggle, RulesButton } from './components/RulesDialog';
import { VersionBadge } from './components/VersionBadge';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { useGame } from './useGame';
import { useWakeLock } from './useWakeLock';

const theme = createTheme({ palette: { mode: 'dark' } });

export function App() {
  const g = useGame();
  useWakeLock(g.state?.game != null);
  const initialCode = new URLSearchParams(location.search).get('raum')?.toUpperCase() ?? '';
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ pb: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
          <div>
            {g.state?.game && g.state.game.phase !== 'roundOver' && g.state.game.phase !== 'gameOver' && (
              <LeaveButton spectator={g.state.role === 'spectator'} onLeave={g.leave} />
            )}
          </div>
          <div>
            <AnimationsToggle />
            <RulesButton />
          </div>
        </div>
        {!g.connected && !g.booting && <Alert severity="warning">Verbindung getrennt</Alert>}
        {g.booting ? null : g.state === null ? (
          <Home initialCode={initialCode} onCreate={g.create} onJoin={g.join} />
        ) : g.state.game === null ? (
          <Lobby state={g.state} onStart={g.start} onRemove={g.remove} onTarget={g.setTarget} onAddBot={g.addBot} onLeave={g.leave} />
        ) : (
          <GameTable state={g.state} act={g.act} remove={g.remove} nudge={g.nudge} next={g.next} rematch={g.rematch} play={g.play} leave={g.leave} />
        )}
      </Container>
      <VersionBadge />
      <Snackbar open={g.nudgedBy !== null} autoHideDuration={5000} onClose={g.clearNudge}>
        <Alert severity="info" onClose={g.clearNudge}>
          {g.nudgedBy} stupst dich an
        </Alert>
      </Snackbar>
      <Snackbar open={g.error !== null} autoHideDuration={4000} onClose={g.clearError}>
        <Alert severity="error" onClose={g.clearError}>
          {g.error}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
