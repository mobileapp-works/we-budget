/**
 * mappers（行 snake_case → ドメイン camelCase 変換）の単体テスト。
 *
 * 重点: PostgREST は numeric(12,2) を文字列で返すことがあるため、金額・レートは
 * 必ず Number() で数値化されること（金額の文字列連結バグを防ぐ）。および NULL 許容列の
 * null 正規化（undefined を返さない）を固定する。
 */
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

describe('toExpense', () => {
  const baseRow = {
    id: 'e1',
    pair_id: 'p1',
    recorded_by: 'u1',
    category_id: 'c1',
    amount: '1234.50', // numeric は文字列で来ることがある
    currency: 'JPY',
    payer_user_id: 'u1',
    is_shared_payment: false,
    settlement_id: null,
    expense_date: '2026-07-01',
    description: null,
    store_name: null,
    receipt_image_url: null,
    is_fixed_cost: false,
    fixed_cost_id: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  };

  it('amount を文字列から数値へ変換する（文字列連結を防ぐ）', () => {
    const e = toExpense(baseRow);
    expect(e.amount).toBe(1234.5);
    expect(typeof e.amount).toBe('number');
  });

  it('共同口座払い（payer null）を正しく写す', () => {
    const e = toExpense({ ...baseRow, is_shared_payment: true, payer_user_id: null });
    expect(e.isSharedPayment).toBe(true);
    expect(e.payerUserId).toBeNull();
  });

  it('未指定の任意列は null に正規化する（undefined を返さない）', () => {
    const { description, store_name, receipt_image_url, settlement_id, ...rest } = baseRow;
    const e = toExpense(rest);
    expect(e.description).toBeNull();
    expect(e.storeName).toBeNull();
    expect(e.receiptImageUrl).toBeNull();
    expect(e.settlementId).toBeNull();
  });

  it('匿名化された recorded_by (null) を保持する', () => {
    const e = toExpense({ ...baseRow, recorded_by: null });
    expect(e.recordedBy).toBeNull();
  });
});

describe('toFixedCost', () => {
  const row = {
    id: 'f1',
    pair_id: 'p1',
    category_id: 'c1',
    name: '家賃',
    type: 'fixed',
    amount: '85000',
    currency: 'JPY',
    payer_user_id: 'u1',
    is_shared_payment: false,
    billing_day: 27,
    reminder_day: null,
    is_active: true,
  };

  it('固定費の amount を数値化する', () => {
    expect(toFixedCost(row).amount).toBe(85000);
  });

  it('変動固定費（amount null）は null のまま', () => {
    const fc = toFixedCost({ ...row, type: 'variable', amount: null, reminder_day: 25 });
    expect(fc.amount).toBeNull();
    expect(fc.reminderDay).toBe(25);
  });
});

describe('toBudget', () => {
  it('全体予算（category_id null）を null に写す', () => {
    const b = toBudget({ id: 'b1', pair_id: 'p1', category_id: null, amount: '30000', currency: 'JPY' });
    expect(b.categoryId).toBeNull();
    expect(b.amount).toBe(30000);
  });

  it('カテゴリ別予算を写す', () => {
    const b = toBudget({ id: 'b2', pair_id: 'p1', category_id: 'c1', amount: 5000, currency: 'JPY' });
    expect(b.categoryId).toBe('c1');
    expect(b.amount).toBe(5000);
  });
});

describe('toExchangeRate', () => {
  it('レートを数値化する', () => {
    const r = toExchangeRate({ id: 'r1', pair_id: 'p1', from_currency: 'USD', to_currency: 'JPY', rate: '150.25' });
    expect(r.rate).toBe(150.25);
    expect(typeof r.rate).toBe('number');
  });
});

describe('toSettlement', () => {
  it('精算額を数値化し from/to を写す', () => {
    const s = toSettlement({
      id: 's1',
      pair_id: 'p1',
      settled_by: 'u1',
      amount: '4200',
      currency: 'JPY',
      from_user_id: 'u2',
      to_user_id: 'u1',
      settled_at: '2026-07-09T00:00:00Z',
    });
    expect(s.amount).toBe(4200);
    expect(s.fromUserId).toBe('u2');
    expect(s.toUserId).toBe('u1');
  });

  it('退会で匿名化された from/to (null) を保持する', () => {
    const s = toSettlement({
      id: 's2',
      pair_id: 'p1',
      settled_by: null,
      amount: 1000,
      currency: 'JPY',
      from_user_id: null,
      to_user_id: null,
      settled_at: '2026-07-09T00:00:00Z',
    });
    expect(s.fromUserId).toBeNull();
    expect(s.toUserId).toBeNull();
    expect(s.settledBy).toBeNull();
  });
});

describe('toSharedEntry', () => {
  it('入金額を数値化する', () => {
    const s = toSharedEntry({
      id: 'sa1',
      pair_id: 'p1',
      type: 'deposit',
      user_id: 'u1',
      amount: '10000',
      currency: 'JPY',
      description: null,
      transaction_date: '2026-07-01',
    });
    expect(s.amount).toBe(10000);
    expect(s.type).toBe('deposit');
  });
});

describe('toPair', () => {
  it('ソロモード（user2_id null）を写す', () => {
    const p = toPair({
      id: 'p1',
      invite_code: 'ABCD1234',
      user1_id: 'u1',
      user2_id: null,
      split_ratio_user1: 50,
      split_ratio_user2: 50,
      created_at: 'x',
      updated_at: 'x',
      deleted_at: null,
    });
    expect(p.user2Id).toBeNull();
    expect(p.inviteCode).toBe('ABCD1234');
  });
});

describe('toProfile / toCategory / toPairRequest / toNotification(Settings)', () => {
  it('toProfile は avatar 等の任意列を null 化する', () => {
    const p = toProfile({
      id: 'u1',
      display_name: 'A',
      pair_id: 'p1',
      language: 'auto',
      theme: 'system',
      ai_consent: false,
      created_at: 'x',
      updated_at: 'x',
    });
    expect(p.avatarUrl).toBeNull();
    expect(p.expoPushToken).toBeNull();
  });

  it('toCategory は name / name_key の欠損を null 化する', () => {
    const c = toCategory({
      id: 'c1',
      pair_id: 'p1',
      name_key: 'category.food',
      icon: 'restaurant',
      color: '#FF7A66',
      is_default: true,
      is_hidden: false,
      sort_order: 0,
    });
    expect(c.name).toBeNull();
    expect(c.nameKey).toBe('category.food');
  });

  it('toPairRequest は requester_name 欠損時 null（行SELECT想定）', () => {
    const r = toPairRequest({
      id: 'r1',
      pair_id: 'p1',
      requester_id: 'u2',
      status: 'pending',
      created_at: 'x',
    });
    expect(r.requesterName).toBeNull();
    expect(r.status).toBe('pending');
  });

  it('toNotificationSettings は全トグルを写す', () => {
    const n = toNotificationSettings({
      user_id: 'u1',
      expense_added: true,
      expense_edited: false,
      expense_deleted: true,
      settlement: true,
      reminder_variable: false,
      budget_alert: true,
      settlement_reminder: false,
    });
    expect(n.expenseEdited).toBe(false);
    expect(n.budgetAlert).toBe(true);
    expect(n.settlementReminder).toBe(false);
  });

  it('toNotification は data 欠損を null 化する', () => {
    const n = toNotification({
      id: 'n1',
      user_id: 'u1',
      pair_id: 'p1',
      type: 'settlement',
      title: 't',
      body: 'b',
      is_read: false,
      created_at: 'x',
    });
    expect(n.data).toBeNull();
    expect(n.isRead).toBe(false);
  });
});
