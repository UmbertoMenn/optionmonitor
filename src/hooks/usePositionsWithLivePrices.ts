import { useMemo, useEffect } from 'react';
import { usePortfolio } from './usePortfolio';
import { useLivePricesContext, PositionWithLive } from '@/contexts/LivePricesContext';
import { PortfolioSummary, AssetType } from '@/types/portfolio';

/**
 * Calculates portfolio summary from positions with live prices.
 * Derivatives are excluded from total value calculation.
 */
function calculateSummary(positions: PositionWithLive[], cashValue: number): PortfolioSummary {
  const byAssetType = new Map<AssetType, { value: number; profitLoss: number }>();
  
  let totalValue = cashValue;
  let totalProfitLoss = 0;
  
  positions.forEach(position => {
    // Derivatives are excluded from dashboard allocation/legend/total
    if (position.asset_type === 'derivative') {
      return;
    }

    const value = position.market_value || 0;
    const pl = position.profit_loss || 0;

    totalValue += value;
    totalProfitLoss += pl;

    const existing = byAssetType.get(position.asset_type) || { value: 0, profitLoss: 0 };
    byAssetType.set(position.asset_type, {
      value: existing.value + value,
      profitLoss: existing.profitLoss + pl,
    });
  });
  
  // Add cash
  if (cashValue > 0) {
    byAssetType.set('cash', { value: cashValue, profitLoss: 0 });
  }
  
  const byAssetTypeArray = Array.from(byAssetType.entries()).map(([type, data]) => ({
    type,
    value: data.value,
    percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
    profitLoss: data.profitLoss,
  }));
  
  const investedValue = totalValue - cashValue;
  const totalProfitLossPct = investedValue > 0 ? (totalProfitLoss / (investedValue - totalProfitLoss)) * 100 : 0;
  
  return {
    totalValue,
    cashValue,
    investedValue,
    totalProfitLoss,
    totalProfitLossPct,
    byAssetType: byAssetTypeArray,
  };
}

export function usePositionsWithLivePrices() {
  const { 
    portfolio, 
    positions: dbPositions, 
    summary: dbSummary, 
    isLoading: isLoadingPortfolio,
    updatePositions,
    isUpdating,
    updateInitialValue,
    isUpdatingInitialValue,
  } = usePortfolio();
  
  const {
    applyLivePricesToPositions,
    setPositionsForFetch,
    isLoading: isLoadingPrices,
    lastFetched,
    error,
    refresh,
    getPriceForPosition,
    stockPrices,
    optionPrices,
  } = useLivePricesContext();

  // Register positions for live price fetching
  useEffect(() => {
    if (dbPositions.length > 0) {
      setPositionsForFetch(dbPositions);
    }
  }, [dbPositions, setPositionsForFetch]);

  // Apply live prices to positions
  const livePositions = useMemo(() => 
    applyLivePricesToPositions(dbPositions),
    [dbPositions, applyLivePricesToPositions, stockPrices, optionPrices]
  );

  // Recalculate summary with live prices
  const liveSummary = useMemo(() => {
    if (livePositions.length === 0) return dbSummary;
    return calculateSummary(livePositions, portfolio?.cash_value || 0);
  }, [livePositions, portfolio?.cash_value, dbSummary]);

  // Check if any positions have live prices
  const hasLivePrices = livePositions.some(p => p._isLive);

  return {
    portfolio,
    positions: livePositions,
    summary: liveSummary,
    isLoading: isLoadingPortfolio,
    isLoadingPrices,
    lastFetched,
    error,
    refresh,
    hasLivePrices,
    getPriceForPosition,
    // Pass through mutation functions
    updatePositions,
    isUpdating,
    updateInitialValue,
    isUpdatingInitialValue,
  };
}
