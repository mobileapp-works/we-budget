/**
 * 画面サイズからデバイス種別を判定するフック。
 * 固定幅を避け、iPhone SE〜iPad まで対応するために使う。
 */
import { useWindowDimensions } from 'react-native';
import { layout } from '@/constants';

export interface ResponsiveValue {
  width: number;
  height: number;
  isTablet: boolean;
  isPhone: boolean;
  /** リスト等のカラム数（iPadで2カラム）。 */
  numColumns: number;
  /** iPadでのコンテンツ最大幅（中央寄せ用）。 */
  contentMaxWidth: number;
}

export function useResponsive(): ResponsiveValue {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= layout.tabletBreakpoint;
  return {
    width,
    height,
    isTablet,
    isPhone: !isTablet,
    numColumns: isTablet ? 2 : 1,
    contentMaxWidth: isTablet ? layout.tabletMaxWidth : width,
  };
}
