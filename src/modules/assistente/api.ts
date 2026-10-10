import { ApiFailure, request } from '../../api';
import type {
  Agente, AgenteInput, Contenuto, Documento, EventoDownload, EventoGenerazione, ImpostazioniAssistente,
  InputGenerazione, ModelloConsigliato, ModelloInstallato, Programma, StatoMotore,
} from '../../../shared/assistente';
import type { Esercizio } from '../../../shared/esercizi';

const B = '/assistente';

export interface EsercizioTrovato extends Esercizio { punteggio: number; cauteleRilevanti: string[] }
export interface FiltriEsercizi { totale: number; categorie: string[]; attrezzi: string[]; livelli: string[] }

export const ass = {
  stato: () => request<StatoMotore>('GET', `${B}/stato`),
  impostazioni: (p: Partial<ImpostazioniAssistente>) => request<StatoMotore>('PUT', `${B}/impostazioni`, p),
  consigliati: () => request<{ ramGb: number; modelli: ModelloConsigliato[] }>('GET', `${B}/modelli/consigliati`),
  modelli: () => request<ModelloInstallato[]>('GET', `${B}/modelli`),

  agenti: () => request<Agente[]>('GET', `${B}/agenti`),
  creaAgente: (a: AgenteInput) => request<Agente>('POST', `${B}/agenti`, a),
  salvaAgente: (id: number, a: Partial<AgenteInput>) => request<Agente>('PUT', `${B}/agenti/${id}`, a),
  eliminaAgente: (id: number) => request<Agente[]>('DELETE', `${B}/agenti/${id}`),
  duplicaAgente: (id: number) => request<Agente>('POST', `${B}/agenti/${id}/duplica`),
  ripristinaAgenti: () => request<Agente[]>('POST', `${B}/agenti/ripristina`),

  filtriEsercizi: () => request<FiltriEsercizi>('GET', `${B}/esercizi/filtri`),
  esercizi: (f: { q?: string; categoria?: string; livello?: string; attrezzi?: string[] | null }) => {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.categoria) p.set('categoria', f.categoria);
    if (f.livello) p.set('livello', f.livello);
    if (f.attrezzi) p.set('attrezzi', f.attrezzi.join(','));
    return request<EsercizioTrovato[]>('GET', `${B}/esercizi?${p}`);
  },
  esercizio: (id: string) => request<Esercizio>('GET', `${B}/esercizi/${encodeURIComponent(id)}`),

  documenti: (iscritto?: number | 'generale') => request<Documento[]>('GET', `${B}/documenti${iscritto !== undefined ? `?iscritto=${iscritto}` : ''}`),
  caricaDocumento: (file: File, partecipanteId: number | null) => request<Documento>('POST', `${B}/documenti`, file, {
    'Content-Type': 'application/octet-stream',
    'X-File-Name': encodeURIComponent(file.name),
    ...(partecipanteId ? { 'X-Participant-Id': String(partecipanteId) } : {}),
  }),
  eliminaDocumento: (id: number) => request<{ ok: true }>('DELETE', `${B}/documenti/${id}`),
  reindicizzaDocumento: (id: number) => request<Documento>('POST', `${B}/documenti/${id}/reindicizza`),
  reindicizza: () => request<{ ok: true }>('POST', `${B}/reindicizza`),
  urlDocumento: (id: number) => `/api${B}/documenti/${id}/file`,

  programmi: (iscritto?: number | 'generale') => request<Programma[]>('GET', `${B}/programmi${iscritto !== undefined ? `?iscritto=${iscritto}` : ''}`),
  creaProgramma: (p: { partecipanteId: number | null; agenteId: number | null; contenuto: Contenuto; input?: Partial<InputGenerazione>; stato?: 'bozza' | 'approvato' }) =>
    request<Programma>('POST', `${B}/programmi`, p),
  salvaProgramma: (id: number, p: Partial<Pick<Programma, 'contenuto' | 'stato' | 'partecipanteId' | 'titolo'>>) => request<Programma>('PUT', `${B}/programmi/${id}`, p),
  eliminaProgramma: (id: number) => request<{ ok: true }>('DELETE', `${B}/programmi/${id}`),
};

/**
 * POST che risponde in NDJSON: chiama `onEvent` per ogni riga. Se il server risponde con un errore prima
 * dello stream, rifiuta con ApiFailure. Interrompibile con `signal` (AbortError).
 */
export async function streamNdjson<E>(url: string, body: unknown, onEvent: (e: E) => void, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api' + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ApiFailure('Server non raggiungibile: controlla che l\'app sia avviata.');
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new ApiFailure(data?.error || `Errore ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line) as E);
    }
  }
  if (buf.trim()) onEvent(JSON.parse(buf) as E);
}

export const generaStream = (input: InputGenerazione, onEvent: (e: EventoGenerazione) => void, signal?: AbortSignal) =>
  streamNdjson<EventoGenerazione>(`${B}/genera`, input, onEvent, signal);

export const scaricaModello = (nome: string, onEvent: (e: EventoDownload) => void, signal?: AbortSignal) =>
  streamNdjson<EventoDownload>(`${B}/modelli/scarica`, { nome }, onEvent, signal);

export const messaggio = (e: unknown) => (e instanceof ApiFailure ? e.message : e instanceof Error && e.name === 'AbortError' ? 'Interrotto.' : 'Operazione non riuscita.');

/** Notifica tra le parti del modulo (es. impostazioni cambiate → la pagina ricarica lo stato). */
export const eventi = new EventTarget();
export const avvisaCambio = (tipo: 'motore' | 'agenti' | 'programmi' | 'documenti') => eventi.dispatchEvent(new Event(tipo));
