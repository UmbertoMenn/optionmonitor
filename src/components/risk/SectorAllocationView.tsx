import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, Building2, Loader2, ChevronDown, BarChart3 } from 'lucide-react';
import { 
  SectorExposure, 
  TopHolding, 
  getSectorColor,
  SECTOR_COLORS 
} from '@/lib/sectorExposure';

interface SectorAllocationViewProps {
  sectorExposure: SectorExposure[];
  topHoldings: TopHolding[];
  grandTotal: number;
  isLoadingETFData: boolean;
  etfCount: number;
  loadedETFCount: number;
  includeDerivatives: boolean;
  onIncludeDerivativesChange: (value: boolean) => void;
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('it-IT', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

export function SectorAllocationView({
  sectorExposure,
  topHoldings,
  grandTotal,
  isLoadingETFData,
  etfCount,
  loadedETFCount,
  includeDerivatives,
  onIncludeDerivativesChange,
}: SectorAllocationViewProps) {
  // Prepare chart data
  const chartData = sectorExposure
    .filter(s => s.percentage >= 1)
    .map(s => ({
      name: s.sector,
      value: s.totalRisk,
      percentage: s.percentage,
      color: getSectorColor(s.sector),
    }));
  
  // Group small sectors into "Other"
  const smallSectors = sectorExposure.filter(s => s.percentage < 1);
  if (smallSectors.length > 0) {
    const otherTotal = smallSectors.reduce((sum, s) => sum + s.totalRisk, 0);
    const otherPercentage = smallSectors.reduce((sum, s) => sum + s.percentage, 0);
    if (otherTotal > 0) {
      chartData.push({
        name: 'Other',
        value: otherTotal,
        percentage: otherPercentage,
        color: SECTOR_COLORS['Other'],
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Total and Controls */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-5 h-5 text-primary" />
              Esposizione Settoriale Totale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold text-primary">
              {formatEUR(grandTotal)}
            </div>
            
            {/* Toggle for derivatives */}
            <div className="flex items-center justify-between">
              <Label htmlFor="include-derivatives-sector" className="text-sm">
                Includi Derivati
              </Label>
              <Switch
                id="include-derivatives-sector"
                checked={includeDerivatives}
                onCheckedChange={onIncludeDerivativesChange}
              />
            </div>
            
            {/* ETF Loading Status */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isLoadingETFData ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Caricamento dati ETF... ({loadedETFCount}/{etfCount})</span>
                </>
              ) : etfCount > 0 ? (
                <>
                  <span className="text-green-500">✓</span>
                  <span>ETF analizzati: {loadedETFCount}/{etfCount}</span>
                </>
              ) : (
                <span>Nessun ETF nel portafoglio</span>
              )}
            </div>
            
            {/* Sector count */}
            <div className="text-sm text-muted-foreground">
              {sectorExposure.length} settori identificati
            </div>
          </CardContent>
        </Card>
        
        {/* Donut Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Allocazione Settoriale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatEUR(value),
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {chartData.slice(0, 6).map((sector) => (
                <div key={sector.name} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sector.color }}
                  />
                  <span className="truncate">{sector.name}</span>
                  <span className="text-muted-foreground ml-auto">
                    {sector.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Sector Details Accordion */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5 text-primary" />
            Dettaglio per Settore
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {sectorExposure.map((sector, index) => (
              <AccordionItem key={sector.sector} value={sector.sector}>
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getSectorColor(sector.sector) }}
                      />
                      <span className="font-medium">{sector.sector}</span>
                      <Badge variant="outline" className="text-xs">
                        {sector.instruments.length} strumenti
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {sector.percentage.toFixed(1)}%
                      </span>
                      <span className="font-medium" style={{ color: getSectorColor(sector.sector) }}>
                        {formatEUR(sector.totalRisk)}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1 pl-6">
                    {sector.instruments.slice(0, 10).map((instrument, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {instrument.isETF ? (
                            <BarChart3 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          ) : (
                            <TrendingUp className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          )}
                          <span className="text-sm truncate">{instrument.name}</span>
                          {instrument.isFromETFDecomposition && instrument.percentage && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {instrument.percentage.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-medium flex-shrink-0">
                          {formatEUR(instrument.riskEUR)}
                        </span>
                      </div>
                    ))}
                    {sector.instruments.length > 10 && (
                      <div className="text-xs text-muted-foreground text-center py-2">
                        + altri {sector.instruments.length - 10} strumenti
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
      
      {/* Top 20 Holdings */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-5 h-5 text-primary" />
            Top 20 Holdings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topHoldings.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {isLoadingETFData ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Caricamento dati holdings ETF...</span>
                </div>
              ) : (
                <span>Nessun dato disponibile sui top holdings degli ETF</span>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {topHoldings.map((holding, index) => (
                <div
                  key={holding.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-sm font-medium text-muted-foreground w-6 text-right">
                      {index + 1}.
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{holding.name}</span>
                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        {holding.sources.slice(0, 3).map((source, idx) => (
                          <span key={idx}>
                            {source.isDirectHolding ? (
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                Diretto
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">
                                via {source.source} ({source.percentage?.toFixed(1)}%)
                              </span>
                            )}
                            {idx < Math.min(2, holding.sources.length - 1) && ', '}
                          </span>
                        ))}
                        {holding.sources.length > 3 && (
                          <span>+{holding.sources.length - 3} altri</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {holding.percentage.toFixed(1)}%
                    </span>
                    <span className="text-sm font-medium text-primary min-w-[80px] text-right">
                      {formatEUR(holding.totalExposure)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
