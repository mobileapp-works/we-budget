/** 空状態（Empty）。アイコン＋説明＋任意のCTA。出典: docs/ui/components.md。 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography } from '@/constants';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'sparkles-outline', title, body, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.coralTint} style={styles.icon} />
      <Text style={[typography.title3, styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {body ? <Text style={[typography.callout, styles.body, { color: colors.textSecondary }]}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button title={actionLabel} onPress={onAction} fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  icon: { marginBottom: spacing.md },
  title: { textAlign: 'center', marginBottom: spacing.xs },
  body: { textAlign: 'center', marginBottom: spacing.lg },
  action: { marginTop: spacing.xs },
});
