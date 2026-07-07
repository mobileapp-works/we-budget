/** 新規登録画面。登録後はメール確認待ち画面へ。 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Button, TextField } from '@/components';
import { useAuthActions } from '@/hooks';
import { useToast } from '@/providers/ToastProvider';
import { spacing } from '@/constants';
import { isValidEmail, isValidPassword } from '@/utils/validation';
import { authErrorKey } from '@/lib/authErrors';

export default function SignupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { signUp } = useAuthActions();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleSignup = () => {
    const nextErrors: typeof errors = {};
    if (!isValidEmail(email)) nextErrors.email = t('error.invalidEmail');
    if (!isValidPassword(password)) nextErrors.password = t('error.weakPassword');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    signUp.mutate(
      { email, password, displayName: displayName.trim() || t('profile.defaultName') },
      {
        onSuccess: () => router.replace('/(auth)/verify-email'),
        onError: (e) => toast.show(t(authErrorKey(e)), 'error'),
      }
    );
  };

  return (
    <Screen withBanner={false} padded={false}>
      <ScreenHeader title={t('auth.signupTitle')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextField label={t('profile.displayName')} value={displayName} onChangeText={setDisplayName} />
          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            error={errors.email}
          />
          <TextField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            error={errors.password}
          />
          <Button title={t('auth.signupButton')} onPress={handleSignup} loading={signUp.isPending} />
          <Button title={t('auth.toLogin')} variant="text" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.md },
});
