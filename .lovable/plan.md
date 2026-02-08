
# Piano: Correzione Dashboard Nera su Cambio Vista e Uscita Admin Mode

## Problema Identificato

La dashboard diventa nera (crash) in due scenari:
1. **Cambio vista** (Base → Netting, etc.)
2. **Uscita dalla admin mode** (clic sulla X)

### Causa Radice

Il problema è un **anti-pattern React** nel file `Dashboard.tsx` (righe 99-102):

```typescript
// ❌ ERRORE: setState durante il render!
if (earliestEntry && !selectedHistoricalDate && historicalData.length > 0) {
  setSelectedHistoricalDate(earliestEntry.snapshot_date);
}
```

Questo codice:
1. Viene eseguito **durante la fase di render** (non in un `useEffect`)
2. Chiama `setSelectedHistoricalDate()` che triggera un nuovo render
3. Quando cambia `viewMode`, la queryKey di `useHistoricalData` cambia → i dati vengono refetchati → `earliestEntry` cambia → nuovo setState → loop infinito → crash

### Problema Secondario

Quando si esce dalla admin mode, il `portfolio?.id` cambia improvvisamente e può causare:
- Query con ID invalido temporaneo
- Dati undefined che causano errori nei componenti figli

---

## Soluzione

### 1. Spostare la logica di inizializzazione in un `useEffect`

Convertire il codice problematico in un `useEffect` che si attiva solo una volta al caricamento iniziale dei dati:

```typescript
// ✅ CORRETTO: useEffect per inizializzazione una tantum
const [hasInitializedDate, setHasInitializedDate] = useState(false);

useEffect(() => {
  // Inizializza solo UNA VOLTA quando i dati sono disponibili
  if (!hasInitializedDate && earliestEntry && historicalData.length > 0) {
    setSelectedHistoricalDate(earliestEntry.snapshot_date);
    setHasInitializedDate(true);
  }
}, [earliestEntry, historicalData.length, hasInitializedDate]);

// Reset quando cambia portfolio
useEffect(() => {
  setHasInitializedDate(false);
  setSelectedHistoricalDate(null);
}, [portfolio?.id]);
```

### 2. Rimuovere `viewMode` dalla queryKey di `useHistoricalData`

La `viewMode` non dovrebbe essere nella queryKey perché i dati storici sono gli stessi - solo il calcolo degli apporti sintetici cambia. Questo evita refetch inutili:

```typescript
// Prima:
queryKey: ['historical-data', portfolioId, viewMode],

// Dopo:
queryKey: ['historical-data', portfolioId],
```

E calcolare i `syntheticDeposits` **a livello di componente** usando `useMemo`, non dentro la query.

### 3. Aggiungere gestione errori con ErrorBoundary wrapper

Verificare che il componente `Dashboard` sia protetto da un ErrorBoundary per evitare schermate nere in caso di errori non gestiti.

---

## Modifiche ai File

### File 1: `src/components/dashboard/Dashboard.tsx`

**Rimuovere** le righe 99-102 (setState durante render):
```typescript
// RIMUOVERE QUESTO:
if (earliestEntry && !selectedHistoricalDate && historicalData.length > 0) {
  setSelectedHistoricalDate(earliestEntry.snapshot_date);
}
```

**Aggiungere** `useEffect` per inizializzazione:
```typescript
// Flag per evitare re-inizializzazioni
const [hasInitializedDate, setHasInitializedDate] = useState(false);

// Inizializza selectedHistoricalDate solo una volta al primo caricamento
useEffect(() => {
  if (!hasInitializedDate && earliestEntry && historicalData.length > 0) {
    setSelectedHistoricalDate(earliestEntry.snapshot_date);
    setHasInitializedDate(true);
  }
}, [earliestEntry, historicalData.length, hasInitializedDate]);

// Reset quando cambia portfolio
useEffect(() => {
  setHasInitializedDate(false);
  setSelectedHistoricalDate(null);
  setPlDeposits(0);
  setAverageBalance(0);
  setIsManualAverageBalance(false);
}, [portfolio?.id]);
```

### File 2: `src/hooks/useHistoricalData.ts`

**Rimuovere `viewMode` dalla queryKey** per evitare refetch inutili:

```typescript
// Prima:
queryKey: ['historical-data', portfolioId, viewMode],

// Dopo:
queryKey: ['historical-data', portfolioId],
```

**Calcolare `syntheticDeposits` separatamente** usando `useMemo` basato su `viewMode`:

```typescript
// I dati grezzi dalla query
const rawResult = historicalDataQuery.data || { entries: [], syntheticDeposits: [] };

// Ricalcola syntheticDeposits quando cambia viewMode
const syntheticDeposits = useMemo(() => {
  if (!isAggregated || rawResult.entries.length === 0) {
    return rawResult.syntheticDeposits;
  }
  
  // Raggruppa per portfolio e calcola il primo valore con viewMode corrente
  const byPortfolio = new Map<string, HistoricalDataEntry[]>();
  // ... logica per ricalcolare con viewMode attuale
  
  return recalculatedDeposits;
}, [rawResult, viewMode, isAggregated]);
```

### File 3: `src/App.tsx`

Verificare che `Dashboard` sia wrappato in un ErrorBoundary. Se non lo e', aggiungere:

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

// In AppRoutes:
<Route path="/" element={
  <ErrorBoundary title="Errore nel caricamento della dashboard">
    <Dashboard />
  </ErrorBoundary>
} />
```

---

## Riepilogo Modifiche

| File | Modifica |
|------|----------|
| `src/components/dashboard/Dashboard.tsx` | Spostare inizializzazione `selectedHistoricalDate` in `useEffect`, aggiungere reset su cambio portfolio |
| `src/hooks/useHistoricalData.ts` | Rimuovere `viewMode` dalla queryKey, calcolare syntheticDeposits in `useMemo` separato |
| `src/App.tsx` | Aggiungere ErrorBoundary wrapper per Dashboard |

---

## Comportamento Atteso

1. **Cambio vista**: La dashboard rimane visibile, i dati storici non vengono refetchati, solo i syntheticDeposits vengono ricalcolati
2. **Uscita admin mode**: Transizione fluida al portfolio personale, reset dello stato senza crash
3. **Errori imprevisti**: ErrorBoundary mostra un messaggio invece di schermo nero
