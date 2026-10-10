import type { ModelloInstallato } from '../../../../shared/assistente';
import { ApiError } from '../../../store';
import { chiama, erroreDa, righe } from './http';
import { sembraEmbedding } from './ollama';
import type { AiProvider, ChatChunk, ChatRequest } from './types';

const NOME = 'Il server del modello';

/**
 * Server locali compatibili con l'API OpenAI (LM Studio, llama.cpp server, vLLM…).
 * `url` può essere con o senza "/v1".
 */
export class OpenAICompatProvider implements AiProvider {
  readonly kind = 'openai' as const;
  private readonly base: string;
  constructor(readonly url: string, private readonly apiKey = '') {
    this.base = /\/v1$/.test(url) ? url : url + '/v1';
  }

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h['Content-Type'] = 'application/json';
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  private async errore(res: Response, model?: string): Promise<never> {
    const msg = await erroreDa(res);
    if (res.status === 401 || res.status === 403) throw new ApiError(502, 'Il server del modello rifiuta la richiesta: controlla la chiave API nelle impostazioni.');
    if (model && (res.status === 404 || /model.*(not found|does not exist)|no model/i.test(msg))) {
      throw new ApiError(404, `Il modello "${model}" non è disponibile sul server: caricalo nel programma (es. LM Studio) e riprova.`);
    }
    throw new ApiError(502, `Il server del modello ha risposto con un errore: ${msg}`);
  }

  async version(signal?: AbortSignal) {
    const res = await chiama(this.base + '/models', { headers: this.headers(), signal, timeoutMs: 4000 }, NOME);
    if (!res.ok) await this.errore(res);
    return null;
  }

  async listModels(signal?: AbortSignal): Promise<ModelloInstallato[]> {
    const res = await chiama(this.base + '/models', { headers: this.headers(), signal, timeoutMs: 8000 }, NOME);
    if (!res.ok) await this.errore(res);
    const j = await res.json() as { data?: { id: string }[] };
    return (j.data ?? []).map(m => ({
      nome: m.id, dimensione: null, famiglia: '', parametri: '', quantizzazione: '', embedding: sembraEmbedding(m.id),
    })).sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async *chat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatChunk> {
    const o = req.options;
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: o.temperature,
      top_p: o.top_p,
      top_k: o.top_k,
      max_tokens: o.num_predict,
    };
    if (o.seed !== null) body.seed = o.seed;
    // Lo schema JSON non è passato come vincolo (non tutti i server lo supportano): è nelle istruzioni.
    const res = await chiama(this.base + '/chat/completions', { method: 'POST', headers: this.headers(true), body: JSON.stringify(body), signal }, NOME);
    if (!res.ok) await this.errore(res, req.model);
    let promptTokens: number | undefined;
    let outputTokens: number | undefined;
    let doneReason: string | undefined;
    for await (const line of righe(res)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') break;
      let j: { error?: unknown; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: { delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null }; finish_reason?: string | null }[] };
      try { j = JSON.parse(data); } catch { continue; }
      if (j.error) throw new ApiError(502, `Il server del modello: ${typeof j.error === 'string' ? j.error : JSON.stringify(j.error)}`);
      if (j.usage) { promptTokens = j.usage.prompt_tokens; outputTokens = j.usage.completion_tokens; }
      const ch = j.choices?.[0];
      if (!ch) continue;
      const out: ChatChunk = {};
      if (ch.delta?.content) out.content = ch.delta.content;
      const think = ch.delta?.reasoning_content ?? ch.delta?.reasoning;
      if (think) out.thinking = think;
      if (ch.finish_reason) doneReason = ch.finish_reason === 'length' ? 'length' : 'stop';
      if (out.content || out.thinking) yield out;
    }
    yield { done: true, promptTokens, outputTokens, doneReason };
  }

  async embed(model: string, inputs: string[], signal?: AbortSignal): Promise<number[][]> {
    if (!inputs.length) return [];
    const res = await chiama(this.base + '/embeddings', {
      method: 'POST', headers: this.headers(true), body: JSON.stringify({ model, input: inputs }), signal, timeoutMs: 120_000,
    }, NOME);
    if (!res.ok) await this.errore(res, model);
    const j = await res.json() as { data?: { embedding: number[]; index?: number }[] };
    const data = [...(j.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (data.length !== inputs.length) throw new ApiError(502, 'Il server del modello ha restituito embedding non validi.');
    return data.map(d => d.embedding);
  }
}
