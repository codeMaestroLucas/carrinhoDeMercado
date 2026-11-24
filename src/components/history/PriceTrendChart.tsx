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
              <stop offset="5%" stopColor="#15803D" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#15803D" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="#8A847A"
            strokeOpacity={0.2}
          />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: '#8A847A', fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#8A847A', fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs shadow-md">
                  <p className="font-mono-tabular font-medium text-[var(--accent-fg)]">
                    {AppFormatters.formatCurrency(point.price)}
                  </p>
                  <p className="text-[var(--text-primary)]">{point.marketName}</p>
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
            stroke="#15803D"
            strokeWidth={2}
            fill="url(#priceTrendFill)"
            dot={{ r: 3, fill: '#15803D', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#15803D' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
