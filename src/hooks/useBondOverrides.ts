import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BondOverride {
  id: string;
  portfolio_id: string;
  isin: string;
  coupon_rate_pct: number | null;
  maturity_date: string | null; // ISO date
  frequency: number;
}

export interface BondOverrideInput {
  portfolioId: string;
  isin: string;
  couponRatePct: number | null;
  maturityDate: string | null; // 'YYYY-MM-DD'
  frequency: number;
}

/**
 * Override manuali dei metadati bond (cedola/scadenza/frequenza), per risolvere i bond
 * che non espongono una cedola fissa nella description (BTP Valore, BTP Italia, ecc.).
 * La RLS limita alle righe dei portfolio dell'utente (admin: tutte).
 */
export function useBondOverrides() {
  const queryClient = useQueryClient();

  const { data: overrides = [], isLoading } = useQuery({
    queryKey: ['bond-overrides'],
    queryFn: async (): Promise<BondOverride[]> => {
      const { data, error } = await supabase.from('bond_overrides').select('*');
      if (error) throw error;
      return (data || []) as BondOverride[];
    },
  });

  const key = (portfolioId: string, isin: string) => `${portfolioId}::${isin}`;
  const map = new Map(overrides.map(o => [key(o.portfolio_id, o.isin), o]));
  const getOverride = (portfolioId: string, isin: string | null): BondOverride | undefined =>
    isin ? map.get(key(portfolioId, isin)) : undefined;

  const setMutation = useMutation({
    mutationFn: async (inp: BondOverrideInput) => {
      const { error } = await supabase.from('bond_overrides').upsert(
        {
          portfolio_id: inp.portfolioId,
          isin: inp.isin,
          coupon_rate_pct: inp.couponRatePct,
          maturity_date: inp.maturityDate,
          frequency: inp.frequency,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'portfolio_id,isin' },
      );
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bond-overrides'] }); },
    onError: (e: unknown) => {
      const err = e as { message?: string; code?: string };
      console.error('[bond_overrides] save failed:', e);
      toast.error(`Errore salvataggio bond${err?.code ? ' [' + err.code + ']' : ''}${err?.message ? ': ' + err.message : ''}`);
    },
  });

  return {
    overrides,
    isLoading,
    getOverride,
    setOverride: setMutation.mutateAsync,
    isSaving: setMutation.isPending,
  };
}
