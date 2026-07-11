/**
 * 支出入力モーダル（追加 / 編集）。
 * 「レシートで入力」「手動で入力」を選び、フォームで金額・カテゴリ・支払い者・日付等を入力する。
 * レシートは端末内OCR（ML Kit）で自動入力し、画像は保存時に Storage（receipts バケット）へアップロードする。
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
  useReceiptImageUrl,
  useReceiptOcr,
  useLocale,
} from '@/hooks';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius, SUPPORTED_CURRENCIES } from '@/constants';
import { parseAmount, roundMoney, formatCurrency } from '@/utils';
import { recordSaveAndMaybeShowInterstitial } from '@/lib/interstitial';
import { prepareReceiptUpload } from '@/lib/receiptImage';
import type { ExpenseInput, ImageUpload } from '@/data';
import type { UUID } from '@/types/models';

/** 通貨ごとの直近入力レートをセッション中だけ覚えておき、次回入力時にプリフィルする。 */
const lastRateByCurrency: Record<string, string> = {};

type PayerChoice = 'self' | 'partner' | 'shared';
type Step = 'choose' | 'form';

export default function ExpenseInputScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const session = useRequireSession();
  const locale = useLocale();
  const baseCurrency = session.pair.baseCurrency;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = typeof id === 'string';

  const { data: categories } = useCategories();
  const resolveName = useCategoryName();
  const existing = useExpense(editing ? id : '');
  const { addExpense, updateExpense, uploadReceipt } = useExpenseActions();
  const ocr = useReceiptOcr();
  const aiConsent = usePreferencesStore((s) => s.aiConsent);

  const isPaired = session.pair.user2Id !== null;

  // フォーム状態
  const [step, setStep] = useState<Step>(editing ? 'form' : 'choose');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>(baseCurrency);
  // 外貨のとき「1 currency = ? baseCurrency」のレート（基準通貨と同じなら未使用）。
  const [rate, setRate] = useState('');
  const [categoryId, setCategoryId] = useState<UUID | null>(null);
  const [payer, setPayer] = useState<PayerChoice>('self');
  const [date, setDate] = useState<Date>(new Date());
  const [store, setStore] = useState('');
  const [memo, setMemo] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  // 撮影した未アップロードのレシート（保存時に Storage へ上げ、キャンセル時は孤児ファイルを作らない）。
  const [pendingReceipt, setPendingReceipt] = useState<ImageUpload | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 編集時: 保存済みレシート（Storageパス）は署名URLに解決してプレビューする。
  const previewUri = useReceiptImageUrl(imageUri);

  // 編集時は既存値をフォームへ反映
  useEffect(() => {
    const e = existing.data;
    if (editing && e) {
      setAmount(String(e.amount));
      setCurrency(e.currency);
      if (e.currency !== baseCurrency) setRate(String(e.exchangeRate));
      setCategoryId(e.categoryId);
      setPayer(e.isSharedPayment ? 'shared' : e.payerUserId === session.userId ? 'self' : 'partner');
      setDate(new Date(e.expenseDate));
      setStore(e.storeName ?? '');
      setMemo(e.description ?? '');
      setImageUri(e.receiptImageUrl);
    }
  }, [editing, existing.data, session.userId, baseCurrency]);

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

  /** レシート撮影 → 端末内OCRで金額・店名・日付を自動入力。AI未同意なら同意画面へ誘導。 */
  const handleScanReceipt = async () => {
    if (!aiConsent) {
      router.push('/ai-consent');
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast.show(t('error.cameraPermission'), 'error');
      return;
    }
    // OCRに圧縮ノイズを載せないため最高画質で撮影する（アップロード用は後で縮小する）。
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setStep('form');

    // 撮影画像を端末内OCR（ML Kit）にかけ、抽出結果でフォームを自動入力する。
    // 失敗の内容（文字なし / 金額だけ取れず / エラー）に応じて案内を変える。
    ocr.mutate(asset.uri, {
      onSuccess: (data) => {
        applyOcr(data);
        if (!data.rawText.trim()) {
          toast.show(t('expense.ocrNoText'), 'error');
        } else if (data.amount === null) {
          toast.show(t('expense.ocrNoAmount'), 'error');
        } else {
          toast.show(t('expense.ocrReview'), 'info');
        }
      },
      onError: () => toast.show(t('expense.ocrFailed'), 'error'),
    });

    // アップロード用は縮小・再圧縮した別ファイルにする（OCRと保存で要求が違う）。
    const upload = await prepareReceiptUpload(asset);
    if (upload) setPendingReceipt(upload);
  };

  /** 支払い者の選択をユーザーIDへ解決する。 */
  const resolvePayerUserId = (): UUID | null => {
    if (payer === 'shared') return null;
    if (payer === 'self') return session.userId;
    // パートナー払い: ペア解除後の編集などで partner が取れない場合は、
    // 既存の支払い者を保持する（null で保存すると匿名化扱いに化けてしまう）。
    return session.partner?.id ?? existing.data?.payerUserId ?? null;
  };

  const isForeign = currency !== baseCurrency;

  const handleSave = async () => {
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setError(t('error.amountPositive'));
      return;
    }
    // 外貨は基準通貨への換算レートを必須にする（未入力だと集計に載らないため）。
    const exchangeRate = isForeign ? parseAmount(rate) : 1;
    if (isForeign && exchangeRate === null) {
      toast.show(t('expense.rateRequired'), 'error');
      return;
    }
    if (!categoryId) return;
    setError(null);
    setSaving(true);

    try {
      // 撮影したレシートは保存時に Storage（receipts バケット）へアップロードし、パスを保存する。
      let receiptRef = imageUri;
      if (pendingReceipt) {
        receiptRef = await uploadReceipt.mutateAsync(pendingReceipt);
      }

      const input: ExpenseInput = {
        categoryId,
        amount: parsed,
        currency,
        exchangeRate: exchangeRate!,
        baseAmount: roundMoney(parsed * exchangeRate!, baseCurrency),
        payerUserId: resolvePayerUserId(),
        isSharedPayment: payer === 'shared',
        expenseDate: dayjs(date).format('YYYY-MM-DD'),
        description: memo.trim() || null,
        storeName: store.trim() || null,
        receiptImageUrl: receiptRef,
      };

      if (editing && existing.data) {
        await updateExpense.mutateAsync({ id: existing.data.id, expectedUpdatedAt: existing.data.updatedAt, input });
      } else {
        await addExpense.mutateAsync(input);
      }
      if (isForeign) lastRateByCurrency[currency] = rate.trim();
      toast.show(t('expense.saved'), 'success');
      router.back();
      // 新規の支出保存を「区切り」として、頻度条件を満たせば全画面広告を表示する（編集時は出さない）。
      if (!editing) recordSaveAndMaybeShowInterstitial(session.email);
    } catch (e) {
      const isConflict = e instanceof Error && e.message === 'conflict';
      toast.show(isConflict ? t('error.conflict') : t('error.generic'), 'error');
    } finally {
      setSaving(false);
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
          {previewUri ? (
            <View style={styles.receiptWrap}>
              <Image source={{ uri: previewUri }} style={styles.receipt} accessibilityLabel={t('expense.scanReceipt')} />
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
            onSelect={(c) => {
              setCurrency(c);
              // 外貨に切り替えたら、同通貨の直近レートをプリフィル（なければ空のまま）。
              if (c !== baseCurrency && rate.trim() === '') setRate(lastRateByCurrency[c] ?? '');
            }}
          />

          {/* 為替レート（基準通貨と異なる通貨のときだけ） */}
          {isForeign ? (
            <>
              <TextField
                label={t('expense.rate', { currency, base: baseCurrency })}
                value={rate}
                onChangeText={setRate}
                keyboardType="numeric"
                placeholder="0"
              />
              {(() => {
                const pa = parseAmount(amount);
                const pr = parseAmount(rate);
                if (pa === null || pr === null) return null;
                return (
                  <Text style={[typography.footnote, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                    {t('expense.baseAmountPreview', {
                      amount: formatCurrency(roundMoney(pa * pr, baseCurrency), baseCurrency, locale),
                    })}
                  </Text>
                );
              })()}
            </>
          ) : null}

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

          <Button title={t('expense.save')} onPress={() => void handleSave()} loading={saving} />
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
