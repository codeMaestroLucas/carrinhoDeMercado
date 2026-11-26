import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  GitCompareArrows,
  X,
} from 'lucide-react';
import {
  findSimilarProducts,
  type ProductHistoryAggregate,
} from '../../services/productHistoryService';
import { AppFormatters } from '../../utils/formatters';
import { CategoryBadge } from '../common/CategoryIcon';
import { PriceTrendChart } from './PriceTrendChart';

export interface SpatialOriginRect {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius?: number;
}

export interface SpatialOrigin {
  rect: SpatialOriginRect;
  element?: HTMLElement | null;
}

export function captureSpatialOrigin(el: HTMLElement | null): SpatialOrigin | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const computed = typeof window !== 'undefined' ? window.getComputedStyle(el) : null;
  const parsedRadius = computed ? parseFloat(computed.borderRadius) : 16;
  return {
    rect: {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      borderRadius: Number.isFinite(parsedRadius) ? parsedRadius : 16,
    },
    element: el,
  };
}

interface ProductAnalyticsModalProps {
  aggregate: ProductHistoryAggregate;
  allAggregates: ProductHistoryAggregate[];
  origin?: SpatialOrigin | null;
  onCompareWith?: (other: ProductHistoryAggregate) => void;
  onClose: () => void;
}

type SpatialPhase = 'entering' | 'open' | 'closing';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getLiveOriginRect(origin?: SpatialOrigin | null): SpatialOriginRect | null {
  if (!origin) return null;
  if (origin.element && origin.element.isConnected) {
    const r = origin.element.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        borderRadius: origin.rect.borderRadius ?? 16,
      };
    }
  }
  return origin.rect;
}

function computeFlipTransform(
  from: SpatialOriginRect,
  to: DOMRect,
): { transform: string; borderRadius: string } {
  const fromCenterX = from.left + from.width / 2;
  const fromCenterY = from.top + from.height / 2;
  const toCenterX = to.left + to.width / 2;
  const toCenterY = to.top + to.height / 2;

  const dx = fromCenterX - toCenterX;
  const dy = fromCenterY - toCenterY;
  const sx = Math.max(0.24, Math.min(1, from.width / Math.max(1, to.width)));
  const sy = Math.max(0.14, Math.min(1, from.height / Math.max(1, to.height)));

  // Compensate border-radius during scale so corners stay visually crisp
  const avgScale = (sx + sy) / 2;
  const compensatedRadius = Math.min(
    64,
    Math.round((from.borderRadius ?? 16) / Math.max(0.35, avgScale)),
  );

  return {
    transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
    borderRadius: `${compensatedRadius}px`,
  };
}

export function ProductAnalyticsModal({
  aggregate,
  allAggregates,
  origin,
  onCompareWith,
  onClose,
}: ProductAnalyticsModalProps) {
  const similar = findSimilarProducts(aggregate, allAggregates, { limit: 4 });
  const variation = aggregate.variationPercentFromLastTime;

  const sheetRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<SpatialPhase>('entering');
  const [sheetStyle, setSheetStyle] = useState<CSSProperties>({});

  // FLIP Shared Element Expansion: Card -> Detail View
  useLayoutEffect(() => {
    const el = sheetRef.current;
    const reduced = prefersReducedMotion();

    if (!el || reduced) {
      setSheetStyle({
        transform: 'translate3d(0, 0, 0) scale(1, 1)',
        opacity: 1,
        transition: reduced ? 'opacity 140ms ease' : undefined,
      });
      setPhase('open');
      return;
    }

    const toRect = el.getBoundingClientRect();
    const fromRect = getLiveOriginRect(origin);

    const inverted = fromRect
      ? computeFlipTransform(fromRect, toRect)
      : {
          transform: 'translate3d(0, 18px, 0) scale(0.95, 0.95)',
          borderRadius: '24px',
        };

    // Frame 0: position container identically over the origin card
    setSheetStyle({
      transform: inverted.transform,
      borderRadius: inverted.borderRadius,
      opacity: fromRect ? 0.92 : 0,
      transition: 'none',
      willChange: 'transform, opacity, border-radius',
    });

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      // Force layout commit of inverted pose before playing transition
      void el.offsetWidth;
      raf2 = requestAnimationFrame(() => {
        setSheetStyle({
          transform: 'translate3d(0, 0, 0) scale(1, 1)',
          borderRadius: '',
          opacity: 1,
          transition:
            'transform 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1), border-radius 340ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform, opacity, border-radius',
        });
        setPhase('open');
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [origin]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Reversible Spatial Back Navigation: Detail View -> Origin Card
  const handleSpatialClose = useCallback(
    (afterClose?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;

      const reduced = prefersReducedMotion();
      const el = sheetRef.current;

      if (reduced || !el) {
        setPhase('closing');
        onClose();
        afterClose?.();
        return;
      }

      // Reset inner scroll smoothly before collapsing back into the card
      if (el.scrollTop > 0) {
        el.scrollTop = 0;
      }

      const currentRect = el.getBoundingClientRect();
      const targetRect = getLiveOriginRect(origin);
      const collapsed = targetRect
        ? computeFlipTransform(targetRect, currentRect)
        : {
            transform: 'translate3d(0, 16px, 0) scale(0.95, 0.95)',
            borderRadius: '24px',
          };

      setPhase('closing');
      setSheetStyle({
        transform: collapsed.transform,
        borderRadius: collapsed.borderRadius,
        opacity: 0,
        transition:
          'transform 280ms cubic-bezier(0.32, 0, 0.2, 1), opacity 220ms cubic-bezier(0.32, 0, 0.2, 1) 50ms, border-radius 280ms cubic-bezier(0.32, 0, 0.2, 1)',
        willChange: 'transform, opacity, border-radius',
      });

      closeTimerRef.current = setTimeout(() => {
        onClose();
        afterClose?.();
      }, 285);
    },
    [origin, onClose],
  );

  // Close with Escape key (reversible)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSpatialClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSpatialClose]);

  const staggerStyle = (delayMs: number): CSSProperties =>
    ({ '--stagger-delay': `${delayMs}ms` }) as CSSProperties;

  return (
    <div
      data-spatial-phase={phase}
      className={`fixed inset-0 z-50 flex items-end justify-center p-0 transition-[background-color,backdrop-filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:items-center sm:p-4 ${
        phase === 'open'
          ? 'bg-black/45 backdrop-blur-xs'
          : 'bg-black/0 backdrop-blur-none'
      }`}
      onClick={() => handleSpatialClose()}
    >
      <div
        ref={sheetRef}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl origin-center overflow-y-auto rounded-t-[28px] border border-[var(--border-hairline)] bg-[var(--bg-app)] p-6 pb-8 shadow-[var(--shadow-float)] sm:rounded-[28px]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden" />

        {/* Shared Header Element (continuously visible throughout expansion & collapse) */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <CategoryBadge
              category={aggregate.category}
              size={20}
              className="h-11 w-11 shrink-0 rounded-2xl"
            />
            <div className="min-w-0">
              <h2 className="font-display truncate text-xl font-semibold text-[var(--text-primary)]">
                {aggregate.displayName}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                <span className="font-mono-tabular">
                  {aggregate.pricedOccurrences.length}
                </span>{' '}
                {aggregate.pricedOccurrences.length === 1
                  ? 'registro com preço'
                  : 'registros com preço'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSpatialClose()}
            aria-label="Fechar análise"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-95"
          >
            <X size={18} strokeWidth={1.9} />
          </button>
        </div>

        {/* Staggered Secondary Detail Content */}
        <div className="space-y-4">
          {/* Metrics grid */}
          <div
            className="spatial-stagger-item grid grid-cols-3 gap-2.5"
            style={staggerStyle(60)}
          >
            <div className="surface-card p-3.5">
              <p className="text-xs text-[var(--text-muted)]">Menor preço</p>
              <p className="font-mono-tabular mt-1 whitespace-nowrap text-base font-semibold text-[var(--positive)]">
                {aggregate.minPriceOccurrence
                  ? AppFormatters.formatCurrency(
                      aggregate.minPriceOccurrence.price,
                    )
                  : '--'}
              </p>
              {aggregate.minPriceOccurrence && (
                <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                  {aggregate.minPriceOccurrence.marketName}
                </p>
              )}
            </div>

            <div className="surface-card p-3.5">
              <p className="text-xs text-[var(--text-muted)]">Preço médio</p>
              <p className="font-mono-tabular mt-1 whitespace-nowrap text-base font-semibold text-[var(--text-primary)]">
                {AppFormatters.formatCurrency(aggregate.averagePrice)}
              </p>
            </div>

            <div className="surface-card p-3.5">
              <p className="text-xs text-[var(--text-muted)]">Último pago</p>
              <p className="font-mono-tabular mt-1 whitespace-nowrap text-base font-semibold text-[var(--text-primary)]">
                {AppFormatters.formatCurrency(aggregate.lastPrice)}
              </p>
              {variation != null && Math.abs(variation) >= 0.5 && (
                <span
                  className={`font-mono-tabular mt-0.5 inline-flex items-center text-[11px] font-semibold ${
                    variation < 0
                      ? 'text-[var(--positive)]'
                      : 'text-[var(--negative)]'
                  }`}
                >
                  {variation < 0 ? (
                    <ArrowDownRight size={12} strokeWidth={2} />
                  ) : (
                    <ArrowUpRight size={12} strokeWidth={2} />
                  )}
                  {Math.abs(variation).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          {aggregate.marketComparisonInsight && (
            <div
              className="spatial-stagger-item surface-card flex items-center gap-2.5 p-3.5 text-xs font-medium text-[var(--text-primary)]"
              style={staggerStyle(95)}
            >
              <Award
                size={16}
                strokeWidth={1.8}
                className="shrink-0 text-[var(--positive)]"
              />
              <span>{aggregate.marketComparisonInsight}</span>
            </div>
          )}

          {/* Price Trend Chart */}
          {aggregate.chronologicalPricedOccurrences.length >= 2 && (
            <div
              className="spatial-stagger-item surface-card p-4"
              style={staggerStyle(130)}
            >
              <h3 className="font-display mb-3 text-sm font-semibold text-[var(--text-primary)]">
                Evolução de preço
              </h3>
              <PriceTrendChart
                occurrences={aggregate.chronologicalPricedOccurrences}
              />
            </div>
          )}

          {/* Market Ranking */}
          {aggregate.marketRanking.length > 0 && (
            <div
              className="spatial-stagger-item surface-card p-4"
              style={staggerStyle(165)}
            >
              <h3 className="font-display mb-3 text-sm font-semibold text-[var(--text-primary)]">
                Ranking de mercados
              </h3>
              <div className="space-y-2">
                {aggregate.marketRanking.map((m, idx) => (
                  <div
                    key={m.marketName}
                    className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3.5 py-2.5 text-xs"
                  >
                    <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                      <span
                        className={`font-mono-tabular ${
                          idx === 0
                            ? 'text-[var(--positive)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {idx + 1}.
                      </span>
                      {m.marketName}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      Média{' '}
                      <strong className="font-mono-tabular font-semibold text-[var(--positive)]">
                        {AppFormatters.formatCurrency(m.averagePrice)}
                      </strong>{' '}
                      <span className="font-mono-tabular">
                        ({m.purchaseCount}x)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar products */}
          {similar.length > 0 && onCompareWith && (
            <div
              className="spatial-stagger-item surface-card p-4"
              style={staggerStyle(200)}
            >
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <GitCompareArrows
                  size={15}
                  strokeWidth={1.8}
                  className="text-[var(--accent-fg)]"
                />
                <span>Comparar com produto similar</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {similar.map((s) => (
                  <button
                    key={s.product.normalizedKey}
                    type="button"
                    onClick={() =>
                      handleSpatialClose(() => onCompareWith(s.product))
                    }
                    className="btn-secondary h-8 px-3 text-xs"
                  >
                    {s.product.displayName}{' '}
                    <span className="font-mono-tabular text-[var(--text-muted)]">
                      ({AppFormatters.formatCurrency(s.product.lastPrice)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All occurrences */}
          <div
            className="spatial-stagger-item surface-card p-4"
            style={staggerStyle(235)}
          >
            <h3 className="font-display mb-2.5 text-sm font-semibold text-[var(--text-primary)]">
              Registros no histórico
            </h3>
            <div className="divide-y divide-[var(--border-hairline)]">
              {aggregate.occurrences.map((occ, idx) => (
                <div
                  key={`${occ.date}_${idx}`}
                  className="flex items-center justify-between py-2.5 text-xs first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      {occ.marketName}
                    </p>
                    <p className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                      {AppFormatters.formatShortDate(occ.date)}
                    </p>
                  </div>
                  <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                    {AppFormatters.formatCurrency(occ.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
