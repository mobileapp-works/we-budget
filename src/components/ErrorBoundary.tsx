/**
 * アプリ全体を囲む ErrorBoundary。
 * クラッシュ時も白画面にせず、フォールバックUI＋再試行を表示する。
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import i18n from '@/lib/i18n';
import { lightColors, spacing, radius, typography } from '@/constants';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    // TODO(Phase4): Sentry.captureException(error) を呼ぶ
    console.error('Uncaught error in tree:', error);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  override render() {
    if (this.state.hasError) {
      // ErrorBoundary はフック不可のため、固定ライトカラー + i18n インスタンス直参照で描画する
      return (
        <View style={styles.container}>
          <Text style={[typography.title2, styles.title]}>{i18n.t('error.crashTitle')}</Text>
          <Text style={[typography.body, styles.body]}>{i18n.t('error.crashBody')}</Text>
          <Pressable
            onPress={this.handleReset}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('common.retry')}
            style={styles.button}
          >
            <Text style={[typography.callout, styles.buttonText]}>{i18n.t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: lightColors.background,
  },
  title: { color: lightColors.textPrimary, marginBottom: spacing.sm },
  body: { color: lightColors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  button: {
    backgroundColor: lightColors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: { color: lightColors.primaryText, fontWeight: '600' },
});
