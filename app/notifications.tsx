/** 通知一覧。タップで既読（ペア申請系はペア画面へ遷移）、ヘッダー右で全既読。 */
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, EmptyState, StateView } from '@/components';
import { useNotifications, useNotificationActions, useLocale } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { queryKeys } from '@/lib/queryClient';
import { spacing, typography } from '@/constants';
import { formatDate } from '@/utils';
import type { AppNotification } from '@/types/models';

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const notificationsQuery = useNotifications();
  const { markRead, markAllRead } = useNotificationActions();

  const data = notificationsQuery.data ?? [];

  const handlePress = (item: AppNotification) => {
    if (!item.isRead) markRead.mutate(item.id);
    // ペア申請系は状態が変わっている可能性が高いので、セッションを取り直しつつペア画面へ。
    if (item.type === 'pair_request') {
      router.push('/pairing');
    } else if (item.type === 'pair_approved') {
      void qc.invalidateQueries({ queryKey: queryKeys.session });
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <Pressable
      onPress={() => handlePress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={[
        styles.row,
        { borderBottomColor: colors.border, backgroundColor: item.isRead ? 'transparent' : colors.coralSoft },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: item.isRead ? 'transparent' : colors.primary }]} />
      <View style={styles.body}>
        <Text style={[typography.body, { color: colors.textPrimary }]}>{item.title}</Text>
        <Text style={[typography.footnote, { color: colors.textSecondary }]}>{item.body}</Text>
        <Text style={[typography.caption, { color: colors.textPlaceholder }]}>
          {formatDate(item.createdAt, i18n.language)}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={t('notifications.title')}
        right={
          data.some((n) => !n.isRead) ? (
            <Pressable onPress={() => markAllRead.mutate()} accessibilityRole="button" accessibilityLabel={t('notifications.markAllRead')} hitSlop={8}>
              <Ionicons name="checkmark-done" size={24} color={colors.primary} />
            </Pressable>
          ) : null
        }
      />
      <StateView
        isLoading={notificationsQuery.isLoading}
        isError={notificationsQuery.isError}
        isEmpty={data.length === 0}
        onRetry={() => notificationsQuery.refetch()}
        emptyComponent={<EmptyState icon="notifications-off-outline" title={t('notifications.emptyTitle')} body={t('notifications.emptyBody')} />}
      >
        <FlatList data={data} keyExtractor={(item) => item.id} renderItem={renderItem} />
      </StateView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: spacing.sm },
  body: { flex: 1, gap: 2 },
});
