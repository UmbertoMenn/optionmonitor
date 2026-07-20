import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FullSnapshot } from '@/lib/fullSnapshot';
import { AttributionTradeRow, InternalTransferRow } from '@/lib/performanceAttribution';
import { Position } from '@/types/portfolio';
import { StrategyConfiguration } from '@/hooks/useStrategyConfigurations';
import { DerivativeOverride } from '@/types/derivativeOverrides';
import { GPHoldingRow } from '@/hooks/useGPHoldings';

interface AttributionSourceData {
  snapshots: FullSnapshot[];
  trades: AttributionTradeRow[];
  internalTransfers: InternalTransferRow[];
}

interface FullSnapshotRow {
  portfolio_id: string;
  snapshot_date: string;
  positions: unknown;
  strategy_configurations: unknown;
  derivative_overrides: unknown;
  gp_holdings: unknown;
  cash_value: number | null;
  gp_total_value: number | null;
}

function decodeSnapshot(row: FullSnapshotRow): FullSnapshot {
  return {
    portfolio_id: row.portfolio_id,
    snapshot_date: row.snapshot_date,
    positions: (row.positions ?? []) as Position[],
    strategy_configurations: (row.strategy_configurations ?? []) as StrategyConfiguration[],
    derivative_overrides: (row.derivative_overrides ?? []) as DerivativeOverride[],
    gp_holdings: (row.gp_holdings ?? []) as GPHoldingRow[],
    cash_value: Number(row.cash_value ?? 0),
    gp_total_value: row.gp_total_value == null ? null : Number(row.gp_total_value),
  };
}

/**
 * Carica soltanto i dati grezzi necessari al motore di attribuzione.
 * Il calcolo resta puro e testabile in `performanceAttribution.ts`.
 */
export function usePerformanceAttribution(portfolioId: string | null) {
  return useQuery({
    queryKey: ['performance-attribution', portfolioId],
    queryFn: async (): Promise<AttributionSourceData> => {
      if (!portfolioId) return { snapshots: [], trades: [], internalTransfers: [] };

      const [snapshotsResult, tradesResult, transfersResult] = await Promise.all([
        supabase
          .from('portfolio_full_snapshots')
          .select('portfolio_id,snapshot_date,positions,strategy_configurations,derivative_overrides,gp_holdings,cash_value,gp_total_value')
          .eq('portfolio_id', portfolioId)
          .order('snapshot_date', { ascending: true }),
        supabase
          .from('cost_basis_trades')
          .select('*')
          .eq('portfolio_id', portfolioId)
          .order('trade_date', { ascending: true }),
        supabase
          .from('internal_transfer_ledger' as never)
          .select('debit_date,credit_date,amount_eur,from_gp,to_gp')
          .eq('portfolio_id', portfolioId)
          .order('credit_date', { ascending: true }),
      ]);

      if (snapshotsResult.error) throw snapshotsResult.error;
      if (tradesResult.error) throw tradesResult.error;
      if (transfersResult.error) throw transfersResult.error;

      return {
        snapshots: ((snapshotsResult.data ?? []) as unknown as FullSnapshotRow[]).map(decodeSnapshot),
        trades: (tradesResult.data ?? []) as unknown as AttributionTradeRow[],
        internalTransfers: (transfersResult.data ?? []) as unknown as InternalTransferRow[],
      };
    },
    enabled: !!portfolioId,
    staleTime: 30_000,
  });
}
