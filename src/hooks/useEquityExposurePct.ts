import { useMemo } from 'react';
import { usePortfolio } from './usePortfolio';
import { useDerivativeOverrides } from './useDerivativeOverrides';
import { useStrategyConfigurations, StrategyConfiguration } from './useStrategyConfigurations';
import { categorizeDerivatives } from '@/lib/derivativeStrategies';
import { analyzePortfolioRisk } from '@/lib/riskCalculator';
import { Position } from '@/types/portfolio';
import { usePortfolioContext, AGGREGATED_PORTFOLIO_ID } from '@/contexts/PortfolioContext';

export interface UseEquityExposurePctOptions {
  includeNakedPut?: boolean;
  includeStrategies?: boolean;
  includeLeapCall?: boolean;
}

export interface EquityExposureResult {
  equityExposurePct: number;
  equityExposureEUR: number;
  assetsTotalEUR: number;
  isLoading: boolean;
  hasData: boolean;
}

export function useEquityExposurePct(options: UseEquityExposurePctOptions = {}): EquityExposureResult {
  const {
    includeNakedPut = true,
    includeStrategies = true,
    includeLeapCall = true
  } = options;
  
  const { positions, summary, isLoading: isLoadingPortfolio } = usePortfolio();
  const { overrides, isLoading: isLoadingOverrides } = useDerivativeOverrides();
  const { configs: strategyConfigs, isLoading: isLoadingConfigs } = useStrategyConfigurations();
  const { selectedPortfolioId } = usePortfolioContext();
  
  const isGlobalAggregate = selectedPortfolioId === AGGREGATED_PORTFOLIO_ID;
  
  const result = useMemo(() => {
    const isLoading = isLoadingPortfolio || isLoadingOverrides || isLoadingConfigs;
    
    if (!positions || positions.length === 0 || !summary || summary.totalValue <= 0) {
      return {
        equityExposurePct: 0.6,
        equityExposureEUR: 0,
        assetsTotalEUR: 0,
        isLoading,
        hasData: false
      };
    }

    let totalStockRisk = 0;
    let totalCommodityRisk = 0;
    let totalNakedPutRisk = 0;
    let totalLeapCallRisk = 0;
    let totalStrategyRisk = 0;

    const analyzePositions = (posArr: Position[], ovr: typeof overrides, cfgs: StrategyConfiguration[]) => {
      const snap = posArr.map(p => ({
        ...p,
        current_price: p.snapshot_price ?? p.current_price,
        market_value: p.snapshot_market_value ?? p.market_value,
      }));
      const derivs = snap.filter(p => p.asset_type === 'derivative');
      const cats = categorizeDerivatives(derivs, snap, ovr, cfgs);
      return analyzePortfolioRisk(snap, cats);
    };

    if (isGlobalAggregate) {
      const byPortfolio = new Map<string, Position[]>();
      positions.forEach(p => {
        if (!byPortfolio.has(p.portfolio_id)) byPortfolio.set(p.portfolio_id, []);
        byPortfolio.get(p.portfolio_id)!.push(p);
      });

      const overridesByPortfolio = new Map<string, typeof overrides>();
      overrides.forEach(o => {
        if (!overridesByPortfolio.has(o.portfolio_id)) overridesByPortfolio.set(o.portfolio_id, []);
        overridesByPortfolio.get(o.portfolio_id)!.push(o);
      });

      const configsByPortfolio = new Map<string, StrategyConfiguration[]>();
      strategyConfigs.forEach(c => {
        if (!configsByPortfolio.has(c.portfolio_id)) configsByPortfolio.set(c.portfolio_id, []);
        configsByPortfolio.get(c.portfolio_id)!.push(c);
      });

      for (const [pid, pPositions] of byPortfolio) {
        const pOverrides = overridesByPortfolio.get(pid) || [];
        const pConfigs = configsByPortfolio.get(pid) || [];
        const analysis = analyzePositions(pPositions, pOverrides, pConfigs);
        totalStockRisk += analysis.totalStockRisk;
        totalCommodityRisk += analysis.totalCommodityRisk;
        totalNakedPutRisk += analysis.totalNakedPutRisk;
        totalLeapCallRisk += analysis.totalLeapCallRisk;
        totalStrategyRisk += analysis.totalStrategyRisk;
      }
    } else {
      const analysis = analyzePositions(positions, overrides, strategyConfigs);
      totalStockRisk = analysis.totalStockRisk;
      totalCommodityRisk = analysis.totalCommodityRisk;
      totalNakedPutRisk = analysis.totalNakedPutRisk;
      totalLeapCallRisk = analysis.totalLeapCallRisk;
      totalStrategyRisk = analysis.totalStrategyRisk;
    }
    
    const grandTotal = 
      totalStockRisk +
      totalCommodityRisk +
      (includeNakedPut ? totalNakedPutRisk : 0) +
      (includeLeapCall ? totalLeapCallRisk : 0) +
      (includeStrategies ? totalStrategyRisk : 0);
    
    const assetsTotalEUR = summary.totalValue;
    let equityExposurePct = grandTotal / assetsTotalEUR;
    equityExposurePct = Math.max(0, Math.min(1, equityExposurePct));
    
    return {
      equityExposurePct,
      equityExposureEUR: grandTotal,
      assetsTotalEUR,
      isLoading,
      hasData: true
    };
  }, [positions, summary, overrides, strategyConfigs, isLoadingPortfolio, isLoadingOverrides, isLoadingConfigs, includeNakedPut, includeStrategies, includeLeapCall, isGlobalAggregate]);
  
  return result;
}
