

## Fix: Label confusionale per derivati splittati

### Problema
Quando un'opzione viene splittata, il label mostra `[1]`, `[2]`, `[3]` — che sembra indicare la quantità anziché il numero dello slot.

### Soluzione
Sostituire `[1]`, `[2]`, `[3]` con lettere: `(A)`, `(B)`, `(C)`. Le lettere non possono essere confuse con quantità numeriche e sono immediatamente comprensibili come identificatori di slot.

Esempio: `AAPL V CALL 250 GIU/25 (A)` invece di `AAPL V CALL 250 GIU/25 [1]`

Stesso approccio per gli slot azioni: `AAPL (100 azioni) (A)` invece di `AAPL (100 azioni) [slot 1]`

### File da modificare

**`src/components/derivatives/StrategyConfigWizard.tsx`** — funzione `positionLabel()` (righe 93-115):
- Slot opzioni: `[${slotNum}]` → `(${letter})`  dove letter = A, B, C...
- Slot azioni: `[slot ${slotNum}]` → `(${letter})`

**`src/components/derivatives/StrategyReconciliationDialog.tsx`** — stessa funzione `positionLabel()` (riga 36+): identiche modifiche

