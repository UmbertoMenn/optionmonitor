

## Merge Covered Call Sintetiche nella sezione Covered Call

### Cosa cambia

Rimuovere la sezione dedicata "Covered Call Sintetiche" e mostrare le CC sintetiche direttamente nella sezione "Covered Call" con badge S arancione + tooltip, come già fatto per le de-risking sintetiche.

### File 1: `src/lib/derivativeStrategies.ts`

**A. Estendere `CoveredCallPosition`** con campi opzionali:
```typescript
export interface CoveredCallPosition {
  option: Position;
  underlying: Position;
  contractsCovered: number;
  sharesCovered: number;
  isFullyCovered: boolean;
  isSynthetic?: boolean;        // nuovo
  syntheticPut?: Position;      // nuovo - PUT venduta deep ITM
}
```

**B. Eliminare `SyntheticCoveredCallPosition`** e rimuovere `syntheticCoveredCalls` da `DerivativeCategories`.

**C. Aggiornare la logica di categorizzazione**: dove attualmente si fa `syntheticCoveredCalls.push(...)`, creare invece un `CoveredCallPosition` con `isSynthetic: true` e `syntheticPut` e pusharlo in `coveredCalls`.

**D. Rimuovere il return di `syntheticCoveredCalls`** dal risultato finale.

### File 2: `src/pages/Derivatives.tsx`

**E. Rimuovere** la sezione "Covered Call Sintetiche" (righe ~558-606), lo stato `syntheticCCOpen`, e il componente `SyntheticCoveredCallRow`.

**F. Aggiornare `CoveredCallRow`**: 
- Dopo la descrizione (Col 3), se `coveredCall.isSynthetic`, mostrare il badge S arancione con tooltip "Synthetic position / short PUT delta -1" (stesso stile usato nelle de-risking sintetiche).
- Nel collapsible content (dettagli espansi), se `coveredCall.syntheticPut` è presente, mostrare i dettagli della PUT venduta deep ITM (strike, scadenza, PMC, prezzo, P/L%).

**G. Rimuovere** riferimenti a `syntheticCoveredCalls` dal merge, sort, e underlying price extraction.

### Ordine sezioni risultante
1. Covered Call (standard + sintetiche con badge S)
2. De-Risking Covered Call
3. Iron Condor
4. Double Diagonal
5. Naked Put
6. Leap Call
7. Protezioni
8. Altre Strategie

