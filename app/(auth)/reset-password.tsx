/** パスワードリセット（ログイン前）画面。 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Button, TextField } from '@/components';
import { useTheme } from '@/hooks/useTheme';
import { useAuthActions } from '@/hooks';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography } from '@/constants';
import { isValidEmail } from '@/utils';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { sendPasswordReset } = useAuthActions();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSend = () => {
    if (!isValidEmail(email)) {
      setError(t('error.invalidEmail'));
      return;
    }
    setError(null);
    sendPasswordReset.mutate(email, {
      onSuccess: () => {
        toast.show(t('auth.resetEmailSent'), 'success');
        router.back();
      },
      onError: () => toast.show(t('error.generic'), 'error'),
    });
  };

  return (
    <Screen withBanner={false} padded={false}>
      <ScreenHeader title={t('auth.resetPasswordTitle')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[typography.body, styles.body, { color: colors.textSecondary }]}>
            {t('auth.resetPasswordBody')}
          </Text>
          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            error={error}
          />
          <Button title={t('auth.sendResetEmail')} onPress={handleSend} loading={sendPasswordReset.isPending} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.md },
  body: { marginBottom: spacing.md },
});
