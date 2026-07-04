/**
 * カラートークン定義。
 * 出典: docs/ui/colors.md（コーラル×ティール / ライト・ダーク両対応 / WCAG AA）。
 * 直値の色をコンポーネントに書かず、必ずこのトークン経由で参照する。
 */

/** 全カラートークンのキー。ライト/ダークで同じキーを持つことを型で保証する。 */
export type ColorToken =
  | 'primary'
  | 'primaryText'
  | 'accent'
  | 'accentText'
  | 'coralTint'
  | 'coralSoft'
  | 'background'
  | 'surface'
  | 'surfaceElevated'
  | 'border'
  | 'textPrimary'
  | 'textSecondary'
  | 'textPlaceholder'
  | 'textDisabled'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'scrim';

export type ColorPalette = Record<ColorToken, string>;

/** ライトモード（あたたかい白ベース） */
export const lightColors: ColorPalette = {
  primary: '#C8472F', // 深めコーラル（白文字 4.8:1 で AA 合格）
  primaryText: '#FFFFFF',
  accent: '#0F766E', // ティール（白文字バッジで AA 合格）
  accentText: '#FFFFFF',
  coralTint: '#FF6F5C', // 装飾・イラスト・選択ハイライト用（白文字背景には使わない）
  coralSoft: '#FFE7E0', // コーラルの淡い面（チップ背景・進捗トラック）
  background: '#FFFBF9',
  surface: '#FFF4F0',
  surfaceElevated: '#FFFFFF',
  border: '#F0E0DA',
  textPrimary: '#1F1410',
  textSecondary: '#6B5750',
  textPlaceholder: '#A8968F',
  textDisabled: '#D8C8C2',
  success: '#16A34A',
  warning: '#B45309',
  error: '#DC2626',
  info: '#0F766E',
  scrim: 'rgba(0,0,0,0.45)', // 画像上のローディング等、コンテンツを覆う半透明レイヤー
};

/** ダークモード（ニュートラルダーク） */
export const darkColors: ColorPalette = {
  primary: '#C8472F',
  primaryText: '#FFFFFF',
  accent: '#2DD4BF',
  accentText: '#0F2A27',
  coralTint: '#FF7A66',
  coralSoft: '#3A211B',
  background: '#121212',
  surface: '#1E1A19',
  surfaceElevated: '#2A2422',
  border: '#3A3431',
  textPrimary: '#F7EDE9',
  textSecondary: '#B5A7A1',
  textPlaceholder: '#7A6E69',
  textDisabled: '#564E4A',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#2DD4BF',
  scrim: 'rgba(0,0,0,0.55)', // 画像上のローディング等、コンテンツを覆う半透明レイヤー
};

export const palettes = {
  light: lightColors,
  dark: darkColors,
} as const;

export type ColorSchemeName = keyof typeof palettes;
