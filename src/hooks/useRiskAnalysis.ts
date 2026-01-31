import { useMemo } from 'react';
import { usePortfolio } from './usePortfolio';
import { useDerivativeOverrides } from './useDerivativeOverrides';
import { categorizeDerivatives } from '@/lib/derivativeStrategies';
import { analyzePortfolioRisk, RiskAnalysis } from '@/lib/riskCalculator';
import { Position } from '@/types/portfolio';

interface UseRiskAnalysisOptions {
  /** Provide external positions (with live prices) instead of using usePortfolio */
  externalPositions?: Position[];
}

export function useRiskAnalysis(options: UseRiskAnalysisOptions = {}): RiskAnalysis & { isLoading: boolean } {
  const { positions: dbPositions, isLoading: isLoadingDb } = usePortfolio();
  const { overrides, isLoading: isLoadingOverrides } = useDerivativeOverrides();
  
  // Use external positions if provided, otherwise fall back to DB positions
  const positions = options.externalPositions ?? dbPositions;
  const isLoading = options.externalPositions ? isLoadingOverrides : (isLoadingDb || isLoadingOverrides);
  
  const analysis = useMemo(() => {
    if (!positions || positions.length === 0) {
      return {
        totalStockRisk: 0,
        totalCommodityRisk: 0,
        totalNakedPutRisk: 0,
        totalLeapCallRisk: 0,
        totalStrategyRisk: 0,
        grandTotal: 0,
        stockDetails: [],
        commodityDetails: [],
        nakedPutDetails: [],
        leapCallDetails: [],
        strategyDetails: []
      };
    }
    
    // Filter derivatives
    const derivatives = positions.filter(p => p.asset_type === 'derivative');
    
    // Categorize derivatives using existing logic WITH overrides
    const categories = categorizeDerivatives(derivatives, positions, overrides);
    
    // Calculate risk analysis
    return analyzePortfolioRisk(positions, categories);
  }, [positions, overrides]);
  
  return {
    ...analysis,
    isLoading,
  };
}
