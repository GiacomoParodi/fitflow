import { useCallback, useEffect, useRef, useState } from 'react';
import { ass, eventi, messaggio } from './api';

/** Carica un dato asincrono e lo ricarica quando arrivano gli eventi indicati. */
export function useDati<T>(load: () => Promise<T>, deps: unknown[], ascolta: string[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  const seq = useRef(0);

  const ricarica = useCallback(async () => {
    const n = ++seq.current;
    setCaricamento(true);
    try {
      const d = await loadRef.current();
      if (n === seq.current) { setData(d); setErrore(null); }
    } catch (e) {
      if (n === seq.current) setErrore(messaggio(e));
    } finally {
      if (n === seq.current) setCaricamento(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void ricarica(); }, deps);
  useEffect(() => {
    const h = () => { void ricarica(); };
    for (const t of ascolta) eventi.addEventListener(t, h);
    return () => { for (const t of ascolta) eventi.removeEventListener(t, h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ricarica, ascolta.join()]);

  return { data, errore, caricamento, ricarica, setData };
}

export const useStato = () => useDati(ass.stato, [], ['motore']);
export const useAgenti = () => useDati(ass.agenti, [], ['agenti']);

/** Ripete `fn` ogni `ms` finché `attivo` è vero (es. stato di indicizzazione dei documenti). */
export function useIntervallo(fn: () => void, ms: number, attivo: boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!attivo) return;
    const t = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(t);
  }, [ms, attivo]);
}

export function fmtByte(n: number | null): string {
  if (n === null || n === undefined) return '';
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(1).replace('.', ',') + ' GB';
  if (n >= 1024 ** 2) return Math.round(n / 1024 ** 2) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

export function fmtData(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
