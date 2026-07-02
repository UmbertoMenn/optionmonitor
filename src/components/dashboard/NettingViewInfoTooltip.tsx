import { Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface NettingViewInfoTooltipProps {
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Icona informativa con spiegazione semplice delle 3 viste di netting,
 * riutilizzata ovunque compaia il selettore di vista (ViewModeSelector,
 * Select nel carousel storico, Select nel DynamicPortfolioChart).
 */
export function NettingViewInfoTooltip({ className, side = 'bottom' }: NettingViewInfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className={className ?? 'w-4 h-4 text-muted-foreground cursor-help shrink-0'} />
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-sm text-xs leading-relaxed space-y-2">
          <p>
            <strong>Netting Totale:</strong> ogni posizione in derivati (venduta o comprata) conta per il suo
            valore di mercato pieno, premio compreso.
          </p>
          <p>
            <strong>Netting Intrinseco (A):</strong> tutte le opzioni — vendute E comprate — contano solo il
            valore intrinseco: se sono <em>fuori mercato (OTM)</em> valgono 0, se sono <em>dentro mercato
            (ITM)</em> valgono la differenza fra prezzo del sottostante e strike (negativa se vendute, positiva
            se comprate). Il premio pagato o incassato in più non viene mai conteggiato.
          </p>
          <p>
            <strong>Netting Intrinseco (B):</strong> come sopra ma solo per le opzioni <em>vendute</em>
            (intrinseco, 0 se OTM). Le opzioni <em>comprate</em> restano invece al loro pieno valore di
            mercato, premio compreso.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
