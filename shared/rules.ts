// Business rules shared by server and client.
import { addMonths, daysBetween } from './dates';

export type Status = 'valido' | 'in_scadenza' | 'scaduto' | 'mancante';

export function status(iso: string | null | undefined, warnDays: number, today: string): Status {
  if (!iso) return 'mancante';
  const d = daysBetween(today, iso);
  return d < 0 ? 'scaduto' : d <= warnDays ? 'in_scadenza' : 'valido';
}

export const isSevere = (s: Status) => s === 'scaduto' || s === 'mancante';

export const PAY_LABELS: Record<Status, string> = { valido: 'In regola', in_scadenza: 'In scadenza', scaduto: 'Da pagare', mancante: 'Da pagare' };
export const CERT_LABELS: Record<Status, string> = { valido: 'Valido', in_scadenza: 'In scadenza', scaduto: 'Scaduto', mancante: 'Mancante' };
export const ISCR_LABELS: Record<Status, string> = { valido: 'Attiva', in_scadenza: 'In scadenza', scaduto: 'Scaduta', mancante: 'Mancante' };

/**
 * Period covered by a new payment. An early renewal (current coverage still running on the
 * payment date) extends from the old end date; otherwise coverage starts on the payment date.
 */
export function paymentPeriod(pagatoFino: string | null, paymentDate: string, mesi: number): { dal: string; al: string } {
  const dal = pagatoFino && pagatoFino >= paymentDate ? pagatoFino : paymentDate;
  return { dal, al: addMonths(dal, mesi) };
}

/** Annual membership renewal: +12 months from the current expiry, or from today if already expired. */
export function renewedIscrizione(scadenza: string | null, today: string): string {
  const base = scadenza && scadenza > today ? scadenza : today;
  return addMonths(base, 12);
}

export function mesiLabel(n: number): string {
  return n === 1 ? '1 mese' : `${n} mesi`;
}

export function euro(n: number): string {
  return '€' + (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));
}
