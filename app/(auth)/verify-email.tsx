/** メール確認待ち画面。届かない初回ユーザー向けに確認メールの再送もできる。 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Button } from '@/components';
import { useAuthActions } from '@/hooks';
import { useToast } from '@/providers/ToastProvider';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography } from '@/constants';
import { authErrorKey } from '@/lib/authErrors';

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { resendVerification } = useAuthActions();
  // サインアップ画面から渡されたメールアドレス（再送先）。直接遷移時は無いこともある。
  const { email } = useLocalSearchParams<{ email?: string }>();

  const handleResend = () => {
    if (!email) return;
    resendVerification.mutate(email, {
      onSuccess: () => toast.show(t('auth.resent'), 'success'),
      onError: (e) => toast.show(t(authErrorKey(e)), 'error'),
    });
  };

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
        {email ? (
          <>
            <Button title={t('auth.resend')} onPress={handleResend} loading={resendVerification.isPending} />
            <View style={{ height: spacing.sm }} />
            <Button title={t('auth.toLogin')} variant="text" onPress={() => router.replace('/(auth)/login')} />
          </>
        ) : (
          <Button title={t('auth.toLogin')} onPress={() => router.replace('/(auth)/login')} />
        )}
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
