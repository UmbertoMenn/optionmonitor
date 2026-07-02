import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History, CalendarDays } from 'lucide-react';
import { usePortfolioContext, isAnyAggregatedId } from '@/contexts/PortfolioContext';
import { fetchFullSnapshotDates } from '@/lib/fullSnapshot';
import { toast } from 'sonner';

interface HistoricalViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateIt(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
}

export function HistoricalViewDialog({ open, onOpenChange }: HistoricalViewDialogProps) {
  const { selectedPortfolio, selectedPortfolioId, enterHistoricalView, historicalViewDate } = usePortfolioContext();
  const isAggregated = isAnyAggregatedId(selectedPortfolioId);
  const portfolioId = !isAggregated ? selectedPortfolio?.id : undefined;

  const { data: dates = [], isLoading } = useQuery({
    queryKey: ['full-snapshot-dates', portfolioId],
    queryFn: () => fetchFullSnapshotDates(portfolioId!),
    enabled: open && !!portfolioId,
  });

  const handleSelect = (date: string) => {
    enterHistoricalView(date);
    onOpenChange(false);
    toast.info(`Visualizzazione storica al ${formatDateIt(date)}`, {
      description: 'Portafoglio in sola lettura. Esci dal banner in alto.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Visualizzazione Storica
          </DialogTitle>
          <DialogDescription>
            Riprendi il portafoglio com'era ad una data passata, in sola lettura,
            in tutte le sezioni (Dashboard, Derivati, Risk Analyzer, Stress Lab).
          </DialogDescription>
        </DialogHeader>

        {isAggregated ? (
          <p className="text-sm text-muted-foreground">
            La visualizzazione storica è disponibile solo per un portafoglio singolo,
            non per le viste aggregate. Seleziona prima un portafoglio.
          </p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento date disponibili…</p>
        ) : dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuno snapshot completo disponibile per questo portafoglio.
            Gli snapshot completi vengono salvati automaticamente ad ogni caricamento
            Excel (e ad ogni ricalcolo dopo modifiche alle strategie): le date
            appariranno qui dal prossimo salvataggio in poi.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {dates.map((d) => (
              <Button
                key={d}
                variant={historicalViewDate === d ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => handleSelect(d)}
              >
                <CalendarDays className="w-4 h-4 mr-2 shrink-0" />
                {formatDateIt(d)}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
