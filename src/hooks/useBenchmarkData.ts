import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useCallback } from 'react';
import { HistoricalDataEntry } from '@/types/historicalData';
import { ViewMode } from '@/components/dashboard/ViewModeSelector';

interface BenchmarkPrice {
  ticker: string;
  price_date: string;
  close_price: number;
}

export interface StaleTickerDetail {
  lastDate: string;
  daysDiff: number;
}

export interface BenchmarkDataGap {
  date: string;
  missingTickers: string[];
  staleTickers: string[];
  staleDetails: Record<string, StaleTickerDetail>;
}

export interface BenchmarkStaleSummary {
  ticker: string;
  lastDate: string;
  daysDiff: number;
}

// Benchmark tickers
const EQUITY_BENCHMARKS = ['SPY', 'QQQ'] as const;
const BOND_TICKER = 'AGG';
const EURUSD_TICKER = 'EURUSD=X';
const ALL_TICKERS = [...EQUITY_BENCHMARKS, BOND_TICKER, EURUSD_TICKER] as const;

// Pagination settings
const PAGE_SIZE = 1000;

/**
 * Fetch all benchmark prices with pagination to avoid the 1000-row limit
 */
async function fetchAllBenchmarkPrices(from: string, to: string): Promise<BenchmarkPrice[]> {
  const allPrices: BenchmarkPrice[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('benchmark_prices')
      .select('ticker, price_date, close_price')
      .gte('price_date', from)
      .lte('price_date', to)
      .order('price_date', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allPrices.push(...(data as BenchmarkPrice[]));
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  console.log(`[Benchmark] Fetched ${allPrices.length} total price records for range ${from} to ${to}`);
  
  // Log max date per ticker for debugging
  const maxDates: Record<string, string> = {};
  allPrices.forEach(p => {
    if (!maxDates[p.ticker] || p.price_date > maxDates[p.ticker]) {
      maxDates[p.ticker] = p.price_date;
    }
  });
  console.log('[Benchmark] Max price_date per ticker:', maxDates);

  return allPrices;
}

// Note: getEquityExposure and selectBenchmarkWeight are deprecated.
// The benchmark now uses the real equity exposure percentage from useEquityExposurePct hook.

export function useBenchmarkData(
  historicalData: HistoricalDataEntry[],
  viewMode: ViewMode,
  currentDate?: string | null,
  equityExposurePct?: number | null,
  usdExposurePct?: number | null,
  currencyAdjusted?: boolean
) {
  const queryClient = useQueryClient();

  // Get date range from historical data
  const dateRange = useMemo(() => {
    if (historicalData.length === 0) return null;
    
    const dates = historicalData.map(h => new Date(h.snapshot_date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    let maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Extend to current date if provided and later than last snapshot
    if (currentDate) {
      const current = new Date(currentDate);
      if (current > maxDate) {
        maxDate = current;
      }
    }
    
    // Extend range slightly for buffer
    minDate.setDate(minDate.getDate() - 7);
    
    return {
      from: minDate.toISOString().split('T')[0],
      to: maxDate.toISOString().split('T')[0],
    };
  }, [historicalData, currentDate]);

  // Fetch benchmark prices with pagination
  const { data: benchmarkPrices, isLoading, refetch } = useQuery({
    queryKey: ['benchmark-prices', dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!dateRange) return [];
      return fetchAllBenchmarkPrices(dateRange.from, dateRange.to);
    },
    enabled: !!dateRange,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Refresh benchmark data from the server
  const refreshBenchmark = useCallback(async () => {
    try {
      console.log('[Benchmark] Triggering refresh from update-benchmark-prices edge function...');
      const { data, error } = await supabase.functions.invoke('update-benchmark-prices', {
        body: { backfill: false },
      });
      
      if (error) {
        console.error('[Benchmark] Refresh failed:', error);
        throw error;
      }
      
      console.log('[Benchmark] Refresh result:', data);
      
      // Invalidate the query to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['benchmark-prices'] });
      
      return data;
    } catch (err) {
      console.error('[Benchmark] Error refreshing benchmark:', err);
      throw err;
    }
  }, [queryClient]);

  // Calculate benchmark returns aligned with historical snapshots
  const { benchmarkReturns, dataGaps, staleSummary } = useMemo(() => {
    if (!benchmarkPrices || benchmarkPrices.length === 0 || historicalData.length < 2) {
      return { benchmarkReturns: [], dataGaps: [], staleSummary: [] };
    }

    // Group prices by ticker and date
    const pricesByTicker: Record<string, Record<string, number>> = {};
    benchmarkPrices.forEach(p => {
      if (!pricesByTicker[p.ticker]) pricesByTicker[p.ticker] = {};
      pricesByTicker[p.ticker][p.price_date] = p.close_price;
    });

    // Calculate last fetched date per ticker for staleness detection
    const lastFetchedDateByTicker: Record<string, string> = {};
    ALL_TICKERS.forEach(ticker => {
      const prices = pricesByTicker[ticker];
      if (prices) {
        const sortedDates = Object.keys(prices).sort();
        lastFetchedDateByTicker[ticker] = sortedDates[sortedDates.length - 1] || '';
      }
    });

    // Sort historical data
    const sortedHistory = [...historicalData].sort(
      (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    );

    // Track data gaps
    const gaps: BenchmarkDataGap[] = [];

    // Find the closest benchmark price for a given date
    const getClosestPrice = (ticker: string, targetDate: string): { 
      price: number | null; 
      matchedDate: string | null;
      isStale: boolean;
      daysDiff: number;
    } => {
      const prices = pricesByTicker[ticker];
      if (!prices) return { price: null, matchedDate: null, isStale: true, daysDiff: -1 };
      
      // Try exact match first
      if (prices[targetDate]) {
        return { price: prices[targetDate], matchedDate: targetDate, isStale: false, daysDiff: 0 };
      }
      
      // Find closest date before target
      const sortedDates = Object.keys(prices).sort();
      for (let i = sortedDates.length - 1; i >= 0; i--) {
        if (sortedDates[i] <= targetDate) {
          const priceDate = new Date(sortedDates[i]);
          const target = new Date(targetDate);
          const daysDiff = Math.floor((target.getTime() - priceDate.getTime()) / (1000 * 60 * 60 * 24));
          // Consider stale if more than 7 days old
          return { 
            price: prices[sortedDates[i]], 
            matchedDate: sortedDates[i],
            isStale: daysDiff > 7,
            daysDiff 
          };
        }
      }
      
      // Fallback to first available (definitely stale)
      if (sortedDates.length > 0) {
        const priceDate = new Date(sortedDates[0]);
        const target = new Date(targetDate);
        const daysDiff = Math.floor((target.getTime() - priceDate.getTime()) / (1000 * 60 * 60 * 24));
        return { price: prices[sortedDates[0]], matchedDate: sortedDates[0], isStale: true, daysDiff: Math.abs(daysDiff) };
      }
      
      return { price: null, matchedDate: null, isStale: true, daysDiff: -1 };
    };

    // Helper to get equity/USD pct with correct fallback (0 is valid, only null/undefined triggers fallback)
    const getEquityPct = (entry: typeof sortedHistory[0]): number => {
      const val = entry.equity_exposure_pct;
      return val != null && val >= 0 ? val : (equityExposurePct ?? 0.6);
    };
    const getUsdPct = (entry: typeof sortedHistory[0]): number => {
      const val = entry.usd_exposure_pct;
      return val != null && val >= 0 ? val : (usdExposurePct ?? 0.8);
    };

    // Calculate returns using PERIOD-BY-PERIOD multiplicative composition
    const returns: Array<{
      date: string;
      equityReturn: number;
      bondReturn: number;
      scaledReturn: number;
      eurusdVariation?: number;
      equityPctUsed?: number;
      usdPctUsed?: number;
    }> = [];

    let cumulativeFactor = 1.0;
    // Track cumulative equity/bond returns from first point for tooltip display
    let cumulativeEquityFactor = 1.0;
    let cumulativeBondFactor = 1.0;
    let cumulativeEurusdFactor = 1.0;

    sortedHistory.forEach((entry, index) => {
      if (index === 0) {
        returns.push({
          date: entry.snapshot_date,
          equityReturn: 0,
          bondReturn: 0,
          scaledReturn: 0,
          eurusdVariation: 0,
          equityPctUsed: 0,
        });
        return;
      }

      const prevEntry = sortedHistory[index - 1];
      const prevDate = prevEntry.snapshot_date;
      const currDate = entry.snapshot_date;
      const missingTickers: string[] = [];
      const staleTickers: string[] = [];
      const staleDetails: Record<string, StaleTickerDetail> = {};

      // Calculate PERIOD equity returns (not cumulative)
      const equityPeriodReturns: number[] = [];
      EQUITY_BENCHMARKS.forEach(ticker => {
        const prevResult = getClosestPrice(ticker, prevDate);
        const currResult = getClosestPrice(ticker, currDate);
        if (prevResult.price && currResult.price) {
          equityPeriodReturns.push((currResult.price - prevResult.price) / prevResult.price);
          if (currResult.isStale && currResult.matchedDate) {
            staleTickers.push(ticker);
            staleDetails[ticker] = { lastDate: currResult.matchedDate, daysDiff: currResult.daysDiff };
          }
        } else {
          missingTickers.push(ticker);
        }
      });

      const avgEquityPeriodReturn = equityPeriodReturns.length > 0
        ? equityPeriodReturns.reduce((a, b) => a + b, 0) / equityPeriodReturns.length
        : 0;

      // Calculate PERIOD bond return
      const bondPrevResult = getClosestPrice(BOND_TICKER, prevDate);
      const bondCurrResult = getClosestPrice(BOND_TICKER, currDate);
      let bondPeriodReturn = 0;
      if (bondPrevResult.price && bondCurrResult.price) {
        bondPeriodReturn = (bondCurrResult.price - bondPrevResult.price) / bondPrevResult.price;
        if (bondCurrResult.isStale && bondCurrResult.matchedDate) {
          staleTickers.push(BOND_TICKER);
          staleDetails[BOND_TICKER] = { lastDate: bondCurrResult.matchedDate, daysDiff: bondCurrResult.daysDiff };
        }
      } else if (!bondCurrResult.price) {
        missingTickers.push(BOND_TICKER);
      }

      if (missingTickers.length > 0 || staleTickers.length > 0) {
        gaps.push({ date: currDate, missingTickers, staleTickers, staleDetails });
      }

      // Weight from PREVIOUS point (determines benchmark allocation for this period)
      const equityPct = getEquityPct(prevEntry);

      // Weighted period return
      let periodReturn = equityPct * avgEquityPeriodReturn + (1 - equityPct) * bondPeriodReturn;

      // Currency adjustment per-period
      let eurusdPeriodVariation = 0;
      const usdPct = getUsdPct(prevEntry);
      if (currencyAdjusted && usdPct > 0) {
        const eurusdPrevResult = getClosestPrice(EURUSD_TICKER, prevDate);
        const eurusdCurrResult = getClosestPrice(EURUSD_TICKER, currDate);
        if (eurusdPrevResult.price && eurusdCurrResult.price) {
          eurusdPeriodVariation = (eurusdCurrResult.price / eurusdPrevResult.price) - 1;
          periodReturn = periodReturn - (usdPct * eurusdPeriodVariation);
        }
      }

      // Multiplicative composition
      cumulativeFactor *= (1 + periodReturn);
      cumulativeEquityFactor *= (1 + avgEquityPeriodReturn);
      cumulativeBondFactor *= (1 + bondPeriodReturn);
      cumulativeEurusdFactor *= (1 + eurusdPeriodVariation);

      returns.push({
        date: currDate,
        equityReturn: (cumulativeEquityFactor - 1) * 100,
        bondReturn: (cumulativeBondFactor - 1) * 100,
        scaledReturn: (cumulativeFactor - 1) * 100,
        eurusdVariation: (cumulativeEurusdFactor - 1) * 100,
        equityPctUsed: equityPct,
        usdPctUsed: currencyAdjusted ? usdPct : undefined,
      });
    });

    // Add current date point if provided and not already in returns
    if (currentDate && !returns.find(r => r.date === currentDate)) {
      const lastEntry = sortedHistory[sortedHistory.length - 1];
      const lastDate = lastEntry.snapshot_date;
      const missingTickers: string[] = [];
      const staleTickers: string[] = [];
      const staleDetails: Record<string, StaleTickerDetail> = {};

      // Period equity returns from last snapshot to current
      const equityPeriodReturns: number[] = [];
      EQUITY_BENCHMARKS.forEach(ticker => {
        const prevResult = getClosestPrice(ticker, lastDate);
        const currResult = getClosestPrice(ticker, currentDate);
        if (prevResult.price && currResult.price) {
          equityPeriodReturns.push((currResult.price - prevResult.price) / prevResult.price);
          if (currResult.isStale && currResult.matchedDate) {
            staleTickers.push(ticker);
            staleDetails[ticker] = { lastDate: currResult.matchedDate, daysDiff: currResult.daysDiff };
          }
        } else {
          missingTickers.push(ticker);
        }
      });

      const avgEquityPeriodReturn = equityPeriodReturns.length > 0
        ? equityPeriodReturns.reduce((a, b) => a + b, 0) / equityPeriodReturns.length
        : 0;

      // Period bond return
      const bondPrevResult = getClosestPrice(BOND_TICKER, lastDate);
      const bondCurrResult = getClosestPrice(BOND_TICKER, currentDate);
      let bondPeriodReturn = 0;
      if (bondPrevResult.price && bondCurrResult.price) {
        bondPeriodReturn = (bondCurrResult.price - bondPrevResult.price) / bondPrevResult.price;
        if (bondCurrResult.isStale && bondCurrResult.matchedDate) {
          staleTickers.push(BOND_TICKER);
          staleDetails[BOND_TICKER] = { lastDate: bondCurrResult.matchedDate, daysDiff: bondCurrResult.daysDiff };
        }
      } else if (!bondCurrResult.price) {
        missingTickers.push(BOND_TICKER);
      }

      if (missingTickers.length > 0 || staleTickers.length > 0) {
        gaps.push({ date: currentDate, missingTickers, staleTickers, staleDetails });
      }

      // Use last snapshot's exposure
      const equityPct = getEquityPct(lastEntry);
      const usdPct = getUsdPct(lastEntry);

      let periodReturn = equityPct * avgEquityPeriodReturn + (1 - equityPct) * bondPeriodReturn;

      let eurusdPeriodVariation = 0;
      if (currencyAdjusted && usdPct > 0) {
        const eurusdPrevResult = getClosestPrice(EURUSD_TICKER, lastDate);
        const eurusdCurrResult = getClosestPrice(EURUSD_TICKER, currentDate);
        if (eurusdPrevResult.price && eurusdCurrResult.price) {
          eurusdPeriodVariation = (eurusdCurrResult.price / eurusdPrevResult.price) - 1;
          periodReturn = periodReturn - (usdPct * eurusdPeriodVariation);
        }
      }

      const finalFactor = cumulativeFactor * (1 + periodReturn);
      const finalEquityFactor = cumulativeEquityFactor * (1 + avgEquityPeriodReturn);
      const finalBondFactor = cumulativeBondFactor * (1 + bondPeriodReturn);
      const finalEurusdFactor = cumulativeEurusdFactor * (1 + eurusdPeriodVariation);

      returns.push({
        date: currentDate,
        equityReturn: (finalEquityFactor - 1) * 100,
        bondReturn: (finalBondFactor - 1) * 100,
        scaledReturn: (finalFactor - 1) * 100,
        eurusdVariation: (finalEurusdFactor - 1) * 100,
        equityPctUsed: equityPct,
        usdPctUsed: currencyAdjusted ? usdPct : undefined,
      });
    }

    // Calculate stale summary (global overview for the most recent target date)
    // Exclude EURUSD from staleness warnings as it's internal
    const targetDate = currentDate || dateRange?.to || '';
    const summary: BenchmarkStaleSummary[] = [];
    
    if (targetDate) {
      [...EQUITY_BENCHMARKS, BOND_TICKER].forEach(ticker => {
        const lastDate = lastFetchedDateByTicker[ticker];
        if (lastDate) {
          const target = new Date(targetDate);
          const last = new Date(lastDate);
          const daysDiff = Math.floor((target.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff > 2) {
            summary.push({ ticker, lastDate, daysDiff });
          }
        } else {
          summary.push({ ticker, lastDate: 'N/A', daysDiff: -1 });
        }
      });
    }

    return { benchmarkReturns: returns, dataGaps: gaps, staleSummary: summary };
  }, [benchmarkPrices, historicalData, currentDate, dateRange?.to, equityExposurePct, usdExposurePct, currencyAdjusted]);

  return {
    benchmarkReturns,
    dataGaps,
    staleSummary,
    isLoading,
    hasBenchmarkData: benchmarkReturns.length > 0,
    refreshBenchmark,
  };
}
