import os from 'node:os';
import type { ModelloConsigliato, ModelloInstallato } from '../../../shared/assistente';

/** Vuoto = scelta automatica (il consigliato se installato, altrimenti il primo disponibile). */
export const MODELLO_CHAT_PREDEFINITO = '';
export const MODELLO_EMBEDDING_PREDEFINITO = '';

type Voce = Omit<ModelloConsigliato, 'installato' | 'consigliato' | 'adatto'>;

/**
 * Modelli della libreria Ollama scelti per FitFlow (ottobre 2026): buon italiano, risposte JSON affidabili,
 * leggeri abbastanza per un Mac M1 con 8 GB o un PC senza scheda video. Dimensioni indicative (quantizzazione Q4).
 */
export const CATALOGO: Voce[] = [
  {
    nome: 'qwen3.5:4b', tipo: 'chat', titolo: 'Qwen 3.5 · 4B', dimensioneGb: 3.4, ramMinGb: 8,
    descrizione: 'Il più equilibrato per 8 GB: ottimo italiano, segue bene istruzioni e formato JSON. Su Mac M1 risponde in tempi buoni.',
  },
  {
    nome: 'gemma3:4b', tipo: 'chat', titolo: 'Gemma 3 · 4B', dimensioneGb: 3.3, ramMinGb: 8,
    descrizione: 'Alternativa di Google con un italiano molto naturale. Utile se Qwen non convince sul tono dei testi.',
  },
  {
    nome: 'qwen3.5:2b', tipo: 'chat', titolo: 'Qwen 3.5 · 2B', dimensioneGb: 2.7, ramMinGb: 6,
    descrizione: 'Versione leggera per PC senza scheda video o con poca memoria: più veloce, un po\' meno preciso.',
  },
  {
    nome: 'gemma3:1b', tipo: 'chat', titolo: 'Gemma 3 · 1B', dimensioneGb: 0.8, ramMinGb: 4,
    descrizione: 'Il minimo indispensabile per computer molto datati: bozze semplici, da rivedere con più attenzione.',
  },
  {
    nome: 'qwen3.5:9b', tipo: 'chat', titolo: 'Qwen 3.5 · 9B', dimensioneGb: 6.6, ramMinGb: 16,
    descrizione: 'Più accurato ma richiede almeno 16 GB di memoria; lento senza scheda video.',
  },
  {
    nome: 'embeddinggemma', tipo: 'embedding', titolo: 'EmbeddingGemma · 300M', dimensioneGb: 0.6, ramMinGb: 4,
    descrizione: 'Modello di embedding multilingue leggerissimo: serve a trovare i passaggi rilevanti nei documenti (ricerca per significato).',
  },
  {
    nome: 'qwen3-embedding:0.6b', tipo: 'embedding', titolo: 'Qwen3 Embedding · 0.6B', dimensioneGb: 0.6, ramMinGb: 4,
    descrizione: 'Alternativa multilingue con contesto più lungo; equivalente per l\'uso in FitFlow.',
  },
];

export function ramGb(): number {
  return Math.round((os.totalmem() / 1024 ** 3) * 10) / 10;
}

/** Nome del modello chat consigliato per la memoria di questo computer. */
export function chatConsigliato(ram: number): string {
  if (ram >= 7) return 'qwen3.5:4b';
  if (ram >= 5) return 'qwen3.5:2b';
  return 'gemma3:1b';
}
export const EMBEDDING_CONSIGLIATO = 'embeddinggemma';

/** Ollama mostra "embeddinggemma:latest" per "embeddinggemma". */
export function stessoModello(a: string, b: string): boolean {
  const n = (s: string) => (s.includes(':') ? s : s + ':latest').toLowerCase();
  return n(a) === n(b);
}

export function consigliati(ram: number, installati: ModelloInstallato[]): ModelloConsigliato[] {
  const chat = chatConsigliato(ram);
  return CATALOGO.map(v => ({
    ...v,
    installato: installati.some(m => stessoModello(m.nome, v.nome)),
    consigliato: v.nome === chat || v.nome === EMBEDDING_CONSIGLIATO,
    adatto: ram + 0.5 >= v.ramMinGb,
  }));
}

/** Modello chat effettivo: quello scelto, oppure (automatico) il consigliato o il primo installato. */
export function risolviChat(scelto: string, installati: ModelloInstallato[], ram: number): string | null {
  if (scelto) return scelto;
  const chat = installati.filter(m => !m.embedding);
  const cons = chat.find(m => stessoModello(m.nome, chatConsigliato(ram)));
  if (cons) return cons.nome;
  const daCatalogo = CATALOGO.filter(v => v.tipo === 'chat').map(v => chat.find(m => stessoModello(m.nome, v.nome))).find(Boolean);
  return daCatalogo?.nome ?? chat[0]?.nome ?? null;
}

/** Modello di embedding effettivo, o null (solo ricerca testuale). */
export function risolviEmbedding(scelto: string, installati: ModelloInstallato[]): string | null {
  if (scelto) return scelto;
  const emb = installati.filter(m => m.embedding);
  return (emb.find(m => stessoModello(m.nome, EMBEDDING_CONSIGLIATO)) ?? emb[0])?.nome ?? null;
}
