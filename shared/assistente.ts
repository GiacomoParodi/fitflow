// Tipi e regole del modulo "assistente" usati sia dal server sia dall'interfaccia.

export const COMPITI = ['genera_programma', 'analizza_cartella', 'libero'] as const;
export type Compito = (typeof COMPITI)[number];

export const COMPITO_LABEL: Record<Compito, string> = {
  genera_programma: 'Genera programma',
  analizza_cartella: 'Analisi cartella',
  libero: 'Libero (risposta di testo)',
};

export type ProviderKind = 'ollama' | 'openai';

/** Fonti di conoscenza che un agente può usare. */
export interface FontiAgente {
  esercizi: boolean;
  conoscenze: boolean;
  documenti: boolean;
  cartella: boolean;
}

export interface Agente {
  id: number;
  nome: string;
  descrizione: string;
  compito: Compito;
  /** Vuoto = modello predefinito del Motore AI. */
  modello: string;
  /** Vuoto = modello di embedding del Motore AI. */
  modelloEmbedding: string;
  promptSistema: string;
  temperatura: number;
  topP: number;
  topK: number;
  /** Finestra di contesto in token (num_ctx). */
  contesto: number;
  /** Lunghezza massima della risposta in token (num_predict / max_tokens). */
  maxRisposta: number;
  seed: number | null;
  /** Lascia "ragionare" i modelli che lo supportano (più lento). */
  ragionamento: boolean;
  fonti: FontiAgente;
  /** Quanti estratti di documenti recuperare. */
  estratti: number;
  /** Chiave dell'agente predefinito da cui deriva (null se creato dall'utente). */
  predefinito: string | null;
  aggiornatoIl: string;
}

export type AgenteInput = Omit<Agente, 'id' | 'predefinito' | 'aggiornatoIl'>;

export interface ImpostazioniAssistente {
  provider: ProviderKind;
  url: string;
  /** Solo per server compatibili OpenAI che la richiedono (resta su questo computer). */
  apiKey: string;
  modelloChat: string;
  modelloEmbedding: string;
}

export interface ModelloInstallato {
  nome: string;
  dimensione: number | null;
  famiglia: string;
  parametri: string;
  quantizzazione: string;
  embedding: boolean;
}

export interface ModelloConsigliato {
  nome: string;
  tipo: 'chat' | 'embedding';
  titolo: string;
  /** Spazio su disco indicativo (GB). */
  dimensioneGb: number;
  /** RAM minima del computer consigliata (GB). */
  ramMinGb: number;
  descrizione: string;
  installato: boolean;
  /** Il migliore per questo computer. */
  consigliato: boolean;
  adatto: boolean;
}

export interface StatoMotore {
  provider: ProviderKind;
  url: string;
  raggiungibile: boolean;
  versione: string | null;
  errore: string | null;
  modelli: ModelloInstallato[];
  impostazioni: ImpostazioniAssistente;
  modelloChatInstallato: boolean;
  /** Modello chat effettivo (risolto se "automatico"). */
  modelloChatEffettivo: string | null;
  modelloEmbeddingEffettivo: string | null;
  modelloEmbeddingInstallato: boolean;
  ramGb: number;
  indicizzazione: { inCoda: number; inCorso: string | null };
  eserciziInLibreria: number;
}

export type StatoDocumento = 'in_attesa' | 'elaborazione' | 'pronto' | 'senza_testo' | 'errore';

export interface Documento {
  id: number;
  origine: 'base' | 'caricato';
  partecipanteId: number | null;
  titolo: string;
  nomeFile: string;
  mime: string;
  dimensione: number;
  stato: StatoDocumento;
  errore: string | null;
  caratteri: number;
  estratti: number;
  estrattiConVettore: number;
  modelloEmbedding: string | null;
  caricatoIl: string;
}

export interface RisultatoRicerca {
  estrattoId: number;
  documentoId: number;
  documento: string;
  origine: 'base' | 'caricato';
  partecipanteId: number | null;
  testo: string;
  punteggio: number;
}

// ─── Contenuti generati ────────────────────────────────────────────────

export interface EsercizioProgramma {
  /** id nella libreria, null se fuori libreria. */
  id: string | null;
  nome: string;
  serie: string;
  /** Ripetizioni o durata. */
  ripetizioni: string;
  recupero: string;
  indicazioni: string;
  motivazione: string;
  fuoriLibreria?: boolean;
}

export const BLOCCHI = ['riscaldamento', 'parteCentrale', 'defaticamento'] as const;
export type Blocco = (typeof BLOCCHI)[number];
export const BLOCCO_LABEL: Record<Blocco, string> = {
  riscaldamento: 'Riscaldamento', parteCentrale: 'Parte centrale', defaticamento: 'Defaticamento',
};

export interface ContenutoProgramma {
  tipo: 'programma';
  titolo: string;
  obiettivo: string;
  durata: string;
  riscaldamento: EsercizioProgramma[];
  parteCentrale: EsercizioProgramma[];
  defaticamento: EsercizioProgramma[];
  avvertenze: string[];
  fonti: string[];
  note: string;
}

export interface EsercizioConsigliato {
  id: string | null;
  nome: string;
  motivazione: string;
  fuoriLibreria?: boolean;
}

export interface ContenutoAnalisi {
  tipo: 'analisi';
  titolo: string;
  sintesi: string;
  puntiAttenzione: string[];
  obiettiviSuggeriti: string[];
  eserciziConsigliati: EsercizioConsigliato[];
  daVerificareConMedico: string[];
  fonti: string[];
  note: string;
}

export interface ContenutoNota {
  tipo: 'nota';
  titolo: string;
  testo: string;
}

export type Contenuto = ContenutoProgramma | ContenutoAnalisi | ContenutoNota;

export interface InputGenerazione {
  agenteId: number;
  partecipanteId: number | null;
  obiettivo: string;
  durata: string;
  attrezzi: string[];
  livello: string;
  limitazioni: string;
  note: string;
  documentiIds: number[];
}

export interface Programma {
  id: number;
  partecipanteId: number | null;
  agenteId: number | null;
  agenteNome: string;
  titolo: string;
  input: Partial<InputGenerazione>;
  contenuto: Contenuto;
  stato: 'bozza' | 'approvato';
  creatoIl: string;
  aggiornatoIl: string;
}

/** Eventi dello stream NDJSON di /genera. */
export type EventoGenerazione =
  | { tipo: 'contesto'; fonti: string[]; tokenStimati: number; budget: number; tagliati: number; modello: string }
  | { tipo: 'testo'; delta: string }
  | { tipo: 'ragionamento'; delta: string }
  | { tipo: 'risultato'; contenuto: Contenuto; avvisi: string[] }
  | { tipo: 'errore'; messaggio: string }
  | { tipo: 'fine' };

export type EventoDownload =
  | { tipo: 'avanzamento'; stato: string; completato: number | null; totale: number | null }
  | { tipo: 'errore'; messaggio: string }
  | { tipo: 'fine' };

// ─── JSON parziale ─────────────────────────────────────────────────────

/**
 * Interpreta un JSON forse incompleto (mentre arriva in streaming) o sporco (testo attorno,
 * blocchi ```json, virgole finali). Restituisce null se non c'è nessun oggetto.
 */
export function parseJsonTollerante(text: string): unknown {
  let s = text.replace(/```(?:json)?/gi, '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  s = s.slice(start);
  // Intero e valido?
  const end = s.lastIndexOf('}');
  if (end >= 0) {
    const whole = s.slice(0, end + 1);
    try { return JSON.parse(whole); } catch { /* prova a riparare */ }
    try { return JSON.parse(whole.replace(/,\s*([}\]])/g, '$1')); } catch { /* incompleto */ }
  }
  return chiudiJson(s);
}

/** Chiude stringhe, array e oggetti lasciati aperti, scartando l'ultimo elemento a metà se serve. */
function chiudiJson(s: string): unknown {
  // Punti in cui il testo può essere tagliato: dopo un valore completo o dopo '{' / '['.
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  const cuts: { pos: number; stack: string[] }[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{' || c === '[') { stack.push(c === '{' ? '}' : ']'); cuts.push({ pos: i + 1, stack: [...stack] }); }
    else if (c === '}' || c === ']') { stack.pop(); cuts.push({ pos: i + 1, stack: [...stack] }); if (!stack.length) break; }
    else if (c === ',') cuts.push({ pos: i, stack: [...stack] });
  }
  // Primo tentativo: chiudere la stringa aperta (testo che sta arrivando).
  if (inStr) {
    const closers = [...stack].reverse().join('');
    try { return JSON.parse(s + '"' + closers); } catch { /* chiave a metà o simili */ }
  }
  for (let k = cuts.length - 1; k >= 0; k--) {
    const { pos, stack: st } = cuts[k];
    const candidate = s.slice(0, pos).replace(/,\s*$/, '') + [...st].reverse().join('');
    try { return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1')); } catch { /* indietro */ }
  }
  return null;
}

// ─── Normalizzazione ───────────────────────────────────────────────────

const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(txt).filter(Boolean) : typeof v === 'string' && v.trim() ? [v.trim()] : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

function esercizio(v: unknown): EsercizioProgramma | null {
  const o = obj(v);
  const nome = txt(o.nome);
  if (!nome) return null;
  const id = txt(o.id);
  return {
    id: id || null,
    nome,
    serie: txt(o.serie),
    ripetizioni: txt(o.ripetizioni ?? o.durata),
    recupero: txt(o.recupero),
    indicazioni: txt(o.indicazioni),
    motivazione: txt(o.motivazione),
  };
}

/** Porta un oggetto qualsiasi (uscita del modello) alla forma di un programma. */
export function normalizzaProgramma(v: unknown): ContenutoProgramma {
  const o = obj(v);
  const ex = (x: unknown) => (Array.isArray(x) ? x.map(esercizio).filter((e): e is EsercizioProgramma => !!e) : []);
  return {
    tipo: 'programma',
    titolo: txt(o.titolo) || 'Programma di allenamento',
    obiettivo: txt(o.obiettivo),
    durata: txt(o.durata),
    riscaldamento: ex(o.riscaldamento),
    parteCentrale: ex(o.parteCentrale ?? o.parte_centrale),
    defaticamento: ex(o.defaticamento),
    avvertenze: list(o.avvertenze),
    fonti: list(o.fonti),
    note: txt(o.note),
  };
}

export function normalizzaAnalisi(v: unknown): ContenutoAnalisi {
  const o = obj(v);
  const consigliati = Array.isArray(o.eserciziConsigliati) ? o.eserciziConsigliati : [];
  return {
    tipo: 'analisi',
    titolo: txt(o.titolo) || 'Analisi della cartella',
    sintesi: txt(o.sintesi),
    puntiAttenzione: list(o.puntiAttenzione),
    obiettiviSuggeriti: list(o.obiettiviSuggeriti),
    eserciziConsigliati: consigliati.map(x => {
      const e = obj(x);
      const nome = txt(e.nome);
      return nome ? { id: txt(e.id) || null, nome, motivazione: txt(e.motivazione) } : null;
    }).filter((e): e is EsercizioConsigliato => !!e),
    daVerificareConMedico: list(o.daVerificareConMedico),
    fonti: list(o.fonti),
    note: txt(o.note),
  };
}

/** Programma vuoto, per iniziare a mano. */
export function programmaVuoto(): ContenutoProgramma {
  return normalizzaProgramma({});
}
