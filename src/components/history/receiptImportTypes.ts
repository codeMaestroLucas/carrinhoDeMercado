import type { ProductCategoryId, ScannedReceiptItem } from '../../types/shopping';
import { AppFormatters } from '../../utils/formatters';

export interface EditableReceiptItem {
  id: string;
  name: string;
  category: ProductCategoryId;
  quantity: number;
  quantityStr: string;
  unit: string;
  price: number;
  priceStr: string;
  unitPrice?: number;
  itemIndex?: number;
}

export function toEditableItem(
  item: ScannedReceiptItem,
  index: number,
  predictCategoryFn: (name: string) => ProductCategoryId,
): EditableReceiptItem {
  const qty = item.quantity > 0 ? item.quantity : 1;
  const unit = item.unit ? AppFormatters.normalizeUnit(item.unit) : 'un';
  const price =
    typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0
      ? item.price
      : 0;

  return {
    id: `rcpt-item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    name: item.name,
    category: item.category ?? predictCategoryFn(item.name),
    quantity: qty,
    quantityStr:
      qty === Math.round(qty) ? String(qty) : qty.toString().replace('.', ','),
    unit,
    price,
    priceStr: price > 0 ? AppFormatters.formatPriceInput(price) : '',
    unitPrice: item.unitPrice,
    itemIndex: item.itemIndex ?? index + 1,
  };
}
