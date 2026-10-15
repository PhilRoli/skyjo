import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const KEY = 'skyjo-animations';

function initial(): boolean {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch {
    /* storage unavailable: fall through to the system preference */
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Ctx {
  enabled: boolean;
  toggle: () => void;
}

const AnimationsContext = createContext<Ctx>({ enabled: true, toggle: () => {} });

export function AnimationsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(initial);
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      try {
        localStorage.setItem(KEY, prev ? 'off' : 'on');
      } catch {
        /* the setting just won't be remembered */
      }
      return !prev;
    });
  }, []);
  const value = useMemo(() => ({ enabled, toggle }), [enabled, toggle]);
  return <AnimationsContext.Provider value={value}>{children}</AnimationsContext.Provider>;
}

export const useAnimations = () => useContext(AnimationsContext);
