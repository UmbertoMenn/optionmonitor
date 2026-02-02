import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SectorOverrideData {
  instrumentName: string;
  currentSector: string | null;
  isin?: string;
  ticker?: string;
}

export function useSectorOverride() {
  const [isSaving, setIsSaving] = useState(false);

  const saveOverride = async (
    data: SectorOverrideData, 
    newSector: string
  ): Promise<boolean> => {
    setIsSaving(true);
    
    try {
      // Determine ISIN to use - real or synthetic
      let isinToUse = data.isin;
      let tickerToUse = data.ticker || 'UNKNOWN';
      
      if (!isinToUse) {
        // For instruments without ISIN (derivatives), create synthetic ISIN
        // Try to extract ticker from instrument name
        const tickerMatch = data.instrumentName.match(/^([A-Z]{1,5})(?:\s|$)/);
        if (tickerMatch) {
          tickerToUse = tickerMatch[1];
        }
        isinToUse = `TICKER:${tickerToUse.toUpperCase()}`;
      }
      
      console.log(`Saving sector override: ${isinToUse} → ${newSector}`);
      
      const { error } = await supabase
        .from('isin_mappings')
        .upsert({
          isin: isinToUse,
          ticker: tickerToUse.toUpperCase(),
          sector: newSector,
          industry: null, // Clear industry when manually overriding
          source: 'manual',
          last_verified_at: new Date().toISOString(),
        }, { onConflict: 'isin' });
      
      if (error) {
        console.error('Error saving sector override:', error);
        toast.error('Errore nel salvataggio dell\'override settore');
        return false;
      }
      
      toast.success(`Settore aggiornato a "${newSector}"`);
      return true;
    } catch (err) {
      console.error('Error in saveOverride:', err);
      toast.error('Errore nel salvataggio');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { saveOverride, isSaving };
}
