import { isValidEmail, isValidPassword, parseAmount } from './validation';

describe('isValidEmail', () => {
  it('正しい形式は true', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('taishirou16@outlook.com')).toBe(true);
  });
  it('前後の空白は許容（trimする）', () => {
    expect(isValidEmail('  a@b.com  ')).toBe(true);
  });
  it('不正な形式は false', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('ab.com')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('6文字以上は true', () => {
    expect(isValidPassword('123456')).toBe(true);
  });
  it('5文字以下は false', () => {
    expect(isValidPassword('12345')).toBe(false);
    expect(isValidPassword('')).toBe(false);
  });
});

describe('parseAmount', () => {
  it('数値文字列を数値に変換', () => {
    expect(parseAmount('1200')).toBe(1200);
    expect(parseAmount('12.5')).toBe(12.5);
  });
  it('カンマ・空白を除去して変換', () => {
    expect(parseAmount('1,200')).toBe(1200);
    expect(parseAmount(' 3 000 ')).toBe(3000);
  });
  it('0・負数・空・非数値は null', () => {
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('-100')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
  it('全角数字を半角へ正規化して変換', () => {
    expect(parseAmount('１２００')).toBe(1200);
    expect(parseAmount('１２．５')).toBe(12.5);
    expect(parseAmount('１，２００')).toBe(1200);
  });
});
