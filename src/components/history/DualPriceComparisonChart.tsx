import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProductHistoryAggregate } from '../../services/productHistoryService';
import { AppFormatters } from '../../utils/formatters';

interface DualPriceComparisonChartProps {
  itemA: ProductHistoryAggregate;
  itemB: ProductHistoryAggregate;
}

export function DualPriceComparisonChart({
  itemA,
  itemB,
}: DualPriceComparisonChartProps) {
  const byDate = new Map<
    string,
    { timestamp: number; dateLabel: string; priceA?: number; priceB?: number }
  >();

  for (const occ of itemA.chronologicalPricedOccurrences) {
    const label = AppFormatters.formatShortDate(occ.date);
    const existing = byDate.get(label) ?? {
      timestamp: Date.parse(occ.date),
      dateLabel: label,
    };
    existing.priceA = Number(occ.price.toFixed(2));
    byDate.set(label, existing);
  }

  for (const occ of itemB.chronologicalPricedOccurrences) {
    const label = AppFormatters.formatShortDate(occ.date);
    const existing = byDate.get(label) ?? {
      timestamp: Date.parse(occ.date),
      dateLabel: label,
    };
    existing.priceB = Number(occ.price.toFixed(2));
    byDate.set(label, existing);
  }

  const data = Array.from(byDate.values()).sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  if (data.length === 0) return null;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
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
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs shadow-lg">
                  <p className="font-mono-tabular mb-1 text-[11px] text-[var(--text-muted)]">
                    {label}
                  </p>
                  {payload.map((entry) => (
                    <p
                      key={String(entry.dataKey)}
                      className="flex items-center justify-between gap-3 text-[var(--text-primary)]"
                    >
                      <span>{entry.name}</span>
                      <span className="font-mono-tabular font-semibold">
                        {AppFormatters.formatCurrency(Number(entry.value ?? 0))}
                      </span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Line
            type="monotone"
            dataKey="priceA"
            name={itemA.displayName}
            stroke="var(--accent)"
            strokeWidth={2.2}
            connectNulls
            dot={{ r: 3.5 }}
          />
          <Line
            type="monotone"
            dataKey="priceB"
            name={itemB.displayName}
            stroke="var(--blue)"
            strokeWidth={2.2}
            connectNulls
            dot={{ r: 3.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
