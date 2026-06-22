/**
 * タイポグラフィトークン。
 * 出典: docs/ui/typography.md（iOS標準に馴染むスケール / Dynamic Type 追従）。
 * fontSize の直値を書かず、必ずこのトークンを参照する。
 */
import type { TextStyle } from 'react-native';

export type TypographyToken =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption';

type TypeStyle = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'lineHeight'>;

export const typography: Record<TypographyToken, TypeStyle> = {
  display: { fontSize: 34, fontWeight: '700', lineHeight: 41 },
  title1: { fontSize: 28, fontWeight: '700', lineHeight: 35 },
  title2: { fontSize: 22, fontWeight: '600', lineHeight: 29 },
  title3: { fontSize: 20, fontWeight: '600', lineHeight: 26 },
  body: { fontSize: 17, fontWeight: '400', lineHeight: 26 },
  callout: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  subhead: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  footnote: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
};
