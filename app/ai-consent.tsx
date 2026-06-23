/**
 * 外部AI（OCR）利用の同意画面。レシート読み取り前に表示する。
 * 出典: GLOBAL_STANDARDS §5-4 / design.md。
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Button } from '@/components';
import { useTheme } from '@/hooks/useTheme';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useProfileActions } from '@/hooks';
import { spacing, typography } from '@/constants';

export default function AiConsentScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const setAiConsent = usePreferencesStore((s) => s.setAiConsent);
  const { updateProfile } = useProfileActions();

  const handleDecision = (agreed: boolean) => {
    setAiConsent(agreed);
    updateProfile.mutate({ aiConsent: agreed });
    router.back();
  };

  return (
    <Screen withBanner={false} padded={false}>
      <ScreenHeader title={t('aiConsent.title')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Ionicons name="scan-circle-outline" size={64} color={colors.primary} style={styles.icon} />
        <Text style={[typography.body, styles.body, { color: colors.textSecondary }]}>{t('aiConsent.body')}</Text>
        <View style={styles.actions}>
          <Button title={t('aiConsent.agree')} onPress={() => handleDecision(true)} />
          <View style={{ height: spacing.sm }} />
          <Button title={t('aiConsent.decline')} variant="secondary" onPress={() => handleDecision(false)} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  icon: { alignSelf: 'center', marginBottom: spacing.md },
  body: { marginBottom: spacing.xl, lineHeight: 24 },
  actions: {},
});
