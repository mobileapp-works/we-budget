/**
 * 日付ユーティリティ（純粋関数）。dayjs をラップして用途を限定する。
 */
import dayjs from 'dayjs';
import type { ISODate } from '@/types/models';

/** 'YYYY-MM' 形式の月キーを返す。 */
export function getMonthKey(date: ISODate | Date = new Date()): string {
  return dayjs(date).format('YYYY-MM');
}

/** 当月の開始日・終了日（'YYYY-MM-DD'）を返す。 */
export function getMonthRange(date: ISODate | Date = new Date()): { start: ISODate; end: ISODate } {
  const d = dayjs(date);
  return {
    start: d.startOf('month').format('YYYY-MM-DD'),
    end: d.endOf('month').format('YYYY-MM-DD'),
  };
}

/** 2つの日付が同じ月か判定する。 */
export function isSameMonth(a: ISODate | Date, b: ISODate | Date): boolean {
  return dayjs(a).isSame(dayjs(b), 'month');
}

/** 今日の 'YYYY-MM-DD'。 */
export function today(): ISODate {
  return dayjs().format('YYYY-MM-DD');
}

/** 表示用に日付を整形する（ロケール依存の簡易版）。 */
export function formatDate(date: ISODate | Date, locale = 'ja'): string {
  const d = dayjs(date);
  return locale === 'ja' ? d.format('M月D日') : d.format('MMM D');
}
