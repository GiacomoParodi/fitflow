/** True when `candidate` ("1.2.3" or "v1.2.3") is a later version than `current`. */
export function isNewer(candidate: string, current: string): boolean {
  const parse = (v: string) => v.trim().replace(/^v/i, '').split(/[-+]/)[0].split('.').map(n => Number.parseInt(n, 10) || 0);
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}
