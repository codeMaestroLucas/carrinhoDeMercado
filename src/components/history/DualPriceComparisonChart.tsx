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
        <LineChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#9CA3AF" strokeOpacity={0.2} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
          />
          <Tooltip
            formatter={(value: number) => AppFormatters.formatCurrency(value)}
            contentStyle={{
              borderRadius: '12px',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Line
            type="monotone"
            dataKey="priceA"
            name={itemA.displayName}
            stroke="#00C853"
            strokeWidth={2.5}
            connectNulls
            dot={{ r: 3.5 }}
          />
          <Line
            type="monotone"
            dataKey="priceB"
            name={itemB.displayName}
            stroke="#3B82F6"
            strokeWidth={2.5}
            connectNulls
            dot={{ r: 3.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
