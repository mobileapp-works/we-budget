/**
 * ドメインモデルの型定義。
 * 出典: docs/design.md のデータモデル。
 * DBは snake_case、アプリ内は camelCase（変換は lib/mappers で行う）。
 */

export type UUID = string;
/** 'YYYY-MM-DD' 形式の日付 */
export type ISODate = string;
/** ISO8601 のタイムスタンプ */
export type ISODateTime = string;

export type LanguagePref = 'ja' | 'en' | 'auto';
export type ThemePref = 'light' | 'dark' | 'system';

/** ユーザープロフィール（profiles） */
export interface Profile {
  id: UUID;
  displayName: string;
  avatarUrl: string | null;
  pairId: UUID;
  expoPushToken: string | null;
  language: LanguagePref;
  theme: ThemePref;
  aiConsent: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** カップルペア（pairs）。user2Id が null ならソロモード。 */
export interface Pair {
  id: UUID;
  inviteCode: string;
  user1Id: UUID | null;
  user2Id: UUID | null;
  splitRatioUser1: number; // 1-99（合計100）
  splitRatioUser2: number;
  /** ペアの基準通貨。レポート・予算・精算はこの通貨で集計・表示する。 */
  baseCurrency: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null;
}

/** カテゴリ（categories）。デフォルトは name_key、カスタムは name を表示。 */
export interface Category {
  id: UUID;
  pairId: UUID;
  name: string | null;
  nameKey: string | null;
  icon: string;
  color: string;
  isDefault: boolean;
  isHidden: boolean;
  sortOrder: number;
}

/** 支出（expenses）。共同口座払いは isSharedPayment=true / payerUserId=null。 */
export interface Expense {
  id: UUID;
  pairId: UUID;
  recordedBy: UUID | null;
  categoryId: UUID;
  amount: number;
  currency: string;
  /** 1 currency = exchangeRate baseCurrency（基準通貨と同じなら 1）。 */
  exchangeRate: number;
  /** 基準通貨に換算した金額（= round(amount × exchangeRate)）。集計・精算はこれを合計する。 */
  baseAmount: number;
  payerUserId: UUID | null;
  isSharedPayment: boolean;
  settlementId: UUID | null; // null=未精算
  expenseDate: ISODate;
  description: string | null;
  storeName: string | null;
  receiptImageUrl: string | null;
  isFixedCost: boolean;
  fixedCostId: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type FixedCostType = 'fixed' | 'variable';

/** 固定費・変動固定費（fixed_costs） */
export interface FixedCost {
  id: UUID;
  pairId: UUID;
  categoryId: UUID;
  name: string;
  type: FixedCostType;
  amount: number | null; // fixed は必須、variable は任意
  currency: string;
  payerUserId: UUID | null;
  isSharedPayment: boolean;
  billingDay: number; // 1-31
  reminderDay: number | null;
  isActive: boolean;
}

/** 精算（settlements） */
export interface Settlement {
  id: UUID;
  pairId: UUID;
  settledBy: UUID | null;
  amount: number;
  currency: string;
  fromUserId: UUID | null; // 払う側
  toUserId: UUID | null; // 受け取る側
  settledAt: ISODateTime;
}

export type SharedAccountType = 'deposit' | 'withdrawal';

/** 共同口座の入金/現金移動（shared_account）。買い物は expenses 側で記録。 */
export interface SharedAccountEntry {
  id: UUID;
  pairId: UUID;
  type: SharedAccountType;
  userId: UUID | null;
  amount: number;
  currency: string;
  description: string | null;
  transactionDate: ISODate;
}

/** 予算（budgets）。categoryId が null なら全体予算。 */
export interface Budget {
  id: UUID;
  pairId: UUID;
  categoryId: UUID | null;
  amount: number;
  currency: string;
}

/** 為替レート（exchange_rates）。1 fromCurrency = rate toCurrency。 */
export interface ExchangeRate {
  id: UUID;
  pairId: UUID;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
}

export type NotificationType =
  | 'expense_added'
  | 'expense_edited'
  | 'expense_deleted'
  | 'settlement'
  | 'reminder_variable'
  | 'budget_warning'
  | 'budget_exceeded'
  | 'settlement_reminder'
  | 'pair_request'
  | 'pair_approved'
  | 'pair_declined';

export type PairRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

/**
 * ペア申請（pair_requests）。
 * 招待コードの持ち主（pair_id のペア）に対する参加申請。承認されると成立する。
 */
export interface PairRequest {
  id: UUID;
  /** 申請先（招待コードの持ち主）のペアID */
  pairId: UUID;
  requesterId: UUID;
  /** 申請者の表示名（受信側リスト表示用。RPCで解決） */
  requesterName: string | null;
  status: PairRequestStatus;
  createdAt: ISODateTime;
}

/** アプリ内通知（notifications） */
export interface AppNotification {
  id: UUID;
  userId: UUID;
  pairId: UUID;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: ISODateTime;
}

/** 通知設定（notification_settings） */
export interface NotificationSettings {
  userId: UUID;
  expenseAdded: boolean;
  expenseEdited: boolean;
  expenseDeleted: boolean;
  settlement: boolean;
  reminderVariable: boolean;
  budgetAlert: boolean;
  settlementReminder: boolean;
}

/** 立替残高計算（RPC: calculate_settlement_balance）の結果 */
export interface SettlementBalance {
  /** 精算すべき金額（基準通貨、絶対値）。0なら精算不要。 */
  settlementAmount: number;
  fromUserId: UUID | null; // 払う側
  toUserId: UUID | null; // 受け取る側
  /** 基準通貨（pair.baseCurrency）。 */
  currency: string;
}

/**
 * レシートOCRの解析結果。
 * Edge Function から得た生テキスト（rawText）を `parseReceiptText` で構造化したもの。
 * 各項目は抽出できなければ null（ユーザーが確認・補正する前提）。
 */
export interface OcrResult {
  /** 合計金額。抽出できなければ null。 */
  amount: number | null;
  /** 店名（先頭行の推定）。 */
  storeName: string | null;
  /** 支出日（'YYYY-MM-DD'）。 */
  date: ISODate | null;
  /** Vision が返した全文（デバッグ・再解析用）。 */
  rawText: string;
}
