/**
 * ペアリング画面（モーダル）。承認制:
 * - 自分の招待コードの表示/共有
 * - 相手のコードを入力 → ペア申請を送信（相手に通知）→ 承認待ち
 * - 自分宛てに届いた申請の承認/拒否
 * pending 中はポーリングで承認/拒否を検知し、成立したらセッションを更新する。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, TextField } from '@/components';
import { useRequireSession, usePairActions, useIncomingPairRequests, useOutgoingPairRequest } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { queryKeys } from '@/lib/queryClient';
import { spacing, typography } from '@/constants';
import type { PairRequest } from '@/types/models';

export default function PairingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const session = useRequireSession();

  const { createInvite, requestPair, respondRequest, cancelRequest } = usePairActions();
  const incomingQuery = useIncomingPairRequests();
  const outgoingQuery = useOutgoingPairRequest();

  const [inviteCode, setInviteCode] = useState<string>(session.pair.inviteCode);
  const [enteredCode, setEnteredCode] = useState('');
  // approved/declined のトーストを重複表示しないためのガード
  const notifiedResult = useRef<string | null>(null);

  const isPaired = session.pair.user2Id !== null;
  const outgoing = outgoingQuery.data;
  const outgoingPending = outgoing?.status === 'pending';
  const incoming = incomingQuery.data ?? [];

  // 招待コードを取得（無ければ生成）
  useEffect(() => {
    if (!inviteCode) {
      createInvite.mutate(undefined, {
        onSuccess: setInviteCode,
        onError: () => toast.show(t('error.generic'), 'error'),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自分の申請が承認/拒否されたのを検知したら反映する
  useEffect(() => {
    if (!outgoing || notifiedResult.current === outgoing.id + outgoing.status) return;
    if (outgoing.status === 'approved' && !isPaired) {
      notifiedResult.current = outgoing.id + outgoing.status;
      // セッションを取り直すとペア成立（partner あり）で再描画される
      void qc.invalidateQueries({ queryKey: queryKeys.session });
      toast.show(t('pairing.joined'), 'success');
      router.back();
    } else if (outgoing.status === 'declined') {
      notifiedResult.current = outgoing.id + outgoing.status;
      toast.show(t('pairing.requestDeclined'), 'info');
    }
  }, [outgoing, isPaired, qc, toast, t, router]);

  const handleShare = () => {
    void Share.share({ message: t('pairing.shareMessage', { code: inviteCode }) });
  };

  const handleSendRequest = () => {
    const code = enteredCode.trim();
    if (!code) return;
    // 合流の非対称性（自分が相手の家計簿に入る）を事前に明示する
    Alert.alert(t('pairing.title'), t('pairing.confirmSend'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('pairing.sendRequest'),
        onPress: () =>
          requestPair.mutate(code, {
            onSuccess: () => {
              setEnteredCode('');
              toast.show(t('pairing.requestSent'), 'success');
            },
            onError: (e) => {
              const msg = e instanceof Error ? e.message : '';
              toast.show(msg.includes('already paired') ? t('pairing.alreadyPaired') : t('pairing.invalidCode'), 'error');
            },
          }),
      },
    ]);
  };

  const handleRespond = (request: PairRequest, approve: boolean) => {
    const doRespond = () =>
      respondRequest.mutate(
        { requestId: request.id, approve },
        {
          onSuccess: () => {
            if (approve) {
              toast.show(t('pairing.joined'), 'success');
              router.back();
            } else {
              toast.show(t('pairing.declined'), 'info');
            }
          },
          onError: () => toast.show(t('error.generic'), 'error'),
        }
      );

    if (approve) {
      Alert.alert(
        t('pairing.incomingTitle'),
        t('pairing.approveConfirm', { name: request.requesterName ?? t('expense.payerPartner') }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('pairing.approve'), onPress: doRespond },
        ]
      );
    } else {
      doRespond();
    }
  };

  const handleCancelRequest = () => {
    if (!outgoing) return;
    cancelRequest.mutate(outgoing.id, {
      onSuccess: () => toast.show(t('pairing.requestCancelled'), 'info'),
      onError: () => toast.show(t('error.generic'), 'error'),
    });
  };

  return (
    <Screen withBanner={false} padded={false}>
      <ScreenHeader title={t('pairing.title')} showBack={false} right={<CloseButton onPress={() => router.back()} />} />
      <View style={styles.body}>
        <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
          {t('pairing.body')}
        </Text>

        {/* 届いているペア申請（承認/拒否） */}
        {incoming.length > 0 ? (
          <Card backgroundColor={colors.coralSoft} style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              {t('pairing.incomingTitle')}
            </Text>
            {incoming.map((request) => (
              <View key={request.id} style={styles.requestRow}>
                <Text style={[typography.body, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                  {t('pairing.incomingBody', { name: request.requesterName ?? t('expense.payerPartner') })}
                </Text>
                <View style={styles.requestActions}>
                  <Button
                    title={t('pairing.approve')}
                    fullWidth={false}
                    loading={respondRequest.isPending}
                    onPress={() => handleRespond(request, true)}
                  />
                  <View style={{ width: spacing.sm }} />
                  <Button
                    title={t('pairing.decline')}
                    variant="secondary"
                    fullWidth={false}
                    disabled={respondRequest.isPending}
                    onPress={() => handleRespond(request, false)}
                  />
                </View>
              </View>
            ))}
          </Card>
        ) : null}

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

        {/* 相手のコードを入力 → 申請 / 承認待ち */}
        {outgoingPending ? (
          <Card>
            <View style={styles.waitingRow}>
              <Ionicons name="hourglass-outline" size={20} color={colors.primary} />
              <Text style={[typography.body, { color: colors.textPrimary, marginLeft: spacing.xs, flex: 1 }]}>
                {t('pairing.waitingApproval')}
              </Text>
            </View>
            <Button
              title={t('pairing.cancelRequest')}
              variant="text"
              loading={cancelRequest.isPending}
              onPress={handleCancelRequest}
            />
          </Card>
        ) : (
          <Card>
            <TextField
              label={t('pairing.enterCode')}
              value={enteredCode}
              onChangeText={setEnteredCode}
              autoCapitalize="characters"
            />
            <Button title={t('pairing.sendRequest')} onPress={handleSendRequest} loading={requestPair.isPending} />
          </Card>
        )}
      </View>
    </Screen>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
      <Ionicons name="close" size={26} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: spacing.md },
  code: { letterSpacing: 4, marginVertical: spacing.sm },
  requestRow: { marginTop: spacing.xs },
  requestActions: { flexDirection: 'row', alignItems: 'center' },
  waitingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
});
