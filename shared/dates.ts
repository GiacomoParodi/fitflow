// Date helpers working on ISO calendar dates ("YYYY-MM-DD"), always in UTC to avoid DST drift.

export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const WEEKDAYS_LONG = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MONTHS_LONG = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

/** Today's date in the local time zone, as ISO. */
export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isISODate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return fromUTC(toUTC(iso) + n * 86400000);
}

/** Adds calendar months, clamping to the end of the month (31/01 + 1 mese = 28/02). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUTC(target.getTime());
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUTC(toIso) - toUTC(fromIso)) / 86400000);
}

/** 0 = domenica … 6 = sabato */
export function weekday(iso: string): number {
  return new Date(toUTC(iso)).getUTCDay();
}

/** "26/09/2026", or "—" when missing. */
export function fmt(iso: string | null | undefined): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
}

/** { day: "Sab", label: "26/09" } */
export function fmtShort(iso: string): { day: string; label: string } {
  return { day: WEEKDAYS_SHORT[weekday(iso)], label: `${iso.slice(8, 10)}/${iso.slice(5, 7)}` };
}

/** "Sabato 26 settembre" */
export function fmtLong(iso: string): string {
  const s = `${WEEKDAYS_LONG[weekday(iso)]} ${Number(iso.slice(8, 10))} ${MONTHS_LONG[Number(iso.slice(5, 7)) - 1]}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthName(iso: string): string {
  return MONTHS_LONG[Number(iso.slice(5, 7)) - 1];
}

/** Last day of the month containing iso. */
export function endOfMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return fromUTC(Date.UTC(y, m, 0));
}
