import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Info, Loader2 } from 'lucide-react';
import { useSectorOverride, SectorOverrideData } from '@/hooks/useSectorOverride';

// Standard GICS sectors
const GICS_SECTORS = [
  'Technology',
  'Financials',
  'Healthcare',
  'Consumer Discretionary',
  'Consumer Staples',
  'Industrials',
  'Energy',
  'Materials',
  'Utilities',
  'Real Estate',
  'Communication Services',
  'Other',
];

interface SectorOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instrumentData: SectorOverrideData | null;
  onSuccess: () => void;
}

export function SectorOverrideDialog({
  open,
  onOpenChange,
  instrumentData,
  onSuccess,
}: SectorOverrideDialogProps) {
  const [selectedSector, setSelectedSector] = useState<string>('');
  const { saveOverride, isSaving } = useSectorOverride();

  const handleSave = async () => {
    if (!instrumentData || !selectedSector) return;
    
    const success = await saveOverride(instrumentData, selectedSector);
    if (success) {
      onOpenChange(false);
      setSelectedSector('');
      onSuccess();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedSector('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifica Settore</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Strumento</Label>
            <div className="font-medium">{instrumentData?.instrumentName}</div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Settore attuale</Label>
            <div className="font-medium text-primary">
              {instrumentData?.currentSector || 'Non definito'}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new-sector">Nuovo settore</Label>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger id="new-sector">
                <SelectValue placeholder="Seleziona settore..." />
              </SelectTrigger>
              <SelectContent>
                {GICS_SECTORS.map((sector) => (
                  <SelectItem key={sector} value={sector}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="text-xs text-blue-600 dark:text-blue-400">
              La modifica sarà salvata nella cache globale e visibile a tutti gli utenti
            </span>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={!selectedSector || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvataggio...
              </>
            ) : (
              'Salva'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
