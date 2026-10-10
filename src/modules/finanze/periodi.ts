// Period presets of the Finanze page, as inclusive ISO date ranges.
import { addMonths, endOfMonth } from '../../../shared/dates';

export type PeriodoId = 'mese' | 'mese-scorso' | 'tre-mesi' | 'anno' | 'stagione' | 'personalizzato';

export const PERIODI: { id: PeriodoId; label: string }[] = [
  { id: 'mese', label: 'Questo mese' },
  { id: 'mese-scorso', label: 'Mese scorso' },
  { id: 'tre-mesi', label: 'Ultimi 3 mesi' },
  { id: 'anno', label: "Quest'anno" },
  { id: 'stagione', label: 'Stagione' },
  { id: 'personalizzato', label: 'Personalizzato' },
];

export interface Range { dal: string; al: string }

/** The season runs 1 September – 31 August; the current one is the one containing today. */
export function stagione(today: string): Range {
  const y = Number(today.slice(0, 4));
  const start = today.slice(5) >= '09-01' ? y : y - 1;
  return { dal: `${start}-09-01`, al: `${start + 1}-08-31` };
}

/** Date range of a preset. 'personalizzato' has none (the user picks it). */
export function rangeFor(id: Exclude<PeriodoId, 'personalizzato'>, today: string): Range {
  const month = today.slice(0, 7) + '-01';
  switch (id) {
    case 'mese': return { dal: month, al: endOfMonth(month) };
    case 'mese-scorso': { const m = addMonths(month, -1); return { dal: m, al: endOfMonth(m) }; }
    case 'tre-mesi': return { dal: addMonths(month, -2), al: endOfMonth(month) };
    case 'anno': return { dal: today.slice(0, 4) + '-01-01', al: today.slice(0, 4) + '-12-31' };
    case 'stagione': return stagione(today);
  }
}
