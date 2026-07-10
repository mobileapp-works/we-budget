/**
 * パスワードリセット画面。
 * - request モード: 登録メールアドレスへリセットリンクを送信する（ログイン前）。
 * - update モード: メールのディープリンク（webudget://reset-password#access_token=...）で開かれたとき、
 *   トークンからリカバリーセッションを確立し、新しいパスワードを設定する。
 */
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Button, TextField } from '@/components';
import { useTheme } from '@/hooks/useTheme';
import { useAuthActions } from '@/hooks';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography } from '@/constants';
import { isValidEmail, isValidPassword } from '@/utils';
import { authErrorKey } from '@/lib/authErrors';

/** ディープリンクURLのクエリ・フラグメント両方からパラメータを集める。 */
function parseAuthParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const collect = (part: string | undefined) => {
    if (!part) return;
    for (const pair of part.split('&')) {
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
    }
  };
  const [beforeFragment, fragment] = url.split('#');
  collect(beforeFragment?.split('?')[1]);
  collect(fragment);
  return params;
}

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { sendPasswordReset, recoverSession, updatePassword } = useAuthActions();
  const url = useURL();

  const [mode, setMode] = useState<'request' | 'update'>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // リンクが無効/期限切れだったとき、トーストが消えても分かるように request モードに常時表示する。
  const [linkInvalid, setLinkInvalid] = useState(false);
  const handledUrl = useRef<string | null>(null);

  // 'error.auth' は資格情報向けの文言でこの画面の文脈に合わないため汎用文言に差し替える。
  const showAuthError = (e: unknown) => {
    const key = authErrorKey(e);
    toast.show(t(key === 'error.auth' ? 'error.generic' : key), 'error');
  };

  // リカバリーリンクで開かれたらトークンからセッションを確立し、新パスワード入力へ切り替える。
  useEffect(() => {
    if (!url || handledUrl.current === url) return;
    handledUrl.current = url;
    const params = parseAuthParams(url);
    if (params.error_description || params.error) {
      // 期限切れ・使用済みリンク等（Supabase が error パラメータ付きでリダイレクトしてくる）
      setLinkInvalid(true);
      toast.show(t('auth.resetLinkInvalid'), 'error');
      return;
    }
    if (params.access_token && params.refresh_token) {
      recoverSession.mutate(
        { accessToken: params.access_token, refreshToken: params.refresh_token },
        {
          onSuccess: () => {
            setLinkInvalid(false);
            setMode('update');
          },
          onError: (e) => {
            // 通信エラーはリンク自体の問題ではないので区別する（再送を促さない）。
            if (authErrorKey(e) === 'error.network') {
              toast.show(t('error.network'), 'error');
              return;
            }
            setLinkInvalid(true);
            toast.show(t('auth.resetLinkInvalid'), 'error');
          },
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

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
      onError: showAuthError,
    });
  };

  const handleUpdate = () => {
    let hasError = false;
    if (!isValidPassword(password)) {
      setError(t('error.weakPassword'));
      hasError = true;
    } else {
      setError(null);
    }
    if (password !== confirm) {
      setConfirmError(t('error.passwordMismatch'));
      hasError = true;
    } else {
      setConfirmError(null);
    }
    if (hasError) return;

    updatePassword.mutate(password, {
      onSuccess: () => {
        toast.show(t('auth.passwordUpdated'), 'success');
        // リカバリーセッションでログイン済みのため、そのままメインへ。
        router.replace('/(tabs)');
      },
      onError: (e) => {
        const key = authErrorKey(e);
        if (key === 'error.sessionExpired') {
          // リカバリーセッションが切れている＝リンクからやり直すしかないので、再送フォームへ戻す。
          setLinkInvalid(true);
          setMode('request');
          toast.show(t('auth.resetLinkInvalid'), 'error');
          return;
        }
        showAuthError(e);
      },
    });
  };

  return (
    <Screen withBanner={false} padded={false}>
      <ScreenHeader title={t('auth.resetPasswordTitle')} showBack={mode === 'request'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {mode === 'request' ? (
            <>
              {linkInvalid && (
                <Text
                  accessibilityRole="alert"
                  style={[typography.body, styles.body, { color: colors.error }]}
                >
                  ⚠ {t('auth.resetLinkInvalid')}
                </Text>
              )}
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
            </>
          ) : (
            <>
              <TextField
                label={t('auth.newPassword')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                error={error}
              />
              <TextField
                label={t('auth.confirmPassword')}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                textContentType="newPassword"
                error={confirmError}
              />
              <Button
                title={t('auth.updatePassword')}
                onPress={handleUpdate}
                loading={updatePassword.isPending || recoverSession.isPending}
              />
            </>
          )}
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
