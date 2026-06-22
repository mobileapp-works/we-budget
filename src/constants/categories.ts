/**
 * デフォルトカテゴリ定義。
 * 出典: design.md（pair作成時に各ペアへ複製。表示名は name_key を翻訳）。
 * icon は Ionicons（@expo/vector-icons）の名前。color はアイコン円の背景色。
 */
export type DefaultCategory = {
  /** 安定キー（DBの name_key と一致: 'category.<key>'） */
  key: string;
  nameKey: string;
  icon: string;
  color: string;
};

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { key: 'food', nameKey: 'category.food', icon: 'restaurant', color: '#FF7A66' },
  { key: 'daily', nameKey: 'category.daily', icon: 'cart', color: '#0EA5E9' },
  { key: 'transport', nameKey: 'category.transport', icon: 'bus', color: '#8B5CF6' },
  { key: 'entertainment', nameKey: 'category.entertainment', icon: 'game-controller', color: '#EC4899' },
  { key: 'utilities', nameKey: 'category.utilities', icon: 'flash', color: '#F59E0B' },
  { key: 'rent', nameKey: 'category.rent', icon: 'home', color: '#14B8A6' },
  { key: 'telecom', nameKey: 'category.telecom', icon: 'wifi', color: '#6366F1' },
  { key: 'medical', nameKey: 'category.medical', icon: 'medkit', color: '#EF4444' },
  { key: 'other', nameKey: 'category.other', icon: 'ellipsis-horizontal', color: '#94A3B8' },
] as const;
