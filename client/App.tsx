import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnimations } from './animations';
import { Chat } from './components/Chat';
import { LanguageSwitch } from './components/LanguageSwitch';
import { LeaveButton } from './components/LeaveButton';
import { AnimationsToggle, RulesButton } from './components/RulesDialog';
import { VersionBadge } from './components/VersionBadge';
import { Home } from './screens/Home';
import { translateError } from './lang';
import { useGame } from './useGame';
import { useWakeLock } from './useWakeLock';

const NUDGE_BLUE = '#2196f3';

function NudgeGlow() {
  const { enabled: animations } = useAnimations();
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        pointerEvents: 'none',
        boxShadow: `inset 0 0 0 4px ${NUDGE_BLUE}, inset 0 0 48px 14px rgba(33,150,243,0.75)`,
        animation: animations ? 'skyjo-nudge 1.2s ease-in-out infinite' : 'none',
        '@keyframes skyjo-nudge': {
          '0%, 100%': { boxShadow: `inset 0 0 0 4px ${NUDGE_BLUE}, inset 0 0 12px 2px rgba(33,150,243,0.35)` },
          '50%': { boxShadow: `inset 0 0 0 4px ${NUDGE_BLUE}, inset 0 0 48px 14px rgba(33,150,243,0.75)` },
        },
      }}
    />
  );
}

const GameTable = lazy(() => import('./screens/GameTable').then((m) => ({ default: m.GameTable })));
const Lobby = lazy(() => import('./screens/Lobby').then((m) => ({ default: m.Lobby })));

const theme = createTheme({ palette: { mode: 'dark' } });

export function App() {
  const { t } = useTranslation();
  const g = useGame();
  useWakeLock(g.state?.game != null);
  const initialCode = new URLSearchParams(location.search).get('raum')?.toUpperCase() ?? '';
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container component="main" maxWidth="md" sx={{ pb: 4 }}>
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
        <Suspense fallback={null}>
        {g.booting ? null : g.state === null ? (
          <Home initialCode={initialCode} onCreate={g.create} onJoin={g.join} />
        ) : g.state.game === null ? (
          <Lobby state={g.state} onStart={g.start} onRemove={g.remove} onTarget={g.setTarget} onAddBot={g.addBot} onLeave={g.leave} />
        ) : (
          <GameTable state={g.state} act={g.act} remove={g.remove} nudge={g.nudge} next={g.next} rematch={g.rematch} play={g.play} leave={g.leave} />
        )}
        </Suspense>
      </Container>
      {g.state && <Chat messages={g.chat} me={g.state.me} onSend={g.sendChat} />}
      <LanguageSwitch />
      <VersionBadge devAllowed={!!g.state?.devAllowed} devOn={!!g.state?.dev} onToggleDev={g.setDev} />
      {g.nudgedBy !== null && <NudgeGlow />}
      <Snackbar open={g.nudgedBy !== null} autoHideDuration={5000} onClose={g.clearNudge}>
        <Alert severity="info" onClose={g.clearNudge}>
          {g.nudgedBy} stupst dich an
        </Alert>
      </Snackbar>
      <Snackbar open={g.error !== null} autoHideDuration={4000} onClose={g.clearError}>
        <Alert severity="error" onClose={g.clearError}>
          {g.error !== null && translateError(t, g.error)}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
