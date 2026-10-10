// Number formatting for the Finanze page (Italian conventions).

function grouped(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "€1.240" or "€1.240,50": cents only when present. */
export function euroIt(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(Math.round(n * 100) / 100);
  const [i, d] = abs.toFixed(2).split('.');
  return (neg ? '−' : '') + '€' + grouped(i) + (d === '00' ? '' : ',' + d);
}

/** "1.240,50" — always two decimals, no symbol (for CSV / spreadsheets). */
export function decimaleIt(n: number): string {
  const [i, d] = (Math.round(n * 100) / 100).toFixed(2).split('.');
  return i + ',' + d;
}

/** "12,5%" */
export function percentIt(n: number): string {
  return (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')) + '%';
}
