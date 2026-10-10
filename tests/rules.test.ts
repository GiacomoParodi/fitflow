import { describe, expect, it } from 'vitest';
import { addMonths, fmt, fmtLong, isISODate } from '../shared/dates';
import { paymentPeriod, renewedIscrizione, status } from '../shared/rules';

describe('dates', () => {
  it('adds months clamping to the end of the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-09-26', 3)).toBe('2026-12-26');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
  it('formats dates in Italian', () => {
    expect(fmt('2026-09-26')).toBe('26/09/2026');
    expect(fmt(null)).toBe('—');
    expect(fmtLong('2026-09-26')).toBe('Sabato 26 settembre');
  });
  it('validates ISO dates', () => {
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('26/09/2026')).toBe(false);
  });
});

describe('status', () => {
  const today = '2026-09-26';
  it('classifies deadlines against the warning threshold', () => {
    expect(status(null, 30, today)).toBe('mancante');
    expect(status('2026-09-25', 30, today)).toBe('scaduto');
    expect(status('2026-09-26', 4, today)).toBe('in_scadenza');
    expect(status('2026-09-30', 4, today)).toBe('in_scadenza');
    expect(status('2026-10-01', 4, today)).toBe('valido');
  });
});

describe('payments and renewals', () => {
  it('extends from the old expiry on an early renewal', () => {
    expect(paymentPeriod('2026-10-01', '2026-09-26', 1)).toEqual({ dal: '2026-10-01', al: '2026-11-01' });
  });
  it('starts from the payment date when coverage already lapsed', () => {
    expect(paymentPeriod('2026-09-05', '2026-09-26', 3)).toEqual({ dal: '2026-09-26', al: '2026-12-26' });
    expect(paymentPeriod(null, '2026-09-26', 1)).toEqual({ dal: '2026-09-26', al: '2026-10-26' });
  });
  it('renews the annual membership by one year', () => {
    expect(renewedIscrizione('2027-08-31', '2026-09-26')).toBe('2028-08-31');
    expect(renewedIscrizione('2026-09-15', '2026-09-26')).toBe('2027-09-26');
    expect(renewedIscrizione(null, '2026-09-26')).toBe('2027-09-26');
  });
});
