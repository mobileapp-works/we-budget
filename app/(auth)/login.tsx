/** ログイン画面。メール/Apple/Google でログイン。 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Button, TextField } from '@/components';
import { useTheme } from '@/hooks/useTheme';
import { useAuthActions } from '@/hooks';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography } from '@/constants';
import { IS_MOCK } from '@/lib/env';
import { OAuthCancelledError, isAppleAuthAvailable, signInWithApple, signInWithGoogle } from '@/lib/oauth';

type OAuthProvider = 'apple' | 'google';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { signIn, signInWithProvider } = useAuthActions();

  const [email, setEmail] = useState('demo@webudget.app');
  const [password, setPassword] = useState('password');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  const handleLogin = () => {
    signIn.mutate(
      { email, password },
      { onError: (e) => toast.show(e instanceof Error ? e.message : t('error.auth'), 'error') }
    );
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    try {
      // モックではネイティブ SDK を呼ばずデモユーザーでログインする。
      let token = 'mock';
      if (!IS_MOCK) {
        const cred = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
        token = cred.token;
      }
      signInWithProvider.mutate(
        { provider, token },
        { onError: (e) => toast.show(e instanceof Error ? e.message : t('error.auth'), 'error') }
      );
    } catch (e) {
      if (!(e instanceof OAuthCancelledError)) {
        toast.show(e instanceof Error ? e.message : t('error.auth'), 'error');
      }
    } finally {
      setOauthLoading(null);
    }
  };

  // Apple はネイティブが使える iOS のみ表示（モック時はデモ確認のため常時表示）。
  const showApple = IS_MOCK || appleAvailable;

  return (
    <Screen withBanner={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Ionicons name="heart-circle" size={64} color={colors.primary} />
            <Text style={[typography.display, { color: colors.textPrimary }]}>{t('common.appName')}</Text>
          </View>

          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />

          <Button title={t('auth.loginButton')} onPress={handleLogin} loading={signIn.isPending} />

          <Button
            title={t('auth.forgotPassword')}
            variant="text"
            onPress={() => router.push('/(auth)/reset-password')}
          />

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
          </View>

          {showApple ? (
            <>
              <Button
                title={t('auth.continueWithApple')}
                variant="secondary"
                loading={oauthLoading === 'apple'}
                disabled={oauthLoading !== null}
                left={<Ionicons name="logo-apple" size={18} color={colors.textPrimary} />}
                onPress={() => handleOAuth('apple')}
              />
              <View style={{ height: spacing.sm }} />
            </>
          ) : null}
          <Button
            title={t('auth.continueWithGoogle')}
            variant="secondary"
            loading={oauthLoading === 'google'}
            disabled={oauthLoading !== null}
            left={<Ionicons name="logo-google" size={18} color={colors.textPrimary} />}
            onPress={() => handleOAuth('google')}
          />

          <View style={styles.footer}>
            <Text style={[typography.subhead, { color: colors.textSecondary }]}>{t('auth.noAccount')}</Text>
            <Button title={t('auth.toSignup')} variant="text" fullWidth={false} onPress={() => router.push('/(auth)/signup')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  divider: { marginVertical: spacing.lg },
  line: { height: StyleSheet.hairlineWidth },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
});
