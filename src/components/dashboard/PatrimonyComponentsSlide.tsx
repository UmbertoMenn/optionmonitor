import { cn } from '@/lib/utils';
import { formatEUR } from '@/lib/formatters';

export interface PatrimonyComponents {
  liquidity: number;
  stocks: number;
  bonds: number;
  gp: number;
  derivatives: number;
  total: number;
}

/**
 * Ripartizione del patrimonio per componente (Netting Totale).
 * Slide del carousel principale (Valore Portafoglio, in alto in dashboard).
 */
export function PatrimonyComponentsSlide({ components }: { components: PatrimonyComponents }) {
  return (
    <div className="h-[250px] flex flex-col justify-center max-w-md mx-auto px-4">
      <p className="text-sm font-semibold mb-2 text-center">Componenti Patrimonio</p>
      <div className="space-y-2">
        {[
          { label: 'Liquidità', value: components.liquidity },
          { label: 'Azioni', value: components.stocks },
          { label: 'Obbligazioni', value: components.bonds },
          { label: 'GP (conto 08...)', value: components.gp },
          { label: 'Derivati', value: components.derivatives },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span
              className={cn(
                'font-mono font-medium tabular-nums',
                value < 0 && 'text-destructive'
              )}
            >
              {formatEUR(value)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between text-sm border-t border-border pt-2 mt-2">
          <span className="font-semibold">Totale (Netting Totale)</span>
          <span className="font-mono font-semibold tabular-nums">
            {formatEUR(components.total)}
          </span>
        </div>
      </div>
    </div>
  );
}
