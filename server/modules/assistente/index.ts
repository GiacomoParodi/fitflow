import type { Database } from '../../db';
import type { ModuleContext, ServerModule } from '../types';
import { migrazioni } from './migrazioni';
import { creaRouter } from './router';
import { Assistente, type OpzioniAssistente } from './servizio';

export { Assistente } from './servizio';

/**
 * Modulo "assistente": generatore di esercizi e analisi della cartella con un modello linguistico locale
 * (Ollama o un server compatibile OpenAI).
 */
export function creaModuloAssistente(opts: OpzioniAssistente = {}): ServerModule & { istanza: (db: Database) => Assistente | undefined } {
  // Un'istanza per database aperto (server, demo e test possono aprirne più d'uno).
  const istanze = new WeakMap<Database, Assistente>();
  const get = (ctx: ModuleContext) => {
    let a = istanze.get(ctx.db);
    if (!a) {
      a = new Assistente(ctx.db, ctx.dataDir, ctx.core, opts);
      istanze.set(ctx.db, a);
    }
    return a;
  };
  return {
    id: 'assistente',
    migrations: migrazioni,
    init: ctx => get(ctx).avvia(),
    onParticipantRemoved: (ctx, pid) => get(ctx).rimuoviIscritto(pid),
    createRouter: ctx => creaRouter(get(ctx), ctx.today),
    istanza: db => istanze.get(db),
  };
}

export const assistente = creaModuloAssistente();
