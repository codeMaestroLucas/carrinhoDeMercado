export type ProductCategoryId =
  | 'alimentos'
  | 'hortifruti'
  | 'congelados'
  | 'bebidas'
  | 'limpeza'
  | 'perfumaria_higiene'
  | 'bebe_crianca'
  | 'descartaveis'
  | 'pet_shop'
  | 'bazar'
  | 'diversos';

export interface ProductCategoryInfo {
  id: ProductCategoryId;
  label: string;
  color: string;
}

export const PRODUCT_CATEGORIES: ProductCategoryInfo[] = [
  { id: 'alimentos', label: 'Alimentos', color: '#198042' },
  { id: 'hortifruti', label: 'Hortifruti', color: '#2DA44E' },
  { id: 'congelados', label: 'Congelados', color: '#0095B6' },
  { id: 'bebidas', label: 'Bebidas', color: '#0071E3' },
  { id: 'limpeza', label: 'Limpeza', color: '#0D9488' },
  { id: 'perfumaria_higiene', label: 'Perfumaria e Higiene', color: '#E14D72' },
  { id: 'bebe_crianca', label: 'Bebê e Criança', color: '#E68A00' },
  { id: 'descartaveis', label: 'Descartáveis', color: '#D97706' },
  { id: 'pet_shop', label: 'PetShop', color: '#A27B5C' },
  { id: 'bazar', label: 'Bazar', color: '#58728A' },
  { id: 'diversos', label: 'Diversos', color: '#86868B' },
];

export const PRODUCT_CATEGORY_MAP: Record<ProductCategoryId, ProductCategoryInfo> =
  Object.fromEntries(PRODUCT_CATEGORIES.map((c) => [c.id, c])) as Record<
    ProductCategoryId,
    ProductCategoryInfo
  >;

const DART_NAME_TO_ID: Record<string, ProductCategoryId> = {
  alimentos: 'alimentos',
  hortifruti: 'hortifruti',
  congelados: 'congelados',
  bebidas: 'bebidas',
  limpeza: 'limpeza',
  perfumariahigiene: 'perfumaria_higiene',
  bebecrianca: 'bebe_crianca',
  descartaveis: 'descartaveis',
  petshop: 'pet_shop',
  bazar: 'bazar',
  diversos: 'diversos',
};

export function categoryFromId(id?: string | null): ProductCategoryId {
  if (!id) return 'diversos';
  const lower = id.trim().toLowerCase();
  if (lower in PRODUCT_CATEGORY_MAP) {
    return lower as ProductCategoryId;
  }
  const normalizedEnumName = lower.replace(/[^a-z]/g, '');
  if (normalizedEnumName in DART_NAME_TO_ID) {
    return DART_NAME_TO_ID[normalizedEnumName];
  }
  if (
    [
      'hortifruti',
      'hortifrúti',
      'vegetais',
      'vegetal',
      'frutas',
      'fruta',
      'legumes',
      'legume',
      'verduras',
      'verdura',
    ].includes(lower)
  ) {
    return 'hortifruti';
  }
  if (lower === 'congelados' || lower === 'congelado') {
    return 'congelados';
  }
  return 'diversos';
}

export function normalizeCategoryOrder(
  order: ProductCategoryId[],
): ProductCategoryId[] {
  const result: ProductCategoryId[] = [];
  for (const cat of order) {
    if (cat in PRODUCT_CATEGORY_MAP && !result.includes(cat)) {
      result.push(cat);
    }
  }
  for (const cat of PRODUCT_CATEGORIES) {
    if (!result.includes(cat.id)) {
      result.push(cat.id);
    }
  }
  return result;
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: ProductCategoryId;
  marketId?: string | null;
  price?: number | null;
  quantity: number;
  unit: string;
  isPriceTotal: boolean;
  isChecked: boolean;
  createdAt: string; // ISO 8601
}

export function getEffectiveTotalAmount(item: Pick<ShoppingItem, 'price' | 'quantity' | 'isPriceTotal'>): number {
  if (item.price == null || item.price <= 0) return 0;
  if (item.isPriceTotal) return item.price;
  return item.price * (item.quantity > 0 ? item.quantity : 1);
}

export function shoppingItemFromJson(json: Record<string, unknown>): ShoppingItem {
  const rawUnit = typeof json.unit === 'string' ? json.unit.trim() : '';
  return {
    id: String(json.id ?? ''),
    name: String(json.name ?? ''),
    category: categoryFromId(typeof json.category === 'string' ? json.category : null),
    marketId: typeof json.marketId === 'string' ? json.marketId : null,
    price: typeof json.price === 'number' ? json.price : null,
    quantity: typeof json.quantity === 'number' && json.quantity > 0 ? Math.trunc(json.quantity) : 1,
    unit: rawUnit.length > 0 ? rawUnit : 'un',
    isPriceTotal: typeof json.isPriceTotal === 'boolean' ? json.isPriceTotal : false,
    isChecked: typeof json.isChecked === 'boolean' ? json.isChecked : false,
    createdAt:
      typeof json.createdAt === 'string' && !Number.isNaN(Date.parse(json.createdAt))
        ? json.createdAt
        : new Date().toISOString(),
  };
}

export interface MarketProfile {
  id: string;
  name: string;
  categoryOrder: ProductCategoryId[];
}

export function marketProfileFromJson(json: Record<string, unknown>): MarketProfile {
  const rawList = Array.isArray(json.categoryOrder)
    ? json.categoryOrder.filter((c): c is string => typeof c === 'string').map(categoryFromId)
    : [];
  return {
    id: String(json.id ?? 'default'),
    name: String(json.name ?? 'Mercado'),
    categoryOrder: normalizeCategoryOrder(rawList),
  };
}

export interface PurchaseHistoryItem {
  name: string;
  category: ProductCategoryId;
  price: number; // total price paid for this item
  unitPrice?: number;
  quantity: number;
  unit: string;
}

export function getEffectiveUnitPrice(
  item: Pick<PurchaseHistoryItem, 'price' | 'unitPrice' | 'quantity'>,
): number {
  if (item.unitPrice != null && item.unitPrice > 0) return item.unitPrice;
  return item.quantity > 0 ? item.price / item.quantity : item.price;
}

export function purchaseHistoryItemFromJson(
  json: Record<string, unknown>,
): PurchaseHistoryItem {
  const qty = typeof json.quantity === 'number' && json.quantity > 0 ? json.quantity : 1.0;
  const pr = typeof json.price === 'number' ? json.price : 0.0;
  const uPrice =
    typeof json.unitPrice === 'number' ? json.unitPrice : qty > 0 ? pr / qty : pr;
  return {
    name: String(json.name ?? ''),
    category: categoryFromId(typeof json.category === 'string' ? json.category : null),
    price: pr,
    unitPrice: uPrice,
    quantity: qty,
    unit: typeof json.unit === 'string' && json.unit.trim().length > 0 ? json.unit : 'un',
  };
}

export interface PurchaseRecord {
  id: string;
  marketId: string;
  marketName: string;
  date: string; // ISO 8601
  items: PurchaseHistoryItem[];
}

export function getPurchaseRecordTotal(record: Pick<PurchaseRecord, 'items'>): number {
  return record.items.reduce((sum, item) => sum + item.price, 0);
}

export function purchaseRecordFromJson(json: Record<string, unknown>): PurchaseRecord {
  const rawItems = Array.isArray(json.items)
    ? json.items
        .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
        .map(purchaseHistoryItemFromJson)
    : [];
  return {
    id: String(json.id ?? ''),
    marketId: typeof json.marketId === 'string' ? json.marketId : 'default',
    marketName: typeof json.marketName === 'string' ? json.marketName : 'Mercado',
    date:
      typeof json.date === 'string' && !Number.isNaN(Date.parse(json.date))
        ? json.date
        : new Date().toISOString(),
    items: rawItems,
  };
}

export interface MarketPriceRecommendation {
  market: MarketProfile;
  averagePrice: number;
  lastPrice: number;
}

export interface ProductVariationItem {
  productName: string;
  category: ProductCategoryId;
  currentPrice: number;
  previousPrice: number;
  variationPercent: number;
  marketName: string;
}

export interface PriceIndexSummary {
  periodLabel: string;
  overallVariationPercent: number;
  totalComparedItems: number;
  increasedCount: number;
  decreasedCount: number;
  stableCount: number;
  topIncreases: ProductVariationItem[];
  topDecreases: ProductVariationItem[];
}

export interface CategorySpendingSummary {
  category: ProductCategoryId;
  totalSpent: number;
  percentage: number;
  itemCount: number;
}

export interface ProductHistoryOccurrence {
  productName: string;
  category: ProductCategoryId;
  price: number;
  unitPrice?: number;
  quantity: number;
  unit: string;
  marketName: string;
  date: string; // ISO 8601
}

export interface MarketProductStats {
  marketName: string;
  averagePrice: number;
  lastPrice: number;
  lastDate: string;
  purchaseCount: number;
}

export interface ScannedReceiptItem {
  name: string;
  price: number;
  unitPrice?: number;
  category?: ProductCategoryId;
  quantity: number;
  unit: string;
  itemIndex?: number;
}

export interface NfceParsedResult {
  items: ScannedReceiptItem[];
  marketName?: string;
  cnpj?: string;
  accessKey?: string;
  date?: string;
  totalAmount?: number;
  stateUf?: string;
  errorMessage?: string;
  rawHtml?: string;
}

export interface PasteListResult {
  addedCount: number;
  skippedDuplicatesCount: number;
}

export interface SharedSpaceStatePayload {
  clientId: string;
  items: ShoppingItem[];
  markets: MarketProfile[];
  selectedMarketId: string;
  history: PurchaseRecord[];
  learnedCategories: Record<string, ProductCategoryId>;
  categoryDictionary: Record<ProductCategoryId, string[]>;
  showCheckedItems: boolean;
}
