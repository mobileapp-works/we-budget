/** メール確認待ち画面。 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Button } from '@/components';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography } from '@/constants';

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Screen withBanner={false}>
      <View style={styles.container}>
        <Ionicons name="mail-unread-outline" size={64} color={colors.primary} style={styles.icon} />
        <Text style={[typography.title2, styles.title, { color: colors.textPrimary }]}>
          {t('auth.verifyEmailTitle')}
        </Text>
        <Text style={[typography.body, styles.body, { color: colors.textSecondary }]}>
          {t('auth.verifyEmailBody')}
        </Text>
        <Button title={t('auth.toLogin')} onPress={() => router.replace('/(auth)/login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  icon: { marginBottom: spacing.md },
  title: { textAlign: 'center', marginBottom: spacing.sm },
  body: { textAlign: 'center', marginBottom: spacing.xl },
});
