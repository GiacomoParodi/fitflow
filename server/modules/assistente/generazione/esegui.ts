import { daysBetween } from '../../../../shared/dates';
import type { Agente, Contenuto, EventoGenerazione, InputGenerazione, RisultatoRicerca } from '../../../../shared/assistente';
import { ApiError } from '../../../store';
import { livelloLibreria, type EsercizioTrovato } from '../conoscenza/esercizi';
import type { AiProvider } from '../providers';
import type { Assistente } from '../servizio';
import { costruisciPrompt, type PromptCostruito } from './contesto';
import { FORMATO_ANALISI, FORMATO_PROGRAMMA, SCHEMA_ANALISI, SCHEMA_PROGRAMMA, validaAnalisi, validaProgramma } from './schema';

const bad = (m: string) => new ApiError(400, m);

function testo(v: unknown, campo: string, max: number): string {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') throw bad(`${campo}: valore non valido.`);
  const s = v.trim();
  if (s.length > max) throw bad(`${campo} è troppo lungo (massimo ${max} caratteri).`);
  return s;
}

export function validaInput(b: Record<string, unknown>): InputGenerazione {
  const agenteId = Number(b.agenteId);
  if (!Number.isInteger(agenteId) || agenteId < 1) throw bad('Scegli un agente.');
  const pid = b.partecipanteId === null || b.partecipanteId === undefined || b.partecipanteId === '' ? null : Number(b.partecipanteId);
  if (pid !== null && (!Number.isInteger(pid) || pid < 1)) throw bad('Iscritto non valido.');
  const attrezzi = Array.isArray(b.attrezzi) ? b.attrezzi.filter((x): x is string => typeof x === 'string').map(s => s.trim()).filter(Boolean).slice(0, 40) : [];
  const documentiIds = Array.isArray(b.documentiIds) ? b.documentiIds.map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 50) : [];
  return {
    agenteId,
    partecipanteId: pid,
    obiettivo: testo(b.obiettivo, 'L\'obiettivo', 500),
    durata: testo(b.durata, 'La durata', 60),
    attrezzi,
    livello: testo(b.livello, 'Il livello', 40),
    limitazioni: testo(b.limitazioni, 'Le limitazioni', 2000),
    note: testo(b.note, 'Le note', 4000),
    documentiIds,
  };
}

/** Scheda dell'iscritto in testo, per il modello. */
export function schedaIscritto(a: Assistente, pid: number, today: string): { testo: string; nome: string; livello: string; note: string; avvisi: string[] } {
  const state = a.core.state();
  const p = state.participants.find(x => x.id === pid);
  if (!p) throw new ApiError(404, 'Iscritto non trovato.');
  const corso = state.courses.find(c => c.id === p.courseId);
  const lezioni = state.lessons.filter(l => l.courseId === p.courseId && l.date <= today);
  const presenti = lezioni.filter(l => l.present.includes(p.id)).length;
  const ultime = lezioni.slice(-8).map(l => (l.present.includes(p.id) ? 'P' : 'A')).join('');
  const avvisi: string[] = [];
  let cert: string;
  if (!p.certScadenza) { cert = 'mancante'; avvisi.push('Certificato medico mancante: verifica l\'idoneità prima di proporre il programma.'); }
  else if (daysBetween(today, p.certScadenza) < 0) { cert = `scaduto il ${p.certScadenza}`; avvisi.push(`Certificato medico scaduto il ${p.certScadenza}: la persona non dovrebbe allenarsi finché non lo rinnova.`); }
  else cert = `valido fino al ${p.certScadenza}`;
  const righe = [
    `Nome: ${p.name}`,
    corso ? `Corso: ${corso.name}` : '',
    `Livello: ${p.livello}`,
    `Iscritto dal: ${p.iscrittoIl}`,
    lezioni.length ? `Presenze: ${presenti} su ${lezioni.length} lezioni (${Math.round((presenti / lezioni.length) * 100)}%), ultime lezioni ${ultime} (P = presente, A = assente)` : 'Presenze: nessuna lezione registrata',
    `Certificato medico: ${cert}`,
    p.note ? `Note dell'istruttore: ${p.note}` : '',
  ].filter(Boolean);
  return { testo: righe.join('\n'), nome: p.name, livello: p.livello, note: p.note, avvisi };
}

export interface Preparato {
  agente: Agente;
  modello: string;
  provider: AiProvider;
  prompt: PromptCostruito;
  input: InputGenerazione;
  avvisi: string[];
  titoloNota: string;
}

/** Validazione, scelta del modello e costruzione del contesto. Gli errori qui diventano risposte HTTP normali. */
export async function prepara(a: Assistente, body: Record<string, unknown>, today: string, signal?: AbortSignal): Promise<Preparato> {
  const input = validaInput(body);
  const agente = a.agenti.get(input.agenteId);
  const compito = agente.compito;
  if (compito === 'genera_programma' && !input.obiettivo) throw bad('Indica l\'obiettivo della seduta.');
  if (compito === 'analizza_cartella' && !input.partecipanteId) throw bad('Scegli l\'iscritto di cui analizzare la cartella.');
  if (compito === 'libero' && !input.note && !input.obiettivo) throw bad('Scrivi la domanda.');

  const scheda = input.partecipanteId ? schedaIscritto(a, input.partecipanteId, today) : null;
  const avvisi = [...(scheda?.avvisi ?? [])];
  const livello = input.livello || scheda?.livello || '';

  const provider = a.provider();
  const modello = await a.modelloChat(agente.modello, signal);

  // Esercizi candidati dalla libreria
  let esercizi: EsercizioTrovato[] = [];
  if (agente.fonti.esercizi && compito !== 'libero') {
    esercizi = a.libreria.cerca({
      obiettivo: [input.obiettivo, compito === 'analizza_cartella' ? scheda?.note : ''].filter(Boolean).join(' '),
      attrezzi: compito === 'genera_programma' ? input.attrezzi : null,
      livello: livelloLibreria(livello) ? livello : undefined,
      limitazioni: [input.limitazioni, scheda?.note].filter(Boolean).join(' '),
      limite: compito === 'genera_programma' ? 40 : 25,
    });
  } else if (agente.fonti.esercizi && compito === 'libero' && (input.note || input.obiettivo)) {
    esercizi = a.libreria.cerca({ q: `${input.obiettivo} ${input.note}`, limite: 15 });
  }

  // Estratti di documenti e schede di conoscenza
  let estratti: RisultatoRicerca[] = [];
  const pid = agente.fonti.cartella ? input.partecipanteId : null;
  if (agente.estratti > 0) {
    let query = [input.obiettivo, input.limitazioni, input.note].filter(Boolean).join('. ');
    if (compito === 'analizza_cartella') query = [query, scheda?.note, 'limitazioni dolore patologie terapie controindicazioni obiettivi attività fisica'].filter(Boolean).join('. ');
    const override = agente.modelloEmbedding ? { provider, modello: agente.modelloEmbedding } : undefined;
    const trovati = await a.documenti.cerca(query, {
      conoscenze: agente.fonti.conoscenze, documenti: agente.fonti.documenti, partecipanteId: pid, documentiIds: input.documentiIds,
    }, agente.estratti, signal, override);
    // Per l'analisi conta avere almeno l'inizio di ogni documento della cartella.
    const inizi = compito === 'analizza_cartella' && pid
      ? a.documenti.iniziDocumenti(a.documenti.elenco(pid).filter(d => d.stato === 'pronto').map(d => d.id), 2)
      : input.documentiIds.length ? a.documenti.iniziDocumenti(input.documentiIds, 1) : [];
    const seen = new Set<number>();
    estratti = [...(compito === 'analizza_cartella' ? [...inizi, ...trovati] : [...trovati, ...inizi])]
      .filter(r => (seen.has(r.estrattoId) ? false : (seen.add(r.estrattoId), true)));
  }
  if (compito === 'analizza_cartella' && pid && !a.documenti.elenco(pid).some(d => d.stato === 'pronto')) {
    avvisi.push('Nella cartella dell\'iscritto non ci sono documenti leggibili: l\'analisi si basa solo sulla scheda.');
  }

  const richiesta = compito === 'genera_programma'
    ? [
      'Prepara una seduta di allenamento con queste indicazioni:',
      `- Obiettivo: ${input.obiettivo}`,
      `- Durata: ${input.durata || 'non indicata (circa 45–60 minuti)'}`,
      `- Livello: ${livello || 'non indicato'}`,
      `- Attrezzi disponibili: ${input.attrezzi.length ? input.attrezzi.join(', ') : 'nessuno, solo corpo libero'}`,
      `- Limitazioni o problemi segnalati: ${input.limitazioni || 'nessuno indicato'}`,
      input.note ? `- Note: ${input.note}` : '',
      scheda ? `- Per: ${scheda.nome} (vedi scheda)` : '- Seduta generica, nessun iscritto specifico',
    ].filter(Boolean).join('\n')
    : compito === 'analizza_cartella'
      ? [
        'Analizza la cartella di questo iscritto (scheda ed estratti dei suoi documenti) e prepara la sintesi per l\'istruttore.',
        input.obiettivo ? `Obiettivo indicato: ${input.obiettivo}` : '',
        input.limitazioni ? `Limitazioni segnalate: ${input.limitazioni}` : '',
        input.note ? `Note dell'istruttore: ${input.note}` : '',
      ].filter(Boolean).join('\n')
      : [input.obiettivo, input.note].filter(Boolean).join('\n');

  const prompt = costruisciPrompt({
    promptSistema: agente.promptSistema,
    formato: compito === 'genera_programma' ? FORMATO_PROGRAMMA : compito === 'analizza_cartella' ? FORMATO_ANALISI : '',
    contesto: agente.contesto,
    maxRisposta: agente.maxRisposta,
    richiesta,
    scheda: scheda?.testo ?? null,
    esercizi,
    estratti,
  });
  if (prompt.tagliati) avvisi.push(`Per stare nella finestra di contesto sono stati esclusi o accorciati ${prompt.tagliati} elementi meno pertinenti.`);
  const titoloNota = (input.note || input.obiettivo).split('\n')[0].slice(0, 80);
  return { agente, modello, provider, prompt, input, avvisi, titoloNota };
}

/** Esegue la generazione in streaming. Interrompibile con `signal`. */
export async function* genera(a: Assistente, p: Preparato, signal?: AbortSignal): AsyncGenerator<EventoGenerazione> {
  const { agente, prompt } = p;
  yield { tipo: 'contesto', fonti: prompt.fonti, tokenStimati: prompt.tokenStimati, budget: prompt.budget, tagliati: prompt.tagliati, modello: p.modello };
  const format = agente.compito === 'genera_programma' ? SCHEMA_PROGRAMMA : agente.compito === 'analizza_cartella' ? SCHEMA_ANALISI : undefined;
  let content = '';
  let thinking = '';
  let doneReason: string | undefined;
  for await (const ch of p.provider.chat({
    model: p.modello,
    messages: prompt.messages,
    options: {
      temperature: agente.temperatura, top_p: agente.topP, top_k: agente.topK,
      num_ctx: agente.contesto, num_predict: agente.maxRisposta, seed: agente.seed,
    },
    format: format as Record<string, unknown> | undefined,
    think: agente.ragionamento,
  }, signal)) {
    if (ch.thinking) { thinking += ch.thinking; yield { tipo: 'ragionamento', delta: ch.thinking }; }
    if (ch.content) { content += ch.content; yield { tipo: 'testo', delta: ch.content }; }
    if (ch.done) doneReason = ch.doneReason;
  }

  const avvisi = [...p.avvisi];
  const troncato = doneReason === 'length';
  if (troncato) avvisi.push('La risposta si è interrotta perché ha raggiunto la lunghezza massima: il risultato potrebbe essere incompleto (aumenta "Lunghezza massima risposta" nell\'agente).');

  let contenuto: Contenuto;
  if (agente.compito === 'libero') {
    const t = content.trim() || thinking.trim();
    if (!t) { yield { tipo: 'errore', messaggio: 'Il modello non ha prodotto una risposta. Riprova.' }; return; }
    contenuto = { tipo: 'nota', titolo: p.titoloNota || 'Risposta dell\'assistente', testo: t };
  } else {
    const valida = agente.compito === 'genera_programma' ? validaProgramma : validaAnalisi;
    // Alcuni modelli (es. Qwen 3.5 con certe versioni di Ollama) mettono il JSON nel "ragionamento".
    const v = valida(content, a.libreria) ?? (thinking ? valida(thinking, a.libreria) : null);
    if (!v) {
      yield {
        tipo: 'errore',
        messaggio: troncato
          ? 'La risposta è stata interrotta prima di essere completa: aumenta "Lunghezza massima risposta" nell\'agente e riprova.'
          : 'Il modello non ha restituito un risultato nel formato atteso. Riprova, abbassa la temperatura o prova un altro modello.',
      };
      return;
    }
    contenuto = v.contenuto;
    avvisi.push(...v.avvisi);
    if (contenuto.fonti.length === 0) contenuto.fonti = prompt.fonti;
  }
  yield { tipo: 'risultato', contenuto, avvisi };
  yield { tipo: 'fine' };
}
