/** プロフィール画面。表示名・アイコン・パスワード変更・パートナー情報・負担割合・ペア解除。 */
import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, TextField, SegmentedControl } from '@/components';
import { useRequireSession, useProfileActions, usePairActions, useAuthActions } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius } from '@/constants';

type RatioPreset = '50' | '60' | '40';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const session = useRequireSession();

  const { updateProfile } = useProfileActions();
  const { leavePair, updateSplitRatio } = usePairActions();
  const { sendPasswordReset } = useAuthActions();

  const [displayName, setDisplayName] = useState(session.profile.displayName);
  const isPaired = session.pair.user2Id !== null;

  const handleSaveName = () => {
    updateProfile.mutate(
      { displayName: displayName.trim() || 'ユーザー' },
      {
        onSuccess: () => toast.show(t('profile.saved'), 'success'),
        onError: () => toast.show(t('error.generic'), 'error'),
      }
    );
  };

  const handleChangeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets[0]) {
      updateProfile.mutate(
        { avatarUrl: result.assets[0].uri },
        { onSuccess: () => toast.show(t('profile.saved'), 'success') }
      );
    }
  };

  const handleChangePassword = () => {
    sendPasswordReset.mutate(session.email, {
      onSuccess: () => toast.show(t('auth.resetEmailSent'), 'success'),
    });
  };

  const handleUnpair = () => {
    Alert.alert(t('profile.unpair'), t('profile.unpairConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.unpair'),
        style: 'destructive',
        onPress: () => leavePair.mutate(undefined, { onSuccess: () => router.back() }),
      },
    ]);
  };

  const ratioValue: RatioPreset =
    session.pair.splitRatioUser1 === 60 ? '60' : session.pair.splitRatioUser1 === 40 ? '40' : '50';

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
          <Button title={t('profile.changeAvatar')} variant="text" fullWidth={false} onPress={handleChangeAvatar} />
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
                {t('profile.splitRatio')}（{t('expense.payerSelf')} : {session.partner?.displayName}）
              </Text>
              <SegmentedControl<RatioPreset>
                options={[
                  { value: '50', label: '50 : 50' },
                  { value: '60', label: '60 : 40' },
                  { value: '40', label: '40 : 60' },
                ]}
                value={ratioValue}
                onChange={(v) => updateSplitRatio.mutate(parseInt(v, 10))}
              />
              <View style={{ height: spacing.md }} />
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
