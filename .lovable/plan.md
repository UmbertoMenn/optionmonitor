
# Piano: Correzione Errore React "Should have a queue"

## Problema Identificato

L'errore si verifica perche' il `useMemo` per `syntheticDeposits` (righe 217-253 di `useHistoricalData.ts`) tenta di ricalcolare gli apporti sintetici partendo dalle `entries` gia' aggregate, ma queste hanno tutte `portfolio_id: 'AGGREGATED'` dopo l'aggregazione.

### Flusso Attuale (Errato)
```text
1. Query fetcha dati raw dal DB
2. aggregateHistoricalWithInterpolation():
   - Raggruppa per portfolio_id ✓
   - Calcola syntheticDeposits con viewMode='base' ✓
   - Aggrega entries (portfolio_id diventa 'AGGREGATED') ✓
3. useMemo per syntheticDeposits:
   - Prova a raggruppare entries per portfolio_id
   - Ma tutte hanno portfolio_id='AGGREGATED' → un solo gruppo
   - Risultato errato
```

### Problema Root Cause
Il `useMemo` non puo' ricalcolare i synthetic deposits perche' le entries restituite dalla query hanno gia' perso l'informazione del portfolio originale.

---

## Soluzione

### Strategia A: Salvare i Dati Raw nella Query

Modificare la struttura di ritorno della query per includere anche i dati raw (non aggregati) da usare per ricalcolare i syntheticDeposits.

```typescript
interface AggregatedHistoricalResult {
  entries: HistoricalDataEntry[];
  syntheticDeposits: SyntheticDeposit[];
  rawEntries?: HistoricalDataEntry[]; // NEW: dati originali per ricalcolo
}
```

### Modifiche a useHistoricalData.ts

**1. Modificare la funzione di aggregazione per restituire anche i dati raw:**

```typescript
function aggregateHistoricalWithInterpolation(
  data: HistoricalDataEntry[],
  viewMode: ViewMode = 'base'
): AggregatedHistoricalResult {
  // ... codice esistente ...
  
  return {
    entries: aggregated.sort(...),
    syntheticDeposits,
    rawEntries: data, // Salva i dati originali
  };
}
```

**2. Modificare la queryFn per passare rawEntries:**

```typescript
// Vista aggregata
if (isAggregated && isAdmin) {
  const { data, error } = await supabase
    .from('historical_data')
    .select('*')
    .order('snapshot_date', { ascending: false });
  
  if (error) throw error;
  const result = aggregateHistoricalWithInterpolation(
    data as unknown as HistoricalDataEntry[], 
    'base'
  );
  // rawEntries gia' incluso nel risultato
  return result;
}
```

**3. Modificare il useMemo per usare rawEntries:**

```typescript
const syntheticDeposits = useMemo((): SyntheticDeposit[] => {
  // Usa rawEntries se disponibile (vista aggregata)
  const rawEntries = historicalDataQuery.data?.rawEntries;
  
  // Per non-aggregated o senza raw data
  if (!isAggregated || !rawEntries || rawEntries.length === 0) {
    return [];
  }
  
  // Raggruppa per portfolio_id originale
  const byPortfolio = new Map<string, HistoricalDataEntry[]>();
  rawEntries.forEach(entry => {
    const list = byPortfolio.get(entry.portfolio_id) || [];
    list.push(entry);
    byPortfolio.set(entry.portfolio_id, list);
  });
  
  // ... resto del calcolo con viewMode attuale
}, [historicalDataQuery.data?.rawEntries, viewMode, isAggregated]);
```

---

## Modifiche ai Tipi

**File: `src/types/historicalData.ts`**

```typescript
export interface AggregatedHistoricalResult {
  entries: HistoricalDataEntry[];
  syntheticDeposits: SyntheticDeposit[];
  rawEntries?: HistoricalDataEntry[]; // Dati originali per ricalcolo viewMode
}
```

---

## Riepilogo Modifiche

| File | Modifica |
|------|----------|
| `src/types/historicalData.ts` | Aggiungere campo `rawEntries` opzionale a `AggregatedHistoricalResult` |
| `src/hooks/useHistoricalData.ts` | 1. Salvare dati raw nel risultato aggregazione 2. Usare `rawEntries` nel useMemo per syntheticDeposits |

---

## Flusso Corretto Dopo le Modifiche

```text
1. Query fetcha dati raw dal DB
2. aggregateHistoricalWithInterpolation():
   - Raggruppa per portfolio_id ✓
   - Calcola syntheticDeposits iniziali (viewMode='base') ✓
   - Aggrega entries (portfolio_id='AGGREGATED') ✓
   - SALVA rawEntries (dati originali con portfolio_id veri) ✓
3. useMemo per syntheticDeposits:
   - USA rawEntries (non entries aggregate) ✓
   - Raggruppa per portfolio_id originale ✓
   - Ricalcola con viewMode attuale ✓
```

---

## Comportamento Atteso

1. **Nessun errore React**: Il useMemo opera su dati stabili e corretti
2. **Cambio viewMode funziona**: I syntheticDeposits vengono ricalcolati correttamente
3. **Uscita admin mode**: Transizione pulita senza crash
4. **Calcoli corretti**: P/L e giacenza media usano i valori giusti per la viewMode selezionata
