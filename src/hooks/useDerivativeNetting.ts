import { useMemo } from 'react';
import { Position, PortfolioSummary } from '@/types/portfolio';
import { categorizeDerivatives } from '@/lib/derivativeStrategies';

export interface NettingResult {
  // Netting excluding covered calls and long puts (protezioni)
  nettingExCoveredCall: number;
  // Total netting including all derivatives
  nettingTotal: number;
}

/**
 * Calculates the portfolio value with derivatives netting.
 * 
 * Netting logic:
 * - Sold options (quantity < 0): SUBTRACT (current_price * |quantity| * 100) from portfolio
 *   → Closing a sold option means buying it back, reducing portfolio value
 * - Bought options (quantity > 0): ADD (current_price * quantity * 100) to portfolio
 *   → Closing a bought option means selling it, increasing portfolio value
 * 
 * @param positions All portfolio positions
 * @param summary Portfolio summary with total value
 * @returns Netting values for both calculations
 */
export function useDerivativeNetting(
  positions: Position[],
  summary: PortfolioSummary | null
): NettingResult {
  return useMemo(() => {
    if (!summary || positions.length === 0) {
      return {
        nettingExCoveredCall: summary?.totalValue ?? 0,
        nettingTotal: summary?.totalValue ?? 0,
      };
    }

    const derivatives = positions.filter(p => p.asset_type === 'derivative');
    
    if (derivatives.length === 0) {
      return {
        nettingExCoveredCall: summary.totalValue,
        nettingTotal: summary.totalValue,
      };
    }

    // Categorize derivatives to identify covered calls and long puts
    const categories = categorizeDerivatives(derivatives, positions);
    
    // Create sets of option IDs that should be excluded from netting ex covered call
    const coveredCallIds = new Set(categories.coveredCalls.map(cc => cc.option.id));
    const longPutIds = new Set(categories.longPuts.map(lp => lp.option.id));
    
    // Calculate netting for each derivative
    let totalNetting = 0;
    let nettingExCoveredCallPuts = 0;
    
    for (const derivative of derivatives) {
      const price = derivative.current_price ?? 0;
      const quantity = derivative.quantity;
      const multiplier = 100; // Standard option multiplier
      
      // Netting value: positive for bought options, negative for sold options
      // This is what we'd get/pay if we closed the position
      const nettingValue = price * quantity * multiplier;
      
      totalNetting += nettingValue;
      
      // For netting ex covered call: exclude covered calls and long puts
      const isCoveredCall = coveredCallIds.has(derivative.id);
      const isLongPut = longPutIds.has(derivative.id);
      
      if (!isCoveredCall && !isLongPut) {
        nettingExCoveredCallPuts += nettingValue;
      }
    }
    
    return {
      nettingExCoveredCall: summary.totalValue + nettingExCoveredCallPuts,
      nettingTotal: summary.totalValue + totalNetting,
    };
  }, [positions, summary]);
}
