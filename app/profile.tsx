/** プロフィール画面。表示名・アイコン・パスワード変更・パートナー情報・負担割合・ペア解除。 */
import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, TextField, SplitRatioField } from '@/components';
import {
  useRequireSession,
  useProfileActions,
  usePairActions,
  useSplitRatio,
  useAuthActions,
  useSettlementBalance,
  useLocale,
} from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius } from '@/constants';
import { formatCurrency } from '@/utils';
import { authErrorKey } from '@/lib/authErrors';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const locale = useLocale();
  const session = useRequireSession();
  const balanceQuery = useSettlementBalance();

  const { updateProfile, changeAvatar } = useProfileActions();
  const { leavePair } = usePairActions();
  const { myPercent, save: saveSplitRatio, saving: savingRatio } = useSplitRatio();
  const { sendPasswordReset } = useAuthActions();

  const [displayName, setDisplayName] = useState(session.profile.displayName);
  const isPaired = session.pair.user2Id !== null;

  const handleSaveName = () => {
    updateProfile.mutate(
      { displayName: displayName.trim() || t('profile.defaultName') },
      {
        onSuccess: () => toast.show(t('profile.saved'), 'success'),
        onError: () => toast.show(t('error.generic'), 'error'),
      }
    );
  };

  const handleChangeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.show(t('error.photoPermission'), 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    changeAvatar.mutate(
      { uri: asset.uri, base64: asset.base64!, contentType: asset.mimeType ?? 'image/jpeg' },
      {
        onSuccess: () => toast.show(t('profile.saved'), 'success'),
        onError: () => toast.show(t('error.generic'), 'error'),
      }
    );
  };

  const handleChangePassword = () => {
    Alert.alert(
      t('profile.changePassword'),
      `${t('auth.resetPasswordBody')}\n${session.email}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.sendResetEmail'),
          onPress: () =>
            sendPasswordReset.mutate(session.email, {
              onSuccess: () => toast.show(t('auth.resetEmailSent'), 'success'),
              onError: (e) => toast.show(t(authErrorKey(e)), 'error'),
            }),
        },
      ]
    );
  };

  const handleUnpair = () => {
    const doUnpair = () =>
      leavePair.mutate(undefined, {
        onSuccess: () => router.back(),
        onError: () => toast.show(t('error.generic'), 'error'),
      });

    // 未精算の立替が残っている場合は先に精算を促す（要件: 解除前に精算を促す）
    const balance = balanceQuery.data;
    if (balance && balance.settlementAmount > 0) {
      Alert.alert(
        t('profile.unpair'),
        t('profile.unpairUnsettledBody', {
          amount: formatCurrency(balance.settlementAmount, balance.currency, locale),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.goSettle'), onPress: () => router.push('/settlement') },
          { text: t('profile.unpairAnyway'), style: 'destructive', onPress: doUnpair },
        ]
      );
      return;
    }

    Alert.alert(t('profile.unpair'), t('profile.unpairConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.unpair'),
        style: 'destructive',
        onPress: doUnpair,
      },
    ]);
  };

  const handleSaveRatio = (mine: number) => {
    saveSplitRatio(mine, {
      onSuccess: () => toast.show(t('common.saved'), 'success'),
      onError: () => toast.show(t('error.generic'), 'error'),
    });
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('profile.title')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* アバター */}
        <View style={styles.avatarWrap}>
          {session.profile.avatarUrl ? (
            <Image source={{ uri: session.profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.coralSoft }]}>
              <Ionicons name="person" size={36} color={colors.primary} />
            </View>
          )}
          <Button title={t('profile.changeAvatar')} variant="text" fullWidth={false} onPress={handleChangeAvatar} loading={changeAvatar.isPending} />
        </View>

        <Card>
          <TextField label={t('profile.displayName')} value={displayName} onChangeText={setDisplayName} />
          <Button title={t('common.save')} onPress={handleSaveName} loading={updateProfile.isPending} />
        </Card>

        <Card>
          <Row label={t('profile.email')} value={session.email} />
          <Button title={t('profile.changePassword')} variant="secondary" onPress={handleChangePassword} />
        </Card>

        {/* パートナー */}
        <Text style={[typography.footnote, styles.sectionTitle, { color: colors.textSecondary }]}>
          {t('profile.partnerSection').toUpperCase()}
        </Text>
        <Card>
          <Text style={[typography.body, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            {isPaired
              ? t('profile.pairedWith', { name: session.partner?.displayName ?? '' })
              : t('profile.soloStatus')}
          </Text>
          {isPaired ? (
            <>
              <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                {t('profile.splitRatio')}
              </Text>
              <SplitRatioField
                myLabel={t('expense.payerSelf')}
                partnerLabel={session.partner?.displayName ?? t('expense.payerPartner')}
                myPercent={myPercent}
                onSave={handleSaveRatio}
                saving={savingRatio}
              />
              <View style={{ height: spacing.xs }} />
              <Button title={t('profile.unpair')} variant="destructive" onPress={handleUnpair} loading={leavePair.isPending} />
            </>
          ) : (
            <Button title={t('pairing.invitePartner')} onPress={() => router.push('/pairing')} />
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[typography.subhead, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.body, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md },
  avatarWrap: { alignItems: 'center', gap: spacing.xs },
  avatar: { width: 88, height: 88, borderRadius: radius.full },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  row: { marginBottom: spacing.sm },
  sectionTitle: { marginLeft: spacing.xs, letterSpacing: 0.5 },
});
