import { transaction, type Database } from '../../db';
import { ApiError } from '../../store';
import { COMPITI, type Agente, type AgenteInput, type Compito, type FontiAgente } from '../../../shared/assistente';

const REGOLE_COMUNI = `Regole che valgono sempre:
- Ti rivolgi a un istruttore professionista, non all'allievo: tono professionale, chiaro e sintetico, in italiano.
- Sei un suggeritore: ogni proposta è una bozza che l'istruttore valuta e corregge. Non sostituisci il medico né il fisioterapista.
- Non fai diagnosi e non nomini patologie che non siano già scritte nei documenti. Se nei dati compaiono segnali d'allarme (dolore toracico, svenimenti, fiato corto sproporzionato, dolore notturno o che peggiora, formicolii o perdita di forza, traumi recenti, gravidanza senza indicazioni, interventi chirurgici recenti, febbre, perdita di peso inspiegata) lo scrivi chiaramente e indichi di sospendere e inviare la persona al medico prima di proseguire.
- Usi solo le informazioni del contesto (scheda dell'iscritto, documenti, schede di conoscenza, libreria esercizi). Se un dato manca, lo dici invece di inventarlo.
- Citi le fonti usate con il loro titolo (es. "Libreria esercizi", nome del documento o della scheda).`;

const PROMPT_GENERATORE = `Sei un esperto di ginnastica, preparazione atletica e allenamento funzionale, sia a corpo libero sia con piccoli e grandi attrezzi. Aiuti un istruttore a preparare programmi di allenamento sicuri ed efficaci.

${REGOLE_COMUNI}

Come costruisci il programma:
- Scegli gli esercizi preferibilmente dalla libreria fornita e riporta il loro "id" esatto; se proponi un esercizio che non è in libreria lascia "id" vuoto.
- Usa solo gli attrezzi disponibili indicati; se nessuno è indicato, solo corpo libero.
- Rispetta il livello: niente esercizi più difficili del livello indicato; per i principianti preferisci regressioni e carichi bassi.
- Rispetta limitazioni e cautele: evita gli esercizi le cui cautele riguardano i problemi segnalati, oppure proponi una variante adatta e spiega perché.
- Struttura sempre: riscaldamento (5–10 minuti), parte centrale, defaticamento (allungamento o respirazione), coerenti con la durata richiesta.
- Per ogni esercizio indica serie, ripetizioni o durata, recupero, un'indicazione tecnica breve e la motivazione della scelta.
- Nelle avvertenze riporta cautele specifiche, adattamenti e, se presenti, i segnali per cui inviare al medico.`;

const PROMPT_ANALISI = `Sei un esperto di ginnastica, preparazione atletica ed esercizio adattato. Leggi la cartella di un iscritto (scheda, note, documenti caricati come referti, certificati, questionari) e prepari per l'istruttore una sintesi utile a impostare l'allenamento.

${REGOLE_COMUNI}

Come imposti l'analisi:
- Sintesi: chi è la persona dal punto di vista dell'allenamento (livello, frequenza, informazioni rilevanti dei documenti), in poche frasi.
- Punti di attenzione: limitazioni, cautele, elementi che condizionano la scelta degli esercizi, sempre con la fonte.
- Obiettivi suggeriti: realistici e misurabili, coerenti con livello e cautele.
- Esercizi consigliati: preferibilmente dalla libreria (riporta l'id esatto), con la motivazione.
- Da verificare con un medico: dubbi, informazioni mancanti o segnali d'allarme. Se il certificato medico non è valido, scrivilo.
- Non riportare dati personali non necessari.`;

const PROMPT_LIBERO = `Sei un esperto di ginnastica e allenamento a corpo libero e con attrezzi. Rispondi alle domande dell'istruttore in modo pratico e sintetico.

${REGOLE_COMUNI}`;

const FONTI_TUTTE: FontiAgente = { esercizi: true, conoscenze: true, documenti: true, cartella: true };

type Predefinito = AgenteInput & { chiave: string };

export const AGENTI_PREDEFINITI: Predefinito[] = [
  {
    chiave: 'generatore', nome: 'Generatore di esercizi', compito: 'genera_programma',
    descrizione: 'Propone una seduta completa (riscaldamento, parte centrale, defaticamento) usando la libreria esercizi.',
    modello: '', modelloEmbedding: '', promptSistema: PROMPT_GENERATORE,
    temperatura: 0.4, topP: 0.9, topK: 40, contesto: 8192, maxRisposta: 2048, seed: null, ragionamento: false,
    fonti: FONTI_TUTTE, estratti: 6,
  },
  {
    chiave: 'analisi', nome: 'Analisi cartella', compito: 'analizza_cartella',
    descrizione: 'Legge scheda e documenti di un iscritto e prepara sintesi, punti di attenzione e obiettivi.',
    modello: '', modelloEmbedding: '', promptSistema: PROMPT_ANALISI,
    temperatura: 0.2, topP: 0.9, topK: 40, contesto: 8192, maxRisposta: 1536, seed: null, ragionamento: false,
    fonti: FONTI_TUTTE, estratti: 8,
  },
];

export const PROMPT_LIBERO_PREDEFINITO = PROMPT_LIBERO;

type Row = Record<string, unknown>;

function daRiga(r: Row): Agente {
  return {
    id: r.id as number,
    nome: r.nome as string,
    descrizione: r.descrizione as string,
    compito: r.compito as Compito,
    modello: r.modello as string,
    modelloEmbedding: r.modello_embedding as string,
    promptSistema: r.prompt_sistema as string,
    temperatura: r.temperatura as number,
    topP: r.top_p as number,
    topK: r.top_k as number,
    contesto: r.contesto as number,
    maxRisposta: r.max_risposta as number,
    seed: r.seed as number | null,
    ragionamento: !!r.ragionamento,
    fonti: { ...FONTI_TUTTE, ...JSON.parse(r.fonti as string) },
    estratti: r.estratti as number,
    predefinito: r.predefinito as string | null,
    aggiornatoIl: r.aggiornato_il as string,
  };
}

const bad = (m: string) => new ApiError(400, m);

function numero(v: unknown, campo: string, min: number, max: number, intero = false): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (intero && !Number.isInteger(n))) {
    throw bad(`${campo}: inserisci un valore ${intero ? 'intero ' : ''}tra ${min} e ${max}.`);
  }
  return n;
}

function testo(v: unknown, campo: string, max: number, required = false): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw bad(`${campo} è obbligatorio.`);
  if (s.length > max) throw bad(`${campo} è troppo lungo (massimo ${max} caratteri).`);
  return s;
}

/** Valida i parametri di un agente (per creazione o modifica). */
export function validaAgente(b: Record<string, unknown>): AgenteInput {
  if (!COMPITI.includes(b.compito as Compito)) throw bad('Compito non valido.');
  const f = (b.fonti && typeof b.fonti === 'object' ? b.fonti : {}) as Record<string, unknown>;
  const modello = testo(b.modello, 'Modello', 200);
  const modelloEmbedding = testo(b.modelloEmbedding, 'Modello di embedding', 200);
  if (/\s/.test(modello) || /\s/.test(modelloEmbedding)) throw bad('Il nome del modello non può contenere spazi.');
  const contesto = numero(b.contesto, 'Contesto', 1024, 131072, true);
  const maxRisposta = numero(b.maxRisposta, 'Lunghezza massima risposta', 128, 16384, true);
  if (maxRisposta > contesto / 2) throw bad('La lunghezza massima della risposta non può superare metà del contesto.');
  return {
    nome: testo(b.nome, 'Il nome', 80, true),
    descrizione: testo(b.descrizione, 'La descrizione', 400),
    compito: b.compito as Compito,
    modello,
    modelloEmbedding,
    promptSistema: testo(b.promptSistema, 'Il prompt di sistema', 20000, true),
    temperatura: numero(b.temperatura, 'Temperatura', 0, 2),
    topP: numero(b.topP, 'Top P', 0.01, 1),
    topK: numero(b.topK, 'Top K', 1, 500, true),
    contesto,
    maxRisposta,
    seed: b.seed === null || b.seed === undefined || b.seed === '' ? null : numero(b.seed, 'Seed', 0, 2 ** 31 - 1, true),
    ragionamento: !!b.ragionamento,
    fonti: { esercizi: f.esercizi !== false, conoscenze: f.conoscenze !== false, documenti: f.documenti !== false, cartella: f.cartella !== false },
    estratti: numero(b.estratti, 'Numero di estratti', 0, 50, true),
  };
}

export class Agenti {
  constructor(private db: Database, private now: () => string = () => new Date().toISOString()) {}

  elenco(): Agente[] {
    return (this.db.prepare('SELECT * FROM assistente_agenti ORDER BY ordine, id').all() as Row[]).map(daRiga);
  }

  get(id: number): Agente {
    const r = this.db.prepare('SELECT * FROM assistente_agenti WHERE id = ?').get(id) as Row | undefined;
    if (!r) throw new ApiError(404, 'Agente non trovato.');
    return daRiga(r);
  }

  private scrivi(a: AgenteInput, id: number | null, predefinito: string | null = null): number {
    const vals = [
      a.nome, a.descrizione, a.compito, a.modello, a.modelloEmbedding, a.promptSistema, a.temperatura, a.topP, a.topK,
      a.contesto, a.maxRisposta, a.seed, a.ragionamento ? 1 : 0, JSON.stringify(a.fonti), a.estratti, this.now(),
    ] as const;
    if (id !== null) {
      this.db.prepare(`UPDATE assistente_agenti SET nome=?, descrizione=?, compito=?, modello=?, modello_embedding=?, prompt_sistema=?,
        temperatura=?, top_p=?, top_k=?, contesto=?, max_risposta=?, seed=?, ragionamento=?, fonti=?, estratti=?, aggiornato_il=? WHERE id=?`).run(...vals, id);
      return id;
    }
    const { m } = this.db.prepare('SELECT COALESCE(MAX(ordine), 0) AS m FROM assistente_agenti').get() as { m: number };
    const r = this.db.prepare(`INSERT INTO assistente_agenti (nome, descrizione, compito, modello, modello_embedding, prompt_sistema,
      temperatura, top_p, top_k, contesto, max_risposta, seed, ragionamento, fonti, estratti, aggiornato_il, predefinito, ordine)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...vals, predefinito, m + 1);
    return Number(r.lastInsertRowid);
  }

  crea(body: Record<string, unknown>): Agente {
    return this.get(this.scrivi(validaAgente(body), null));
  }

  aggiorna(id: number, body: Record<string, unknown>): Agente {
    const cur = this.get(id);
    return this.get(this.scrivi(validaAgente({ ...cur, ...body }), id));
  }

  elimina(id: number) {
    this.get(id);
    this.db.prepare('DELETE FROM assistente_agenti WHERE id = ?').run(id);
  }

  duplica(id: number): Agente {
    const a = this.get(id);
    return this.get(this.scrivi({ ...a, nome: `${a.nome} (copia)`.slice(0, 80) }, null));
  }

  /** Al primo avvio crea gli agenti predefiniti mancanti (una sola volta: se l'utente li elimina non tornano). */
  inizializza() {
    const seeded = this.db.prepare("SELECT 1 FROM settings WHERE key = 'assistente.agentiCreati'").get();
    if (seeded) return;
    transaction(this.db, () => {
      for (const p of AGENTI_PREDEFINITI) {
        const { chiave, ...input } = p;
        this.scrivi(input, null, chiave);
      }
      this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('assistente.agentiCreati', 'true')").run();
    });
  }

  /** Riporta gli agenti predefiniti ai valori originali (li ricrea se eliminati). Gli agenti dell'utente restano. */
  ripristina(): Agente[] {
    transaction(this.db, () => {
      for (const p of AGENTI_PREDEFINITI) {
        const { chiave, ...input } = p;
        const r = this.db.prepare('SELECT id FROM assistente_agenti WHERE predefinito = ? ORDER BY id LIMIT 1').get(chiave) as { id: number } | undefined;
        this.scrivi(input, r ? r.id : null, chiave);
      }
    });
    return this.elenco();
  }
}
