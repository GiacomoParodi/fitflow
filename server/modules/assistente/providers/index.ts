import type { ImpostazioniAssistente } from '../../../../shared/assistente';
import { validaUrlLocale } from '../urlLocale';
import { OllamaProvider } from './ollama';
import { OpenAICompatProvider } from './openai';
import type { AiProvider } from './types';

export type { AiProvider } from './types';

export type ProviderFactory = (s: ImpostazioniAssistente) => AiProvider;

/** Crea il motore indicato nelle impostazioni (l'URL è sempre riverificato come locale). */
export const creaProvider: ProviderFactory = s => {
  const url = validaUrlLocale(s.url);
  return s.provider === 'openai' ? new OpenAICompatProvider(url, s.apiKey) : new OllamaProvider(url);
};

export const URL_PREDEFINITI = { ollama: 'http://127.0.0.1:11434', openai: 'http://127.0.0.1:1234' } as const;
