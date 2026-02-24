

## Fix: Rimuovere ETF da `stockPositions`

**File:** `src/pages/Derivatives.tsx`, riga 116

Cambiare:
```ts
positions.filter(p => p.asset_type === 'stock' || p.asset_type === 'etf'),
```
in:
```ts
positions.filter(p => p.asset_type === 'stock'),
```

Singola modifica, una riga.

