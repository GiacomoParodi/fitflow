import { describe, expect, it } from 'vitest';
import { isNewer } from '../electron/version';

describe('app desktop: confronto versioni per gli aggiornamenti', () => {
  it('riconosce una versione più recente', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(true);
    expect(isNewer('v1.2.0', '1.1.9')).toBe(true);
    expect(isNewer('2.0.0', '1.10.3')).toBe(true);
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
  });
  it('non propone versioni uguali o più vecchie', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false);
    expect(isNewer('v1.0.0', '1.0.0')).toBe(false);
    expect(isNewer('0.9.9', '1.0.0')).toBe(false);
    expect(isNewer('1.0.0-beta.1', '1.0.0')).toBe(false);
  });
});
