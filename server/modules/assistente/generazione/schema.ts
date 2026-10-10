import {
  BLOCCHI, normalizzaAnalisi, normalizzaProgramma, parseJsonTollerante,
  type ContenutoAnalisi, type ContenutoProgramma, type EsercizioConsigliato, type EsercizioProgramma,
} from '../../../../shared/assistente';
import type { LibreriaEsercizi } from '../conoscenza/esercizi';

const S = { type: 'string' } as const;
const LISTA = { type: 'array', items: S } as const;

const ESERCIZIO = {
  type: 'object',
  properties: { id: S, nome: S, serie: S, ripetizioni: S, recupero: S, indicazioni: S, motivazione: S },
  required: ['id', 'nome', 'serie', 'ripetizioni', 'recupero', 'indicazioni', 'motivazione'],
} as const;

export const SCHEMA_PROGRAMMA = {
  type: 'object',
  properties: {
    titolo: S, obiettivo: S, durata: S,
    riscaldamento: { type: 'array', items: ESERCIZIO },
    parteCentrale: { type: 'array', items: ESERCIZIO },
    defaticamento: { type: 'array', items: ESERCIZIO },
    avvertenze: LISTA, fonti: LISTA,
  },
  required: ['titolo', 'obiettivo', 'durata', 'riscaldamento', 'parteCentrale', 'defaticamento', 'avvertenze', 'fonti'],
} as const;

export const SCHEMA_ANALISI = {
  type: 'object',
  properties: {
    titolo: S, sintesi: S, puntiAttenzione: LISTA, obiettiviSuggeriti: LISTA,
    eserciziConsigliati: { type: 'array', items: { type: 'object', properties: { id: S, nome: S, motivazione: S }, required: ['id', 'nome', 'motivazione'] } },
    daVerificareConMedico: LISTA, fonti: LISTA,
  },
  required: ['titolo', 'sintesi', 'puntiAttenzione', 'obiettiviSuggeriti', 'eserciziConsigliati', 'daVerificareConMedico', 'fonti'],
} as const;

/** Istruzioni sul formato, aggiunte al prompt di sistema (servono anche ai motori che non vincolano il JSON). */
export const FORMATO_PROGRAMMA = `Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, con questa forma:
{"titolo": "...", "obiettivo": "...", "durata": "es. 45 minuti",
 "riscaldamento": [ESERCIZIO, ...], "parteCentrale": [ESERCIZIO, ...], "defaticamento": [ESERCIZIO, ...],
 "avvertenze": ["..."], "fonti": ["titoli delle fonti usate"]}
dove ESERCIZIO è {"id": "id esatto dalla libreria oppure stringa vuota", "nome": "...", "serie": "es. 3", "ripetizioni": "es. 10-12 oppure 30 s", "recupero": "es. 60 s", "indicazioni": "indicazione tecnica breve", "motivazione": "perché è adatto"}.
Tutti i testi in italiano.`;

export const FORMATO_ANALISI = `Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, con questa forma:
{"titolo": "...", "sintesi": "...", "puntiAttenzione": ["..."], "obiettiviSuggeriti": ["..."],
 "eserciziConsigliati": [{"id": "id esatto dalla libreria oppure stringa vuota", "nome": "...", "motivazione": "..."}],
 "daVerificareConMedico": ["..."], "fonti": ["titoli delle fonti usate"]}
Tutti i testi in italiano.`;

/** Collega un esercizio alla libreria: id valido, oppure riconosciuto per nome, altrimenti "fuori libreria". */
function collega<T extends { id: string | null; nome: string; fuoriLibreria?: boolean }>(e: T, lib: LibreriaEsercizi): T {
  const byId = e.id ? lib.get(e.id) : null;
  if (byId) return { ...e, fuoriLibreria: false };
  const byName = lib.perNome(e.nome);
  if (byName) return { ...e, id: byName.id, fuoriLibreria: false };
  return { ...e, id: null, fuoriLibreria: true };
}

export interface Validato<T> { contenuto: T; avvisi: string[] }

function avvisoFuori(nomi: string[], totaleLibreria: number): string[] {
  if (!nomi.length) return [];
  if (!totaleLibreria) return ['La libreria esercizi è vuota: tutti gli esercizi sono proposte libere del modello, da verificare.'];
  return [`Esercizi fuori libreria (proposti dal modello, da verificare): ${nomi.join(', ')}.`];
}

export function validaProgramma(raw: string, lib: LibreriaEsercizi): Validato<ContenutoProgramma> | null {
  const parsed = parseJsonTollerante(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const p = normalizzaProgramma(parsed);
  const fuori: string[] = [];
  for (const b of BLOCCHI) {
    p[b] = p[b].map(e => {
      const x = collega<EsercizioProgramma>(e, lib);
      if (x.fuoriLibreria) fuori.push(x.nome);
      return x;
    });
  }
  const totale = BLOCCHI.reduce((n, b) => n + p[b].length, 0);
  if (!totale) return null;
  return { contenuto: p, avvisi: avvisoFuori(fuori, lib.conta()) };
}

export function validaAnalisi(raw: string, lib: LibreriaEsercizi): Validato<ContenutoAnalisi> | null {
  const parsed = parseJsonTollerante(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const a = normalizzaAnalisi(parsed);
  if (!a.sintesi && !a.puntiAttenzione.length && !a.obiettiviSuggeriti.length) return null;
  const fuori: string[] = [];
  a.eserciziConsigliati = a.eserciziConsigliati.map(e => {
    const x = collega<EsercizioConsigliato>(e, lib);
    if (x.fuoriLibreria) fuori.push(x.nome);
    return x;
  });
  return { contenuto: a, avvisi: avvisoFuori(fuori, lib.conta()) };
}
