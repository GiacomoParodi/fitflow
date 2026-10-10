import type { RisultatoRicerca } from '../../../../shared/assistente';
import { ApiError } from '../../../store';
import type { EsercizioTrovato } from '../conoscenza/esercizi';
import { stimaToken, tronca } from '../conoscenza/testo';
import type { ChatMessage } from '../providers/types';

export interface PromptInput {
  promptSistema: string;
  /** Istruzioni sul formato della risposta (vuoto per le risposte libere). */
  formato: string;
  contesto: number;
  maxRisposta: number;
  richiesta: string;
  scheda: string | null;
  /** In ordine di pertinenza. */
  esercizi: EsercizioTrovato[];
  /** In ordine di pertinenza. */
  estratti: RisultatoRicerca[];
}

export interface PromptCostruito {
  messages: ChatMessage[];
  fonti: string[];
  tokenStimati: number;
  budget: number;
  /** Elementi (esercizi o estratti) lasciati fuori o accorciati per stare nel contesto. */
  tagliati: number;
  eserciziInclusi: string[];
  estrattiInclusi: number[];
}

/** Riga compatta di un esercizio per il modello. */
export function rigaEsercizio(e: EsercizioTrovato): string {
  const parts = [
    `${e.categoria}, livello ${e.livello}`,
    `attrezzi: ${e.attrezzi.length ? e.attrezzi.join(', ') : 'corpo libero'}`,
  ];
  if (e.muscoliPrincipali.length) parts.push(`muscoli: ${e.muscoliPrincipali.join(', ')}`);
  if (e.obiettivi.length) parts.push(`utile per: ${e.obiettivi.slice(0, 5).join(', ')}`);
  if (e.dosaggio) parts.push(`dosaggio tipico: ${e.dosaggio}`);
  if (e.cautele.length) parts.push(`cautele: ${e.cautele.slice(0, 3).join('; ')}`);
  if (e.regressioni.length) parts.push(`regressioni: ${e.regressioni.slice(0, 3).join(', ')}`);
  const warn = e.cauteleRilevanti.length ? ' ⚠ ATTENZIONE: cautele legate alle limitazioni indicate' : '';
  return `- id "${e.id}" · ${e.nome} (${parts.join('; ')})${warn}`;
}

const ORIGINE: Record<string, string> = { base: 'scheda di conoscenza', caricato: 'documento' };

function intestazioneEstratto(r: RisultatoRicerca): string {
  const tipo = r.partecipanteId ? 'cartella dell\'iscritto' : ORIGINE[r.origine];
  return `«${r.documento}» (${tipo})`;
}

/** Riempie `budget` token con gli elementi in ordine; l'ultimo che non entra intero viene accorciato se ne vale la pena. */
function riempi<T>(items: T[], render: (x: T) => string, budget: number, accorcia: boolean) {
  const out: { item: T; text: string }[] = [];
  let used = 0;
  let tagliati = 0;
  for (const item of items) {
    const text = render(item);
    const t = stimaToken(text) + 1;
    if (used + t <= budget) {
      out.push({ item, text });
      used += t;
    } else if (accorcia && budget - used >= 120) {
      const short = tronca(text, budget - used - 2);
      out.push({ item, text: short });
      used += stimaToken(short) + 1;
      tagliati++;
    } else {
      tagliati++;
    }
  }
  return { out, used, tagliati };
}

/**
 * Costruisce i messaggi per il modello restando entro la finestra di contesto: riserva lo spazio della
 * risposta, del prompt di sistema e della richiesta, poi riempie con scheda, esercizi ed estratti
 * scartando o accorciando i meno pertinenti.
 */
export function costruisciPrompt(p: PromptInput): PromptCostruito {
  const system = p.formato ? `${p.promptSistema.trim()}\n\n${p.formato}` : p.promptSistema.trim();
  const richiesta = `## Richiesta\n${p.richiesta.trim()}`;
  const overhead = 160; // intestazioni delle sezioni e formattazione dei messaggi
  const budget = p.contesto - p.maxRisposta - stimaToken(system) - stimaToken(richiesta) - overhead;
  if (budget < 150) {
    throw new ApiError(400, 'La finestra di contesto dell\'agente è troppo piccola per prompt, richiesta e risposta: aumenta "Contesto" o riduci "Lunghezza massima risposta" o il prompt.');
  }

  let rest = budget;
  let tagliati = 0;
  const sezioni: string[] = [];
  const fonti: string[] = [];

  if (p.scheda) {
    const max = Math.max(80, Math.floor(budget * 0.2));
    const scheda = stimaToken(p.scheda) > max ? tronca(p.scheda, max) : p.scheda;
    sezioni.push(`## Scheda dell'iscritto\n${scheda}`);
    rest -= stimaToken(scheda) + 8;
    fonti.push('Scheda dell\'iscritto');
  }

  const totEstratti = p.estratti.reduce((n, r) => n + stimaToken(intestazioneEstratto(r) + r.testo) + 4, 0);
  const totEsercizi = p.esercizi.reduce((n, e) => n + stimaToken(rigaEsercizio(e)) + 1, 0);
  let budgetEsercizi = rest;
  if (p.estratti.length) budgetEsercizi = Math.min(totEsercizi, Math.max(Math.floor(rest * 0.45), rest - totEstratti));

  const ex = riempi(p.esercizi, rigaEsercizio, Math.max(0, Math.min(budgetEsercizi, rest - 12)), false);
  tagliati += ex.tagliati;
  if (ex.out.length) {
    sezioni.push(`## Esercizi della libreria adatti (usa questi id)\n${ex.out.map(x => x.text).join('\n')}`);
    rest -= ex.used + 12;
    fonti.push('Libreria esercizi');
  }

  let n = 0;
  const es = riempi(p.estratti, r => `[${++n}] ${intestazioneEstratto(r)}\n${r.testo}`, Math.max(0, rest - 12), true);
  tagliati += es.tagliati;
  if (es.out.length) {
    sezioni.push(`## Estratti da documenti e schede di conoscenza\n${es.out.map(x => x.text).join('\n\n')}`);
    rest -= es.used + 12;
    for (const x of es.out) if (!fonti.includes(x.item.documento)) fonti.push(x.item.documento);
  }

  if (!sezioni.length) sezioni.push('## Contesto\nNessun dato aggiuntivo disponibile: rispondi con proposte generali e prudenti, dichiarandolo.');
  const user = `${sezioni.join('\n\n')}\n\n${richiesta}`;
  const messages: ChatMessage[] = [{ role: 'system', content: system }, { role: 'user', content: user }];
  return {
    messages,
    fonti,
    tokenStimati: stimaToken(system) + stimaToken(user) + 20,
    budget,
    tagliati,
    eserciziInclusi: ex.out.map(x => x.item.id),
    estrattiInclusi: es.out.map(x => x.item.estrattoId),
  };
}
