/** ペアリング画面（モーダル）。招待コードの表示/共有と、相手コードの入力。 */
import React, { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, TextField } from '@/components';
import { useRequireSession, usePairActions } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography } from '@/constants';

export default function PairingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const session = useRequireSession();

  const { createInvite, joinPair } = usePairActions();
  const [inviteCode, setInviteCode] = useState<string>(session.pair.inviteCode);
  const [enteredCode, setEnteredCode] = useState('');

  // 招待コードを取得（無ければ生成）
  useEffect(() => {
    if (!inviteCode) {
      createInvite.mutate(undefined, { onSuccess: setInviteCode });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShare = () => {
    void Share.share({ message: `WeBudget の招待コード: ${inviteCode}` });
  };

  const handleJoin = () => {
    if (!enteredCode.trim()) return;
    joinPair.mutate(enteredCode.trim(), {
      onSuccess: () => {
        toast.show(t('pairing.joined'), 'success');
        router.back();
      },
      onError: () => toast.show(t('pairing.invalidCode'), 'error'),
    });
  };

  return (
    <Screen withBanner={false} padded={false}>
      <ScreenHeader title={t('pairing.title')} showBack={false} right={<CloseButton onPress={() => router.back()} />} />
      <View style={styles.body}>
        <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
          {t('pairing.body')}
        </Text>

        {/* 自分の招待コード */}
        <Card backgroundColor={colors.coralSoft}>
          <Text style={[typography.subhead, { color: colors.textSecondary }]}>{t('pairing.yourCode')}</Text>
          <Text style={[typography.display, styles.code, { color: colors.primary }]}>{inviteCode || '…'}</Text>
          <Button
            title={t('pairing.shareCode')}
            left={<Ionicons name="share-outline" size={18} color={colors.primaryText} />}
            onPress={handleShare}
          />
        </Card>

        <View style={{ height: spacing.lg }} />

        {/* 相手のコードを入力 */}
        <Card>
          <TextField
            label={t('pairing.enterCode')}
            value={enteredCode}
            onChangeText={setEnteredCode}
            autoCapitalize="characters"
          />
          <Button title={t('pairing.join')} onPress={handleJoin} loading={joinPair.isPending} />
        </Card>
      </View>
    </Screen>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="閉じる" hitSlop={8}>
      <Ionicons name="close" size={26} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: spacing.md },
  code: { letterSpacing: 4, marginVertical: spacing.sm },
});
