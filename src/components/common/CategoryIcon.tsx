import {
  Baby,
  CookingPot,
  CupSoda,
  Flower2,
  Grid,
  Leaf,
  PawPrint,
  Recycle,
  Snowflake,
  Sparkles,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import {
  PRODUCT_CATEGORY_MAP,
  type ProductCategoryId,
} from '../../types/shopping';

const ICON_MAP: Record<ProductCategoryId, LucideIcon> = {
  alimentos: Utensils,
  hortifruti: Leaf,
  congelados: Snowflake,
  bebidas: CupSoda,
  limpeza: Sparkles,
  perfumaria_higiene: Flower2,
  bebe_crianca: Baby,
  descartaveis: Recycle,
  pet_shop: PawPrint,
  bazar: CookingPot,
  diversos: Grid,
};

interface CategoryIconProps {
  category: ProductCategoryId;
  size?: number;
  className?: string;
}

export function CategoryIcon({
  category,
  size = 18,
  className = '',
}: CategoryIconProps) {
  const Icon = ICON_MAP[category] ?? Grid;
  return (
    <Icon
      size={size}
      strokeWidth={1.5}
      className={`text-[var(--text-muted)] ${className}`}
    />
  );
}

export function CategoryDot({
  category,
  className = '',
}: {
  category: ProductCategoryId;
  className?: string;
}) {
  const info = PRODUCT_CATEGORY_MAP[category];
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: info?.color ?? '#8A847A' }}
    />
  );
}
