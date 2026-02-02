
# Piano: Migliorare Breakdown Holdings + Fix ETF Top Holdings

## Problemi Identificati

### Problema 1: Breakdown manca informazioni protezioni

Nel breakdown dialog, la sezione Stock mostra solo:
- Quantità azioni e prezzo
- Valore lordo e valore con protezione

Ma **NON mostra**:
- Numero di contratti PUT di protezione
- Strike medio ponderato delle protezioni

Questi dati sono disponibili in `StockRiskDetail` (dal `riskCalculator.ts`):
- `protectionStrike: number | null`
- `protectionContracts: number`
- `hasProtection: boolean`

...ma non vengono passati a `ConsolidatedHoldingWithDetails.stockDetails`.

### Problema 2: ETF Top Holdings vuote nel database

Tutti gli ETF nel database hanno:
- `top_holdings: []` (array vuoto)
- `last_fetched_at: 2020-01-01` (cache invalidata)

Il fallback AI per le top holdings è implementato nell'edge function (`fetchETFTopHoldingsWithAI`), ma non viene mai chiamato perché:
1. La cache è stata invalidata manualmente (data vecchia)
2. Il frontend usa `useETFAllocations` che non richiede un refresh esplicito se i dati esistono nel database (anche se vecchi)
3. L'hook ha una logica di caching che evita chiamate ripetute

## Correzioni Richieste

### Correzione 1: Estendere stockDetails con informazioni protezioni

**File**: `src/lib/sectorExposure.ts`

Modificare l'interfaccia `ConsolidatedHoldingWithDetails.stockDetails`:

```typescript
stockDetails: Array<{
  quantity: number;
  price: number;
  currency: string;
  value: number;
  valueWithProtection: number;
  // NUOVI CAMPI:
  protectionContracts: number;      // Numero PUT di protezione
  protectionStrike: number | null;  // Strike medio ponderato
  hasProtection: boolean;
}>;
```

E modificare il loop che popola `stockDetails` per includere questi campi:

```typescript
holding.stockDetails.push({
  quantity: stock.stockQuantity,
  price: stock.stockPrice,
  currency: stock.currency,
  value: stockValueEUR,
  valueWithProtection: stock.riskEUR,
  // Nuovi campi dalle protezioni:
  protectionContracts: stock.protectionContracts,
  protectionStrike: stock.protectionStrike,
  hasProtection: stock.hasProtection,
});
```

### Correzione 2: Aggiornare HoldingBreakdownDialog per mostrare protezioni

**File**: `src/components/risk/HoldingBreakdownDialog.tsx`

Nella sezione Stock, aggiungere visualizzazione delle protezioni:

```tsx
{holding.stockDetails.map((stock, i) => (
  <div key={i} className="p-3">
    <div className="text-sm">
      {formatNumber(stock.quantity)} azioni @ {stock.currency} {formatNumber(stock.price, 2)}
    </div>
    
    {/* NUOVO: Mostra info protezione se presente */}
    {stock.hasProtection && stock.protectionContracts > 0 && (
      <div className="text-xs text-green-500 mt-1">
        Protetto: {stock.protectionContracts} PUT × Strike {formatNumber(stock.protectionStrike, 0)}
      </div>
    )}
    
    <div className="text-right">
      <div className="font-medium text-blue-500">
        {formatEUR(includeProtections ? stock.valueWithProtection : stock.value)}
      </div>
      {includeProtections && stock.hasProtection && (
        <div className="text-xs text-green-500">
          (Lordo: {formatEUR(stock.value)})
        </div>
      )}
    </div>
  </div>
))}
```

### Correzione 3: Forzare refresh ETF con data vecchia

**File**: `src/hooks/useETFAllocations.ts`

Modificare la logica di caching per considerare gli ETF con `last_fetched_at` troppo vecchio come "stale":

```typescript
// Se cache è più vecchia di 30 giorni, considera stale
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni

const isStale = (lastFetchedAt: string) => {
  const lastFetched = new Date(lastFetchedAt).getTime();
  return Date.now() - lastFetched > CACHE_TTL_MS;
};
```

Oppure, più semplicemente, forzare un refresh immediato per gli ETF con `top_holdings` vuoto.

### Correzione 4: Trigger refresh iniziale al mount

**File**: `src/pages/RiskAnalyzer.tsx` o `src/hooks/useETFAllocations.ts`

Quando la vista carica e rileva ETF senza top holdings, triggerare automaticamente un refresh:

```typescript
useEffect(() => {
  // Dopo aver caricato allocations, controlla quanti hanno top_holdings vuote
  const emptyHoldings = etfIsins.filter(isin => 
    allocations[isin] && (!allocations[isin].topHoldings || allocations[isin].topHoldings.length === 0)
  );
  
  if (emptyHoldings.length > 0 && !hasFetchedETFs) {
    // Forza refresh con flag per bypassare cache
    fetchMultipleAllocations(emptyHoldings, true); // forceRefresh = true
  }
}, [allocations, etfIsins]);
```

## File da Modificare

| File | Modifica |
|------|----------|
| `src/lib/sectorExposure.ts` | Estendere `stockDetails` con campi protezione |
| `src/components/risk/HoldingBreakdownDialog.tsx` | Mostrare contratti e strike protezione |
| `src/hooks/useETFAllocations.ts` | Aggiungere logica per refresh ETF stale |

## Risultato Atteso

### Breakdown per ALIBABA:

**Stock Diretto**
- 100 azioni @ USD 175.66
- Protetto: 1 PUT × Strike 90
- Valore: €14.669 (Lordo: €14.669) — nota: strike 90 < prezzo 175, quindi protezione non riduce rischio

**Naked PUT**
- Strike 165 • 1 contratto • GIU/26 → €13.784
- Strike 170 • 1 contratto • SET/25 → €14.202
- Subtotale PUT: €27.986

**Totale**: €42.655

### Badge ETF:
Dopo il refresh degli ETF, le top holdings verranno popolate dall'AI e il badge ETF apparirà per i titoli presenti negli ETF (es. Apple, Microsoft, etc.)

## Sequenza di Implementazione

1. Estendere interfaccia `stockDetails` con campi protezione
2. Modificare loop in `calculateConsolidatedTopHoldings` per passare i dati protezione
3. Aggiornare `HoldingBreakdownDialog` per visualizzare le protezioni
4. Aggiungere logica refresh per ETF con cache stale
5. Testare che Alibaba mostri correttamente 1 PUT protezione @ strike 90
