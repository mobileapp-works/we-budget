/** 現在の言語に対応する Intl ロケールを返す（金額・日付フォーマット用）。 */
import { useTranslation } from 'react-i18next';

export function useLocale(): string {
  const { i18n } = useTranslation();
  return i18n.language === 'ja' ? 'ja-JP' : 'en-US';
}
