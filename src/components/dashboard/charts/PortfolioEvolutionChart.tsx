import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { HistoricalDataEntry } from '@/types/historicalData';
import { ViewMode } from '@/components/dashboard/ViewModeSelector';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

type TimeRange = '1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1A' },
  { value: '2Y', label: '2A' },
  { value: '3Y', label: '3A' },
];

function getCutoffDate(timeRange: TimeRange, endDate: Date): Date {
  const cutoffDate = new Date(endDate);

  switch (timeRange) {
    case '1M':
      cutoffDate.setMonth(cutoffDate.getMonth() - 1);
      break;
    case '3M':
      cutoffDate.setMonth(cutoffDate.getMonth() - 3);
      break;
    case '6M':
      cutoffDate.setMonth(cutoffDate.getMonth() - 6);
      break;
    case '1Y':
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
      break;
    case '2Y':
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
      break;
    case '3Y':
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 3);
      break;
  }

  return cutoffDate;
}

/**
 * Format large numbers for Y-axis labels (e.g., 2.1M, 814k)
 */
function formatAxisValue(value: number): string {
  const absValue = Math.abs(value);
  
  if (absValue >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(1);
    // Remove trailing .0
    return formatted.endsWith('.0') 
      ? `${Math.round(value / 1_000_000)}M` 
      : `${formatted}M`;
  }
  
  if (absValue >= 1_000) {
    const formatted = (value / 1_000).toFixed(0);
    return `${formatted}k`;
  }
  
  return value.toFixed(0);
}

interface PortfolioEvolutionChartProps {
  historicalData: HistoricalDataEntry[];
  viewMode: ViewMode;
  currentValue: number;
  currentDate: string | null;
}

interface ChartDataPoint {
  date: string;
  timestamp: number;
  formattedDate: string;
  value: number;
  isCurrent?: boolean;
}

function downsampleData<T extends { timestamp: number }>(
  data: T[],
  maxPoints = 30,
  preserveIndices?: Set<number>
): T[] {
  if (data.length <= maxPoints) return data;
  const result: T[] = [data[0]];
  const step = (data.length - 2) / (maxPoints - 2);
  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(data[Math.round(i * step)]);
  }
  result.push(data[data.length - 1]);
  // Ensure preserved indices are included
  if (preserveIndices) {
    for (const idx of preserveIndices) {
      if (!result.includes(data[idx])) {
        result.push(data[idx]);
      }
    }
    result.sort((a, b) => a.timestamp - b.timestamp);
  }
  return result;
}

function computeTimeTicks(data: { timestamp: number }[], maxTicks = 6): number[] {
  if (data.length === 0) return [];
  if (data.length <= maxTicks) return data.map(d => d.timestamp);
  const min = data[0].timestamp;
  const max = data[data.length - 1].timestamp;
  const step = (max - min) / (maxTicks - 1);
  return Array.from({ length: maxTicks }, (_, i) => min + step * i);
}

function formatTickDate(timestamp: number): string {
  return format(new Date(timestamp), "MMM ''yy", { locale: it });
}

function formatTooltipDate(timestamp: number): string {
  return format(new Date(timestamp), "dd MMM ''yy", { locale: it });
}

function getValueForViewMode(entry: HistoricalDataEntry, viewMode: ViewMode): number {
  switch (viewMode) {
    case 'netting_intrinsic_a':
      return entry.netting_ex_cc_np ?? entry.netting_ex_cc;
    case 'netting_intrinsic_b':
      return entry.netting_intrinsic_b ?? entry.netting_ex_cc_np ?? entry.netting_ex_cc;
    case 'netting_total':
    default:
      return entry.netting_total;
  }
}

export function PortfolioEvolutionChart({
  historicalData,
  viewMode,
  currentValue,
  currentDate,
}: PortfolioEvolutionChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');

  // Latest saved snapshot date (used only to decide whether to append a new point)
  const latestSnapshotDate = useMemo(() => {
    if (historicalData.length === 0) return null;
    return new Date(Math.max(...historicalData.map(d => new Date(d.snapshot_date).getTime())));
  }, [historicalData]);

  const chartData = useMemo(() => {
    if (historicalData.length === 0 && !(currentDate && currentValue > 0)) return [];

    // Sort by date ascending
    const sorted = [...historicalData].sort(
      (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    );

    const data: ChartDataPoint[] = sorted.map((entry) => ({
      date: entry.snapshot_date,
      timestamp: new Date(entry.snapshot_date).getTime(),
      formattedDate: format(parseISO(entry.snapshot_date), "dd MMM ''yy", { locale: it }),
      value: getValueForViewMode(entry, viewMode),
    }));

    // Always reflect the current live value on the chart when available:
    // - if there's already a snapshot for today, OVERRIDE its value with the live one
    // - otherwise, append a new "current" point
    if (currentDate && currentValue > 0) {
      const existingIdx = data.findIndex(d => d.date === currentDate);
      if (existingIdx >= 0) {
        data[existingIdx] = { ...data[existingIdx], value: currentValue, isCurrent: true };
      } else {
        const isNewest = !latestSnapshotDate || new Date(currentDate) >= latestSnapshotDate;
        if (isNewest) {
          data.push({
            date: currentDate,
            timestamp: new Date(currentDate).getTime(),
            formattedDate: format(parseISO(currentDate), "dd MMM ''yy", { locale: it }),
            value: currentValue,
            isCurrent: true,
          });
        }
      }
    }

    // Ensure chronological order as a safety measure
    data.sort((a, b) => a.timestamp - b.timestamp);

    // Anchor the selected window to the newest point actually shown. This keeps
    // historical portfolios usable even when their last snapshot is not today.
    const endDate = new Date(data[data.length - 1].timestamp);
    const cutoffTimestamp = getCutoffDate(timeRange, endDate).getTime();
    const filteredData = data.filter((point) => point.timestamp >= cutoffTimestamp);

    // Downsample for smoother curve
    const currentIdx = filteredData.findIndex(d => d.isCurrent);
    const preserve = currentIdx >= 0 ? new Set([currentIdx]) : undefined;
    return downsampleData(filteredData, 30, preserve);
  }, [historicalData, viewMode, currentValue, currentDate, latestSnapshotDate, timeRange]);

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Nessun dato storico disponibile
      </div>
    );
  }

  // Calculate domain with some padding
  const minValue = Math.min(...chartData.map((d) => d.value));
  const maxValue = Math.max(...chartData.map((d) => d.value));
  const padding = (maxValue - minValue) * 0.1 || maxValue * 0.1;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-end mb-2">
        <div className="flex items-center gap-0.5 border border-border rounded-md overflow-hidden">
          {TIME_RANGES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTimeRange(value)}
              aria-pressed={timeRange === value}
              className={cn(
                'px-2 py-0.5 text-xs transition-colors',
                timeRange === value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
        <XAxis
          dataKey="timestamp"
          type="number"
          domain={['dataMin', 'dataMax']}
          ticks={computeTimeTicks(chartData)}
          tickFormatter={formatTickDate}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={{ stroke: 'hsl(var(--border))' }}
        />
        <YAxis
          domain={[minValue - padding, maxValue + padding]}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={{ stroke: 'hsl(var(--border))' }}
          tickFormatter={formatAxisValue}
          width={50}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number) => [formatCurrency(value), 'Patrimonio']}
          labelFormatter={(ts: number) => `Data: ${formatTooltipDate(ts)}`}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#portfolioGradient)"
          dot={(props) => {
            const { cx, cy, payload, index } = props;
            if (payload?.isCurrent) {
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={6}
                  fill="hsl(var(--primary))"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
              );
            }
            // Show dots only on first and last points
            if (index === 0 || index === chartData.length - 1) {
              return <circle cx={cx} cy={cy} r={3} fill="hsl(var(--primary))" />;
            }
            return <circle cx={cx} cy={cy} r={0} />;
          }}
          activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
        />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
