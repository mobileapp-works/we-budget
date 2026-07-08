/**
 * Supabase の行（snake_case）⇔ アプリのドメイン型（camelCase）の変換。
 * 生成型に依存せず、ここで明示的にマッピングする（保守しやすく、型も安全）。
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
  ExchangeRate,
  AppNotification,
  NotificationSettings,
} from '@/types/models';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export function toProfile(r: Row): Profile {
  return {
    id: r.id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url ?? null,
    pairId: r.pair_id,
    expoPushToken: r.expo_push_token ?? null,
    language: r.language,
    theme: r.theme,
    aiConsent: r.ai_consent,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toPair(r: Row): Pair {
  return {
    id: r.id,
    inviteCode: r.invite_code,
    user1Id: r.user1_id ?? null,
    user2Id: r.user2_id ?? null,
    splitRatioUser1: r.split_ratio_user1,
    splitRatioUser2: r.split_ratio_user2,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at ?? null,
  };
}

export function toPairRequest(r: Row): PairRequest {
  return {
    id: r.id,
    pairId: r.pair_id,
    requesterId: r.requester_id,
    // requester_name は list_incoming_pair_requests RPC のみが返す（行SELECTでは undefined）
    requesterName: r.requester_name ?? null,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function toCategory(r: Row): Category {
  return {
    id: r.id,
    pairId: r.pair_id,
    name: r.name ?? null,
    nameKey: r.name_key ?? null,
    icon: r.icon,
    color: r.color,
    isDefault: r.is_default,
    isHidden: r.is_hidden,
    sortOrder: r.sort_order,
  };
}

export function toExpense(r: Row): Expense {
  return {
    id: r.id,
    pairId: r.pair_id,
    recordedBy: r.recorded_by ?? null,
    categoryId: r.category_id,
    amount: Number(r.amount),
    currency: r.currency,
    payerUserId: r.payer_user_id ?? null,
    isSharedPayment: r.is_shared_payment,
    settlementId: r.settlement_id ?? null,
    expenseDate: r.expense_date,
    description: r.description ?? null,
    storeName: r.store_name ?? null,
    receiptImageUrl: r.receipt_image_url ?? null,
    isFixedCost: r.is_fixed_cost,
    fixedCostId: r.fixed_cost_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toFixedCost(r: Row): FixedCost {
  return {
    id: r.id,
    pairId: r.pair_id,
    categoryId: r.category_id,
    name: r.name,
    type: r.type,
    amount: r.amount === null || r.amount === undefined ? null : Number(r.amount),
    currency: r.currency,
    payerUserId: r.payer_user_id ?? null,
    isSharedPayment: r.is_shared_payment,
    billingDay: r.billing_day,
    reminderDay: r.reminder_day ?? null,
    isActive: r.is_active,
  };
}

export function toSettlement(r: Row): Settlement {
  return {
    id: r.id,
    pairId: r.pair_id,
    settledBy: r.settled_by ?? null,
    amount: Number(r.amount),
    currency: r.currency,
    fromUserId: r.from_user_id ?? null,
    toUserId: r.to_user_id ?? null,
    settledAt: r.settled_at,
  };
}

export function toSharedEntry(r: Row): SharedAccountEntry {
  return {
    id: r.id,
    pairId: r.pair_id,
    type: r.type,
    userId: r.user_id ?? null,
    amount: Number(r.amount),
    currency: r.currency,
    description: r.description ?? null,
    transactionDate: r.transaction_date,
  };
}

export function toBudget(r: Row): Budget {
  return {
    id: r.id,
    pairId: r.pair_id,
    categoryId: r.category_id ?? null,
    amount: Number(r.amount),
    currency: r.currency,
  };
}

export function toExchangeRate(r: Row): ExchangeRate {
  return {
    id: r.id,
    pairId: r.pair_id,
    fromCurrency: r.from_currency,
    toCurrency: r.to_currency,
    rate: Number(r.rate),
  };
}

export function toNotification(r: Row): AppNotification {
  return {
    id: r.id,
    userId: r.user_id,
    pairId: r.pair_id,
    type: r.type,
    title: r.title,
    body: r.body,
    data: r.data ?? null,
    isRead: r.is_read,
    createdAt: r.created_at,
  };
}

export function toNotificationSettings(r: Row): NotificationSettings {
  return {
    userId: r.user_id,
    expenseAdded: r.expense_added,
    expenseEdited: r.expense_edited,
    expenseDeleted: r.expense_deleted,
    settlement: r.settlement,
    reminderVariable: r.reminder_variable,
    budgetAlert: r.budget_alert,
    settlementReminder: r.settlement_reminder,
  };
}
