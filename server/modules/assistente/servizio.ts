import type { Database } from '../../db';
import { ApiError, type Store } from '../../store';
import type { ImpostazioniAssistente, ModelloInstallato, StatoMotore } from '../../../shared/assistente';
import { Agenti } from './agenti';
import { Documenti } from './conoscenza/documenti';
import { LibreriaEsercizi } from './conoscenza/esercizi';
import { impostazioni } from './impostazioni';
import { ramGb, risolviChat, risolviEmbedding, stessoModello } from './modelli';
import { cartellaContenuti } from './percorsi';
import { Programmi } from './programmi';
import { creaProvider, type AiProvider, type ProviderFactory } from './providers';

export interface OpzioniAssistente {
  /** Cartella `content/` (predefinita: trovata risalendo dal codice). null = nessun contenuto. */
  contentDir?: string | null;
  /** Per i test: motore finto. */
  providerFactory?: ProviderFactory;
  /** Per i test: memoria del computer in GB. */
  ramGb?: number;
}

/** Tutto lo stato del modulo per un database aperto. */
export class Assistente {
  readonly agenti: Agenti;
  readonly libreria: LibreriaEsercizi;
  readonly documenti: Documenti;
  readonly programmi: Programmi;
  readonly impostazioni: ReturnType<typeof impostazioni>;
  readonly contentDir: string | null;
  readonly ram: number;
  private factory: ProviderFactory;
  private cacheModelli: { chiave: string; quando: number; modelli: ModelloInstallato[] } | null = null;

  constructor(readonly db: Database, dataDir: string, readonly core: Store, opts: OpzioniAssistente = {}) {
    this.factory = opts.providerFactory ?? creaProvider;
    this.ram = opts.ramGb ?? ramGb();
    this.contentDir = opts.contentDir !== undefined ? opts.contentDir : cartellaContenuti();
    this.impostazioni = impostazioni(db);
    this.agenti = new Agenti(db);
    this.libreria = new LibreriaEsercizi(db);
    this.documenti = new Documenti(db, dataDir, () => this.embeddingAttivo());
    this.programmi = new Programmi(db, id => core.participants().some(p => p.id === id));
  }

  /** Primo avvio e ogni avvio: agenti predefiniti, libreria esercizi, schede di conoscenza, coda rimasta a metà. */
  avvia() {
    this.agenti.inizializza();
    this.libreria.carica(this.contentDir);
    this.documenti.sincronizzaConoscenze(this.contentDir);
    this.documenti.riprendi();
    // Se nel frattempo è cambiato il modello di embedding, ricalcola i vettori (in background).
    void this.documenti.aggiornaVettori().catch(() => 0);
  }

  ferma() {
    this.documenti.ferma();
  }

  provider(s: ImpostazioniAssistente = this.impostazioni.get()): AiProvider {
    return this.factory(s);
  }

  /** Modelli installati, con una breve cache per non interrogare il motore a ogni ricerca. */
  async modelli(force = false, signal?: AbortSignal): Promise<ModelloInstallato[]> {
    const s = this.impostazioni.get();
    const chiave = `${s.provider}|${s.url}`;
    if (!force && this.cacheModelli && this.cacheModelli.chiave === chiave && Date.now() - this.cacheModelli.quando < 15_000) {
      return this.cacheModelli.modelli;
    }
    const modelli = await this.provider(s).listModels(signal);
    this.cacheModelli = { chiave, quando: Date.now(), modelli };
    return modelli;
  }

  invalidaCache() {
    this.cacheModelli = null;
  }

  /** Modello di embedding in uso (null = solo ricerca testuale). */
  async embeddingAttivo(): Promise<{ provider: AiProvider; modello: string } | null> {
    const s = this.impostazioni.get();
    let modelli: ModelloInstallato[];
    try { modelli = await this.modelli(); } catch { return null; }
    const modello = risolviEmbedding(s.modelloEmbedding, modelli);
    if (!modello) return null;
    if (s.provider === 'ollama' && !modelli.some(m => stessoModello(m.nome, modello))) return null;
    return { provider: this.provider(s), modello };
  }

  /** Modello chat per un agente; errore chiaro se non c'è. */
  async modelloChat(sceltoAgente: string, signal?: AbortSignal): Promise<string> {
    const s = this.impostazioni.get();
    const modelli = await this.modelli(true, signal);
    const modello = risolviChat(sceltoAgente || s.modelloChat, modelli, this.ram);
    if (!modello) {
      throw new ApiError(409, s.provider === 'ollama'
        ? 'Nessun modello installato in Ollama: scarica il modello consigliato da Impostazioni → Motore AI.'
        : 'Il server del modello non ha modelli caricati: caricane uno (es. in LM Studio) e riprova.');
    }
    if (!modelli.some(m => stessoModello(m.nome, modello))) {
      throw new ApiError(404, s.provider === 'ollama'
        ? `Il modello "${modello}" non è scaricato in Ollama. Scaricalo da Impostazioni → Motore AI oppure scegli un altro modello.`
        : `Il modello "${modello}" non è disponibile sul server del modello.`);
    }
    return modello;
  }

  async stato(): Promise<StatoMotore> {
    const s = this.impostazioni.get();
    const base: StatoMotore = {
      provider: s.provider, url: s.url, raggiungibile: false, versione: null, errore: null, modelli: [], impostazioni: s,
      modelloChatInstallato: false, modelloEmbeddingInstallato: false, ramGb: this.ram,
      indicizzazione: this.documenti.stato(), eserciziInLibreria: this.libreria.conta(),
    };
    try {
      const p = this.provider(s);
      base.versione = await p.version();
      base.modelli = await this.modelli(true);
      base.raggiungibile = true;
      const chat = risolviChat(s.modelloChat, base.modelli, this.ram);
      base.modelloChatInstallato = !!chat && base.modelli.some(m => stessoModello(m.nome, chat));
      const emb = risolviEmbedding(s.modelloEmbedding, base.modelli);
      base.modelloEmbeddingInstallato = !!emb && base.modelli.some(m => stessoModello(m.nome, emb));
    } catch (e) {
      base.errore = e instanceof ApiError ? e.message : 'Motore AI non raggiungibile.';
    }
    return base;
  }
}
