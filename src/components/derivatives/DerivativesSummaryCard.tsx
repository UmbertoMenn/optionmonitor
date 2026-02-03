import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, Target, Layers, Puzzle, BarChart3, ShieldAlert, Rocket, ChevronDown, ChevronUp } from 'lucide-react';
import { Position } from '@/types/portfolio';
import { UnderlyingPrice } from '@/hooks/useUnderlyingPrices';
import { 
  DerivativeCategories,
  GroupedOtherStrategy
} from '@/lib/derivativeStrategies';

interface DerivativesSummaryCardProps {
  categories: DerivativeCategories;
  stockPositions: Position[];
  underlyingPrices: Record<string, UnderlyingPrice>;
  totalCoveredCallContractsByUnderlying: Record<string, number>;
}

// Normalize string for matching (lowercase, remove suffixes, etc.)
function normalizeForMatching(str: string): string {
  return str
    .toUpperCase()
    .replace(/\s+(INC|CORP|LTD|PLC|AG|SA|SPA|ADR|CLASS\s*[A-Z]?)\.?$/gi, '')
    .replace(/^AZ\.\s*/i, '')
    .trim();
}

// Get ticker from position
function getTicker(position: Position | { description?: string; ticker?: string; underlying?: string }): string {
  return position.ticker || position.description?.split(' ')[0] || 'N/A';
}

// Expandable section component
function ExpandableSection({ 
  title, 
  icon: Icon, 
  iconColor,
  titleColor,
  items, 
  renderItem,
  showAlert = false
}: { 
  title: string;
  icon: React.ElementType;
  iconColor: string;
  titleColor?: string;
  items: any[];
  renderItem: (item: any, idx: number) => React.ReactNode;
  showAlert?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const INITIAL_SHOW = 5;
  const hasMore = items.length > INITIAL_SHOW;
  const displayItems = isExpanded ? items : items.slice(0, INITIAL_SHOW);

  if (items.length === 0) return null;

  return (
    <div className="p-3 rounded-lg border border-border bg-background/50">
      <div className="flex items-center gap-2 mb-2">
        {showAlert && <AlertTriangle className="w-4 h-4 text-amber-500" />}
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className={`text-sm font-semibold ${titleColor || ''}`}>{title}</span>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      <div className="space-y-1">
        {displayItems.map((item, idx) => renderItem(item, idx))}
      </div>
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3 mr-1" />
              Mostra meno
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              Mostra altri {items.length - INITIAL_SHOW}
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export function DerivativesSummaryCard({
  categories,
  stockPositions,
  underlyingPrices,
  totalCoveredCallContractsByUnderlying
}: DerivativesSummaryCardProps) {
  
  // ============ 1. Covered Call da vendere ============
  const availableForSale = useMemo(() => {
    const available: { ticker: string; shares: number }[] = [];
    
    // Build a map of total sold call contracts per underlying across ALL sources
    const totalSoldCallsByUnderlying = new Map<string, number>();
    
    // Add Covered Calls
    categories.coveredCalls.forEach(cc => {
      const key = normalizeForMatching(cc.underlying.description || cc.option.underlying || '');
      totalSoldCallsByUnderlying.set(key, (totalSoldCallsByUnderlying.get(key) || 0) + cc.contractsCovered);
    });
    
    // Add Iron Condors (sold calls)
    categories.ironCondors.forEach(ic => {
      const key = normalizeForMatching(ic.underlying);
      totalSoldCallsByUnderlying.set(key, (totalSoldCallsByUnderlying.get(key) || 0) + ic.contracts);
    });
    
    // Add Double Diagonals (sold calls)
    categories.doubleDiagonals.forEach(dd => {
      const key = normalizeForMatching(dd.underlying);
      totalSoldCallsByUnderlying.set(key, (totalSoldCallsByUnderlying.get(key) || 0) + dd.contracts);
    });
    
    // Add Alternative Double Diagonal and other strategies with sold calls
    categories.groupedOtherStrategies.forEach(group => {
      const key = normalizeForMatching(group.underlying);
      group.options.forEach(os => {
        if (os.option.option_type === 'call' && os.option.quantity < 0) {
          totalSoldCallsByUnderlying.set(key, (totalSoldCallsByUnderlying.get(key) || 0) + Math.abs(os.option.quantity));
        }
      });
    });
    
    // Check each stock position
    stockPositions.forEach(stock => {
      const key = normalizeForMatching(stock.description || '');
      const potentialContracts = Math.floor(stock.quantity / 100);
      const soldContracts = totalSoldCallsByUnderlying.get(key) || 0;
      const freeContracts = potentialContracts - soldContracts;
      
      if (freeContracts >= 1) {
        available.push({
          ticker: getTicker(stock),
          shares: freeContracts * 100
        });
      }
    });
    
    return available.sort((a, b) => b.shares - a.shares);
  }, [categories, stockPositions]);
  
  // ============ 2. Call vendute non coperte (Naked Call) ============
  const uncoveredCalls = useMemo(() => {
    const result: { ticker: string; uncoveredContracts: number; strategies: string[] }[] = [];
    
    // Build balance per underlying: owned shares vs (sold calls - bought calls)
    const underlyingBalance = new Map<string, {
      owned: number;
      soldCalls: number;
      boughtCalls: number;
      strategies: Set<string>;
    }>();
    
    // Initialize with stock positions
    stockPositions.forEach(stock => {
      const key = normalizeForMatching(stock.description || '');
      if (!underlyingBalance.has(key)) {
        underlyingBalance.set(key, { owned: 0, soldCalls: 0, boughtCalls: 0, strategies: new Set() });
      }
      underlyingBalance.get(key)!.owned += stock.quantity;
    });
    
    // Count Covered Calls (sold)
    categories.coveredCalls.forEach(cc => {
      const key = normalizeForMatching(cc.underlying.description || cc.option.underlying || '');
      if (!underlyingBalance.has(key)) {
        underlyingBalance.set(key, { owned: 0, soldCalls: 0, boughtCalls: 0, strategies: new Set() });
      }
      underlyingBalance.get(key)!.soldCalls += cc.contractsCovered;
      underlyingBalance.get(key)!.strategies.add('Covered Call');
    });
    
    // Count Iron Condors (sold call + bought call)
    categories.ironCondors.forEach(ic => {
      const key = normalizeForMatching(ic.underlying);
      if (!underlyingBalance.has(key)) {
        underlyingBalance.set(key, { owned: 0, soldCalls: 0, boughtCalls: 0, strategies: new Set() });
      }
      underlyingBalance.get(key)!.soldCalls += ic.contracts;
      underlyingBalance.get(key)!.boughtCalls += ic.contracts;
      underlyingBalance.get(key)!.strategies.add('Iron Condor');
    });
    
    // Count Double Diagonals (sold call + bought call)
    categories.doubleDiagonals.forEach(dd => {
      const key = normalizeForMatching(dd.underlying);
      if (!underlyingBalance.has(key)) {
        underlyingBalance.set(key, { owned: 0, soldCalls: 0, boughtCalls: 0, strategies: new Set() });
      }
      underlyingBalance.get(key)!.soldCalls += dd.contracts;
      underlyingBalance.get(key)!.boughtCalls += dd.contracts;
      underlyingBalance.get(key)!.strategies.add('Double Diagonal');
    });
    
    // Count grouped other strategies
    categories.groupedOtherStrategies.forEach(group => {
      const key = normalizeForMatching(group.underlying);
      if (!underlyingBalance.has(key)) {
        underlyingBalance.set(key, { owned: 0, soldCalls: 0, boughtCalls: 0, strategies: new Set() });
      }
      
      group.options.forEach(os => {
        if (os.option.option_type === 'call') {
          if (os.option.quantity < 0) {
            underlyingBalance.get(key)!.soldCalls += Math.abs(os.option.quantity);
          } else {
            underlyingBalance.get(key)!.boughtCalls += os.option.quantity;
          }
        }
      });
      if (group.strategyName) {
        underlyingBalance.get(key)!.strategies.add(group.strategyName);
      }
    });
    
    // Count Leap Calls (bought)
    categories.leapCalls.forEach(lc => {
      const key = normalizeForMatching(lc.option.underlying || lc.option.description);
      if (!underlyingBalance.has(key)) {
        underlyingBalance.set(key, { owned: 0, soldCalls: 0, boughtCalls: 0, strategies: new Set() });
      }
      underlyingBalance.get(key)!.boughtCalls += lc.contracts;
      underlyingBalance.get(key)!.strategies.add('Leap Call');
    });
    
    // Check balance: floor(owned/100) - (soldCalls - boughtCalls) < 0 → Naked Call
    for (const [key, data] of underlyingBalance) {
      const coveredContracts = Math.floor(data.owned / 100);
      const netSoldCalls = data.soldCalls - data.boughtCalls;
      
      if (netSoldCalls > coveredContracts) {
        const uncovered = netSoldCalls - coveredContracts;
        // Get ticker from the key (first part)
        const ticker = key.split(' ')[0] || key;
        result.push({
          ticker,
          uncoveredContracts: uncovered,
          strategies: Array.from(data.strategies)
        });
      }
    }
    
    return result.sort((a, b) => b.uncoveredContracts - a.uncoveredContracts);
  }, [categories, stockPositions]);
  
  // ============ 3. Covered Call ITM ============
  const coveredCallsITM = useMemo(() => {
    const result: { ticker: string; strike: number; contracts: number }[] = [];
    
    categories.coveredCalls.forEach(cc => {
      const strikePrice = cc.option.strike_price || 0;
      const underlyingPrice = cc.underlying.current_price || 0;
      
      // CALL is ITM when strike < underlying price
      if (underlyingPrice > 0 && strikePrice < underlyingPrice) {
        result.push({
          ticker: getTicker(cc.underlying),
          strike: strikePrice,
          contracts: cc.contractsCovered
        });
      }
    });
    
    return result.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [categories.coveredCalls]);
  
  // ============ 4. Iron Condor IR/OOR ============
  const ironCondorStatus = useMemo(() => {
    const result: { ticker: string; isInRange: boolean }[] = [];
    
    categories.ironCondors.forEach(ic => {
      const underlyingPrice = underlyingPrices[ic.underlying]?.price || 0;
      if (underlyingPrice > 0) {
        const soldPutStrike = ic.soldPut.strike_price || 0;
        const soldCallStrike = ic.soldCall.strike_price || 0;
        const isInRange = underlyingPrice >= soldPutStrike && underlyingPrice <= soldCallStrike;
        
        result.push({
          ticker: ic.underlying.split(' ')[0] || ic.underlying,
          isInRange
        });
      }
    });
    
    return result.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [categories.ironCondors, underlyingPrices]);
  
  // ============ 5. Double Diagonal IR/OOR (include Alternative DD) ============
  const doubleDiagonalStatus = useMemo(() => {
    const result: { ticker: string; isInRange: boolean; isAlternative: boolean }[] = [];
    
    // Regular Double Diagonals
    categories.doubleDiagonals.forEach(dd => {
      const underlyingPrice = underlyingPrices[dd.underlying]?.price || 0;
      if (underlyingPrice > 0) {
        const soldPutStrike = dd.soldPut.strike_price || 0;
        const soldCallStrike = dd.soldCall.strike_price || 0;
        const isInRange = underlyingPrice >= soldPutStrike && underlyingPrice <= soldCallStrike;
        
        result.push({
          ticker: dd.underlying.split(' ')[0] || dd.underlying,
          isInRange,
          isAlternative: false
        });
      }
    });
    
    // Alternative Double Diagonals (from groupedOtherStrategies)
    categories.groupedOtherStrategies
      .filter(g => g.strategyName === 'Alternative Double Diagonal')
      .forEach(group => {
        const underlyingPrice = underlyingPrices[group.underlying]?.price || 0;
        if (underlyingPrice > 0) {
          const soldPut = group.options.find(o => o.option.option_type === 'put' && o.option.quantity < 0);
          const soldCall = group.options.find(o => o.option.option_type === 'call' && o.option.quantity < 0);
          
          if (soldPut && soldCall) {
            const soldPutStrike = soldPut.option.strike_price || 0;
            const soldCallStrike = soldCall.option.strike_price || 0;
            const isInRange = underlyingPrice >= soldPutStrike && underlyingPrice <= soldCallStrike;
            
            result.push({
              ticker: group.underlying.split(' ')[0] || group.underlying,
              isInRange,
              isAlternative: true
            });
          }
        }
      });
    
    return result.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [categories.doubleDiagonals, categories.groupedOtherStrategies, underlyingPrices]);
  
  // ============ 6. Naked Put status ============
  const nakedPutStatus = useMemo(() => {
    const result: { ticker: string; strike: number; contracts: number; isITM: boolean }[] = [];
    
    categories.nakedPuts.forEach(np => {
      const strikePrice = np.option.strike_price || 0;
      const underlyingPrice = np.underlying?.current_price || 0;
      // PUT is ITM when strike > underlying price
      const isITM = underlyingPrice > 0 && strikePrice > underlyingPrice;
      
      result.push({
        ticker: getTicker({ ticker: np.option.ticker, description: np.option.underlying || np.option.description }),
        strike: strikePrice,
        contracts: np.contracts,
        isITM
      });
    });
    
    return result.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [categories.nakedPuts]);
  
  // ============ 7. Leap Call status ============
  const leapCallStatus = useMemo(() => {
    const result: { ticker: string; strike: number; contracts: number; isITM: boolean }[] = [];
    
    categories.leapCalls.forEach(lc => {
      const strikePrice = lc.option.strike_price || 0;
      const underlyingPrice = lc.underlying?.current_price || 0;
      // CALL is ITM when strike < underlying price
      const isITM = underlyingPrice > 0 && strikePrice < underlyingPrice;
      
      result.push({
        ticker: getTicker({ ticker: lc.option.ticker, description: lc.option.underlying || lc.option.description }),
        strike: strikePrice,
        contracts: lc.contracts,
        isITM
      });
    });
    
    return result.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [categories.leapCalls]);
  
  // ============ 8. Altre Strategie IB/OOB/IR/OOR ============
  const otherStrategiesStatus = useMemo(() => {
    const result: { 
      ticker: string; 
      strategyName: string; 
      status: 'IR' | 'OOR' | 'IB' | 'OOB'; 
    }[] = [];
    
    // Strategies that use IR/OOR (range-based)
    const rangeBasedStrategies = ['Short Strangle', 'Put Spread', 'Call Spread', 'Diagonal Put Spread', 'Diagonal Call Spread'];
    
    categories.groupedOtherStrategies
      .filter(g => g.strategyName && g.strategyName !== 'Alternative Double Diagonal')
      .forEach(group => {
        const underlyingPrice = underlyingPrices[group.underlying]?.price || 0;
        if (underlyingPrice <= 0) return;
        
        const strategyName = group.strategyName || 'Strategia';
        const isRangeBased = rangeBasedStrategies.some(s => strategyName.includes(s));
        
        let status: 'IR' | 'OOR' | 'IB' | 'OOB';
        
        if (isRangeBased) {
          // IR/OOR logic
          if (strategyName.includes('Short Strangle')) {
            const soldPut = group.options.find(o => o.option.option_type === 'put' && o.option.quantity < 0);
            const soldCall = group.options.find(o => o.option.option_type === 'call' && o.option.quantity < 0);
            if (soldPut && soldCall) {
              const soldPutStrike = soldPut.option.strike_price || 0;
              const soldCallStrike = soldCall.option.strike_price || 0;
              status = underlyingPrice >= soldPutStrike && underlyingPrice <= soldCallStrike ? 'IR' : 'OOR';
            } else {
              return;
            }
          } else if (strategyName.includes('Put Spread') || strategyName.includes('Diagonal Put Spread')) {
            const soldPut = group.options.find(o => o.option.option_type === 'put' && o.option.quantity < 0);
            if (soldPut) {
              const soldPutStrike = soldPut.option.strike_price || 0;
              status = underlyingPrice >= soldPutStrike ? 'IR' : 'OOR';
            } else {
              return;
            }
          } else if (strategyName.includes('Call Spread') || strategyName.includes('Diagonal Call Spread')) {
            const soldCall = group.options.find(o => o.option.option_type === 'call' && o.option.quantity < 0);
            if (soldCall) {
              const soldCallStrike = soldCall.option.strike_price || 0;
              status = underlyingPrice <= soldCallStrike ? 'IR' : 'OOR';
            } else {
              return;
            }
          } else {
            return;
          }
        } else {
          // IB/OOB logic - simplified: check if we're profitable based on total P/L
          // A negative P/L means we're out of breakeven
          status = group.totalProfitLoss >= 0 ? 'IB' : 'OOB';
        }
        
        result.push({
          ticker: group.underlying.split(' ')[0] || group.underlying,
          strategyName: strategyName.replace('Alternative ', '').replace('Diagonal ', 'Diag. '),
          status
        });
      });
    
    return result.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [categories.groupedOtherStrategies, underlyingPrices]);
  
  // Check if there's anything to show
  const hasContent = availableForSale.length > 0 || 
                     uncoveredCalls.length > 0 || 
                     coveredCallsITM.length > 0 || 
                     ironCondorStatus.length > 0 || 
                     doubleDiagonalStatus.length > 0 || 
                     nakedPutStatus.length > 0 ||
                     leapCallStatus.length > 0 ||
                     otherStrategiesStatus.length > 0;
  
  if (!hasContent) {
    return null;
  }
  
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <CardTitle className="text-xl">Riepilogo Strategie</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* 1. Call non coperte (ALERT) */}
          <ExpandableSection
            title="CALL NON COPERTE"
            icon={AlertTriangle}
            iconColor="text-red-500"
            titleColor="text-red-500"
            items={uncoveredCalls}
            renderItem={(uc, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                <span className="font-medium">{uc.ticker}:</span>
                <span className="text-red-500">{uc.uncoveredContracts} NC</span>
                <span className="text-xs text-muted-foreground truncate">({uc.strategies.join(', ')})</span>
              </div>
            )}
          />
          
          {/* 2. Call vendibili */}
          <ExpandableSection
            title="CALL VENDIBILI"
            icon={TrendingUp}
            iconColor="text-primary"
            items={availableForSale}
            renderItem={(item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.ticker}</span>
                <span className="text-muted-foreground">{item.shares} azioni</span>
              </div>
            )}
          />
          
          {/* 3. Covered Call ITM */}
          <ExpandableSection
            title="COVERED CALL ITM"
            icon={TrendingUp}
            iconColor="text-amber-500"
            titleColor="text-amber-500"
            items={coveredCallsITM}
            showAlert={true}
            renderItem={(cc, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                <span className="font-medium text-amber-500">{cc.ticker}</span>
                <span className="text-muted-foreground">${cc.strike}</span>
                <span className="text-xs">×{cc.contracts}</span>
              </div>
            )}
          />
          
          {/* 4. Iron Condor IR/OOR */}
          <ExpandableSection
            title="IRON CONDOR"
            icon={Target}
            iconColor="text-amber-500"
            items={ironCondorStatus}
            renderItem={(ic, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{ic.ticker}</span>
                <Badge 
                  variant="outline"
                  className={`text-xs ${ic.isInRange 
                    ? 'text-green-500 border-green-500' 
                    : 'text-red-500 border-red-500'}`}
                >
                  {ic.isInRange ? 'IR' : 'OOR'}
                </Badge>
              </div>
            )}
          />
          
          {/* 5. Double Diagonal IR/OOR */}
          <ExpandableSection
            title="DOUBLE DIAGONAL"
            icon={Layers}
            iconColor="text-purple-500"
            items={doubleDiagonalStatus}
            renderItem={(dd, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="font-medium">
                  {dd.ticker}
                  {dd.isAlternative && <span className="text-xs text-muted-foreground ml-0.5">Alt</span>}
                </span>
                <Badge 
                  variant="outline"
                  className={`text-xs ${dd.isInRange 
                    ? 'text-green-500 border-green-500' 
                    : 'text-red-500 border-red-500'}`}
                >
                  {dd.isInRange ? 'IR' : 'OOR'}
                </Badge>
              </div>
            )}
          />
          
          {/* 6. Naked Put */}
          <ExpandableSection
            title="NAKED PUT"
            icon={ShieldAlert}
            iconColor="text-orange-500"
            items={nakedPutStatus}
            renderItem={(np, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{np.ticker}</span>
                <span className="text-muted-foreground">${np.strike}</span>
                <span className="text-xs">×{np.contracts}</span>
                <Badge 
                  variant="outline"
                  className={`text-xs ${np.isITM 
                    ? 'text-red-500 border-red-500' 
                    : 'text-green-500 border-green-500'}`}
                >
                  {np.isITM ? 'ITM' : 'OTM'}
                </Badge>
              </div>
            )}
          />
          
          {/* 7. Leap Call */}
          <ExpandableSection
            title="LEAP CALL"
            icon={Rocket}
            iconColor="text-blue-500"
            items={leapCallStatus}
            renderItem={(lc, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{lc.ticker}</span>
                <span className="text-muted-foreground">${lc.strike}</span>
                <span className="text-xs">×{lc.contracts}</span>
                <Badge 
                  variant="outline"
                  className={`text-xs ${lc.isITM 
                    ? 'text-green-500 border-green-500' 
                    : 'text-red-500 border-red-500'}`}
                >
                  {lc.isITM ? 'ITM' : 'OTM'}
                </Badge>
              </div>
            )}
          />
          
          {/* 8. Altre Strategie */}
          <ExpandableSection
            title="ALTRE STRATEGIE"
            icon={Puzzle}
            iconColor="text-cyan-500"
            items={otherStrategiesStatus}
            renderItem={(os, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{os.ticker}</span>
                <span className="text-xs text-muted-foreground truncate">{os.strategyName}</span>
                <Badge 
                  variant="outline"
                  className={`text-xs ${os.status === 'IR' || os.status === 'IB'
                    ? 'text-green-500 border-green-500' 
                    : 'text-red-500 border-red-500'}`}
                >
                  {os.status}
                </Badge>
              </div>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
