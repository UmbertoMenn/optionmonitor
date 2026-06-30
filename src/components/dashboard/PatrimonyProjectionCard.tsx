import { useMemo, useState } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import { Position } from '@/types/portfolio';
import { UnderlyingPrice } from '@/hooks/useUnderlyingPrices';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import {
  buildProjectionInputs, buildTimeGrid, projectDeterministic, projectMonteCarlo,
  DEFAULT_MC,
} from '@/lib/portfolioProjection';

interface Props {
  positions: Position[];
  baseValue: number;
  underlyingPrices?: Record<string, UnderlyingPrice>;
}

const fmtEURc = (n: number) =>
  '€' + n.toLocaleString('it-IT', { maximumFractionDigits: 0 });
const fmtEURcompact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return '€' + (n / 1_000_000).toLocaleString('it-IT', { maximumFractionDigits: 2 }) + 'M';
  if (a >= 1_000) return '€' + (n / 1_000).toLocaleString('it-IT', { maximumFractionDigits: 0 }) + 'k';
  return '€' + n.toFixed(0);
};

export function PatrimonyProjectionCard({ positions, baseValue, underlyingPrices }: Props) {
  const [mcVolRates, setMcVolRates] = useState(false);
  const [mcUnderlying, setMcUnderlying] = useState(false);

  const inputs = useMemo(
    () => buildProjectionInputs(positions, baseValue, underlyingPrices),
    [positions, baseValue, underlyingPrices],
  );
  const grid = useMemo(() => buildTimeGrid(inputs.t0, inputs.horizon, 60), [inputs]);
  const deterministic = useMemo(() => projectDeterministic(inputs, grid), [inputs, grid]);

  const mcOn = mcVolRates || mcUnderlying;
  const mc = useMemo(() => {
    if (!mcOn) return null;
    return projectMonteCarlo(inputs, grid, {
      ...DEFAULT_MC,
      enableVolRates: mcVolRates,
      enableUnderlying: mcUnderlying,
    });
  }, [mcOn, mcVolRates, mcUnderlying, inputs, grid]);

  // dataset unico per il grafico
  const data = useMemo(() => deterministic.map((d, i) => {
    const m = mc?.[i];
    return {
      label: d.label,
      patrimony: Math.round(d.patrimony),
      pnlPct: +d.pnlPct.toFixed(2),
      ...(m ? { p5: Math.round(m.p5 ?? 0), p50: Math.round(m.p50 ?? 0), p95: Math.round(m.p95 ?? 0), range: [Math.round(m.p5 ?? 0), Math.round(m.p95 ?? 0)] as [number, number] } : {}),
    };
  }), [deterministic, mc]);

  const last = deterministic[deterministic.length - 1];
  const horizonLabel = grid[grid.length - 1]?.label ?? '';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-medium text-foreground">Evoluzione patrimonio alle scadenze</p>
          <p className="text-xs text-muted-foreground">
            Proiezione fino a {horizonLabel}. Patrimonio finale stimato{' '}
            <span className="font-semibold text-blue-500">{last ? fmtEURc(last.patrimony) : '—'}</span>{' '}
            <span className={last && last.pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}>
              ({last ? (last.pnlPct >= 0 ? '+' : '') + last.pnlPct.toFixed(1) + '%' : ''})
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={mcVolRates} onCheckedChange={setMcVolRates} />
            Monte Carlo: vol &amp; tassi
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={mcUnderlying} onCheckedChange={setMcUnderlying} />
            Monte Carlo: variazione titoli
          </label>
        </div>
      </div>

      <div className="w-full h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              yAxisId="eur"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickFormatter={fmtEURcompact}
              width={56}
              domain={['auto', 'auto']}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
              width={40}
            />
            <RechartsTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as typeof data[number];
                return (
                  <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-xs space-y-0.5">
                    <div className="font-semibold text-foreground">{label}</div>
                    <div className="text-blue-500">Patrimonio: {fmtEURc(row.patrimony)}</div>
                    <div className={row.pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}>
                      P/L: {row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(2)}%
                    </div>
                    {'p5' in row && row.p5 !== undefined && (
                      <div className="text-muted-foreground pt-0.5 border-t border-border/50 mt-0.5">
                        MC p5–p95: {fmtEURc(row.p5!)} … {fmtEURc(row.p95!)}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {mcOn && (
              <Area
                yAxisId="eur"
                dataKey="range"
                stroke="none"
                fill="hsl(217, 91%, 60%)"
                fillOpacity={0.12}
                isAnimationActive={false}
                connectNulls
              />
            )}
            <Line
              yAxisId="eur"
              type="monotone"
              dataKey="patrimony"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="Patrimonio"
            />
            {mcOn && (
              <Line
                yAxisId="eur"
                type="monotone"
                dataKey="p50"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
                name="MC mediana"
              />
            )}
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="pnlPct"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              name="P/L %"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> patrimonio (€)</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 inline-block" style={{ background: 'hsl(142, 71%, 45%)' }} /> P/L %</span>
        {(inputs.unparsedBonds.length > 0 || inputs.derivsNoUnderlying.length > 0) && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-amber-500 cursor-help ml-auto">
                  <Info className="w-3 h-3" /> {inputs.unparsedBonds.length + inputs.derivsNoUnderlying.length} pos. tenute piatte
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px] text-xs">
                {inputs.unparsedBonds.length > 0 && (
                  <div className="mb-1">
                    <div className="font-semibold">Bond senza cedola/scadenza deducibili (tenuti al valore corrente, niente cedole):</div>
                    <ul className="list-disc pl-4">{inputs.unparsedBonds.slice(0, 6).map((b, i) => <li key={i}>{b}</li>)}</ul>
                  </div>
                )}
                {inputs.derivsNoUnderlying.length > 0 && (
                  <div>
                    <div className="font-semibold">Derivati senza prezzo sottostante (nessun decadimento):</div>
                    <ul className="list-disc pl-4">{inputs.derivsNoUnderlying.slice(0, 6).map((b, i) => <li key={i}>{b}</li>)}</ul>
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug">
        Per ogni mese da oggi fino alla scadenza massima tra bond e derivati: i derivati sono
        rivalutati al market value tramite Black-Scholes inverso (IV implicita dal prezzo
        attuale, poi repricing con vita residua decrescente → il premio temporale scende); i
        bond convergono al valore di rimborso (pull-to-par) e le cedole staccate incrementano il
        patrimonio. Azioni/ETF/cash restano costanti nello scenario base.
      </p>
    </div>
  );
}
