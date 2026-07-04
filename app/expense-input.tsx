/**
 * 支出入力モーダル（追加 / 編集）。
 * 「レシートで入力」「手動で入力」を選び、フォームで金額・カテゴリ・支払い者・日付等を入力する。
 * レシートOCRはSupabase Edge Function（Phase4）。現状は画像添付＋手動入力に対応。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Button, TextField, CategoryIcon, useCategoryName } from '@/components';
import { useTheme } from '@/hooks/useTheme';
import {
  useRequireSession,
  useCategories,
  useExpense,
  useExpenseActions,
  useReceiptOcr,
} from '@/hooks';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius, SUPPORTED_CURRENCIES, APP_CONFIG } from '@/constants';
import { parseAmount, today } from '@/utils';
import type { ExpenseInput } from '@/data';
import type { UUID } from '@/types/models';

type PayerChoice = 'self' | 'partner' | 'shared';
type Step = 'choose' | 'form';

export default function ExpenseInputScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const session = useRequireSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = typeof id === 'string';

  const { data: categories } = useCategories();
  const resolveName = useCategoryName();
  const existing = useExpense(editing ? id : '');
  const { addExpense, updateExpense } = useExpenseActions();
  const ocr = useReceiptOcr();
  const aiConsent = usePreferencesStore((s) => s.aiConsent);

  const isPaired = session.pair.user2Id !== null;

  // フォーム状態
  const [step, setStep] = useState<Step>(editing ? 'form' : 'choose');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>(APP_CONFIG.defaultCurrency);
  const [categoryId, setCategoryId] = useState<UUID | null>(null);
  const [payer, setPayer] = useState<PayerChoice>('self');
  const [date, setDate] = useState<Date>(new Date());
  const [store, setStore] = useState('');
  const [memo, setMemo] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 編集時は既存値をフォームへ反映
  useEffect(() => {
    const e = existing.data;
    if (editing && e) {
      setAmount(String(e.amount));
      setCurrency(e.currency);
      setCategoryId(e.categoryId);
      setPayer(e.isSharedPayment ? 'shared' : e.payerUserId === session.userId ? 'self' : 'partner');
      setDate(new Date(e.expenseDate));
      setStore(e.storeName ?? '');
      setMemo(e.description ?? '');
      setImageUri(e.receiptImageUrl);
    }
  }, [editing, existing.data, session.userId]);

  // 初期カテゴリを先頭に
  useEffect(() => {
    if (!categoryId && categories && categories.length > 0) {
      setCategoryId(categories[0]!.id);
    }
  }, [categories, categoryId]);

  const payerOptions = useMemo(() => {
    const base: { value: PayerChoice; label: string }[] = [{ value: 'self', label: t('expense.payerSelf') }];
    if (isPaired) {
      base.push({ value: 'partner', label: session.partner?.displayName ?? t('expense.payerPartner') });
      base.push({ value: 'shared', label: t('expense.payerShared') });
    }
    return base;
  }, [isPaired, session.partner, t]);

  /** OCR結果をフォームへ反映（抽出できた項目のみ上書き）。 */
  const applyOcr = (result: { amount: number | null; storeName: string | null; date: string | null }) => {
    if (result.amount !== null) setAmount(String(result.amount));
    if (result.storeName) setStore(result.storeName);
    if (result.date) {
      const d = new Date(result.date);
      if (!Number.isNaN(d.getTime())) setDate(d);
    }
  };

  /** レシート撮影 → Edge Function でOCR → 金額・店名・日付を自動入力。AI未同意なら同意画面へ誘導。 */
  const handleScanReceipt = async () => {
    if (!aiConsent) {
      router.push('/ai-consent');
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast.show(t('error.generic'), 'error');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setStep('form');

    // 撮影画像を端末内OCR（ML Kit）にかけ、抽出結果でフォームを自動入力する。
    ocr.mutate(asset.uri, {
      onSuccess: (data) => {
        applyOcr(data);
        // 何も抽出できなければ読み取り失敗、少しでも拾えたら確認を促す。
        const gotSomething = data.amount !== null || data.storeName || data.date;
        toast.show(gotSomething ? t('expense.ocrReview') : t('expense.ocrFailed'), gotSomething ? 'info' : 'error');
      },
      onError: () => toast.show(t('expense.ocrFailed'), 'error'),
    });
  };

  const handleSave = () => {
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setError(t('error.amountPositive'));
      return;
    }
    if (!categoryId) return;
    setError(null);

    const input: ExpenseInput = {
      categoryId,
      amount: parsed,
      currency,
      payerUserId: payer === 'shared' ? null : payer === 'self' ? session.userId : session.partner?.id ?? null,
      isSharedPayment: payer === 'shared',
      expenseDate: dayjs(date).format('YYYY-MM-DD'),
      description: memo.trim() || null,
      storeName: store.trim() || null,
      receiptImageUrl: imageUri,
    };

    if (editing && existing.data) {
      updateExpense.mutate(
        { id: existing.data.id, expectedUpdatedAt: existing.data.updatedAt, input },
        {
          onSuccess: () => {
            toast.show(t('expense.saved'), 'success');
            router.back();
          },
          onError: (e) =>
            toast.show(e instanceof Error && e.message === 'conflict' ? t('error.generic') : t('error.generic'), 'error'),
        }
      );
    } else {
      addExpense.mutate(input, {
        onSuccess: () => {
          toast.show(t('expense.saved'), 'success');
          router.back();
        },
        onError: () => toast.show(t('error.generic'), 'error'),
      });
    }
  };

  // 入力方法の選択ステップ
  if (step === 'choose') {
    return (
      <Screen withBanner={false} padded={false}>
        <ScreenHeader title={t('expense.addTitle')} showBack={false} right={<CloseButton onPress={() => router.back()} />} />
        <View style={styles.chooseWrap}>
          <Text style={[typography.title3, styles.chooseTitle, { color: colors.textPrimary }]}>
            {t('expense.chooseMethod')}
          </Text>
          <Button
            title={t('expense.byReceipt')}
            left={<Ionicons name="camera" size={18} color={colors.primaryText} />}
            onPress={handleScanReceipt}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            title={t('expense.byManual')}
            variant="secondary"
            left={<Ionicons name="create-outline" size={18} color={colors.textPrimary} />}
            onPress={() => setStep('form')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen withBanner={false} padded={false}>
      <ScreenHeader
        title={editing ? t('expense.editTitle') : t('expense.addTitle')}
        showBack={false}
        right={<CloseButton onPress={() => router.back()} />}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {imageUri ? (
            <View style={styles.receiptWrap}>
              <Image source={{ uri: imageUri }} style={styles.receipt} accessibilityLabel="receipt" />
              {ocr.isPending ? (
                <View style={[styles.ocrOverlay, { backgroundColor: colors.scrim }]}>
                  <ActivityIndicator color={colors.primaryText} />
                  <Text style={[typography.subhead, styles.ocrOverlayText, { color: colors.primaryText }]}>
                    {t('expense.ocrProcessing')}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <TextField
            label={t('expense.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            prefix={currency === 'JPY' ? '￥' : currency}
            error={error}
            placeholder="0"
          />

          {/* 通貨 */}
          <FieldLabel label={t('expense.currency')} />
          <ChipRow
            items={SUPPORTED_CURRENCIES.map((c) => ({ key: c, label: c }))}
            selectedKey={currency}
            onSelect={setCurrency}
          />

          {/* カテゴリ */}
          <FieldLabel label={t('expense.category')} />
          <View style={styles.categoryGrid}>
            {categories?.map((c) => {
              const selected = c.id === categoryId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={resolveName(c)}
                  style={[styles.categoryItem, selected && { backgroundColor: colors.coralSoft, borderColor: colors.primary }]}
                >
                  <CategoryIcon icon={c.icon} color={c.color} size={36} />
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                    {resolveName(c)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 支払い者 */}
          <FieldLabel label={t('expense.payer')} />
          <ChipRow
            items={payerOptions.map((o) => ({ key: o.value, label: o.label }))}
            selectedKey={payer}
            onSelect={(k) => setPayer(k as PayerChoice)}
          />

          {/* 日付 */}
          <FieldLabel label={t('expense.date')} />
          <Pressable
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={t('expense.date')}
            style={[styles.dateField, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            <Text style={[typography.body, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
              {dayjs(date).format('YYYY/MM/DD')}
            </Text>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              value={date}
              mode="date"
              maximumDate={new Date()}
              onChange={(_, selected) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selected) setDate(selected);
              }}
            />
          ) : null}

          <View style={{ height: spacing.md }} />
          <TextField label={t('expense.store')} value={store} onChangeText={setStore} placeholder="" />
          <TextField label={t('expense.memo')} value={memo} onChangeText={setMemo} placeholder="" />

          <Button
            title={t('expense.save')}
            onPress={handleSave}
            loading={addExpense.isPending || updateExpense.isPending}
          />
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
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

function FieldLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.xs }]}>{label}</Text>;
}

function ChipRow({
  items,
  selectedKey,
  onSelect,
}: {
  items: { key: string; label: string }[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.chipRow}>
      {items.map((item) => {
        const selected = item.key === selectedKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              { borderColor: colors.border, backgroundColor: selected ? colors.primary : colors.surface },
            ]}
          >
            <Text style={[typography.subhead, { color: selected ? colors.primaryText : colors.textSecondary }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.md },
  chooseWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  chooseTitle: { textAlign: 'center', marginBottom: spacing.lg },
  receiptWrap: { marginBottom: spacing.md, borderRadius: radius.md, overflow: 'hidden' },
  receipt: { width: '100%', height: 160, resizeMode: 'cover' },
  ocrOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  ocrOverlayText: { marginLeft: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  categoryItem: {
    width: 72,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
});
