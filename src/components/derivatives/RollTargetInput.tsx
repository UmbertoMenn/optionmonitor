import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePutRollTargets } from '@/hooks/usePutRollTargets';

interface RollTargetInputProps {
  /** Stable strategy_key the target attaches to (np_/cc_/dcc_...). */
  strategyKey: string;
  /** Real portfolio that owns the position. */
  portfolioId: string;
  className?: string;
}

/**
 * Casella inline "Target da recuperare", modificabile a mano sulla riga della
 * strategia (PUT roll-up, Covered Call, De-Risking Covered Call).
 *
 * Il valore è salvato in `put_roll_targets` keyed by strategy_key e isolato
 * per-utente dalla RLS (admin compreso). Una piccola "x" a sinistra, visibile solo
 * quando c'è un valore, lo cancella con un click.
 */
export function RollTargetInput({ strategyKey, portfolioId, className }: RollTargetInputProps) {
  const { getTarget, setTarget, isSaving } = usePutRollTargets();

  const saved = getTarget(strategyKey);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizza il valore mostrato quando cambia il salvato e non stiamo editando.
  useEffect(() => {
    if (!editing) setDraft(saved !== null ? String(saved) : '');
  }, [saved, editing]);

  const showClear = draft.trim() !== '';

  const commit = () => {
    setEditing(false);
    const raw = draft.trim().replace(',', '.');
    if (raw === '') {
      if (saved !== null) setTarget({ strategyKey, target: null, portfolioId });
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      setDraft(saved !== null ? String(saved) : '');
      return;
    }
    if (parsed !== saved) setTarget({ strategyKey, target: parsed, portfolioId });
  };

  const clear = () => {
    setEditing(false);
    setDraft('');
    if (saved !== null) setTarget({ strategyKey, target: null, portfolioId });
  };

  return (
    <div
      className={`relative flex items-center justify-end ${className || ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {showClear && (
        <button
          type="button"
          aria-label="Cancella target"
          disabled={isSaving}
          // onMouseDown (non onClick) per scattare prima del blur dell'input.
          onMouseDown={(e) => { e.preventDefault(); clear(); }}
          className="absolute left-1 z-10 flex items-center justify-center w-3.5 h-3.5 rounded-full
            text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={draft}
              placeholder="—"
              disabled={isSaving}
              onFocus={(e) => { setEditing(true); e.currentTarget.select(); }}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur(); }
                if (e.key === 'Escape') {
                  setEditing(false);
                  setDraft(saved !== null ? String(saved) : '');
                  inputRef.current?.blur();
                }
              }}
              className={`w-full h-7 ${showClear ? 'pl-5' : 'pl-1.5'} pr-1.5 text-right text-sm font-mono rounded-md border bg-background/60 outline-none transition-colors
                focus:border-primary focus:ring-1 focus:ring-primary/40
                ${saved !== null ? 'border-amber-500/50 text-amber-400' : 'border-border text-muted-foreground'}
                placeholder:text-muted-foreground/40`}
            />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[240px]">
            Target da recuperare per questa strategia. Valore privato del singolo
            utente: modificabile a mano (Invio per salvare), la x lo cancella.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
