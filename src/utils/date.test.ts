import { getMonthKey, getMonthRange, isSameMonth } from './date';

describe('getMonthKey', () => {
  it('YYYY-MM 形式を返す', () => {
    expect(getMonthKey('2026-06-15')).toBe('2026-06');
    expect(getMonthKey('2026-12-31')).toBe('2026-12');
  });
});

describe('getMonthRange', () => {
  it('当月の開始日・終了日を返す', () => {
    expect(getMonthRange('2026-06-15')).toEqual({ start: '2026-06-01', end: '2026-06-30' });
  });
  it('2月（うるう年でない）は28日まで', () => {
    expect(getMonthRange('2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });
});

describe('isSameMonth', () => {
  it('同じ月は true', () => {
    expect(isSameMonth('2026-06-01', '2026-06-30')).toBe(true);
  });
  it('違う月は false', () => {
    expect(isSameMonth('2026-06-30', '2026-07-01')).toBe(false);
    expect(isSameMonth('2025-06-15', '2026-06-15')).toBe(false);
  });
});
