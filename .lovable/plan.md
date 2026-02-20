

## Fix: Distanza min strike per roll_up_always + Colonna Sottostante nei Movimenti

### 1. Aggiungere "Distanza min strike" a roll_up_always

L'opzione "Rollo su scadenza successiva con strike piu alto (anche se il nuovo premio e inferiore)" non mostra alcun campo configurabile. Serve aggiungere l'input "Distanza min strike" (gia presente per `roll_up_positive`), che usa il campo `rollUpMinDistancePct` gia esistente nel model.

**File: `src/components/simulator/AdjustmentRuleEditor.tsx`**
- Dopo la label `roll_up_always` (riga 70-75), aggiungere un blocco condizionale `{rules.approachRule.action === 'roll_up_always' && ...}` con l'input per `rollUpMinDistancePct`, identico a quello gia presente nel blocco `roll_up_positive`.

### 2. Colonna "Sottostante" nei Movimenti Cronologici

La tabella Movimenti Cronologici non include il prezzo del sottostante al momento dell'operazione.

**File: `src/components/simulator/BacktestResults.tsx`**
- Aggiungere `underlyingPrice?: number` all'interfaccia `TradeMovement`.
- In `buildMovements`: per le leg iniziali, usare il prezzo della leg stock (se presente) o il primo `result.days[0].price`. Per le leg da `adjustmentLog`, usare `adj.underlyingPrice`.
- Aggiungere la colonna "Sottostante" nella `TableHeader` e `TableBody` della tabella Movimenti, formattata come `$XXX.XX`.

### Dettaglio tecnico

| File | Modifica |
|------|----------|
| `src/components/simulator/AdjustmentRuleEditor.tsx` | Aggiungere input "Distanza min strike" quando `roll_up_always` e selezionato |
| `src/components/simulator/BacktestResults.tsx` | Aggiungere `underlyingPrice` a `TradeMovement`; popolare da `adj.underlyingPrice`; nuova colonna nella tabella |

