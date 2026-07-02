import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

/**
 * Tooltip "bloccabile": stessa firma pubblica del Tooltip Radix originale
 * (Tooltip, TooltipTrigger, TooltipContent, TooltipProvider), ma internamente
 * basato su Popover invece che su hover puro.
 *
 * Motivo: il vecchio Tooltip hover-only appariva dopo un delay e scompariva
 * al minimo movimento del mouse, rendendo impossibile selezionare o leggere
 * con calma il testo. Con Popover: click per aprire, il contenuto resta
 * aperto (testo selezionabile con calma) finché non si clicca fuori, si
 * riclicca il trigger o si preme Esc — nessun'altra modifica richiesta nei
 * punti dell'app che già usano questi componenti.
 *
 * TooltipProvider è mantenuto come no-op (Popover non ne ha bisogno) per
 * compatibilità con i punti che passano ancora `delayDuration` ecc.
 */
const TooltipProvider = ({
  children,
}: React.PropsWithChildren<Record<string, unknown>>) => <>{children}</>;

const Tooltip = PopoverPrimitive.Root;

const TooltipTrigger = PopoverPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={8}
      onOpenAutoFocus={(e) => e.preventDefault()}
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md select-text cursor-text outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
TooltipContent.displayName = PopoverPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
