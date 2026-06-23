/**
 * 支出表示の補助フック。
 * カテゴリの解決と「支払った人」ラベルの組み立てを共通化する。
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCategories } from './useCategories';
import { useRequireSession } from './useSession';
import { useCategoryName } from '@/components/CategoryBadge';
import type { Category, Expense, UUID } from '@/types/models';

export function useExpenseHelpers() {
  const session = useRequireSession();
  const { t } = useTranslation();
  const { data: categories } = useCategories();
  const resolveName = useCategoryName();

  const categoryMap = useMemo(() => {
    const map = new Map<UUID, Category>();
    categories?.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const getCategory = (id: UUID): Category | undefined => categoryMap.get(id);

  const getCategoryName = (id: UUID): string => {
    const category = categoryMap.get(id);
    return category ? resolveName(category) : '';
  };

  /** 「自分 / パートナー名 / 共同口座 / 退会したユーザー」を返す。 */
  const getPayerLabel = (expense: Expense): string => {
    if (expense.isSharedPayment) return t('expense.payerShared');
    if (!expense.payerUserId) return t('expense.retiredUser');
    if (expense.payerUserId === session.userId) return t('expense.payerSelf');
    if (session.partner && expense.payerUserId === session.partner.id) {
      return session.partner.displayName;
    }
    return t('expense.payerPartner');
  };

  return { getCategory, getCategoryName, getPayerLabel, categoryMap };
}
