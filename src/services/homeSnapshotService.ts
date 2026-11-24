import type {
  CategorySpendingSummary,
  MarketProfile,
  PriceIndexSummary,
  PurchaseRecord,
} from '../types/shopping';
import {
  calculateCategorySpending,
  calculatePriceIndex,
} from './productHistoryService';
import { getPurchaseRecordTotal } from '../types/shopping';

export const HOME_SNAPSHOT_STORAGE_KEY = 'carrinhocompras_home_snapshot_v1';

export interface HomeSnapshot {
  monthlyStats: {
    currentMonthTotal: number;
    currentMonthCount: number;
    previousMonthTotal: number;
    diffPercent: number | null;
  };
  priceIndex: PriceIndexSummary;
  categorySpending: CategorySpendingSummary[];
  recentPurchases: Array<{
    id: string;
    marketName: string;
    date: string;
    total: number;
    itemCount: number;
  }>;
  availableMarketNames: string[];
  pendingItemsCount: number;
  updatedAtMs: number;
}

export function loadHomeSnapshotSync(): HomeSnapshot | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(HOME_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.updatedAtMs === 'number' &&
      parsed.monthlyStats &&
      parsed.priceIndex
    ) {
      return parsed as HomeSnapshot;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveHomeSnapshot(snapshot: HomeSnapshot): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(
      HOME_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  } catch {
    // Ignore quota issues
  }
}

export function buildHomeSnapshot(
  history: PurchaseRecord[],
  markets: MarketProfile[],
  pendingItemsCount: number = 0,
  priceIndexDays: number = 60,
): HomeSnapshot {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const prevDate = new Date(curYear, curMonth - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();

  let currentMonthTotal = 0;
  let currentMonthCount = 0;
  let previousMonthTotal = 0;

  for (const rec of history) {
    const d = new Date(rec.date);
    const total = getPurchaseRecordTotal(rec);
    if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
      currentMonthTotal += total;
      currentMonthCount++;
    } else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
      previousMonthTotal += total;
    }
  }

  const diffPercent =
    previousMonthTotal > 0
      ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
      : null;

  const priceIndexResult = calculatePriceIndex(history, priceIndexDays);
  const spendingResult = calculateCategorySpending(history);

  const marketSet = new Set<string>();
  markets.forEach((m) => marketSet.add(m.name));
  history.forEach((r) => marketSet.add(r.marketName));

  const sortedRecent = [...history]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      marketName: r.marketName,
      date: r.date,
      total: getPurchaseRecordTotal(r),
      itemCount: r.items.length,
    }));

  return {
    monthlyStats: {
      currentMonthTotal,
      currentMonthCount,
      previousMonthTotal,
      diffPercent,
    },
    priceIndex: priceIndexResult,
    categorySpending: spendingResult,
    recentPurchases: sortedRecent,
    availableMarketNames: Array.from(marketSet).sort(),
    pendingItemsCount,
    updatedAtMs: Date.now(),
  };
}
