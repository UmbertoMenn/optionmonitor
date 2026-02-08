
# Piano: Correzione Valori Nulli al Cambio Portfolio

## Problema Identificato

Quando si entra in un portfolio (cambio selezione o uscita da admin mode), la giacenza media e il patrimonio iniziale vengono mostrati come "—" fino al refresh della pagina.

### Causa Radice

Il problema è nel flusso di inizializzazione in `Dashboard.tsx`:

```typescript
// Riga 92-98: Reset quando cambia portfolio
useEffect(() => {
  setHasInitializedDate(false);        // Reset flag
  setSelectedHistoricalDate(null);     // Reset data → valori nulli
  setPlDeposits(0);
  setAverageBalance(0);
  setIsManualAverageBalance(false);
}, [portfolio?.id]);

// Riga 84-89: Inizializza dopo il caricamento dati
useEffect(() => {
  if (!hasInitializedDate && earliestEntry && historicalData.length > 0) {
    setSelectedHistoricalDate(earliestEntry.snapshot_date);
    setHasInitializedDate(true);
  }
}, [earliestEntry, historicalData.length, hasInitializedDate]);
```

**Sequenza problematica:**
1. `portfolio?.id` cambia → primo effect si attiva → `selectedHistoricalDate = null`
2. React fa render → StatsCards vede `selectedHistoricalEntry = null` → mostra "—"
3. Query `useHistoricalData` termina (o era già in cache)
4. `earliestEntry` diventa disponibile → secondo effect si attiva → imposta `selectedHistoricalDate`
5. React fa secondo render → ora i valori sono visibili

Il problema è che tra il passo 1 e il passo 4, c'è almeno un render dove i dati appaiono nulli. Se la query è già in cache, questo flash è brevissimo, ma comunque visibile.

---

## Soluzione

### Strategia: Inizializzazione Immediata Senza Reset Distruttivo

Invece di resettare tutto a `null` e poi ri-inizializzare, modifichiamo la logica per:
1. **NON resettare `selectedHistoricalDate` a null** quando cambia portfolio
2. Lasciare che l'effect di inizializzazione aggiorni il valore quando i nuovi dati arrivano
3. In `StatsCards`, se `selectedHistoricalDate` non corrisponde a nessun entry valido, fallback silenzioso

### Modifiche Necessarie

**File: `src/components/dashboard/Dashboard.tsx`**

1. **Rimuovere il reset di `selectedHistoricalDate` a `null`** dal primo effect:
```typescript
// PRIMA
useEffect(() => {
  setHasInitializedDate(false);
  setSelectedHistoricalDate(null);  // ← Causa il problema
  setPlDeposits(0);
  setAverageBalance(0);
  setIsManualAverageBalance(false);
}, [portfolio?.id]);

// DOPO - Solo reset flag e valori calcolati, non la data selezionata
useEffect(() => {
  setHasInitializedDate(false);
  // Non resettare selectedHistoricalDate qui!
  setPlDeposits(0);
  setAverageBalance(0);
  setIsManualAverageBalance(false);
}, [portfolio?.id]);
```

2. **Modificare l'effect di inizializzazione** per aggiornare `selectedHistoricalDate` quando i dati cambiano (anche se non è la prima volta):
```typescript
// DOPO - Inizializza quando i dati del nuovo portfolio sono pronti
useEffect(() => {
  // Se i dati storici sono vuoti, reset a null
  if (historicalData.length === 0) {
    setSelectedHistoricalDate(null);
    return;
  }
  
  // Se la data selezionata non esiste più nei nuovi dati, o non è mai stata inizializzata
  const currentDateExists = selectedHistoricalDate && 
    historicalData.some(h => h.snapshot_date === selectedHistoricalDate);
  
  if (!currentDateExists && earliestEntry) {
    setSelectedHistoricalDate(earliestEntry.snapshot_date);
  }
}, [historicalData, earliestEntry, selectedHistoricalDate]);
```

Questa logica:
- **Se non ci sono dati storici**: `selectedHistoricalDate` diventa `null` (corretto)
- **Se la data selezionata non esiste nei nuovi dati**: aggiorna alla data più vecchia del nuovo portfolio
- **Se la data selezionata esiste ancora**: la mantiene (utile se si passa tra portfolii con date in comune)

3. **Rimuovere il flag `hasInitializedDate`** che non è più necessario con questa logica.

---

## Riepilogo Modifiche

| File | Modifica |
|------|----------|
| `src/components/dashboard/Dashboard.tsx` | Rimuovere reset di `selectedHistoricalDate` nel primo effect; riscrivere effect di inizializzazione per validare data contro dati correnti |

---

## Flusso Corretto Dopo le Modifiche

```
1. portfolio?.id cambia
2. Effect di reset: azzera plDeposits, averageBalance (ma NON selectedHistoricalDate)
3. Render: selectedHistoricalDate ancora valido dal portfolio precedente
4. Query useHistoricalData: restituisce dati del nuovo portfolio
5. Effect di validazione: la data non esiste nei nuovi dati → aggiorna a earliestEntry
6. Render: dati corretti visualizzati
```

Se la query è in cache, i passi 3-6 avvengono nello stesso ciclo di render, eliminando il flash.

---

## Comportamento Atteso

- **Cambio portfolio**: giacenza media e patrimonio iniziale visibili immediatamente (o con minimo ritardo se query in corso)
- **Uscita admin mode**: transizione fluida senza valori nulli temporanei
- **Portfolio senza dati storici**: mostra correttamente "—" perché non ci sono entry
