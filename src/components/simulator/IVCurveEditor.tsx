import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, RotateCcw, Minus } from 'lucide-react';
import {
  ComposedChart, Area, Line, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

export interface IVPoint {
  date: string;
  iv: number; // as decimal, e.g. 0.30 = 30%
}

interface IVCurveEditorProps {
  priceData: { date: string; close: number }[];
  ivPoints: IVPoint[];
  riskFreeRate: number;
  onIVPointsChange: (points: IVPoint[]) => void;
  onRiskFreeRateChange: (rate: number) => void;
}

/**
 * Interpolate IV at a given date from sorted IV points.
 */
function interpolateIVAtDate(points: IVPoint[], date: string): number {
  if (points.length === 0) return 0.3;
  if (points.length === 1) return points[0].iv;
  if (date <= points[0].date) return points[0].iv;
  if (date >= points[points.length - 1].date) return points[points.length - 1].iv;

  for (let i = 0; i < points.length - 1; i++) {
    if (date >= points[i].date && date <= points[i + 1].date) {
      const t1 = new Date(points[i].date).getTime();
      const t2 = new Date(points[i + 1].date).getTime();
      const t = new Date(date).getTime();
      if (t2 === t1) return points[i].iv;
      const w = (t - t1) / (t2 - t1);
      return points[i].iv + w * (points[i + 1].iv - points[i].iv);
    }
  }
  return points[points.length - 1].iv;
}

export function IVCurveEditor({
  priceData,
  ivPoints,
  riskFreeRate,
  onIVPointsChange,
  onRiskFreeRateChange,
}: IVCurveEditorProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Sample price data for chart display (max ~120 points)
  const sampledDates = useMemo(() => {
    const step = Math.max(1, Math.floor(priceData.length / 120));
    return priceData.filter((_, i) => i % step === 0 || i === priceData.length - 1);
  }, [priceData]);

  // Build chart data with interpolated IV curve
  const chartData = useMemo(() => {
    const sorted = [...ivPoints].sort((a, b) => a.date.localeCompare(b.date));
    return sampledDates.map(p => ({
      date: p.date,
      close: p.close,
      iv: interpolateIVAtDate(sorted, p.date) * 100,
      // Mark if this date has an IV point
      ivPoint: sorted.find(ip => ip.date === p.date) ? interpolateIVAtDate(sorted, p.date) * 100 : undefined,
    }));
  }, [sampledDates, ivPoints]);

  // Scatter data: only the IV control points
  const scatterData = useMemo(() => {
    return ivPoints.map((p, i) => ({
      date: p.date,
      ivPoint: p.iv * 100,
      idx: i,
    }));
  }, [ivPoints]);

  const handleChartClick = useCallback((e: any) => {
    if (draggingIdx !== null) return;
    if (!e || !e.activeLabel) return;
    const date = e.activeLabel as string;

    // Don't add if too close to existing point
    const existing = ivPoints.find(p => p.date === date);
    if (existing) {
      setSelectedIdx(ivPoints.indexOf(existing));
      return;
    }

    const sorted = [...ivPoints].sort((a, b) => a.date.localeCompare(b.date));
    const newIV = interpolateIVAtDate(sorted, date);
    const newPoints = [...ivPoints, { date, iv: newIV }].sort((a, b) => a.date.localeCompare(b.date));
    onIVPointsChange(newPoints);
    setSelectedIdx(newPoints.findIndex(p => p.date === date));
  }, [ivPoints, onIVPointsChange, draggingIdx]);

  const handleScatterClick = useCallback((data: any) => {
    if (data && data.idx !== undefined) {
      setSelectedIdx(data.idx);
    }
  }, []);

  const handleDeletePoint = useCallback(() => {
    if (selectedIdx === null || ivPoints.length <= 2) return;
    const newPoints = ivPoints.filter((_, i) => i !== selectedIdx);
    onIVPointsChange(newPoints);
    setSelectedIdx(null);
  }, [selectedIdx, ivPoints, onIVPointsChange]);

  const handleFlatIV = useCallback(() => {
    const val = selectedIdx !== null ? ivPoints[selectedIdx].iv : 0.3;
    onIVPointsChange(ivPoints.map(p => ({ ...p, iv: val })));
  }, [ivPoints, selectedIdx, onIVPointsChange]);

  const handleReset = useCallback(() => {
    if (priceData.length === 0) return;
    onIVPointsChange([
      { date: priceData[0].date, iv: 0.3 },
      { date: priceData[priceData.length - 1].date, iv: 0.3 },
    ]);
    setSelectedIdx(null);
  }, [priceData, onIVPointsChange]);

  const handleIVInput = useCallback((val: string) => {
    if (selectedIdx === null) return;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return;
    const newPoints = [...ivPoints];
    newPoints[selectedIdx] = { ...newPoints[selectedIdx], iv: num / 100 };
    onIVPointsChange(newPoints);
  }, [selectedIdx, ivPoints, onIVPointsChange]);

  // Handle mouse drag on chart for IV point vertical adjustment
  const handleMouseDown = useCallback((e: any) => {
    if (e && e.activePayload) {
      const payload = e.activePayload.find((p: any) => p.dataKey === 'ivPoint' && p.value !== undefined);
      if (payload) {
        const date = e.activeLabel;
        const idx = ivPoints.findIndex(p => p.date === date);
        if (idx >= 0) {
          setDraggingIdx(idx);
          setSelectedIdx(idx);
        }
      }
    }
  }, [ivPoints]);

  const handleMouseMove = useCallback((e: any) => {
    if (draggingIdx === null || !e) return;
    // Get chart area bounds to calculate IV from Y position
    const chartWrapper = chartRef.current;
    if (!chartWrapper) return;

    // Use the tooltip coordinate to estimate IV
    if (e.chartY !== undefined) {
      const chartArea = chartWrapper.querySelector('.recharts-cartesian-grid');
      if (!chartArea) return;
      const rect = chartArea.getBoundingClientRect();
      const relY = (e.chartY - 5) / (rect.height);  // normalized 0-1 from top
      // IV axis: assume 0-150% range
      const maxIV = 150;
      const iv = Math.max(1, Math.min(maxIV, maxIV * (1 - relY))) / 100;

      const newPoints = [...ivPoints];
      newPoints[draggingIdx] = { ...newPoints[draggingIdx], iv };
      onIVPointsChange(newPoints);
    }
  }, [draggingIdx, ivPoints, onIVPointsChange]);

  const handleMouseUp = useCallback(() => {
    setDraggingIdx(null);
  }, []);

  useEffect(() => {
    if (draggingIdx !== null) {
      const up = () => setDraggingIdx(null);
      window.addEventListener('mouseup', up);
      return () => window.removeEventListener('mouseup', up);
    }
  }, [draggingIdx]);

  const formatDate = (d: string) => {
    if (!d) return '';
    return d.slice(5); // MM-DD
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Curva Volatilità Implicita</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toolbar */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">IV punto selezionato (%)</Label>
            <Input
              type="number"
              step="1"
              min="1"
              max="300"
              className="w-20 h-8 text-xs"
              value={selectedIdx !== null ? Math.round(ivPoints[selectedIdx].iv * 100) : ''}
              onChange={e => handleIVInput(e.target.value)}
              disabled={selectedIdx === null}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Risk-Free Rate (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="20"
              className="w-20 h-8 text-xs"
              value={Math.round(riskFreeRate * 1000) / 10}
              onChange={e => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onRiskFreeRateChange(v / 100);
              }}
            />
          </div>

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleFlatIV}>
            <Minus className="w-3 h-3 mr-1" />IV Piatta
          </Button>
          <Button
            variant="outline" size="sm" className="h-8 text-xs"
            onClick={handleDeletePoint}
            disabled={selectedIdx === null || ivPoints.length <= 2}
          >
            <Trash2 className="w-3 h-3 mr-1" />Elimina
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleReset}>
            <RotateCcw className="w-3 h-3 mr-1" />Reset
          </Button>
        </div>

        {/* Chart */}
        <div ref={chartRef} className="select-none" style={{ cursor: draggingIdx !== null ? 'ns-resize' : 'crosshair' }}>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart
              data={chartData}
              onClick={handleChartClick}
              onMouseDown={handleMouseDown}
              onMouseMove={draggingIdx !== null ? handleMouseMove : undefined}
              onMouseUp={handleMouseUp}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={formatDate} interval="preserveStartEnd" />
              <YAxis yAxisId="iv" tick={{ fontSize: 9 }} unit="%" domain={[0, 150]} />
              <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 9 }} domain={['dataMin', 'dataMax']} />

              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }}
                formatter={(v: number, name: string) => {
                  if (name === 'close') return [`$${v.toFixed(2)}`, 'Prezzo'];
                  if (name === 'iv') return [`${v.toFixed(1)}%`, 'IV'];
                  return [`${v.toFixed(1)}%`, 'Punto IV'];
                }}
              />

              {/* Price area */}
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="close"
                fill="hsl(var(--primary) / 0.1)"
                stroke="hsl(var(--primary) / 0.3)"
                strokeWidth={1}
              />

              {/* IV interpolated line */}
              <Line
                yAxisId="iv"
                type="monotone"
                dataKey="iv"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={false}
                activeDot={false}
              />

              {/* IV control points */}
              <Scatter
                yAxisId="iv"
                dataKey="ivPoint"
                data={scatterData}
                fill="hsl(var(--chart-2))"
                onClick={handleScatterClick}
                cursor="grab"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground">
          {ivPoints.length} punti IV • Clicca per aggiungere • Trascina verticalmente per modificare • Risk-free: {(riskFreeRate * 100).toFixed(1)}%
        </p>
      </CardContent>
    </Card>
  );
}
