import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { todayISO } from '../shared/dates';
import type { AppState } from '../shared/types';
import { ApiFailure, api } from './api';
import { decorate, type DecoratedParticipant } from './derive';

export type Tab = 'dashboard' | 'corsi' | 'statistiche' | 'impostazioni';

interface Route { tab: Tab; courseId: number | null }

function parseHash(): Route {
  const [, tab, id] = window.location.hash.replace(/^#/, '').split('/');
  const known: Tab[] = ['dashboard', 'corsi', 'statistiche', 'impostazioni'];
  return { tab: known.includes(tab as Tab) ? tab as Tab : 'dashboard', courseId: id ? Number(id) || null : null };
}

interface Ctx {
  state: AppState;
  people: DecoratedParticipant[];
  today: string;
  route: Route;
  go: (tab: Tab, courseId?: number | null) => void;
  /** Runs a mutation; resolves to an error message, or null on success. */
  run: (fn: () => Promise<AppState>) => Promise<string | null>;
  /** Like run, but shows failures as a toast. */
  act: (fn: () => Promise<AppState>) => Promise<boolean>;
  openParticipant: (id: number | null) => void;
  participantId: number | null;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

export function AppProvider({ children }: { children: (ready: boolean, error: string | null) => ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(parseHash);
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    api.state().then(setState, e => setLoadError(e instanceof Error ? e.message : String(e)));
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    // Keep "today" right when the app stays open overnight.
    const t = window.setInterval(() => setToday(todayISO()), 60_000);
    return () => { window.removeEventListener('hashchange', onHash); window.clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const go = useCallback((tab: Tab, courseId: number | null = null) => {
    window.location.hash = courseId ? `/${tab}/${courseId}` : `/${tab}`;
  }, []);

  const run = useCallback(async (fn: () => Promise<AppState>) => {
    try {
      setState(await fn());
      return null;
    } catch (e) {
      return e instanceof ApiFailure ? e.message : 'Operazione non riuscita.';
    }
  }, []);

  const act = useCallback(async (fn: () => Promise<AppState>) => {
    const err = await run(fn);
    if (err) setToast(err);
    return !err;
  }, [run]);

  const people = useMemo(() => (state ? decorate(state, today) : []), [state, today]);

  const value = useMemo<Ctx | null>(() => state && {
    state, people, today, route, go, run, act, participantId, openParticipant: setParticipantId,
  }, [state, people, today, route, go, run, act, participantId]);

  return (
    <>
      {value ? <AppCtx.Provider value={value}>{children(true, null)}</AppCtx.Provider> : children(false, loadError)}
      {toast && <div className="toast" role="alert">{toast}</div>}
    </>
  );
}
