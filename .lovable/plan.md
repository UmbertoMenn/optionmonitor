

## Fix: Includere gpRisk nel sorting delle Holdings Consolidate

### Problema
Il sorting usa `stockRisk + nakedPutRisk + leapCallRisk + strategyRisk` ma non include `gpRisk`. Quando il toggle GP è attivo, le holdings con solo rischio GP vengono ordinate come se avessero valore 0.

### Modifica

**File: `src/components/risk/EquityExposureView.tsx`** (righe 192-193)

Aggiungere `a.gpRisk` e `b.gpRisk` al calcolo del gross value per il sorting:

```typescript
const grossA = a.stockRisk + a.nakedPutRisk + a.leapCallRisk + a.strategyRisk + a.gpRisk;
const grossB = b.stockRisk + b.nakedPutRisk + b.leapCallRisk + b.strategyRisk + b.gpRisk;
```

Una sola riga per file, fix immediato.

