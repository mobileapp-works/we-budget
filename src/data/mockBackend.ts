/**
 * モックバックエンド（インメモリ）。
 * Supabase 構築前でもアプリ全体を動かして確認できるようにするためのデモ実装。
 * Backend インターフェースに準拠。EXPO_PUBLIC_USE_MOCK=true の間はこれが使われる。
 */
import dayjs from 'dayjs';
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
import { DEFAULT_CATEGORIES } from '@/constants';
import { buildRateMap, calculateSettlementBalance, isSettleableExpense } from '@/utils';
import type {
  Backend,
  SessionContext,
  ExpenseInput,
  FixedCostInput,
  SharedEntryInput,
  BudgetInput,
  CategoryInput,
} from './backend';

// --- ユーティリティ ---
const delay = (ms = 120): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
let counter = 0;
const uid = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${++counter}`;
const nowIso = (): string => new Date().toISOString();
const daysAgo = (n: number): string => dayjs().subtract(n, 'day').format('YYYY-MM-DD');

const ME = 'user-me';
const PARTNER = 'user-partner';
const PAIR = 'pair-1';

// --- インメモリDB ---
interface MockState {
  currentUserId: UUID | null;
  email: string;
  profiles: Profile[];
  pair: Pair;
  categories: Category[];
  expenses: Expense[];
  fixedCosts: FixedCost[];
  settlements: Settlement[];
  shared: SharedAccountEntry[];
  budgets: Budget[];
  rates: ExchangeRate[];
  notifications: AppNotification[];
  notificationSettings: NotificationSettings;
}

let state: MockState;

/** デモ用の初期データを構築する。 */
function seed(): MockState {
  const profiles: Profile[] = [
    {
      id: ME,
      displayName: 'あなた',
      avatarUrl: null,
      pairId: PAIR,
      expoPushToken: null,
      language: 'auto',
      theme: 'system',
      aiConsent: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: PARTNER,
      displayName: 'パートナー',
      avatarUrl: null,
      pairId: PAIR,
      expoPushToken: null,
      language: 'auto',
      theme: 'system',
      aiConsent: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  const pair: Pair = {
    id: PAIR,
    inviteCode: 'WEBUDGET',
    user1Id: ME,
    user2Id: PARTNER,
    splitRatioUser1: 50,
    splitRatioUser2: 50,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };

  const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
    id: `cat-${c.key}`,
    pairId: PAIR,
    name: null,
    nameKey: c.nameKey,
    icon: c.icon,
    color: c.color,
    isDefault: true,
    isHidden: false,
    sortOrder: i,
  }));

  const mkExpense = (e: Partial<Expense>): Expense => ({
    id: uid('exp'),
    pairId: PAIR,
    recordedBy: ME,
    categoryId: 'cat-food',
    amount: 0,
    currency: 'JPY',
    payerUserId: ME,
    isSharedPayment: false,
    settlementId: null,
    expenseDate: daysAgo(0),
    description: null,
    storeName: null,
    receiptImageUrl: null,
    isFixedCost: false,
    fixedCostId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...e,
  });

  const expenses: Expense[] = [
    mkExpense({ categoryId: 'cat-food', amount: 1200, payerUserId: ME, storeName: 'スーパー', expenseDate: daysAgo(0) }),
    mkExpense({ categoryId: 'cat-food', amount: 800, payerUserId: PARTNER, recordedBy: PARTNER, storeName: 'カフェ', expenseDate: daysAgo(1) }),
    mkExpense({ categoryId: 'cat-daily', amount: 3000, payerUserId: null, isSharedPayment: true, storeName: 'ドラッグストア', expenseDate: daysAgo(2) }),
    mkExpense({ categoryId: 'cat-transport', amount: 480, payerUserId: ME, expenseDate: daysAgo(3) }),
    mkExpense({ categoryId: 'cat-entertainment', amount: 2500, payerUserId: PARTNER, recordedBy: PARTNER, storeName: '映画館', expenseDate: daysAgo(5) }),
  ];

  const fixedCosts: FixedCost[] = [
    {
      id: uid('fc'),
      pairId: PAIR,
      categoryId: 'cat-rent',
      name: '家賃',
      type: 'fixed',
      amount: 80000,
      currency: 'JPY',
      payerUserId: null,
      isSharedPayment: true,
      billingDay: 1,
      reminderDay: null,
      isActive: true,
    },
    {
      id: uid('fc'),
      pairId: PAIR,
      categoryId: 'cat-utilities',
      name: '電気代',
      type: 'variable',
      amount: null,
      currency: 'JPY',
      payerUserId: ME,
      isSharedPayment: false,
      billingDay: 25,
      reminderDay: 20,
      isActive: true,
    },
  ];

  const shared: SharedAccountEntry[] = [
    { id: uid('sa'), pairId: PAIR, type: 'deposit', userId: ME, amount: 50000, currency: 'JPY', description: '今月の入金', transactionDate: daysAgo(6) },
    { id: uid('sa'), pairId: PAIR, type: 'deposit', userId: PARTNER, amount: 50000, currency: 'JPY', description: '今月の入金', transactionDate: daysAgo(6) },
  ];

  const budgets: Budget[] = [
    { id: uid('bud'), pairId: PAIR, categoryId: null, amount: 150000, currency: 'JPY' },
    { id: uid('bud'), pairId: PAIR, categoryId: 'cat-food', amount: 30000, currency: 'JPY' },
  ];

  const notifications: AppNotification[] = [
    {
      id: uid('ntf'),
      userId: ME,
      pairId: PAIR,
      type: 'expense_added',
      title: 'パートナーが支出を記録',
      body: 'パートナーが「娯楽 ￥2,500」を記録しました',
      data: null,
      isRead: false,
      createdAt: dayjs().subtract(5, 'day').toISOString(),
    },
  ];

  const notificationSettings: NotificationSettings = {
    userId: ME,
    expenseAdded: true,
    expenseEdited: true,
    expenseDeleted: true,
    settlement: true,
    reminderVariable: true,
    budgetAlert: true,
    settlementReminder: true,
  };

  return {
    currentUserId: null,
    email: 'demo@webudget.app',
    profiles,
    pair,
    categories,
    expenses,
    fixedCosts,
    settlements: [],
    shared,
    budgets,
    rates: [],
    notifications,
    notificationSettings,
  };
}

state = seed();

// --- ヘルパー ---
function profileOf(id: UUID | null): Profile | null {
  if (!id) return null;
  return state.profiles.find((p) => p.id === id) ?? null;
}

function buildSession(): SessionContext {
  if (!state.currentUserId) throw new Error('not authenticated');
  const profile = profileOf(state.currentUserId);
  if (!profile) throw new Error('profile not found');
  const partnerId = state.pair.user1Id === state.currentUserId ? state.pair.user2Id : state.pair.user1Id;
  return {
    userId: state.currentUserId,
    email: state.email,
    profile,
    pair: { ...state.pair },
    partner: profileOf(partnerId),
  };
}

function activeExpenses(): Expense[] {
  return state.expenses; // モックは論理削除済みを配列から除外している
}

// --- Backend 実装 ---
export const mockBackend: Backend = {
  async getSession() {
    await delay(60);
    if (!state.currentUserId) return null;
    return buildSession();
  },

  async signIn(email) {
    await delay();
    state.currentUserId = ME;
    state.email = email;
    return buildSession();
  },

  async signUp(email) {
    await delay();
    // デモでは登録後すぐログイン可能（本番はメール確認が必要）
    state.email = email;
  },

  async signOut() {
    await delay(60);
    state.currentUserId = null;
  },

  async sendPasswordReset() {
    await delay();
  },

  async deleteAccount() {
    await delay();
    state.currentUserId = null;
  },

  async updateProfile(patch) {
    await delay();
    const profile = profileOf(state.currentUserId);
    if (!profile) throw new Error('profile not found');
    Object.assign(profile, patch, { updatedAt: nowIso() });
    return { ...profile };
  },

  async registerPushToken(token) {
    await delay(60);
    const profile = profileOf(state.currentUserId);
    if (profile) profile.expoPushToken = token;
  },

  async createInvite() {
    await delay();
    return state.pair.inviteCode;
  },

  async joinPair() {
    await delay();
    // デモでは既にペア済み
    return buildSession();
  },

  async leavePair() {
    await delay();
    // デモ: ソロpairに戻す（履歴は recorded_by 条件で閲覧可能想定）
    state.pair = { ...state.pair, user2Id: null, updatedAt: nowIso() };
    return buildSession();
  },

  async updateSplitRatio(user1Percent) {
    await delay();
    state.pair = {
      ...state.pair,
      splitRatioUser1: user1Percent,
      splitRatioUser2: 100 - user1Percent,
      updatedAt: nowIso(),
    };
    return { ...state.pair };
  },

  async listCategories() {
    await delay(60);
    return state.categories.filter((c) => !c.isHidden).sort((a, b) => a.sortOrder - b.sortOrder).map((c) => ({ ...c }));
  },

  async addCategory(input: CategoryInput) {
    await delay();
    const category: Category = {
      id: uid('cat'),
      pairId: state.pair.id,
      name: input.name,
      nameKey: null,
      icon: input.icon,
      color: input.color,
      isDefault: false,
      isHidden: false,
      sortOrder: state.categories.length,
    };
    state.categories.push(category);
    return { ...category };
  },

  async updateCategory(id, patch) {
    await delay();
    const category = state.categories.find((c) => c.id === id);
    if (!category) throw new Error('category not found');
    Object.assign(category, patch);
    return { ...category };
  },

  async listExpenses(monthKey) {
    await delay(80);
    return activeExpenses()
      .filter((e) => dayjs(e.expenseDate).format('YYYY-MM') === monthKey)
      .sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1))
      .map((e) => ({ ...e }));
  },

  async getExpense(id) {
    await delay(60);
    const e = state.expenses.find((x) => x.id === id);
    return e ? { ...e } : null;
  },

  async addExpense(input: ExpenseInput) {
    await delay();
    const expense: Expense = {
      id: uid('exp'),
      pairId: state.pair.id,
      recordedBy: state.currentUserId,
      settlementId: null,
      isFixedCost: false,
      fixedCostId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...input,
    };
    state.expenses.push(expense);
    return { ...expense };
  },

  async updateExpense(id, expectedUpdatedAt, input) {
    await delay();
    const expense = state.expenses.find((e) => e.id === id);
    if (!expense) throw new Error('expense not found');
    // 楽観的ロック: updated_at 不一致なら競合
    if (expense.updatedAt !== expectedUpdatedAt) {
      throw new Error('conflict');
    }
    Object.assign(expense, input, { updatedAt: nowIso() });
    return { ...expense };
  },

  async deleteExpense(id) {
    await delay();
    state.expenses = state.expenses.filter((e) => e.id !== id);
  },

  async getSettlementBalance() {
    await delay(80);
    return calculateSettlementBalance(activeExpenses(), state.pair, state.rates);
  },

  async executeSettlement() {
    await delay();
    const balance: SettlementBalance = calculateSettlementBalance(activeExpenses(), state.pair, state.rates);
    if (balance.settlementAmount <= 0 || !balance.fromUserId || !balance.toUserId) {
      throw new Error('nothing to settle');
    }
    const settlement: Settlement = {
      id: uid('stl'),
      pairId: state.pair.id,
      settledBy: state.currentUserId,
      amount: balance.settlementAmount,
      currency: balance.currency,
      fromUserId: balance.fromUserId,
      toUserId: balance.toUserId,
      settledAt: nowIso(),
    };
    // 対象の未精算・個人払い支出にスタンプ。
    // 集計に含まれた支出のみ（レート未設定の外貨は残高に入っていないため、スタンプすると立替が消える）
    const rateMap = buildRateMap(state.rates);
    for (const e of state.expenses) {
      if (isSettleableExpense(e, state.pair, rateMap)) {
        e.settlementId = settlement.id;
      }
    }
    state.settlements.unshift(settlement);
    return { ...settlement };
  },

  async listSettlements() {
    await delay(60);
    return state.settlements.map((s) => ({ ...s }));
  },

  async listSharedEntries() {
    await delay(60);
    return state.shared.slice().sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : -1)).map((s) => ({ ...s }));
  },

  async addSharedEntry(input: SharedEntryInput) {
    await delay();
    const entry: SharedAccountEntry = {
      id: uid('sa'),
      pairId: state.pair.id,
      userId: state.currentUserId,
      ...input,
    };
    state.shared.push(entry);
    return { ...entry };
  },

  async listFixedCosts() {
    await delay(60);
    return state.fixedCosts.map((f) => ({ ...f }));
  },

  async addFixedCost(input: FixedCostInput) {
    await delay();
    const fixedCost: FixedCost = { id: uid('fc'), pairId: state.pair.id, ...input };
    state.fixedCosts.push(fixedCost);
    return { ...fixedCost };
  },

  async updateFixedCost(id, input) {
    await delay();
    const fixedCost = state.fixedCosts.find((f) => f.id === id);
    if (!fixedCost) throw new Error('fixed cost not found');
    Object.assign(fixedCost, input);
    return { ...fixedCost };
  },

  async deleteFixedCost(id) {
    await delay();
    state.fixedCosts = state.fixedCosts.filter((f) => f.id !== id);
  },

  async listBudgets() {
    await delay(60);
    return state.budgets.map((b) => ({ ...b }));
  },

  async upsertBudget(input: BudgetInput) {
    await delay();
    const existing = state.budgets.find((b) => b.categoryId === input.categoryId);
    if (existing) {
      existing.amount = input.amount;
      existing.currency = input.currency;
      return { ...existing };
    }
    const budget: Budget = { id: uid('bud'), pairId: state.pair.id, ...input };
    state.budgets.push(budget);
    return { ...budget };
  },

  async listExchangeRates() {
    await delay(40);
    return state.rates.map((r) => ({ ...r }));
  },

  async upsertExchangeRate(fromCurrency, rate) {
    await delay();
    const existing = state.rates.find((r) => r.fromCurrency === fromCurrency && r.toCurrency === 'JPY');
    if (existing) {
      existing.rate = rate;
      return { ...existing };
    }
    const created: ExchangeRate = { id: uid('rate'), pairId: state.pair.id, fromCurrency, toCurrency: 'JPY', rate };
    state.rates.push(created);
    return { ...created };
  },

  async listNotifications() {
    await delay(60);
    return state.notifications.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((n) => ({ ...n }));
  },

  async markNotificationRead(id) {
    await delay(40);
    const n = state.notifications.find((x) => x.id === id);
    if (n) n.isRead = true;
  },

  async markAllNotificationsRead() {
    await delay(40);
    state.notifications.forEach((n) => {
      n.isRead = true;
    });
  },

  async getNotificationSettings() {
    await delay(40);
    return { ...state.notificationSettings };
  },

  async updateNotificationSettings(patch) {
    await delay();
    Object.assign(state.notificationSettings, patch);
    return { ...state.notificationSettings };
  },
};
