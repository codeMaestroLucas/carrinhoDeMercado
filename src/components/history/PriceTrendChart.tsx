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

interface PriceTrendChartProps {
  occurrences: ProductHistoryOccurrence[];
}

export function PriceTrendChart({ occurrences }: PriceTrendChartProps) {
  if (occurrences.length === 0) return null;

  const data = occurrences.map((occ) => ({
    dateLabel: AppFormatters.formatShortDate(occ.date),
    price: Number(occ.price.toFixed(2)),
    marketName: occ.marketName,
  }));

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="priceTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="#86868B"
            strokeOpacity={0.18}
          />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: '#86868B', fontFamily: 'ui-monospace, SF Mono, Geist Mono, monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#86868B', fontFamily: 'ui-monospace, SF Mono, Geist Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs shadow-lg">
                  <p className="font-mono-tabular font-semibold text-[var(--accent-fg)]">
                    {AppFormatters.formatCurrency(point.price)}
                  </p>
                  <p className="mt-0.5 font-medium text-[var(--text-primary)]">
                    {point.marketName}
                  </p>
                  <p className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                    {point.dateLabel}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="var(--accent)"
            strokeWidth={2.2}
            fill="url(#priceTrendFill)"
            dot={{ r: 3.5, fill: 'var(--accent)', strokeWidth: 0 }}
            activeDot={{ r: 5.5, fill: 'var(--accent)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
