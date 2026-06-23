/**
 * 現在のカラースキーム（ライト/ダーク）と対応するカラーパレットを返すフック。
 * ユーザー設定（theme: light/dark/system）と端末設定を合成して解決する。
 */
import { useColorScheme } from 'react-native';
import { usePreferencesStore } from '@/store/preferencesStore';
import { palettes, type ColorPalette, type ColorSchemeName } from '@/constants';

export interface ThemeValue {
  colors: ColorPalette;
  scheme: ColorSchemeName;
  isDark: boolean;
}

export function useTheme(): ThemeValue {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const themePref = usePreferencesStore((s) => s.theme);

  const scheme: ColorSchemeName =
    themePref === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePref;

  return {
    colors: palettes[scheme],
    scheme,
    isDark: scheme === 'dark',
  };
}
