/**
 * データアクセスの契約（Backend インターフェース）。
 * モック実装（mockBackend）と Supabase 実装（supabaseBackend）が共通で従う。
 * 画面・フックはこのインターフェースだけに依存し、実体の差し替えを容易にする。
 */
import type {
  Profile,
  Pair,
  Category,
  Expense,
  FixedCost,
  Settlement,
  SharedAccountEntry,
  Budget,
  ExchangeRate,
  AppNotification,
  NotificationSettings,
  SettlementBalance,
  UUID,
} from '@/types/models';

/** ログイン中のセッション（本人 + プロフィール + ペア + パートナー）。 */
export interface SessionContext {
  userId: UUID;
  email: string;
  profile: Profile;
  pair: Pair;
  /** ペア相手のプロフィール（ソロモードなら null）。 */
  partner: Profile | null;
}

/** 支出の作成・更新入力（id等のサーバー管理項目を除く）。 */
export interface ExpenseInput {
  categoryId: UUID;
  amount: number;
  currency: string;
  payerUserId: UUID | null;
  isSharedPayment: boolean;
  expenseDate: string;
  description: string | null;
  storeName: string | null;
  receiptImageUrl: string | null;
}

export interface FixedCostInput {
  categoryId: UUID;
  name: string;
  type: FixedCost['type'];
  amount: number | null;
  currency: string;
  payerUserId: UUID | null;
  isSharedPayment: boolean;
  billingDay: number;
  reminderDay: number | null;
  isActive: boolean;
}

export interface SharedEntryInput {
  type: SharedAccountEntry['type'];
  amount: number;
  currency: string;
  description: string | null;
  transactionDate: string;
}

export interface BudgetInput {
  categoryId: UUID | null;
  amount: number;
  currency: string;
}

export interface CategoryInput {
  name: string;
  icon: string;
  color: string;
}

export interface Backend {
  // --- 認証・セッション ---
  getSession(): Promise<SessionContext | null>;
  signIn(email: string, password: string): Promise<SessionContext>;
  signUp(email: string, password: string, displayName: string): Promise<void>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  deleteAccount(): Promise<void>;

  // --- プロフィール ---
  updateProfile(patch: Partial<Pick<Profile, 'displayName' | 'avatarUrl' | 'aiConsent'>>): Promise<Profile>;

  // --- ペア ---
  createInvite(): Promise<string>; // 招待コードを返す
  joinPair(inviteCode: string): Promise<SessionContext>;
  leavePair(): Promise<SessionContext>;
  updateSplitRatio(user1Percent: number): Promise<Pair>;

  // --- カテゴリ ---
  listCategories(): Promise<Category[]>;
  addCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: UUID, patch: Partial<CategoryInput & { isHidden: boolean; sortOrder: number }>): Promise<Category>;

  // --- 支出 ---
  listExpenses(monthKey: string): Promise<Expense[]>;
  getExpense(id: UUID): Promise<Expense | null>;
  addExpense(input: ExpenseInput): Promise<Expense>;
  updateExpense(id: UUID, expectedUpdatedAt: string, input: ExpenseInput): Promise<Expense>;
  deleteExpense(id: UUID): Promise<void>;

  // --- 立替精算 ---
  getSettlementBalance(): Promise<SettlementBalance>;
  executeSettlement(): Promise<Settlement>;
  listSettlements(): Promise<Settlement[]>;

  // --- 共同口座 ---
  listSharedEntries(): Promise<SharedAccountEntry[]>;
  addSharedEntry(input: SharedEntryInput): Promise<SharedAccountEntry>;

  // --- 固定費 ---
  listFixedCosts(): Promise<FixedCost[]>;
  addFixedCost(input: FixedCostInput): Promise<FixedCost>;
  updateFixedCost(id: UUID, input: Partial<FixedCostInput>): Promise<FixedCost>;
  deleteFixedCost(id: UUID): Promise<void>;

  // --- 予算 ---
  listBudgets(): Promise<Budget[]>;
  upsertBudget(input: BudgetInput): Promise<Budget>;

  // --- 為替レート ---
  listExchangeRates(): Promise<ExchangeRate[]>;
  upsertExchangeRate(fromCurrency: string, rate: number): Promise<ExchangeRate>;

  // --- 通知 ---
  listNotifications(): Promise<AppNotification[]>;
  markNotificationRead(id: UUID): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  getNotificationSettings(): Promise<NotificationSettings>;
  updateNotificationSettings(patch: Partial<NotificationSettings>): Promise<NotificationSettings>;
}
