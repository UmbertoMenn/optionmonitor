import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LivePriceData } from '@/hooks/useLivePrices';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface LivePriceBadgeProps {
  livePrice: LivePriceData | null;
  currentPrice: number | null;
  currency?: string | null;
  showChange?: boolean;
  compact?: boolean;
}

export function LivePriceBadge({
  livePrice,
  currentPrice,
  currency,
  showChange = true,
  compact = false,
}: LivePriceBadgeProps) {
  if (!livePrice || livePrice.source === 'error') {
    // Show current price from portfolio if no live data
    if (currentPrice) {
      return (
        <span className="font-mono text-muted-foreground">
          {formatCurrency(currentPrice, currency)}
        </span>
      );
    }
    return <span className="text-muted-foreground">-</span>;
  }
  
  const price = livePrice.price;
  const change = livePrice.change;
  const changePct = livePrice.changePct;
  
  if (price === null) {
    return <span className="text-muted-foreground">N/A</span>;
  }
  
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;
  const isNeutral = change === null || change === 0;
  
  const ChangeIcon = isPositive ? ArrowUp : isNegative ? ArrowDown : Minus;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "flex items-center gap-1",
          compact && "text-sm"
        )}>
          <span className="font-mono font-medium">
            {formatCurrency(price, currency)}
          </span>
          
          {showChange && !isNeutral && (
            <div className={cn(
              "flex items-center gap-0.5 text-xs",
              isPositive && "text-profit",
              isNegative && "text-loss"
            )}>
              <ChangeIcon className="w-3 h-3" />
              <span>
                {changePct !== null ? `${Math.abs(changePct).toFixed(2)}%` : ''}
              </span>
            </div>
          )}
          
          {/* Live indicator dot */}
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-profit opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-profit"></span>
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <p>Prezzo live: {formatCurrency(price, currency)}</p>
          {change !== null && (
            <p className={isPositive ? 'text-profit' : isNegative ? 'text-loss' : ''}>
              Variazione: {isPositive ? '+' : ''}{formatCurrency(change, currency)} ({changePct?.toFixed(2)}%)
            </p>
          )}
          {livePrice.bid !== null && livePrice.ask !== null && (
            <p>Bid/Ask: {formatCurrency(livePrice.bid, currency)} / {formatCurrency(livePrice.ask, currency)}</p>
          )}
          <p className="text-muted-foreground">
            Fonte: {livePrice.source === 'tradier' ? 'Tradier' : 'Yahoo Finance'}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
