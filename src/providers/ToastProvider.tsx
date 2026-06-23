/**
 * 軽量トースト。操作結果（成功/エラー）を一時表示する。
 * 出典: docs/ui/components.md（フィードバック要素）。
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/constants';

type ToastType = 'success' | 'error' | 'info';
interface ToastState {
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      setToast({ message, type });
      // スクリーンリーダーにも結果を通知する
      AccessibilityInfo.announceForAccessibility(message);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
          setToast(null);
        });
      }, 2600);
    },
    [opacity]
  );

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && <ToastView toast={toast} opacity={opacity} />}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, opacity }: { toast: ToastState; opacity: Animated.Value }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bg =
    toast.type === 'success' ? colors.success : toast.type === 'error' ? colors.error : colors.surfaceElevated;
  const fg = toast.type === 'info' ? colors.textPrimary : '#FFFFFF';

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { opacity, bottom: insets.bottom + spacing.xl }]}
    >
      <View style={[styles.toast, { backgroundColor: bg }]}>
        <Text style={[typography.callout, { color: fg }]}>{toast.message}</Text>
      </View>
    </Animated.View>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
  },
  toast: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    maxWidth: 500,
  },
});
