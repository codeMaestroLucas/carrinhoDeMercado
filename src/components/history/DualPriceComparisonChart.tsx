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
import {
  CHART_AXIS_TICK_STYLE,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_CLASS,
} from './chartTheme';

interface DualPriceComparisonChartProps {
  itemA: ProductHistoryAggregate;
  itemB: ProductHistoryAggregate;
}

interface DualChartPoint {
  dateKey: string;
  label: string;
  timestamp: number;
  priceA?: number;
  priceB?: number;
}

function appendSeries(
  byDate: Map<string, DualChartPoint>,
  occurrences: ProductHistoryAggregate['chronologicalPricedOccurrences'],
  field: 'priceA' | 'priceB',
) {
  for (const occ of occurrences) {
    const parsedTime = Date.parse(occ.date);
    const dateKey = Number.isNaN(parsedTime) ? occ.date : occ.date.slice(0, 10);
    const existing = byDate.get(dateKey) ?? {
      dateKey,
      label: AppFormatters.formatShortDate(occ.date),
      timestamp: Number.isNaN(parsedTime) ? 0 : parsedTime,
    };
    existing[field] = occ.price;
    byDate.set(dateKey, existing);
  }
}

export function DualPriceComparisonChart({
  itemA,
  itemB,
}: DualPriceComparisonChartProps) {
  const byDate = new Map<string, DualChartPoint>();
  appendSeries(byDate, itemA.chronologicalPricedOccurrences, 'priceA');
  appendSeries(byDate, itemB.chronologicalPricedOccurrences, 'priceB');

  const data = Array.from(byDate.values()).sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  if (data.length === 0) return null;

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
              const point = payload[0].payload as { label: string };
              return (
                <div className={CHART_TOOLTIP_CLASS}>
                  <p className="font-semibold text-[var(--text-primary)] mb-1">
                    {point.label}
                  </p>
                  {payload.map((entry) => (
                    <p
                      key={String(entry.dataKey)}
                      className="font-medium"
                      style={{ color: entry.color }}
                    >
                      {entry.name}: {AppFormatters.formatCurrency(Number(entry.value))}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
          />
          <Line
            type="monotone"
            dataKey="priceA"
            name={itemA.displayName}
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={{ r: 3.5 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="priceB"
            name={itemB.displayName}
            stroke="var(--blue)"
            strokeWidth={2.5}
            dot={{ r: 3.5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
