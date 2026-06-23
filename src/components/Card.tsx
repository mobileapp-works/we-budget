/** カード。出典: docs/ui/components.md（surface背景・角丸md・内側パディングmd）。 */
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius } from '@/constants';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  /** カード背景を coralSoft などに上書きしたい場合 */
  backgroundColor?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Card({ children, onPress, style, backgroundColor, accessibilityLabel, accessibilityHint }: CardProps) {
  const { colors } = useTheme();
  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: backgroundColor ?? colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
