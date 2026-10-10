// Formato della libreria di esercizi (content/esercizi.json), base di conoscenza dell'assistente AI.

export const CATEGORIE = ['forza', 'core', 'cardio', 'pliometria', 'mobilita', 'stretching', 'equilibrio', 'posturale', 'respirazione'] as const;
export type Categoria = (typeof CATEGORIE)[number];

export const LIVELLI_ESERCIZIO = ['base', 'intermedio', 'avanzato'] as const;
export type LivelloEsercizio = (typeof LIVELLI_ESERCIZIO)[number];

/** Attrezzi riconosciuti. Un esercizio a corpo libero ha `attrezzi: []`. */
export const ATTREZZI = [
  'tappetino', 'manubri', 'kettlebell', 'bilanciere', 'elastico', 'mini band', 'fitball', 'bosu',
  'step', 'sbarra', 'anelli', 'TRX', 'panca', 'spalliera', 'cavi', 'palla medica', 'foam roller',
  'corda', 'cerchio pilates', 'bastone', 'parallele', 'cassone', 'sedia',
] as const;
export type Attrezzo = (typeof ATTREZZI)[number];

export interface Esercizio {
  /** Slug stabile in minuscolo-con-trattini, es. "squat-a-corpo-libero". */
  id: string;
  nome: string;
  altriNomi: string[];
  categoria: Categoria;
  attrezzi: Attrezzo[];
  muscoliPrincipali: string[];
  muscoliSecondari: string[];
  livello: LivelloEsercizio;
  /** Esecuzione passo passo, 2–5 frasi. */
  esecuzione: string;
  /** Indicazioni tecniche brevi da dare all'allievo. */
  indicazioni: string[];
  erroriComuni: string[];
  /** Cautele e situazioni in cui evitarlo o adattarlo (non diagnosi). */
  cautele: string[];
  /** id di esercizi più facili / più difficili della stessa famiglia. */
  regressioni: string[];
  progressioni: string[];
  /** Obiettivi o problemi per cui è utile, es. "postura", "lombalgia aspecifica", "tonificazione glutei". */
  obiettivi: string[];
  /** Dosaggio tipico, es. "3 serie × 10–12 ripetizioni, recupero 60 s". */
  dosaggio: string;
}
