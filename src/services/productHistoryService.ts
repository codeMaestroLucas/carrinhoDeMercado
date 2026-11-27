import {
  PRODUCT_CATEGORIES,
  type CategorySpendingSummary,
  type MarketBargainGroup,
  type MarketBargainItem,
  type MarketPriceRecommendation,
  type MarketProductStats,
  type MarketProfile,
  type PriceIndexSummary,
  type ProductCategoryId,
  type ProductHistoryOccurrence,
  type ProductVariationItem,
  type PurchaseRecord,
  type ShoppingItem,
} from '../types/shopping';
import { CategoryClassifier } from './categoryClassifier';

export interface ProductHistoryAggregate {
  normalizedKey: string;
  displayName: string;
  category: ProductCategoryId;
  occurrences: ProductHistoryOccurrence[]; // sorted newest to oldest
  pricedOccurrences: ProductHistoryOccurrence[];
  chronologicalPricedOccurrences: ProductHistoryOccurrence[];
  lastPrice: number;
  previousPrice: number | null;
  variationPercentFromLastTime: number | null;
  lastMarket: string;
  lastDate: string;
  averagePrice: number;
  minPriceOccurrence: ProductHistoryOccurrence | null;
  maxPriceOccurrence: ProductHistoryOccurrence | null;
  marketRanking: MarketProductStats[];
  marketComparisonInsight: string | null;
}

function hasReceiptCode(name: string): boolean {
  return /(?:\b(?:cod|codigo|ref|plu|ean|gtin|sku|lote)\b|#\s*\d+|\b\d{3,}\b)/i.test(
    name,
  );
}

function createProductHistoryAggregate(
  normalizedKey: string,
  displayName: string,
  category: ProductCategoryId,
  occurrencesInput: ProductHistoryOccurrence[],
): ProductHistoryAggregate {
  const occurrences = [...occurrencesInput].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date),
  );
  const pricedOccurrences = occurrences.filter((e) => e.price > 0);
  const chronologicalPricedOccurrences = [...pricedOccurrences].reverse();

  const lastPrice = pricedOccurrences.length > 0 ? pricedOccurrences[0].price : 0;
  const previousPrice =
    pricedOccurrences.length >= 2 ? pricedOccurrences[1].price : null;
  const variationPercentFromLastTime =
    previousPrice != null && previousPrice > 0
      ? ((lastPrice - previousPrice) / previousPrice) * 100
      : null;

  const lastMarket =
    pricedOccurrences.length > 0
      ? pricedOccurrences[0].marketName
      : occurrences[0]?.marketName ?? 'Mercado';
  const lastDate =
    pricedOccurrences.length > 0
      ? pricedOccurrences[0].date
      : occurrences[0]?.date ?? new Date().toISOString();

  const averagePrice =
    pricedOccurrences.length > 0
      ? pricedOccurrences.reduce((acc, item) => acc + item.price, 0) /
        pricedOccurrences.length
      : 0;

  const minPriceOccurrence =
    pricedOccurrences.length > 0
      ? pricedOccurrences.reduce((a, b) => (a.price <= b.price ? a : b))
      : null;
  const maxPriceOccurrence =
    pricedOccurrences.length > 0
      ? pricedOccurrences.reduce((a, b) => (a.price >= b.price ? a : b))
      : null;

  const byMarket = new Map<string, ProductHistoryOccurrence[]>();
  for (const occ of pricedOccurrences) {
    const existing = byMarket.get(occ.marketName) ?? [];
    existing.push(occ);
    byMarket.set(occ.marketName, existing);
  }

  const marketRanking: MarketProductStats[] = Array.from(byMarket.entries())
    .map(([marketName, list]) => {
      const sorted = [...list].sort(
        (a, b) => Date.parse(b.date) - Date.parse(a.date),
      );
      const avg =
        sorted.reduce((sum, e) => sum + e.price, 0) / sorted.length;
      return {
        marketName,
        averagePrice: avg,
        lastPrice: sorted[0].price,
        lastDate: sorted[0].date,
        purchaseCount: sorted.length,
      };
    })
    .sort((a, b) => a.averagePrice - b.averagePrice);

  let marketComparisonInsight: string | null = null;
  if (marketRanking.length >= 2) {
    const cheapest = marketRanking[0];
    const compared = marketRanking[marketRanking.length - 1];
    if (compared.averagePrice > 0) {
      const diffPercent =
        ((compared.averagePrice - cheapest.averagePrice) /
          compared.averagePrice) *
        100;
      if (diffPercent < 0.5) {
        marketComparisonInsight = `${cheapest.marketName} e ${compared.marketName} têm preços médios praticamente iguais para este item.`;
      } else {
        marketComparisonInsight = `${cheapest.marketName} é ${diffPercent.toFixed(0)}% mais barato para este item que ${compared.marketName}.`;
      }
    }
  }

  return {
    normalizedKey,
    displayName,
    category,
    occurrences,
    pricedOccurrences,
    chronologicalPricedOccurrences,
    lastPrice,
    previousPrice,
    variationPercentFromLastTime,
    lastMarket,
    lastDate,
    averagePrice,
    minPriceOccurrence,
    maxPriceOccurrence,
    marketRanking,
    marketComparisonInsight,
  };
}

interface ProductBucket {
  key: string;
  displayName: string;
  category: ProductCategoryId;
  occurrences: ProductHistoryOccurrence[];
}

function choosePreferredDisplayName(current: string, candidate: string): string {
  const currentHasCode = hasReceiptCode(current);
  const candidateHasCode = hasReceiptCode(candidate);
  if (currentHasCode && !candidateHasCode) return candidate;
  if (!currentHasCode && candidateHasCode) return current;
  return candidate.length > current.length ? candidate : current;
}

function groupHistoryOccurrences(
  records: PurchaseRecord[],
  options?: { marketFilter?: string | null; onlyPriced?: boolean },
): ProductBucket[] {
  const exactMap = new Map<string, ProductBucket>();

  for (const record of records) {
    if (options?.marketFilter && record.marketName !== options.marketFilter) {
      continue;
    }
    for (const item of record.items) {
      if (options?.onlyPriced && item.price <= 0) continue;
      const key = CategoryClassifier.normalizeForComparison(item.name);
      if (!key) continue;

      const occurrence: ProductHistoryOccurrence = {
        productName: item.name,
        category: item.category,
        price: item.price,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        unit: item.unit,
        marketName: record.marketName,
        date: record.date,
      };

      const existing = exactMap.get(key);
      if (existing) {
        existing.displayName = choosePreferredDisplayName(
          existing.displayName,
          item.name,
        );
        if (existing.category === 'diversos' && item.category !== 'diversos') {
          existing.category = item.category;
        }
        existing.occurrences.push(occurrence);
      } else {
        exactMap.set(key, {
          key,
          displayName: item.name,
          category: item.category,
          occurrences: [occurrence],
        });
      }
    }
  }

  const hasMeasRegex = /\b\d+(?:\.\d+)?(?:ml|l|g|kg)\b/;
  const sortedBuckets = Array.from(exactMap.values()).sort((a, b) => {
    const aHasMeas = hasMeasRegex.test(a.key) ? 1 : 0;
    const bHasMeas = hasMeasRegex.test(b.key) ? 1 : 0;
    if (bHasMeas !== aHasMeas) return bHasMeas - aHasMeas;
    const aTokens = a.key.split(' ').length;
    const bTokens = b.key.split(' ').length;
    if (bTokens !== aTokens) return bTokens - aTokens;
    return a.key.localeCompare(b.key);
  });

  const merged: ProductBucket[] = [];
  for (const bucket of sortedBuckets) {
    const target = merged.find((anchor) =>
      CategoryClassifier.areComparisonKeysEquivalent(anchor.key, bucket.key, {
        categoryA: anchor.category,
        categoryB: bucket.category,
      }),
    );
    if (target) {
      target.displayName = choosePreferredDisplayName(
        target.displayName,
        bucket.displayName,
      );
      if (target.category === 'diversos' && bucket.category !== 'diversos') {
        target.category = bucket.category;
      }
      target.occurrences.push(...bucket.occurrences);
    } else {
      merged.push(bucket);
    }
  }

  return merged;
}

export function buildAllProductAggregates(
  records: PurchaseRecord[],
  options?: { marketFilter?: string | null },
): ProductHistoryAggregate[] {
  const buckets = groupHistoryOccurrences(records, options);

  return buckets
    .map((bucket) =>
      createProductHistoryAggregate(
        bucket.key,
        bucket.displayName,
        bucket.category,
        bucket.occurrences,
      ),
    )
    .sort((a, b) =>
      a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()),
    );
}

export function matchesAggregateSearchQuery(
  aggregate: ProductHistoryAggregate,
  rawQuery: string,
): boolean {
  const normQuery = CategoryClassifier.normalizeForComparison(rawQuery);
  if (!normQuery) return true;
  if (aggregate.normalizedKey.includes(normQuery)) return true;
  const normRaw = CategoryClassifier.normalize(rawQuery);
  if (CategoryClassifier.normalize(aggregate.displayName).includes(normRaw)) {
    return true;
  }
  if (
    aggregate.occurrences.some((occ) =>
      CategoryClassifier.normalize(occ.productName).includes(normRaw),
    )
  ) {
    return true;
  }
  return (
    CategoryClassifier.productSimilarity(aggregate.displayName, rawQuery) >=
    0.55
  );
}

export function findSimilarProducts(
  target: ProductHistoryAggregate,
  candidates: ProductHistoryAggregate[],
  options?: { minSimilarity?: number; limit?: number },
): Array<{ product: ProductHistoryAggregate; similarity: number }> {
  const minSimilarity = options?.minSimilarity ?? 0.42;
  const limit = options?.limit ?? 10;

  const scored: Array<{ product: ProductHistoryAggregate; similarity: number }> =
    [];

  for (const candidate of candidates) {
    if (candidate.normalizedKey === target.normalizedKey) continue;
    const score = CategoryClassifier.productSimilarity(
      target.displayName,
      candidate.displayName,
      {
        categoryA: target.category,
        categoryB: candidate.category,
      },
    );
    if (score >= minSimilarity) {
      scored.push({ product: candidate, similarity: score });
    }
  }

  scored.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    return (
      b.product.pricedOccurrences.length - a.product.pricedOccurrences.length
    );
  });

  return scored.slice(0, limit);
}

export function calculatePriceIndex(
  history: PurchaseRecord[],
  daysWindow = 60,
): PriceIndexSummary {
  const cutoffMs = Date.now() - daysWindow * 24 * 60 * 60 * 1000;
  const buckets = groupHistoryOccurrences(history, { onlyPriced: true });

  const variations: ProductVariationItem[] = [];
  let increasedCount = 0;
  let decreasedCount = 0;
  let stableCount = 0;
  let totalVariationSum = 0;

  for (const bucket of buckets) {
    const list = [...bucket.occurrences].sort(
      (a, b) => Date.parse(b.date) - Date.parse(a.date),
    );
    if (list.length < 2) continue;

    const latest = list[0];
    if (Date.parse(latest.date) < cutoffMs) continue;

    const previous = list[1];
    if (previous.price <= 0) continue;

    const diffPercent =
      ((latest.price - previous.price) / previous.price) * 100;
    totalVariationSum += diffPercent;

    if (diffPercent > 0.5) {
      increasedCount++;
    } else if (diffPercent < -0.5) {
      decreasedCount++;
    } else {
      stableCount++;
    }

    variations.push({
      productName: latest.productName,
      category: latest.category,
      currentPrice: latest.price,
      previousPrice: previous.price,
      variationPercent: diffPercent,
      marketName: latest.marketName,
    });
  }

  const overallVariation =
    variations.length > 0 ? totalVariationSum / variations.length : 0;

  const topIncreases = variations
    .filter((v) => v.variationPercent > 0.5)
    .sort((a, b) => b.variationPercent - a.variationPercent)
    .slice(0, 6);

  const topDecreases = variations
    .filter((v) => v.variationPercent < -0.5)
    .sort((a, b) => a.variationPercent - b.variationPercent)
    .slice(0, 6);

  return {
    periodLabel: `Últimos ${daysWindow} dias`,
    overallVariationPercent: overallVariation,
    totalComparedItems: variations.length,
    increasedCount,
    decreasedCount,
    stableCount,
    topIncreases,
    topDecreases,
  };
}

export function calculateCategorySpending(
  history: PurchaseRecord[],
  startDate?: Date | null,
): CategorySpendingSummary[] {
  const spendingMap = new Map<ProductCategoryId, number>();
  const countMap = new Map<ProductCategoryId, number>();
  let total = 0;
  const startMs = startDate ? startDate.getTime() : null;

  for (const record of history) {
    if (startMs != null && Date.parse(record.date) < startMs) continue;
    for (const item of record.items) {
      if (item.price <= 0) continue;
      spendingMap.set(
        item.category,
        (spendingMap.get(item.category) ?? 0) + item.price,
      );
      countMap.set(item.category, (countMap.get(item.category) ?? 0) + 1);
      total += item.price;
    }
  }

  if (total <= 0) return [];

  const result: CategorySpendingSummary[] = [];
  for (const cat of PRODUCT_CATEGORIES) {
    const amount = spendingMap.get(cat.id) ?? 0;
    if (amount > 0) {
      result.push({
        category: cat.id,
        totalSpent: amount,
        percentage: (amount / total) * 100,
        itemCount: countMap.get(cat.id) ?? 0,
      });
    }
  }

  result.sort((a, b) => b.totalSpent - a.totalSpent);
  return result;
}

export function findAggregateForProductName(
  aggregates: ProductHistoryAggregate[],
  productName: string,
): ProductHistoryAggregate | undefined {
  const exact = aggregates.find((agg) =>
    agg.occurrences.some((occ) => occ.productName === productName),
  );
  if (exact) return exact;
  const normTarget = CategoryClassifier.normalizeForComparison(productName);
  if (!normTarget) return undefined;
  return aggregates.find((agg) => agg.normalizedKey === normTarget);
}

export function findLastHistoricalPrice(
  history: PurchaseRecord[],
  itemName: string,
  marketId?: string | null,
): number | null {
  const normalized = CategoryClassifier.normalize(itemName);
  if (!normalized) return null;

  if (marketId) {
    for (const record of history) {
      if (record.marketId !== marketId) continue;
      for (const item of record.items) {
        if (
          CategoryClassifier.normalize(item.name) === normalized &&
          item.price > 0
        ) {
          return item.price;
        }
      }
    }
  }

  for (const record of history) {
    for (const item of record.items) {
      if (
        CategoryClassifier.normalize(item.name) === normalized &&
        item.price > 0
      ) {
        return item.price;
      }
    }
  }
  return null;
}

export function buildMarketRecommendationsByProduct(
  history: PurchaseRecord[],
  markets: MarketProfile[],
): Map<string, MarketPriceRecommendation[]> {
  const byId = new Map<string, MarketProfile>();
  const byNormName = new Map<string, MarketProfile>();
  for (const m of markets) {
    byId.set(m.id, m);
    byNormName.set(CategoryClassifier.normalize(m.name), m);
  }

  const pricesByProduct = new Map<string, Map<string, number[]>>();
  const fallbackMarketNames = new Map<string, string>();
  const allCategoryIds = PRODUCT_CATEGORIES.map((c) => c.id);

  for (const record of history) {
    const matchedMarket =
      byId.get(record.marketId) ??
      byNormName.get(CategoryClassifier.normalize(record.marketName));
    const marketKey = matchedMarket?.id ?? record.marketId;
    if (!fallbackMarketNames.has(marketKey)) {
      fallbackMarketNames.set(
        marketKey,
        matchedMarket?.name ?? record.marketName,
      );
    }

    for (const histItem of record.items) {
      if (histItem.price <= 0) continue;
      const prodKey = CategoryClassifier.normalize(histItem.name);
      if (!prodKey) continue;

      let marketPrices = pricesByProduct.get(prodKey);
      if (!marketPrices) {
        marketPrices = new Map<string, number[]>();
        pricesByProduct.set(prodKey, marketPrices);
      }
      const arr = marketPrices.get(marketKey);
      if (arr) {
        arr.push(histItem.price);
      } else {
        marketPrices.set(marketKey, [histItem.price]);
      }
    }
  }

  const result = new Map<string, MarketPriceRecommendation[]>();
  for (const [prodKey, marketPrices] of pricesByProduct.entries()) {
    const recs: MarketPriceRecommendation[] = [];
    for (const [marketId, prices] of marketPrices.entries()) {
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const market =
        byId.get(marketId) ??
        ({
          id: marketId,
          name: fallbackMarketNames.get(marketId) ?? 'Mercado',
          categoryOrder: allCategoryIds,
        } satisfies MarketProfile);
      recs.push({ market, averagePrice: avg, lastPrice: prices[0] });
    }
    recs.sort((a, b) => a.averagePrice - b.averagePrice);
    result.set(prodKey, recs);
  }
  return result;
}

export function getMarketRecommendationsForProduct(
  history: PurchaseRecord[],
  markets: MarketProfile[],
  itemName: string,
): MarketPriceRecommendation[] {
  const normalized = CategoryClassifier.normalize(itemName);
  if (!normalized) return [];
  return buildMarketRecommendationsByProduct(history, markets).get(normalized) ?? [];
}

export function computeMarketBargains(
  items: ShoppingItem[],
  recommendationsByProduct: Map<string, MarketPriceRecommendation[]>,
): MarketBargainGroup[] {
  const groupsMap = new Map<string, MarketBargainGroup>();
  for (const item of items) {
    const recs = recommendationsByProduct.get(
      CategoryClassifier.normalize(item.name),
    );
    if (!recs || recs.length < 2) continue;
    const cheapest = recs[0];
    const highest = recs[recs.length - 1];
    if (highest.averagePrice <= cheapest.averagePrice) continue;
    const savingsPercent =
      ((highest.averagePrice - cheapest.averagePrice) / highest.averagePrice) *
      100;
    const bargain: MarketBargainItem = {
      item,
      cheapestPrice: cheapest.averagePrice,
      highestPrice: highest.averagePrice,
      savingsPercent,
    };
    const existing = groupsMap.get(cheapest.market.id);
    if (existing) {
      existing.bargains.push(bargain);
    } else {
      groupsMap.set(cheapest.market.id, {
        market: cheapest.market,
        bargains: [bargain],
      });
    }
  }
  return Array.from(groupsMap.values()).sort(
    (a, b) => b.bargains.length - a.bargains.length,
  );
}
