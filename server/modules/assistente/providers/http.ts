import { ApiError } from '../../../store';

export const NOME_MOTORE = { ollama: 'Ollama', openai: 'Il server del modello' } as const;

function combina(signal: AbortSignal | undefined, timeoutMs: number | null): AbortSignal | undefined {
  const sigs = [signal, timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined].filter((s): s is AbortSignal => !!s);
  return sigs.length ? AbortSignal.any(sigs) : undefined;
}

export function isAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError');
}

/**
 * fetch verso il motore locale. Non segue redirect (potrebbero portare fuori dal computer) e
 * traduce gli errori di rete in messaggi chiari.
 */
export async function chiama(
  url: string, init: RequestInit & { timeoutMs?: number | null; signal?: AbortSignal }, nome: string,
): Promise<Response> {
  const { timeoutMs = null, signal, ...rest } = init;
  try {
    return await fetch(url, { ...rest, redirect: 'error', signal: combina(signal, timeoutMs) });
  } catch (e) {
    if (signal?.aborted) throw e;
    if (isAbort(e)) throw new ApiError(504, `${nome} non risponde in tempo (${new URL(url).origin}).`);
    throw new ApiError(503, `${nome} non risponde su ${new URL(url).origin}: controlla che sia installato e avviato.`);
  }
}

/** Legge il corpo della risposta riga per riga (NDJSON o SSE). */
export async function* righe(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(chunk, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line.trim()) yield line;
    }
  }
  buf += decoder.decode();
  if (buf.trim()) yield buf.trim();
}

/** Messaggio di errore dal corpo JSON del motore ({ error } oppure { error: { message } }). */
export async function erroreDa(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text);
    const e = j?.error;
    return typeof e === 'string' ? e : typeof e?.message === 'string' ? e.message : text;
  } catch {
    return text || `HTTP ${res.status}`;
  }
}
