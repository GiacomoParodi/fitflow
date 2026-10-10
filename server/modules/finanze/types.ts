// Shapes returned by GET /api/finanze/riepilogo. Imported (type-only) by the interface too.
import type { Status } from '../../../shared/rules';

export interface FiltriFinanze {
  /** Inclusive ISO dates. */
  dal: string;
  al: string;
  /** Course id, or null for all courses. */
  corso: number | null;
  /** Plan name as stored on the payment (historic), or null for all plans. */
  abbonamento: string | null;
}

export interface TotaliFinanze {
  incassato: number;
  pagamenti: number;
  /** Distinct people who paid in the period (including people who have since left). */
  persone: number;
  /** incassato / pagamenti, 0 when there are no payments. */
  medio: number;
}

export interface VoceAbbonamento {
  nome: string;
  pagamenti: number;
  totale: number;
  /** Share of the period's takings, 0–100 (one decimal). */
  quota: number;
  /** Active members whose current plan has this name. */
  iscrittiAttivi: number;
}

export interface VoceCorso {
  id: number;
  nome: string;
  incassato: number;
  pagamenti: number;
  iscrittiAttivi: number;
  /** incassato / iscrittiAttivi, null without active members. */
  medioPerIscritto: number | null;
}

export interface VoceMese {
  /** "YYYY-MM" */
  mese: string;
  incassato: number;
  pagamenti: number;
  /** True when the month falls inside the chosen period. */
  nelPeriodo: boolean;
}

export interface VocePagamento {
  id: number;
  data: string;
  participantId: number;
  nome: string;
  courseId: number;
  corso: string;
  abbonamento: string;
  dal: string;
  al: string;
  importo: number;
  /** Date the person left their course, null if still enrolled. */
  ritiratoIl: string | null;
}

export interface DaPagare {
  id: number;
  nome: string;
  courseId: number;
  corso: string;
  abbonamento: string | null;
  pagatoFino: string | null;
  stato: Status;
}

export interface SituazioneFinanze {
  attivi: number;
  inRegola: number;
  inScadenza: number;
  daPagare: number;
  /** Members due or about to be: unpaid first, then by expiry. */
  elenco: DaPagare[];
}

export interface RiepilogoFinanze {
  filtri: FiltriFinanze;
  totali: TotaliFinanze;
  abbonamenti: VoceAbbonamento[];
  corsi: VoceCorso[];
  mesi: VoceMese[];
  pagamenti: VocePagamento[];
  situazione: SituazioneFinanze;
  /** Choices for the filters: every course and every plan name ever paid or currently offered. */
  opzioni: { corsi: { id: number; nome: string }[]; abbonamenti: string[] };
}
