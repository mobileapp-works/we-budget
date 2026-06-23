/**
 * i18next の初期化。日本語・英語に対応。
 * 出典: GLOBAL_STANDARDS §3 / design.md §6。UI文字列は必ず t('key') 経由で参照する。
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import ja from '@/locales/ja.json';
import en from '@/locales/en.json';
import type { LanguagePref } from '@/types/models';

export type AppLanguage = 'ja' | 'en';

/** 言語設定（auto含む）を実際の言語コードに解決する。 */
export function resolveLanguage(pref: LanguagePref): AppLanguage {
  if (pref === 'ja' || pref === 'en') return pref;
  const deviceLang = Localization.getLocales()[0]?.languageCode;
  return deviceLang === 'ja' ? 'ja' : 'en';
}

// 初期化（端末言語をデフォルトに。設定変更時は applyLanguage で切り替える）
void i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: resolveLanguage('auto'),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React は自動エスケープするため不要
  returnNull: false,
});

/** 設定に応じて表示言語を切り替える。 */
export function applyLanguage(pref: LanguagePref): void {
  void i18n.changeLanguage(resolveLanguage(pref));
}

export default i18n;
