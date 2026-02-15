

## Fix: Aggregato per-utente - dati mancanti (giacenza, patrimonio iniziale, grafici)

### Causa principale: Collisione di cache key in React Query

Due hook diversi usano la stessa query key `['user-portfolio-ids', targetUserId]` ma restituiscono dati con strutture incompatibili:

| Hook | Seleziona | Restituisce |
|---|---|---|
| `usePortfolio.ts` (riga 24) | `id, snapshot_date, cash_value, total_value` | Array di oggetti |
| `useUserPortfolioIds.ts` (riga 14) | `id` | Array di stringhe (`data.map(p => p.id)`) |

React Query condivide i dati tra tutti gli observer con la stessa chiave. Il primo queryFn che viene eseguito imposta i dati in cache, e il secondo riusa quei dati senza eseguire il proprio queryFn.

**Effetto**: se `usePortfolio` esegue per primo (probabile), la cache contiene oggetti. Quando `useUserPortfolioIds` (usato da `useHistoricalData`, `useDeposits`, ecc.) legge la cache, ottiene oggetti invece di stringhe. Questo causa:
- `.in('portfolio_id', [oggetti])` nelle query database fallisce silenziosamente (nessun risultato)
- `historicalData` risulta vuoto (nessun grafico)
- `selectedHistoricalEntry` e' null (niente patrimonio iniziale ne' giacenza media)
- Anche `deposits` risulta vuoto per la vista aggregata

### Soluzione

**File: `src/hooks/usePortfolio.ts`**

Rinominare la query key da `['user-portfolio-ids', targetUserId]` a `['user-portfolio-meta', targetUserId]` per eliminare la collisione con l'hook condiviso `useUserPortfolioIds`.

Questa modifica e' sufficiente perche':
- `usePortfolio.ts` usa i dati estesi (con `snapshot_date`, `cash_value`) solo internamente per calcolare `aggregatedSnapshotDate` e `aggregatedCashValue`
- `useUserPortfolioIds` (usato da `useHistoricalData`, `useDeposits`, ecc.) continua a funzionare con la propria query key, restituendo correttamente array di stringhe
- Le due cache non si sovrappongono piu'

### Dettaglio tecnico

```text
// usePortfolio.ts - PRIMA (riga 24)
queryKey: ['user-portfolio-ids', targetUserId],

// usePortfolio.ts - DOPO
queryKey: ['user-portfolio-meta', targetUserId],
```

Modifica di 1 riga, nessun effetto collaterale.

### File da modificare

| File | Modifica |
|---|---|
| `src/hooks/usePortfolio.ts` | Rinominare query key da `user-portfolio-ids` a `user-portfolio-meta` (riga 24) |

