

## Aggiornare snapshot storico dopo upload GP

### Problema
Quando si carica un file GP, i dati vengono salvati in `gp_holdings` e i totali aggiornati su `portfolios`, ma NON viene ricalcolato e salvato lo snapshot storico in `historical_data`. Il valore GP influenza `total_value`, netting ed esposizioni, quindi lo snapshot diventa stale.

### Soluzione
Dopo il salvataggio dei GP holdings e l'aggiornamento dei totali su `portfolios`, chiamare `upsertUploadSnapshot` usando la `snapshot_date` del portfolio (non una data GP).

### Modifica

**File: `src/components/dashboard/FileUploader.tsx`** (dopo riga 220, dentro `onDropGP`)

Aggiungere dopo le invalidazioni delle query:

```typescript
// Re-compute and save historical snapshot using portfolio's snapshot date
const portfolioSnapshotDate = portfolio?.snapshot_date;
if (portfolioSnapshotDate) {
  try {
    await upsertUploadSnapshot({
      portfolioId: targetPortfolioId,
      snapshotDate: portfolioSnapshotDate,
      cashValue: (portfolio?.cash_value || 0) + cashValue,
    });
    queryClient.invalidateQueries({ queryKey: ['historical-data'] });
  } catch (snapErr) {
    console.error('[FileUploader] GP snapshot update failed:', snapErr);
  }
}
```

Il `cashValue` passato a `upsertUploadSnapshot` deve includere sia il cash del portfolio principale che il cash GP, dato che `upsertUploadSnapshot` calcola `totalValue = positionsValue + cashValue + gpTotalValue` — ma `gpTotalValue` include già il cash GP. Quindi il cashValue corretto è solo `portfolio.cash_value`.

Correzione: passare `cashValue: portfolio?.cash_value || 0` (senza aggiungere il cash GP, che è già conteggiato tramite `gpTotalValue` dentro `upsertUploadSnapshot`).

### File da modificare
1. `src/components/dashboard/FileUploader.tsx` — aggiungere chiamata `upsertUploadSnapshot` in `onDropGP`

