

## Aggiungere De-Risking Covered Call ITM alla card "Posizioni da monitorare"

### Problema
La sezione "Covered Call ITM" controlla solo `categories.coveredCalls`. Le `deRiskingCoveredCalls` (che hanno la stessa struttura `coveredCall.option`) vengono ignorate, quindi una de-risking CC che va ITM non viene segnalata.

### Soluzione

**File: `src/components/derivatives/DerivativesSummaryCard.tsx`**

1. **Estendere il calcolo `coveredCallsITM`** (righe 250-268): aggiungere un secondo loop su `categories.deRiskingCoveredCalls` con la stessa logica ITM (strike < prezzo sottostante), aggiungendo i risultati allo stesso array. Aggiungere un campo `isDeRisking: boolean` per distinguerli nel rendering.

2. **Aggiornare le dipendenze del `useMemo`**: includere `categories.deRiskingCoveredCalls`.

3. **Aggiornare il rendering** (riga ~670): nella sezione che mostra le Covered Call ITM, distinguere visivamente le de-risking (es. titolo "Covered Call / De-Risking" oppure badge aggiuntivo "DR" per le de-risking).

### Dettagli tecnici

```typescript
// Dentro il useMemo coveredCallsITM, dopo il loop su coveredCalls:
categories.deRiskingCoveredCalls.forEach(dr => {
  const cc = dr.coveredCall;
  const strikePrice = cc.option.strike_price || 0;
  const underlyingKey = cc.option.underlying || '';
  const underlyingPrice = (underlyingKey ? underlyingPrices[underlyingKey]?.price : 0) || 0;
  
  if (underlyingPrice > 0 && strikePrice < underlyingPrice) {
    result.push({
      ticker: getDisplayTicker(underlyingKey, underlyingPrices, cc.underlying.ticker),
      strike: strikePrice,
      contracts: cc.contractsCovered,
      isDeRisking: true,
    });
  }
});
```

- 1 file da modificare
- Nessuna modifica database

