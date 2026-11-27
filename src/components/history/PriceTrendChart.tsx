import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProductHistoryOccurrence } from '../../types/shopping';
import { AppFormatters } from '../../utils/formatters';
import {
  CHART_AXIS_TICK_STYLE,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_CLASS,
} from './chartTheme';

interface PriceTrendChartProps {
  occurrences: ProductHistoryOccurrence[];
}

export function PriceTrendChart({ occurrences }: PriceTrendChartProps) {
  const gradientId = useId();
  if (occurrences.length === 0) return null;

  const data = occurrences.map((occ) => ({
    label: AppFormatters.formatShortDate(occ.date),
    price: occ.price,
    market: occ.marketName,
    fullDate: AppFormatters.formatDate(occ.date),
  }));

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...CHART_GRID_PROPS} />
          <XAxis
            dataKey="label"
            tick={CHART_AXIS_TICK_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={CHART_AXIS_TICK_STYLE}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `R$${Number(v).toFixed(0)}`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const p = payload[0].payload as {
                price: number;
                market: string;
                fullDate: string;
              };
              return (
                <div className={CHART_TOOLTIP_CLASS}>
                  <p className="font-bold text-[var(--accent-fg)]">
                    {AppFormatters.formatCurrency(p.price)}
                  </p>
                  <p className="text-[var(--text-primary)] font-medium mt-0.5">
                    {p.market}
                  </p>
                  <p className="text-[var(--text-muted)] text-[10px]">
                    {p.fullDate}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="var(--accent)"
            strokeWidth={2.5}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 5, fill: 'var(--accent)', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
