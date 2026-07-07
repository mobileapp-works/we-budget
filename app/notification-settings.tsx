/** 通知設定。種類ごとに ON/OFF を切り替える。 */
import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, StateView } from '@/components';
import { useNotificationSettings, useNotificationSettingsActions } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography } from '@/constants';
import type { NotificationSettings } from '@/types/models';

type ToggleKey = Exclude<keyof NotificationSettings, 'userId'>;

const ROWS: { key: ToggleKey; labelKey: string }[] = [
  { key: 'expenseAdded', labelKey: 'notificationSettings.expenseAdded' },
  { key: 'expenseEdited', labelKey: 'notificationSettings.expenseEdited' },
  { key: 'expenseDeleted', labelKey: 'notificationSettings.expenseDeleted' },
  { key: 'settlement', labelKey: 'notificationSettings.settlement' },
  { key: 'reminderVariable', labelKey: 'notificationSettings.reminderVariable' },
  { key: 'budgetAlert', labelKey: 'notificationSettings.budgetAlert' },
  { key: 'settlementReminder', labelKey: 'notificationSettings.settlementReminder' },
];

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const settingsQuery = useNotificationSettings();
  const { updateSettings } = useNotificationSettingsActions();

  const settings = settingsQuery.data;

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('notificationSettings.title')} />
      <StateView isLoading={settingsQuery.isLoading} isError={settingsQuery.isError} onRetry={() => settingsQuery.refetch()}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.listCard}>
            {ROWS.map((row, idx) => (
              <View
                key={row.key}
                style={[styles.row, idx < ROWS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
              >
                <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{t(row.labelKey)}</Text>
                <Switch
                  value={settings ? settings[row.key] : true}
                  onValueChange={(value) =>
                    updateSettings.mutate(
                      { [row.key]: value },
                      { onError: () => toast.show(t('error.generic'), 'error') }
                    )
                  }
                  trackColor={{ true: colors.primary, false: colors.border }}
                  accessibilityLabel={t(row.labelKey)}
                />
              </View>
            ))}
          </Card>
        </ScrollView>
      </StateView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md },
  listCard: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, minHeight: 52 },
});
