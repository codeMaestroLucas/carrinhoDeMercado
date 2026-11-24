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
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="priceTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00C853" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#00C853" stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-lg dark:border-[#2E3440] dark:bg-[#1E2229]">
                  <p className="font-bold text-[#00C853]">
                    {AppFormatters.formatCurrency(point.price)}
                  </p>
                  <p className="text-[#111827] dark:text-[#F3F4F6]">
                    {point.marketName}
                  </p>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                    {point.dateLabel}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#00C853"
            strokeWidth={2.5}
            fill="url(#priceTrendFill)"
            dot={{ r: 3.5, fill: '#00C853', strokeWidth: 0 }}
            activeDot={{ r: 5.5, fill: '#10B981' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
