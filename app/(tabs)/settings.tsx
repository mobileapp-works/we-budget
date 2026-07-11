/** 設定画面。言語/テーマ切替、各管理画面への導線、ログアウト・アカウント削除など。 */
import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card, SegmentedControl } from '@/components';
import { useTheme } from '@/hooks/useTheme';
import { useAuthActions } from '@/hooks';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, layout, APP_CONFIG } from '@/constants';
import type { LanguagePref, ThemePref } from '@/types/models';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { signOut, deleteAccount } = useAuthActions();

  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);

  const confirmLogout = () => {
    Alert.alert(t('auth.logout'), t('auth.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logout'), style: 'destructive', onPress: () => signOut.mutate() },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(t('auth.deleteAccount'), t('auth.deleteAccountConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.deleteAccount'),
        style: 'destructive',
        onPress: () =>
          deleteAccount.mutate(undefined, { onError: () => toast.show(t('error.generic'), 'error') }),
      },
    ]);
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={[typography.title1, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 表示 */}
        <SectionTitle title={t('settings.appearance')} />
        <Card>
          <Text style={[typography.subhead, styles.label, { color: colors.textSecondary }]}>{t('settings.language')}</Text>
          <SegmentedControl<LanguagePref>
            options={[
              { value: 'ja', label: t('settings.languageJa') },
              { value: 'en', label: t('settings.languageEn') },
              { value: 'auto', label: t('settings.languageAuto') },
            ]}
            value={language}
            onChange={setLanguage}
          />
          <View style={{ height: spacing.md }} />
          <Text style={[typography.subhead, styles.label, { color: colors.textSecondary }]}>{t('settings.theme')}</Text>
          <SegmentedControl<ThemePref>
            options={[
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
              { value: 'system', label: t('settings.themeSystem') },
            ]}
            value={theme}
            onChange={setTheme}
          />
        </Card>

        {/* 管理 */}
        <SectionTitle title={t('settings.account')} />
        <Card style={styles.linkCard}>
          <LinkRow icon="person-outline" label={t('settings.profile')} onPress={() => router.push('/profile')} />
          <LinkRow icon="pricetags-outline" label={t('settings.categories')} onPress={() => router.push('/categories')} />
          <LinkRow icon="repeat-outline" label={t('settings.fixedCosts')} onPress={() => router.push('/fixed-costs')} />
          <LinkRow icon="wallet-outline" label={t('settings.budget')} onPress={() => router.push('/budget')} />
          <LinkRow icon="cash-outline" label={t('settings.baseCurrency')} onPress={() => router.push('/base-currency')} />
          <LinkRow icon="people-outline" label={t('settings.sharedAccount')} onPress={() => router.push('/shared-account')} />
          <LinkRow
            icon="notifications-outline"
            label={t('settings.notifications')}
            onPress={() => router.push('/notification-settings')}
            last
          />
        </Card>

        {/* アカウント操作 */}
        <Card style={styles.linkCard}>
          <LinkRow icon="log-out-outline" label={t('auth.logout')} onPress={confirmLogout} />
          <LinkRow icon="trash-outline" label={t('auth.deleteAccount')} onPress={confirmDelete} destructive last />
        </Card>

        {/* アプリについて */}
        <SectionTitle title={t('settings.about')} />
        <Card style={styles.linkCard}>
          <LinkRow
            icon="shield-checkmark-outline"
            label={t('settings.privacyPolicy')}
            onPress={() => Linking.openURL(APP_CONFIG.privacyPolicyUrl)}
          />
          <View style={[styles.versionRow, { borderTopColor: colors.border }]}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{t('settings.version')}</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{version}</Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return <Text style={[typography.footnote, styles.sectionTitle, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>;
}

function LinkRow({
  icon,
  label,
  onPress,
  destructive,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const color = destructive ? colors.error : colors.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.linkRow,
        { opacity: pressed ? 0.6 : 1 },
        !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[typography.body, { color, flex: 1, marginLeft: spacing.sm }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textPlaceholder} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  scroll: { padding: spacing.md, gap: spacing.sm },
  label: { marginBottom: spacing.xs },
  sectionTitle: { marginTop: spacing.md, marginLeft: spacing.xs, letterSpacing: 0.5 },
  linkCard: { padding: 0, overflow: 'hidden' },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, minHeight: layout.minTapSize + 6 },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
