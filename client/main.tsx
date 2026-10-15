import { createRoot } from 'react-dom/client';
import { AnimationsProvider } from './animations';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <AnimationsProvider>
    <App />
  </AnimationsProvider>,
);
