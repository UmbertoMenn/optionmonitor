import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolioContext } from '@/contexts/PortfolioContext';

function useEffectiveUserId() {
  const { user } = useAuth();
  const { isAdminMode, adminViewUserId } = usePortfolioContext();
  return isAdminMode && adminViewUserId ? adminViewUserId : user?.id;
}

interface StrategyAlertToggle {
  id: string;
  user_id: string;
  strategy_key: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useStrategyAlertToggles() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();

  return useQuery({
    queryKey: ['strategy-alert-toggles', effectiveUserId],
    queryFn: async (): Promise<StrategyAlertToggle[]> => {
      if (!effectiveUserId) return [];

      const { data, error } = await supabase
        .from('strategy_alert_toggles')
        .select('*')
        .eq('user_id', effectiveUserId);

      if (error) {
        console.error('Error fetching strategy alert toggles:', error);
        throw error;
      }

      return (data || []) as StrategyAlertToggle[];
    },
    enabled: !!user && !!effectiveUserId,
  });
}

export function useUpsertStrategyAlertToggle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();

  return useMutation({
    mutationFn: async (params: { strategy_key: string; enabled: boolean }) => {
      if (!user || !effectiveUserId) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('strategy_alert_toggles')
        .upsert(
          {
            user_id: effectiveUserId,
            strategy_key: params.strategy_key,
            enabled: params.enabled,
          } as any,
          { onConflict: 'user_id,strategy_key' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-alert-toggles'] });
    },
  });
}

export function useBatchUpsertStrategyAlertToggles() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();

  return useMutation({
    mutationFn: async (toggles: Array<{ strategy_key: string; enabled: boolean }>) => {
      if (!user || !effectiveUserId) throw new Error('User not authenticated');

      const upsertData = toggles.map(t => ({
        user_id: effectiveUserId,
        strategy_key: t.strategy_key,
        enabled: t.enabled,
      }));

      const { error } = await supabase
        .from('strategy_alert_toggles')
        .upsert(upsertData as any, { onConflict: 'user_id,strategy_key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-alert-toggles'] });
    },
  });
}
