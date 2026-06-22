export * from './colors';
export * from './spacing';
export * from './typography';
export * from './motion';
export * from './categories';

/** アプリ全体で使う定数 */
export const APP_CONFIG = {
  defaultCurrency: 'JPY',
  /** 招待コードの桁数 */
  inviteCodeLength: 8,
  /** レシート画像の最大幅（アップロード前に圧縮） */
  maxReceiptWidth: 1200,
  /** 予算アラートの閾値（％） */
  budgetWarningPercent: 80,
  budgetExceededPercent: 100,
  /** プライバシーポリシー公開URL（GitHub Pages） */
  privacyPolicyUrl: 'https://mobileapp-works.github.io/we-budget/privacy-policy.html',
} as const;

/** 対応通貨（MVP）。表示と入力候補に使う。 */
export const SUPPORTED_CURRENCIES = ['JPY', 'USD', 'EUR', 'GBP', 'KRW', 'TWD', 'AUD', 'CAD'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];
