

## Aumentare il numero di posizioni nel tooltip dell'istogramma

Modifica minima: nel componente `NettingBreakdownChart` in `src/components/dashboard/DynamicPortfolioChart.tsx`, cambiare `.slice(0, 3)` a `.slice(0, 8)` alla riga 98. Questo mostrera' fino a 8 posizioni nel tooltip di dettaglio di ogni barra dell'istogramma, ordinate per valore assoluto decrescente.

### Dettaglio tecnico

**File: `src/components/dashboard/DynamicPortfolioChart.tsx`** (riga 98)

Cambiare:
```typescript
.slice(0, 3),
```
in:
```typescript
.slice(0, 8),
```

