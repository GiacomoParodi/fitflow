import { moduleSettings, type Database } from '../../db';
import { ApiError } from '../../store';
import type { ImpostazioniAssistente, ProviderKind } from '../../../shared/assistente';
import { URL_PREDEFINITI } from './providers';
import { MODELLO_CHAT_PREDEFINITO, MODELLO_EMBEDDING_PREDEFINITO } from './modelli';
import { validaUrlLocale } from './urlLocale';

export const IMPOSTAZIONI_PREDEFINITE: ImpostazioniAssistente = {
  provider: 'ollama',
  url: URL_PREDEFINITI.ollama,
  apiKey: '',
  modelloChat: MODELLO_CHAT_PREDEFINITO,
  modelloEmbedding: MODELLO_EMBEDDING_PREDEFINITO,
};

const nomeModello = (v: unknown, campo: string): string => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length > 200 || /[\s"'<>]/.test(s)) throw new ApiError(400, `${campo}: nome del modello non valido.`);
  return s;
};

export function impostazioni(db: Database) {
  const s = moduleSettings(db, 'assistente', IMPOSTAZIONI_PREDEFINITE);
  return {
    get: s.get,
    /** Valida e salva; restituisce le impostazioni aggiornate. */
    aggiorna(patch: Record<string, unknown>): ImpostazioniAssistente {
      const clean: Partial<ImpostazioniAssistente> = {};
      if ('provider' in patch) {
        if (patch.provider !== 'ollama' && patch.provider !== 'openai') throw new ApiError(400, 'Motore non valido.');
        clean.provider = patch.provider as ProviderKind;
      }
      if ('url' in patch) clean.url = validaUrlLocale(String(patch.url ?? ''));
      if ('apiKey' in patch) clean.apiKey = String(patch.apiKey ?? '').trim().slice(0, 500);
      if ('modelloChat' in patch) clean.modelloChat = nomeModello(patch.modelloChat, 'Modello');
      if ('modelloEmbedding' in patch) clean.modelloEmbedding = nomeModello(patch.modelloEmbedding, 'Modello di embedding');
      s.set(clean);
      return s.get();
    },
  };
}
