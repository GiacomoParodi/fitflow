// Value axis for the Finanze chart: round ticks from 0 to just above the maximum.

/** About four evenly spaced round ticks (1, 2, 2.5 or 5 × 10^n), always starting at 0. */
export function assePulito(max: number, passi = 4): number[] {
  if (!(max > 0)) return [0, 100];
  const grezzo = max / passi;
  const mag = 10 ** Math.floor(Math.log10(grezzo));
  const norm = grezzo / mag;
  const passo = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const n = Math.max(1, Math.ceil(max / passo - 1e-9));
  return Array.from({ length: n + 1 }, (_, i) => Math.round(i * passo * 100) / 100);
}
