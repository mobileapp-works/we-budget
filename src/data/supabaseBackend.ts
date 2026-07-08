/**
 * Supabase 実装の Backend。
 * モックと同じ Backend インターフェースを満たす。EXPO_PUBLIC_USE_MOCK=false で使われる。
 * 行(snake) ⇔ ドメイン(camel) の変換は mappers.ts に集約。
 *
 * 注: ローカルにDBが無いため未実機検証。SUPABASE_SETUP.md の SQL 適用後に動作する。
 */
import dayjs from 'dayjs';
import { requireSupabase } from '@/lib/supabase';
import type { Backend, SessionContext, ExpenseInput, FixedCostInput, SharedEntryInput, BudgetInput, CategoryInput } from './backend';
import type { SettlementBalance, UUID } from '@/types/models';
import {
  toProfile,
  toPair,
  toPairRequest,
  toCategory,
  toExpense,
  toFixedCost,
  toSettlement,
  toSharedEntry,
  toBudget,
  toExchangeRate,
  toNotification,
  toNotificationSettings,
} from './mappers';

/** 認証済みユーザーの id と pair_id を取得する。 */
async function context(): Promise<{ userId: UUID; pairId: UUID }> {
  const sb = requireSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('not authenticated');
  const { data, error } = await sb.from('profiles').select('pair_id').eq('id', userId).single();
  if (error) throw error;
  return { userId, pairId: data.pair_id };
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * base64 文字列を Uint8Array にデコードする。
 * RN/Hermes で確実に動くよう atob 等に依存しない自前実装。
 * Storage.upload は ArrayBufferView を受け付けるためこれをそのまま渡す。
 */
function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const outLen = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(outLen);
  let pos = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const val = B64_CHARS.indexOf(clean[i]!);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[pos++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

async function buildSession(): Promise<SessionContext> {
  const sb = requireSupabase();
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('not authenticated');

  const { data: profileRow, error: pErr } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (pErr) throw pErr;
  const profile = toProfile(profileRow);

  const { data: pairRow, error: prErr } = await sb.from('pairs').select('*').eq('id', profile.pairId).single();
  if (prErr) throw prErr;
  const pair = toPair(pairRow);

  const partnerId = pair.user1Id === user.id ? pair.user2Id : pair.user1Id;
  let partner = null;
  if (partnerId) {
    const { data: partnerRow } = await sb.from('profiles').select('*').eq('id', partnerId).maybeSingle();
    partner = partnerRow ? toProfile(partnerRow) : null;
  }

  return { userId: user.id, email: user.email ?? '', profile, pair, partner };
}

export const supabaseBackend: Backend = {
  // --- 認証 ---
  async getSession() {
    const sb = requireSupabase();
    const { data } = await sb.auth.getSession();
    if (!data.session) return null;
    return buildSession();
  },

  async signIn(email, password) {
    const sb = requireSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return buildSession();
  },

  async signInWithIdToken(provider, token, nonce) {
    const sb = requireSupabase();
    const { error } = await sb.auth.signInWithIdToken({ provider, token, nonce });
    if (error) throw error;
    return buildSession();
  },

  async signUp(email, password, displayName) {
    const sb = requireSupabase();
    const { error } = await sb.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
    if (error) throw error;
  },

  async signOut() {
    await requireSupabase().auth.signOut();
  },

  async sendPasswordReset(email) {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email, { redirectTo: 'webudget://reset-password' });
    if (error) throw error;
  },

  async recoverSession(accessToken, refreshToken) {
    const sb = requireSupabase();
    const { error } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  },

  async updatePassword(newPassword) {
    const sb = requireSupabase();
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async deleteAccount() {
    const sb = requireSupabase();
    const { error } = await sb.functions.invoke('delete-account');
    if (error) throw error;
    await sb.auth.signOut();
  },

  // --- プロフィール ---
  async updateProfile(patch) {
    const sb = requireSupabase();
    const { userId } = await context();
    const row: Record<string, unknown> = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    if (patch.aiConsent !== undefined) row.ai_consent = patch.aiConsent;
    const { data, error } = await sb.from('profiles').update(row).eq('id', userId).select().single();
    if (error) throw error;
    return toProfile(data);
  },

  async registerPushToken(token) {
    const sb = requireSupabase();
    const { userId } = await context();
    const { error } = await sb.from('profiles').update({ expo_push_token: token }).eq('id', userId);
    if (error) throw error;
  },

  // --- 画像アップロード ---
  async uploadAvatar(image) {
    const sb = requireSupabase();
    const { userId } = await context();
    // パス先頭フォルダは user_id（avatars の書き込みポリシー準拠）。
    const path = `${userId}/avatar_${Date.now()}.jpg`;
    const { error } = await sb.storage
      .from('avatars')
      .upload(path, base64ToBytes(image.base64), { contentType: image.contentType, upsert: true });
    if (error) throw error;
    return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  },

  async uploadCategoryIcon(image) {
    const sb = requireSupabase();
    const { pairId } = await context();
    // パス先頭フォルダは pair_id（category-icons の書き込みポリシー準拠）。ペアで共有表示する。
    const path = `${pairId}/icon_${Date.now()}.jpg`;
    const { error } = await sb.storage
      .from('category-icons')
      .upload(path, base64ToBytes(image.base64), { contentType: image.contentType, upsert: true });
    if (error) throw error;
    return sb.storage.from('category-icons').getPublicUrl(path).data.publicUrl;
  },

  async uploadReceipt(image) {
    const sb = requireSupabase();
    const { pairId } = await context();
    // receipts は private バケット。パス先頭フォルダは pair_id（0003 のRLS準拠）。
    // 公開URLは使えないため、DB には Storage パスを保存し表示時に署名URLへ解決する。
    const path = `${pairId}/receipt_${Date.now()}.jpg`;
    const { error } = await sb.storage
      .from('receipts')
      .upload(path, base64ToBytes(image.base64), { contentType: image.contentType, upsert: false });
    if (error) throw error;
    return path;
  },

  async getReceiptUrl(path) {
    const sb = requireSupabase();
    const { data, error } = await sb.storage.from('receipts').createSignedUrl(path, 60 * 60);
    if (error) throw error;
    return data.signedUrl;
  },

  // --- ペア ---
  async createInvite() {
    const sb = requireSupabase();
    const { pairId } = await context();
    const { data, error } = await sb.from('pairs').select('invite_code').eq('id', pairId).single();
    if (error) throw error;
    return data.invite_code;
  },

  async requestPair(inviteCode) {
    const sb = requireSupabase();
    const { error } = await sb.rpc('request_pair', { p_invite_code: inviteCode });
    if (error) throw error;
  },

  async getOutgoingPairRequest() {
    const sb = requireSupabase();
    const { userId } = await context();
    // 最新1件を状態ごと返す（pending→approved/declined の遷移をポーリングで検知するため）。
    const { data, error } = await sb
      .from('pair_requests')
      .select('*')
      .eq('requester_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toPairRequest(data) : null;
  },

  async listIncomingPairRequests() {
    const sb = requireSupabase();
    // RLS では申請者のプロフィールを読めないため、表示名込みで返す RPC を使う。
    const { data, error } = await sb.rpc('list_incoming_pair_requests');
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(toPairRequest);
  },

  async respondPairRequest(requestId, approve) {
    const sb = requireSupabase();
    const { error } = await sb.rpc('respond_pair_request', { p_request_id: requestId, p_approve: approve });
    if (error) throw error;
    return buildSession();
  },

  async cancelPairRequest(requestId) {
    const sb = requireSupabase();
    const { error } = await sb.rpc('cancel_pair_request', { p_request_id: requestId });
    if (error) throw error;
  },

  async leavePair() {
    const sb = requireSupabase();
    const { pairId } = await context();
    const { error } = await sb.rpc('leave_pair', { p_pair_id: pairId });
    if (error) throw error;
    return buildSession();
  },

  async updateSplitRatio(user1Percent) {
    const sb = requireSupabase();
    const { error } = await sb.rpc('update_split_ratio', { p_user1_percent: user1Percent });
    if (error) throw error;
    const { pairId } = await context();
    const { data, error: e2 } = await sb.from('pairs').select('*').eq('id', pairId).single();
    if (e2) throw e2;
    return toPair(data);
  },

  // --- カテゴリ ---
  async listCategories(includeHidden = false) {
    const sb = requireSupabase();
    let query = sb
      .from('categories')
      .select('*')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (!includeHidden) query = query.eq('is_hidden', false);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toCategory);
  },

  async addCategory(input: CategoryInput) {
    const sb = requireSupabase();
    const { pairId } = await context();
    const { data, error } = await sb
      .from('categories')
      .insert({ pair_id: pairId, name: input.name, icon: input.icon, color: input.color, is_default: false })
      .select()
      .single();
    if (error) throw error;
    return toCategory(data);
  },

  async updateCategory(id, patch) {
    const sb = requireSupabase();
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.icon !== undefined) row.icon = patch.icon;
    if (patch.color !== undefined) row.color = patch.color;
    if (patch.isHidden !== undefined) row.is_hidden = patch.isHidden;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    const { data, error } = await sb.from('categories').update(row).eq('id', id).select().single();
    if (error) throw error;
    return toCategory(data);
  },

  // --- 支出 ---
  async listExpenses(monthKey) {
    const sb = requireSupabase();
    // RLS は「自分のペア OR 自分が記録した支出（解除済みpair含む）」を通すため、
    // 現在のペアの家計簿に旧pair/ソロ時代の支出が混入しないよう pair_id で明示的に絞る。
    const { pairId } = await context();
    const start = dayjs(`${monthKey}-01`).startOf('month').format('YYYY-MM-DD');
    const end = dayjs(`${monthKey}-01`).endOf('month').format('YYYY-MM-DD');
    const { data, error } = await sb
      .from('expenses')
      .select('*')
      .eq('pair_id', pairId)
      .is('deleted_at', null)
      .gte('expense_date', start)
      .lte('expense_date', end)
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toExpense);
  },

  async listSharedExpenses() {
    const sb = requireSupabase();
    const { pairId } = await context();
    const { data, error } = await sb
      .from('expenses')
      .select('*')
      .eq('pair_id', pairId)
      .eq('is_shared_payment', true)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toExpense);
  },

  async getExpense(id) {
    const sb = requireSupabase();
    const { data, error } = await sb.from('expenses').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data ? toExpense(data) : null;
  },

  async addExpense(input: ExpenseInput) {
    const sb = requireSupabase();
    const { userId, pairId } = await context();
    const { data, error } = await sb
      .from('expenses')
      .insert({
        pair_id: pairId,
        recorded_by: userId,
        category_id: input.categoryId,
        amount: input.amount,
        currency: input.currency,
        payer_user_id: input.payerUserId,
        is_shared_payment: input.isSharedPayment,
        expense_date: input.expenseDate,
        description: input.description,
        store_name: input.storeName,
        receipt_image_url: input.receiptImageUrl,
      })
      .select()
      .single();
    if (error) throw error;
    return toExpense(data);
  },

  async updateExpense(id, expectedUpdatedAt, input) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('expenses')
      .update({
        category_id: input.categoryId,
        amount: input.amount,
        currency: input.currency,
        payer_user_id: input.payerUserId,
        is_shared_payment: input.isSharedPayment,
        expense_date: input.expenseDate,
        description: input.description,
        store_name: input.storeName,
        receipt_image_url: input.receiptImageUrl,
      })
      .eq('id', id)
      .eq('updated_at', expectedUpdatedAt) // 楽観的ロック
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('conflict'); // updated_at 不一致 = 競合
    return toExpense(data);
  },

  async deleteExpense(id) {
    const sb = requireSupabase();
    const { error } = await sb.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  // --- 立替精算 ---
  async getSettlementBalance() {
    const sb = requireSupabase();
    const { pairId } = await context();
    const { data, error } = await sb.rpc('calculate_settlement_balance', { p_pair_id: pairId });
    if (error) throw error;
    return data as SettlementBalance;
  },

  async executeSettlement() {
    const sb = requireSupabase();
    const { pairId } = await context();
    const { data, error } = await sb.rpc('execute_settlement', { p_pair_id: pairId });
    if (error) throw error;
    return toSettlement(data);
  },

  async listSettlements() {
    const sb = requireSupabase();
    const { data, error } = await sb.from('settlements').select('*').order('settled_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toSettlement);
  },

  // --- 共同口座 ---
  async listSharedEntries() {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('shared_account')
      .select('*')
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toSharedEntry);
  },

  async addSharedEntry(input: SharedEntryInput) {
    const sb = requireSupabase();
    const { userId, pairId } = await context();
    const { data, error } = await sb
      .from('shared_account')
      .insert({
        pair_id: pairId,
        user_id: userId,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        transaction_date: input.transactionDate,
      })
      .select()
      .single();
    if (error) throw error;
    return toSharedEntry(data);
  },

  // --- 固定費 ---
  async listFixedCosts() {
    const sb = requireSupabase();
    const { data, error } = await sb.from('fixed_costs').select('*').is('deleted_at', null);
    if (error) throw error;
    return (data ?? []).map(toFixedCost);
  },

  async addFixedCost(input: FixedCostInput) {
    const sb = requireSupabase();
    const { pairId } = await context();
    const { data, error } = await sb
      .from('fixed_costs')
      .insert({
        pair_id: pairId,
        category_id: input.categoryId,
        name: input.name,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        payer_user_id: input.payerUserId,
        is_shared_payment: input.isSharedPayment,
        billing_day: input.billingDay,
        reminder_day: input.reminderDay,
        is_active: input.isActive,
      })
      .select()
      .single();
    if (error) throw error;
    return toFixedCost(data);
  },

  async updateFixedCost(id, input) {
    const sb = requireSupabase();
    const row: Record<string, unknown> = {};
    if (input.categoryId !== undefined) row.category_id = input.categoryId;
    if (input.name !== undefined) row.name = input.name;
    if (input.type !== undefined) row.type = input.type;
    if (input.amount !== undefined) row.amount = input.amount;
    if (input.currency !== undefined) row.currency = input.currency;
    if (input.payerUserId !== undefined) row.payer_user_id = input.payerUserId;
    if (input.isSharedPayment !== undefined) row.is_shared_payment = input.isSharedPayment;
    if (input.billingDay !== undefined) row.billing_day = input.billingDay;
    if (input.reminderDay !== undefined) row.reminder_day = input.reminderDay;
    if (input.isActive !== undefined) row.is_active = input.isActive;
    const { data, error } = await sb.from('fixed_costs').update(row).eq('id', id).select().single();
    if (error) throw error;
    return toFixedCost(data);
  },

  async deleteFixedCost(id) {
    const sb = requireSupabase();
    const { error } = await sb.from('fixed_costs').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  // --- 予算 ---
  async listBudgets() {
    const sb = requireSupabase();
    const { data, error } = await sb.from('budgets').select('*');
    if (error) throw error;
    return (data ?? []).map(toBudget);
  },

  async upsertBudget(input: BudgetInput) {
    const sb = requireSupabase();
    const { pairId } = await context();
    // 部分一意インデックスのため手動 upsert（category_id が null/非nullで分岐）
    let query = sb.from('budgets').select('id').eq('pair_id', pairId);
    query = input.categoryId === null ? query.is('category_id', null) : query.eq('category_id', input.categoryId);
    const { data: existing } = await query.maybeSingle();

    if (existing) {
      const { data, error } = await sb
        .from('budgets')
        .update({ amount: input.amount, currency: input.currency })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return toBudget(data);
    }
    const { data, error } = await sb
      .from('budgets')
      .insert({ pair_id: pairId, category_id: input.categoryId, amount: input.amount, currency: input.currency })
      .select()
      .single();
    if (error) throw error;
    return toBudget(data);
  },

  // --- 為替レート ---
  async listExchangeRates() {
    const sb = requireSupabase();
    const { data, error } = await sb.from('exchange_rates').select('*');
    if (error) throw error;
    return (data ?? []).map(toExchangeRate);
  },

  async upsertExchangeRate(fromCurrency, rate) {
    const sb = requireSupabase();
    const { pairId } = await context();
    const { data, error } = await sb
      .from('exchange_rates')
      .upsert(
        { pair_id: pairId, from_currency: fromCurrency, to_currency: 'JPY', rate },
        { onConflict: 'pair_id,from_currency,to_currency' }
      )
      .select()
      .single();
    if (error) throw error;
    return toExchangeRate(data);
  },

  // --- 通知 ---
  async listNotifications() {
    const sb = requireSupabase();
    const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toNotification);
  },

  async markNotificationRead(id) {
    const sb = requireSupabase();
    const { error } = await sb.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw error;
  },

  async markAllNotificationsRead() {
    const sb = requireSupabase();
    const { userId } = await context();
    const { error } = await sb.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    if (error) throw error;
  },

  async getNotificationSettings() {
    const sb = requireSupabase();
    const { userId } = await context();
    const { data, error } = await sb.from('notification_settings').select('*').eq('user_id', userId).single();
    if (error) throw error;
    return toNotificationSettings(data);
  },

  async updateNotificationSettings(patch) {
    const sb = requireSupabase();
    const { userId } = await context();
    const row: Record<string, unknown> = {};
    if (patch.expenseAdded !== undefined) row.expense_added = patch.expenseAdded;
    if (patch.expenseEdited !== undefined) row.expense_edited = patch.expenseEdited;
    if (patch.expenseDeleted !== undefined) row.expense_deleted = patch.expenseDeleted;
    if (patch.settlement !== undefined) row.settlement = patch.settlement;
    if (patch.reminderVariable !== undefined) row.reminder_variable = patch.reminderVariable;
    if (patch.budgetAlert !== undefined) row.budget_alert = patch.budgetAlert;
    if (patch.settlementReminder !== undefined) row.settlement_reminder = patch.settlementReminder;
    const { data, error } = await sb.from('notification_settings').update(row).eq('user_id', userId).select().single();
    if (error) throw error;
    return toNotificationSettings(data);
  },
};
