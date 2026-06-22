import {
  roundMoney,
  currencyDecimals,
  formatSignedCurrency,
  buildRateMap,
  convertAmount,
} from './money';
import { makeRate } from '@/test-utils/factories';

describe('currencyDecimals', () => {
  it('JPY/KRW は 0 桁', () => {
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('KRW')).toBe(0);
  });
  it('USD/EUR は 2 桁', () => {
    expect(currencyDecimals('USD')).toBe(2);
    expect(currencyDecimals('EUR')).toBe(2);
  });
});

describe('roundMoney', () => {
  it('JPY は整数に丸める', () => {
    expect(roundMoney(1200.6, 'JPY')).toBe(1201);
    expect(roundMoney(1200.4, 'JPY')).toBe(1200);
  });
  it('USD は小数2桁に丸める', () => {
    expect(roundMoney(12.005, 'USD')).toBe(12.01);
    expect(roundMoney(12.004, 'USD')).toBe(12.0);
  });
  it('浮動小数の誤差を吸収する', () => {
    expect(roundMoney(0.1 + 0.2, 'USD')).toBe(0.3);
  });
});

describe('formatSignedCurrency', () => {
  it('プラスは ＋ を付ける', () => {
    expect(formatSignedCurrency(1000, 'JPY')).toContain('＋');
  });
  it('マイナスは − を付ける', () => {
    expect(formatSignedCurrency(-1000, 'JPY')).toContain('−');
  });
  it('0 は符号なし', () => {
    const s = formatSignedCurrency(0, 'JPY');
    expect(s).not.toContain('＋');
    expect(s).not.toContain('−');
  });
});

describe('convertAmount', () => {
  it('同一通貨はそのまま返す', () => {
    const map = buildRateMap([]);
    expect(convertAmount(1000, 'JPY', 'JPY', map)).toBe(1000);
  });
  it('直接レートで換算する', () => {
    const map = buildRateMap([makeRate({ fromCurrency: 'USD', toCurrency: 'JPY', rate: 150 })]);
    expect(convertAmount(10, 'USD', 'JPY', map)).toBe(1500);
  });
  it('逆レートがあれば 1/rate で換算する', () => {
    const map = buildRateMap([makeRate({ fromCurrency: 'JPY', toCurrency: 'USD', rate: 0.0066 })]);
    const result = convertAmount(1500, 'USD', 'JPY', map);
    expect(result).not.toBeNull();
    expect(Math.round(result as number)).toBe(227273); // 1500 / 0.0066
  });
  it('レートが無ければ null を返す', () => {
    const map = buildRateMap([]);
    expect(convertAmount(10, 'USD', 'JPY', map)).toBeNull();
  });
});
