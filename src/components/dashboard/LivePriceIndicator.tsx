import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatRelativeTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface LivePriceIndicatorProps {
  lastFetched: Date | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function LivePriceIndicator({
  lastFetched,
  isLoading,
  error,
  onRefresh,
}: LivePriceIndicatorProps) {
  const isConnected = lastFetched && !error;
  
  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-profit" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {lastFetched ? formatRelativeTime(lastFetched.toISOString()) : 'Mai aggiornato'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {error 
              ? `Errore: ${error}` 
              : isConnected 
                ? 'Prezzi live attivi (ogni 5 min)' 
                : 'In attesa di connessione...'
            }
          </p>
        </TooltipContent>
      </Tooltip>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onRefresh}
        disabled={isLoading}
      >
        <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
      </Button>
    </div>
  );
}
