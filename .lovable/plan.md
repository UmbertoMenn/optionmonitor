

## Fix: Sorting Holdings Consolidate in ordine decrescente

### Problema
Il sorting in `EquityExposureView.tsx` (righe 189-197) ricalcola manualmente il valore lordo sommando tutti i campi risk (`stockRisk + nakedPutRisk + leapCallRisk + strategyRisk + gpRisk`), **ignorando lo stato dei toggle**. Quando un toggle è disattivato (es. Naked PUT off), il valore nakedPutRisk contribuisce comunque all'ordinamento, causando un ordine incoerente con i valori visualizzati.

Nel frattempo, `calculateConsolidatedTopHoldings` in `sectorExposure.ts` calcola già un campo `totalExposure` che rispetta i toggle attivi — ma il sorting in EquityExposureView lo ignora.

### Soluzione

**File: `src/components/risk/EquityExposureView.tsx`** (righe 188-197)

Sostituire il sorting manuale con l'uso del campo `totalExposure` già calcolato:

```typescript
const sortedConsolidatedHoldings = useMemo(() => 
  [...consolidatedHoldings].sort((a, b) => {
    return Math.abs(b.totalExposure) - Math.abs(a.totalExposure);
  }),
  [consolidatedHoldings]
);
```

Questo garantisce che l'ordinamento sia sempre coerente con i valori effettivamente visualizzati, indipendentemente da quali toggle sono attivi o disattivi.

### File da modificare
1. `src/components/risk/EquityExposureView.tsx` — una sola modifica al sorting

