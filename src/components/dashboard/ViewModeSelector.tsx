import { cn } from '@/lib/utils';
import { NettingViewInfoTooltip } from '@/components/dashboard/NettingViewInfoTooltip';

export type ViewMode = 'netting_total' | 'netting_intrinsic_a' | 'netting_intrinsic_b';

interface ViewModeSelectorProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const VIEW_LABELS: Record<ViewMode, string> = {
  netting_total: 'Netting Totale',
  netting_intrinsic_a: 'Netting Intrinseco (A)',
  netting_intrinsic_b: 'Netting Intrinseco (B)',
};

const VIEWS: ViewMode[] = ['netting_total', 'netting_intrinsic_a', 'netting_intrinsic_b'];

export function ViewModeSelector({ viewMode, onViewModeChange }: ViewModeSelectorProps) {
  return (
    <div className="mb-4 border border-border rounded-xl bg-card p-1">
      <div className="flex flex-wrap items-center justify-center gap-1">
        {VIEWS.map((v) => {
          const active = viewMode === v;
          return (
            <button
              key={v}
              onClick={() => onViewModeChange(v)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                active
                  ? 'bg-blue-400/10 text-blue-400'
                  : 'hover:bg-muted/50 text-foreground'
              )}
              aria-pressed={active}
            >
              {VIEW_LABELS[v]}
            </button>
          );
        })}
        <NettingViewInfoTooltip className="w-4 h-4 text-muted-foreground cursor-pointer shrink-0 ml-1" />
      </div>
    </div>
  );
}
