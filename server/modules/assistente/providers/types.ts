import type { ModelloInstallato, ProviderKind } from '../../../../shared/assistente';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature: number;
  top_p: number;
  top_k: number;
  /** Finestra di contesto (ignorata dai server che non la permettono per richiesta). */
  num_ctx: number;
  /** Lunghezza massima della risposta. */
  num_predict: number;
  seed: number | null;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  options: ChatOptions;
  /** JSON Schema della risposta: vincolato dove il motore lo supporta. */
  format?: Record<string, unknown>;
  /** false = disattiva il "ragionamento" dei modelli che lo prevedono. */
  think: boolean;
}

export interface ChatChunk {
  content?: string;
  thinking?: string;
  done?: boolean;
  /** Token letti / generati, quando il motore li comunica. */
  promptTokens?: number;
  outputTokens?: number;
  doneReason?: string;
}

export interface PullProgress {
  status: string;
  completed: number | null;
  total: number | null;
}

/**
 * Un motore di modelli linguistici locale. Le implementazioni lanciano ApiError con messaggi in italiano
 * (motore non avviato, modello mancante…).
 */
export interface AiProvider {
  readonly kind: ProviderKind;
  readonly url: string;
  /** Versione del motore; lancia ApiError se non risponde. */
  version(signal?: AbortSignal): Promise<string | null>;
  listModels(signal?: AbortSignal): Promise<ModelloInstallato[]>;
  chat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatChunk>;
  embed(model: string, inputs: string[], signal?: AbortSignal): Promise<number[][]>;
  /** Scarica un modello (non tutti i motori lo permettono). */
  pull?(model: string, signal?: AbortSignal): AsyncGenerator<PullProgress>;
}
