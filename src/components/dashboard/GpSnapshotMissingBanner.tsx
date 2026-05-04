import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { useGPHoldings } from '@/hooks/useGPHoldings';
import { usePortfolio } from '@/hooks/usePortfolio';

/**
 * Avvisa l'utente quando la GP è stata caricata DOPO il file Portafoglio
 * (o senza un Portafoglio successivo che la integri): in quel caso lo
 * snapshot storico per la data del Portafoglio NON include la GP, e i
 * grafici per quel giorno saranno disallineati rispetto alle card finché
 * non viene caricato un nuovo file Portafoglio.
 */
export function GpSnapshotMissingBanner() {
  const { portfolio } = usePortfolio();
  const { gpHoldings } = useGPHoldings();
  const [dismissed, setDismissed] = useState(false);

  const shouldShow = useMemo(() => {
    if (dismissed) return false;
    if (!portfolio?.id) return false;
    if (!gpHoldings || gpHoldings.length === 0) return false;

    const ownGp = gpHoldings.filter(h => h.portfolio_id === portfolio.id);
    if (ownGp.length === 0) return false;

    const latestGpUpdate = ownGp.reduce<number>((max, h) => {
      const d = new Date(h.updated_at || h.created_at || 0).getTime();
      return d > max ? d : max;
    }, 0);
    if (!latestGpUpdate) return false;

    const portfolioSnapshotDate = portfolio.snapshot_date;
    if (!portfolioSnapshotDate) return true;

    // GP caricata dopo la fine del giorno dello snapshot del Portafoglio
    const snapshotDayEnd = new Date(`${portfolioSnapshotDate}T23:59:59Z`).getTime();
    return latestGpUpdate > snapshotDayEnd;
  }, [dismissed, portfolio?.id, portfolio?.snapshot_date, gpHoldings]);

  if (!shouldShow) return null;

  return (
    <Alert className="border-amber-500/40 bg-amber-500/10 text-foreground">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <div className="flex items-start justify-between gap-2 w-full">
        <div className="flex-1">
          <AlertTitle className="text-sm">Snapshot storico non aggiornato</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Hai caricato una Gestione Patrimoniale dopo il file Portafoglio.
            Lo snapshot storico per quella data non include la GP e verrà
            riallineato solo dopo aver caricato un nuovo file Portafoglio.
            Le card in alto mostrano comunque il valore live corretto.
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mr-1 -mt-1"
          onClick={() => setDismissed(true)}
          aria-label="Chiudi avviso"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Alert>
  );
}
