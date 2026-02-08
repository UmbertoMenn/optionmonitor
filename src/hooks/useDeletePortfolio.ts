import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useDeletePortfolio() {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const deletePortfolio = async (portfolioId: string) => {
    setIsDeleting(true);

    try {
      // 1. Elimina derivative_overrides PRIMA (ha FK a positions)
      const { error: overridesError } = await supabase
        .from('derivative_overrides')
        .delete()
        .eq('portfolio_id', portfolioId);
      
      if (overridesError) throw overridesError;

      // 2. Elimina positions
      const { error: positionsError } = await supabase
        .from('positions')
        .delete()
        .eq('portfolio_id', portfolioId);
      
      if (positionsError) throw positionsError;

      // 3. Elimina strategy_cache
      const { error: strategiesError } = await supabase
        .from('strategy_cache')
        .delete()
        .eq('portfolio_id', portfolioId);
      
      if (strategiesError) throw strategiesError;

      // 4. Elimina covered_call_premiums
      const { error: premiumsError } = await supabase
        .from('covered_call_premiums')
        .delete()
        .eq('portfolio_id', portfolioId);
      
      if (premiumsError) throw premiumsError;

      // 5. Elimina alert_states
      const { error: alertStatesError } = await supabase
        .from('alert_states')
        .delete()
        .eq('portfolio_id', portfolioId);
      
      if (alertStatesError) throw alertStatesError;

      // 6. Elimina alerts
      const { error: alertsError } = await supabase
        .from('alerts')
        .delete()
        .eq('portfolio_id', portfolioId);
      
      if (alertsError) throw alertsError;

      // 7. Elimina historical_data
      const { error: historicalError } = await supabase
        .from('historical_data')
        .delete()
        .eq('portfolio_id', portfolioId);
      
      if (historicalError) throw historicalError;

      // 8. Elimina deposits
      const { error: depositsError } = await supabase
        .from('deposits')
        .delete()
        .eq('portfolio_id', portfolioId);
      
      if (depositsError) throw depositsError;

      // 9. Elimina il portfolio stesso
      const { error: portfolioError } = await supabase
        .from('portfolios')
        .delete()
        .eq('id', portfolioId);
      
      if (portfolioError) throw portfolioError;

      // 10. Invalida cache
      await queryClient.invalidateQueries({ queryKey: ['admin-all-portfolios'] });
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] });

      toast.success('Portfolio eliminato con successo');
    } catch (error) {
      console.error('Errore durante l\'eliminazione del portfolio:', error);
      toast.error('Errore eliminazione portfolio', {
        description: error instanceof Error ? error.message : 'Errore sconosciuto',
      });
      throw error;
    } finally {
      setIsDeleting(false);
    }
  };

  return { deletePortfolio, isDeleting };
}
