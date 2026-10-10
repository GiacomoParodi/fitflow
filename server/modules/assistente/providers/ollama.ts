import type { ModelloInstallato } from '../../../../shared/assistente';
import { ApiError } from '../../../store';
import { chiama, erroreDa, righe } from './http';
import type { AiProvider, ChatChunk, ChatRequest, PullProgress } from './types';

const NOME = 'Ollama';

export function sembraEmbedding(name: string, families: string[] = []): boolean {
  return /embed|bge-|minilm|e5-|gte-|arctic-embed/i.test(name) || families.some(f => /bert/i.test(f));
}

function modelloMancante(model: string) {
  return new ApiError(404, `Il modello "${model}" non è scaricato in Ollama. Scaricalo da Impostazioni → Motore AI (oppure con "ollama pull ${model}").`);
}

/** Ollama tramite la sua API nativa (http://127.0.0.1:11434). */
export class OllamaProvider implements AiProvider {
  readonly kind = 'ollama' as const;
  constructor(readonly url: string) {}

  private async errore(res: Response, model?: string): Promise<never> {
    const msg = await erroreDa(res);
    if (model && (res.status === 404 || /not found|pull/i.test(msg))) throw modelloMancante(model);
    throw new ApiError(502, `Ollama ha risposto con un errore: ${msg}`);
  }

  async version(signal?: AbortSignal) {
    const res = await chiama(this.url + '/api/version', { signal, timeoutMs: 4000 }, NOME);
    if (!res.ok) throw new ApiError(502, `All'indirizzo ${this.url} risponde un servizio che non sembra Ollama.`);
    const j = await res.json().catch(() => null) as { version?: string } | null;
    if (!j || typeof j.version !== 'string') throw new ApiError(502, `All'indirizzo ${this.url} risponde un servizio che non sembra Ollama.`);
    return j.version;
  }

  async listModels(signal?: AbortSignal): Promise<ModelloInstallato[]> {
    const res = await chiama(this.url + '/api/tags', { signal, timeoutMs: 8000 }, NOME);
    if (!res.ok) await this.errore(res);
    const j = await res.json() as { models?: { name: string; size?: number; details?: { family?: string; families?: string[]; parameter_size?: string; quantization_level?: string } }[] };
    return (j.models ?? []).map(m => ({
      nome: m.name,
      dimensione: m.size ?? null,
      famiglia: m.details?.family ?? '',
      parametri: m.details?.parameter_size ?? '',
      quantizzazione: m.details?.quantization_level ?? '',
      embedding: sembraEmbedding(m.name, m.details?.families ?? (m.details?.family ? [m.details.family] : [])),
    })).sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async *chat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatChunk> {
    const { seed, ...opts } = req.options;
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      stream: true,
      options: seed === null ? opts : { ...opts, seed },
      think: req.think,
    };
    if (req.format) body.format = req.format;
    let res = await chiama(this.url + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }, NOME);
    if (res.status === 400) {
      // Versioni o modelli che non accettano il parametro "think": si riprova senza.
      const msg = await erroreDa(res);
      if (!/think/i.test(msg)) throw new ApiError(502, `Ollama ha risposto con un errore: ${msg}`);
      delete body.think;
      res = await chiama(this.url + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }, NOME);
    }
    if (!res.ok) await this.errore(res, req.model);
    for await (const line of righe(res)) {
      let j: { error?: string; message?: { content?: string; thinking?: string }; done?: boolean; done_reason?: string; prompt_eval_count?: number; eval_count?: number };
      try { j = JSON.parse(line); } catch { continue; }
      if (j.error) {
        if (/not found/i.test(j.error)) throw modelloMancante(req.model);
        throw new ApiError(502, `Ollama: ${j.error}`);
      }
      const out: ChatChunk = {};
      if (j.message?.content) out.content = j.message.content;
      if (j.message?.thinking) out.thinking = j.message.thinking;
      if (j.done) {
        out.done = true;
        out.doneReason = j.done_reason;
        out.promptTokens = j.prompt_eval_count;
        out.outputTokens = j.eval_count;
      }
      yield out;
    }
  }

  async embed(model: string, inputs: string[], signal?: AbortSignal): Promise<number[][]> {
    if (!inputs.length) return [];
    const res = await chiama(this.url + '/api/embed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: inputs, truncate: true }), signal, timeoutMs: 120_000,
    }, NOME);
    if (!res.ok) {
      const msg = await erroreDa(res);
      if (res.status === 404 || /not found/i.test(msg)) throw modelloMancante(model);
      if (/does not support embed/i.test(msg)) throw new ApiError(400, `Il modello "${model}" non calcola embedding: scegli un modello di embedding.`);
      throw new ApiError(502, `Ollama ha risposto con un errore: ${msg}`);
    }
    const j = await res.json() as { embeddings?: number[][] };
    if (!Array.isArray(j.embeddings) || j.embeddings.length !== inputs.length) throw new ApiError(502, 'Ollama ha restituito embedding non validi.');
    return j.embeddings;
  }

  async *pull(model: string, signal?: AbortSignal): AsyncGenerator<PullProgress> {
    const res = await chiama(this.url + '/api/pull', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: true }), signal,
    }, NOME);
    if (!res.ok) {
      const msg = await erroreDa(res);
      throw new ApiError(502, `Download non riuscito: ${msg}`);
    }
    for await (const line of righe(res)) {
      let j: { error?: string; status?: string; total?: number; completed?: number };
      try { j = JSON.parse(line); } catch { continue; }
      if (j.error) {
        if (/file does not exist|not found|manifest/i.test(j.error)) throw new ApiError(404, `Il modello "${model}" non esiste nella libreria di Ollama.`);
        throw new ApiError(502, `Download non riuscito: ${j.error}`);
      }
      yield { status: j.status ?? '', completed: j.completed ?? null, total: j.total ?? null };
    }
  }
}
