

# Piano: Correzione Bug Vista Aggregata

## Problema Identificato

Quando l'admin clicca su "Aggregato - Tutti", la schermata resta nera a causa di **errori SQL a cascata**.

### Causa Root

L'ID speciale `'AGGREGATED'` viene passato agli hook di fetch che tentano query con:
```sql
WHERE portfolio_id = 'AGGREGATED'
```

Ma `portfolio_id` è di tipo `uuid` in PostgreSQL, che genera l'errore:
```
ERROR: invalid input syntax for type uuid: "AGGREGATED"
```

Questo errore non gestito causa il crash dell'applicazione React.

### Log Database Rilevati

```text
[ERROR] invalid input syntax for type uuid: "AGGREGATED"
[ERROR] invalid input syntax for type uuid: "AGGREGATED"
[ERROR] invalid input syntax for type uuid: "AGGREGATED"
```

Multipli errori simultanei perche vari hook eseguono query parallele.

---

## Soluzione

### Approccio

Per la vista aggregata, gli hook devono:
1. **Riconoscere** l'ID speciale `'AGGREGATED'`
2. **Modificare la query** per fetchare TUTTI i dati (senza filtro `portfolio_id`)
3. **Aggregare** i risultati dove appropriato

---

## Modifiche Tecniche

### 1. `src/contexts/PortfolioContext.tsx`

Evitare che l'useEffect di auto-selezione resetti l'ID aggregato:

```typescript
// Riga 97 - Aggiungere check per AGGREGATED
if (selectedId === AGGREGATED_PORTFOLIO_ID) {
  if (!hasInitialized) setHasInitialized(true);
  return; // Non resettare se e' AGGREGATED
}
if (selectedId && portfolios.some(p => p.id === selectedId)) {
  ...
}
```

### 2. `src/hooks/useHistoricalData.ts`

Gestire il caso aggregato fetchando tutti i dati storici:

```typescript
export function useHistoricalData(portfolioId: string | undefined) {
  const { isAdmin } = useAuth();
  const isAggregated = portfolioId === AGGREGATED_PORTFOLIO_ID;
  
  const historicalDataQuery = useQuery({
    queryKey: ['historical-data', portfolioId],
    queryFn: async () => {
      if (!portfolioId) return [];
      
      if (isAggregated && isAdmin) {
        // Fetch ALL historical data, aggregate by date
        const { data, error } = await supabase
          .from('historical_data')
          .select('*')
          .order('snapshot_date', { ascending: false });
        
        if (error) throw error;
        return aggregateHistoricalByDate(data);
      }
      
      // Normal single-portfolio query
      const { data, error } = await supabase
        .from('historical_data')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .order('snapshot_date', { ascending: false });
      
      if (error) throw error;
      return data as HistoricalDataEntry[];
    },
    enabled: !!portfolioId && (portfolioId !== AGGREGATED_PORTFOLIO_ID || isAdmin),
  });
  ...
}
```

### 3. `src/hooks/useDeposits.ts`

Stesso pattern: fetch tutti i depositi e aggregare per data:

```typescript
if (isAggregated && isAdmin) {
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .order('deposit_date', { ascending: false });
  
  if (error) throw error;
  return data as DepositEntry[];
}
```

### 4. `src/hooks/useDerivativeOverrides.ts`

Fetch tutti gli override per vista aggregata:

```typescript
const { data: overrides = [], isLoading } = useQuery({
  queryKey: ['derivative-overrides', portfolioId],
  queryFn: async () => {
    if (!portfolioId) return [];
    
    if (portfolioId === AGGREGATED_PORTFOLIO_ID && isAdmin) {
      // Fetch ALL overrides
      const { data, error } = await supabase
        .from('derivative_overrides')
        .select('*');
      
      if (error) throw error;
      return data as DerivativeOverride[];
    }
    
    // Normal query
    const { data, error } = await supabase
      .from('derivative_overrides')
      .select('*')
      .eq('portfolio_id', portfolioId);
    
    if (error) throw error;
    return data as DerivativeOverride[];
  },
  enabled: !!portfolioId && (portfolioId !== AGGREGATED_PORTFOLIO_ID || isAdmin),
});
```

### 5. `src/hooks/usePortfolio.ts`

Il hook già gestisce `isAggregatedView` parzialmente, ma devo assicurarmi che l'aggregated portfolio abbia i valori corretti sommati:

```typescript
// Fetch all portfolios for aggregated view to sum values
const allPortfoliosQuery = useQuery({
  queryKey: ['all-portfolios-for-aggregation'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*');
    
    if (error) throw error;
    return data as Portfolio[];
  },
  enabled: isAggregatedView && isAdmin,
});

// Calculate aggregated portfolio with real sums
const aggregatedPortfolio: Portfolio | null = isAggregatedView ? {
  id: AGGREGATED_PORTFOLIO_ID,
  user_id: 'aggregated',
  name: 'Aggregato - Tutti gli Utenti',
  total_value: (allPortfoliosQuery.data || []).reduce((sum, p) => sum + (p.total_value || 0), 0),
  cash_value: (allPortfoliosQuery.data || []).reduce((sum, p) => sum + (p.cash_value || 0), 0),
  // ... altri campi sommati
} : null;
```

---

## Funzione Helper per Aggregazione Dati Storici

Per aggregare i dati storici per data:

```typescript
function aggregateHistoricalByDate(data: HistoricalDataEntry[]): HistoricalDataEntry[] {
  const byDate = new Map<string, HistoricalDataEntry>();
  
  data.forEach(entry => {
    const existing = byDate.get(entry.snapshot_date);
    if (existing) {
      byDate.set(entry.snapshot_date, {
        ...existing,
        total_value: (existing.total_value || 0) + (entry.total_value || 0),
        netting_total: (existing.netting_total || 0) + (entry.netting_total || 0),
        netting_ex_cc: (existing.netting_ex_cc || 0) + (entry.netting_ex_cc || 0),
        netting_ex_cc_np: (existing.netting_ex_cc_np || 0) + (entry.netting_ex_cc_np || 0),
        deposits: (existing.deposits || 0) + (entry.deposits || 0),
      });
    } else {
      byDate.set(entry.snapshot_date, { ...entry });
    }
  });
  
  return Array.from(byDate.values())
    .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
}
```

---

## File Coinvolti

| File | Modifica |
|------|----------|
| `src/contexts/PortfolioContext.tsx` | Evitare reset di AGGREGATED nell'useEffect |
| `src/hooks/useHistoricalData.ts` | Gestire query aggregata |
| `src/hooks/useDeposits.ts` | Gestire query aggregata |
| `src/hooks/useDerivativeOverrides.ts` | Gestire query aggregata |
| `src/hooks/usePortfolio.ts` | Sommare valori da tutti i portfolios |

---

## Note Importanti

La vista aggregata e **read-only**: le operazioni di modifica (upsert, delete) devono essere disabilitate quando `isAggregatedView` e `true`. Questo e già parzialmente gestito tramite `isReadOnly` in alcuni hook, ma verifichero che sia consistente.

