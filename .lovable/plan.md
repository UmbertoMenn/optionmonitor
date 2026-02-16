

## Fix: Mostrare ticker non risolti delle azioni nella sezione admin Ticker

### Problema

L'hook `useUnderlyingMappings` (riga 34-60) cerca i sottostanti non risolti solo tra le posizioni con `asset_type IN ('OPTION', 'WARRANT', 'derivative')`. Le azioni (`asset_type = 'stock'`) non vengono mai considerate, quindi nella sezione admin "Ticker Non Risolti" non appaiono mai.

### Soluzione

**File: `src/hooks/useUnderlyingMappings.ts`**

Modificare la `unresolvedQuery` per includere anche le posizioni stock:

1. Aggiungere una query per le posizioni stock con `ticker IS NULL`
2. Estrarre le descrizioni, pulirle (rimuovere prefisso "AZ.", trim)
3. Verificare quali non hanno corrispondenza in `underlying_mappings`
4. Unire i risultati con gli underlying dei derivati non risolti (deduplicando)

### Dettaglio tecnico

```text
// Dentro unresolvedQuery queryFn, DOPO il blocco derivati:

// Fetch stock positions without ticker
const { data: stocks, error: stocksError } = await supabase
  .from('positions')
  .select('description')
  .eq('asset_type', 'stock')
  .is('ticker', null);

if (stocksError) throw stocksError;

// Clean stock descriptions and add unique ones
const stockNames = [...new Set(
  stocks
    ?.map(s => s.description?.replace(/^AZ\./i, '').trim())
    .filter((d): d is string => Boolean(d))
)];

// Merge with derivative underlyings, check against mappings
const allUnresolved = [...uniqueUnderlyings, ...stockNames];
const mappedUnderlyings = new Set(mappings?.map(m => m.underlying));

return allUnresolved.filter(u => !mappedUnderlyings.has(u)).sort();
```

Bisogna anche verificare la corrispondenza normalizzata (non solo esatta) per evitare falsi positivi.

### File da modificare

| File | Modifica |
|---|---|
| `src/hooks/useUnderlyingMappings.ts` | Aggiungere posizioni stock alla `unresolvedQuery` per mostrare azioni senza mapping nella sezione admin |

### Risultato atteso

- La sezione admin "Ticker Non Risolti" mostra sia i sottostanti dei derivati che le descrizioni delle azioni senza mapping
- L'admin puo' risolvere i mapping mancanti direttamente dalla sezione Ticker
- I ticker risolti appaiono automaticamente nel dialog Gestione Avvisi

