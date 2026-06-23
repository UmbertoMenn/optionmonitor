import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useAuth } from '@/contexts/AuthContext';
import { AGGREGATED_PORTFOLIO_ID, isAnyAggregatedId } from '@/contexts/PortfolioContext';
import { useUserPortfolioIds } from '@/hooks/useUserPortfolioIds';
import { toast } from 'sonner';

export interface PutRollFlag {
  id: string;
  portfolio_id: string;
  strategy_key: string;
  roll_up: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface SetRollUpParams {
  strategyKey: string;
  rollUp: boolean;
  /** Real portfolio that owns the position; defaults to the active portfolio. */
  portfolioId?: string;
}

/**
 * Manage the "PUT da rollare al rialzo" flags (table `put_roll_flags`).
 *
 * The flag is keyed by the Naked Put strategy_key (np_{underlying}_{strike}_{YYYYMM}),
 * built via `nakedPutKeyForPosition` so it matches strategy_cache / the alert engine.
 */
export function usePutRollFlags() {
  const { portfolio } = usePortfolio();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const activePortfolioId = portfolio?.id;
  const isGlobalAggregated = activePortfolioId === AGGREGATED_PORTFOLIO_ID;
  const isAggregated = isAnyAggregatedId(activePortfolioId);
  const { portfolioIds: userPortfolioIds, isUserAggregated } = useUserPortfolioIds(activePortfolioId);

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['put-roll-flags', activePortfolioId],
    queryFn: async (): Promise<PutRollFlag[]> => {
      if (!activePortfolioId) return [];

      // Global aggregated (admin): all flags
      if (isGlobalAggregated && isAdmin) {
        const { data, error } = await supabase.from('put_roll_flags').select('*');
        if (error) throw error;
        return (data || []) as PutRollFlag[];
      }

      // Per-user aggregated: flags across the user's real portfolios
      if (isUserAggregated && userPortfolioIds.length > 0) {
        const { data, error } = await supabase
          .from('put_roll_flags').select('*')
          .in('portfolio_id', userPortfolioIds);
        if (error) throw error;
        return (data || []) as PutRollFlag[];
      }

      // Single portfolio
      const { data, error } = await supabase
        .from('put_roll_flags').select('*')
        .eq('portfolio_id', activePortfolioId);
      if (error) throw error;
      return (data || []) as PutRollFlag[];
    },
    enabled: !!activePortfolioId && (!isGlobalAggregated || isAdmin) && (!isUserAggregated || userPortfolioIds.length > 0),
  });

  /** True when a given strategy_key is flagged "roll up" (and enabled). */
  const isRollUp = (strategyKey: string): boolean =>
    flags.some(f => f.strategy_key === strategyKey && f.roll_up);

  const setRollUpMutation = useMutation({
    mutationFn: async ({ strategyKey, rollUp, portfolioId }: SetRollUpParams) => {
      const targetPortfolioId = portfolioId || (isAggregated ? undefined : activePortfolioId);
      if (!targetPortfolioId) {
        throw new Error('Portfolio non determinabile per il flag roll-up');
      }

      if (rollUp) {
        const { error } = await supabase
          .from('put_roll_flags')
          .upsert(
            { portfolio_id: targetPortfolioId, strategy_key: strategyKey, roll_up: true, updated_at: new Date().toISOString() },
            { onConflict: 'portfolio_id,strategy_key' },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('put_roll_flags')
          .delete()
          .eq('portfolio_id', targetPortfolioId)
          .eq('strategy_key', strategyKey);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['put-roll-flags'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Errore aggiornamento flag roll-up');
    },
  });

  return {
    flags,
    isLoading,
    isRollUp,
    setRollUp: setRollUpMutation.mutateAsync,
    isSaving: setRollUpMutation.isPending,
  };
}
