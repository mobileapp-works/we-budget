/**
 * クエリ画面の4状態（Loading / Error / Empty / Success）をまとめて扱うラッパー。
 * 各画面でこのコンポーネントを使い、状態の出し分け漏れを防ぐ。
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography } from '@/constants';
import { Button } from './Button';

interface StateViewProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  onRetry?: () => void;
  /** Empty 時に表示する要素（EmptyState など）。未指定なら何も出さない。 */
  emptyComponent?: React.ReactNode;
  children: React.ReactNode;
}

export function StateView({ isLoading, isError, isEmpty, onRetry, emptyComponent, children }: StateViewProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <View style={styles.center} accessibilityLabel={t('common.loading')}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={[typography.body, styles.errorText, { color: colors.textSecondary }]}>
          {t('error.generic')}
        </Text>
        {onRetry ? (
          <Button title={t('common.retry')} variant="secondary" fullWidth={false} onPress={onRetry} />
        ) : null}
      </View>
    );
  }

  if (isEmpty) {
    return <>{emptyComponent ?? null}</>;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { textAlign: 'center', marginBottom: spacing.md },
});
