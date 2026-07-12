/**
 * データアクセスの契約（Backend インターフェース）。
 * モック実装（mockBackend）と Supabase 実装（supabaseBackend）が共通で従う。
 * 画面・フックはこのインターフェースだけに依存し、実体の差し替えを容易にする。
 */
import type {
  Profile,
  Pair,
  PairRequest,
  Category,
  Expense,
  FixedCost,
  Settlement,
  SharedAccountEntry,
  Budget,
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
  /** 1 currency = exchangeRate baseCurrency（基準通貨と同じなら 1）。 */
  exchangeRate: number;
  /** 基準通貨換算額（= round(amount × exchangeRate)）。 */
  baseAmount: number;
  payerUserId: UUID | null;
  isSharedPayment: boolean;
  expenseDate: string;
  description: string | null;
  storeName: string | null;
  receiptImageUrl: string | null;
  /** 変動固定費の当月入力を紐づける固定費ID（通常の支出は null）。 */
  fixedCostId?: UUID | null;
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
  /** 入金/出金の当事者。未指定なら記録者本人。共同(誰の分でもない)調整は null。 */
  userId?: UUID | null;
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

/** 画像アップロードの入力（ImagePicker の asset 由来）。 */
export interface ImageUpload {
  /** ローカルURI（モック時・アップロード前プレビューに使う）。 */
  uri: string;
  /** 画像本体の base64（`ImagePicker` の base64:true で取得）。 */
  base64: string;
  /** MIMEタイプ（例: 'image/jpeg'）。 */
  contentType: string;
}

export interface Backend {
  // --- 認証・セッション ---
  getSession(): Promise<SessionContext | null>;
  signIn(email: string, password: string): Promise<SessionContext>;
  /** Apple / Google のネイティブ ID トークンでサインイン（無ければ自動でアカウント作成）。 */
  signInWithIdToken(provider: 'apple' | 'google', token: string, nonce?: string): Promise<SessionContext>;
  signUp(email: string, password: string, displayName: string): Promise<void>;
  /** サインアップ確認メールを再送する（メールが届かなかった初回ユーザー向け）。 */
  resendVerificationEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /**
   * Sign in with Apple の authorization_code を送り、削除時失効用の refresh_token を
   * サーバー側で保管させる（Apple 未設定なら no-op）。ログインをブロックしない前提。
   */
  linkAppleAuthorization(authorizationCode: string): Promise<void>;
  /** リカバリーメールのディープリンクで受け取ったトークンからセッションを確立する。 */
  recoverSession(accessToken: string, refreshToken: string): Promise<void>;
  /** ログイン中ユーザーのパスワードを変更する（リカバリーセッション含む）。 */
  updatePassword(newPassword: string): Promise<void>;
  deleteAccount(): Promise<void>;

  // --- プロフィール ---
  updateProfile(patch: Partial<Pick<Profile, 'displayName' | 'avatarUrl' | 'aiConsent'>>): Promise<Profile>;
  /** Expo Push Token を profiles に保存する（プッシュ配信の宛先）。 */
  registerPushToken(token: string): Promise<void>;

  // --- 画像アップロード ---
  /** アバター画像を Storage にアップロードし、公開URLを返す（モックはローカルURIをそのまま返す）。 */
  uploadAvatar(image: ImageUpload): Promise<string>;
  /** カテゴリアイコン画像を Storage にアップロードし、公開URLを返す（モックはローカルURIをそのまま返す）。 */
  uploadCategoryIcon(image: ImageUpload): Promise<string>;
  /**
   * レシート画像を private バケットにアップロードし、Storage パスを返す
   * （receipts はペア外非公開のため、表示時は getReceiptUrl で署名URLに解決する）。
   */
  uploadReceipt(image: ImageUpload): Promise<string>;
  /** レシートの Storage パスから表示用の署名URLを取得する（モックはそのまま返す）。 */
  getReceiptUrl(path: string): Promise<string>;

  // --- ペア（承認制: 申請 → 相手が承認 → 成立） ---
  createInvite(): Promise<string>; // 招待コードを返す
  /** 招待コードの持ち主へペア申請を送る（相手に通知が届く。即時成立はしない）。 */
  requestPair(inviteCode: string): Promise<void>;
  /** 自分が送った最新のペア申請（未送信なら null）。pending 中はポーリングで状態遷移を検知する。 */
  getOutgoingPairRequest(): Promise<PairRequest | null>;
  /** 自分のペア宛てに届いている pending のペア申請一覧（承認/拒否用）。 */
  listIncomingPairRequests(): Promise<PairRequest[]>;
  /** ペア申請を承認/拒否する。承認すると申請者が自分のペアに合流する。 */
  respondPairRequest(requestId: UUID, approve: boolean): Promise<SessionContext>;
  /** 自分が送った pending のペア申請を取り消す。 */
  cancelPairRequest(requestId: UUID): Promise<void>;
  leavePair(): Promise<SessionContext>;
  updateSplitRatio(user1Percent: number): Promise<Pair>;
  /**
   * ペアの基準通貨を変更する。currency が現在と異なる場合、rate（1 旧基準 = rate 新基準）で
   * 既存の支出・予算・固定費・共同口座の金額を新基準へ再換算する（確定済み精算は凍結）。
   */
  setBaseCurrency(currency: string, rate: number): Promise<Pair>;

  // --- カテゴリ ---
  /** includeHidden=true で非表示カテゴリも含める（カテゴリ管理画面の再表示用）。 */
  listCategories(includeHidden?: boolean): Promise<Category[]>;
  addCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: UUID, patch: Partial<CategoryInput & { isHidden: boolean; sortOrder: number }>): Promise<Category>;

  // --- 支出 ---
  listExpenses(monthKey: string): Promise<Expense[]>;
  /** 共同口座払いの支出（全期間）。共同口座残高の計算に使う。 */
  listSharedExpenses(): Promise<Expense[]>;
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

  // --- 通知 ---
  listNotifications(): Promise<AppNotification[]>;
  markNotificationRead(id: UUID): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  getNotificationSettings(): Promise<NotificationSettings>;
  updateNotificationSettings(patch: Partial<NotificationSettings>): Promise<NotificationSettings>;
}
