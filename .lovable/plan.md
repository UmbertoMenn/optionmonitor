
## Piano: Clustering Temporale e di Strike per Distinguere Protezioni da Strategie

### Il Problema Attuale
Nello Step 2, le PUT comprate con sottostante in portafoglio vengono classificate immediatamente come "Protezioni". Questo impedisce allo Step 5 di vedere tutte le gambe e riconoscere strategie multi-leg come Put Broken Wing Butterfly.

Il filtro `hasCloseExpiries` (12 mesi) esiste ma:
1. Viene applicato troppo tardi (Step 5)
2. È un filtro assoluto, non relativo tra le gambe

### La Soluzione: Clustering Bidimensionale

Classificare le gambe in **cluster** basati su due dimensioni:
- **Scadenza**: gambe con scadenze vicine TRA LORO (max 100 giorni)
- **Strike**: gambe con strike "correlati" (stessa area di prezzo)

Una PUT comprata viene classificata come **Protezione** solo se è **isolata** (non appartiene a nessun cluster con altre gambe vendute).

---

### Algoritmo di Clustering

```text
1. Raggruppa tutte le opzioni per sottostante

2. Per ogni sottostante, crea cluster temporali:
   - Ordina le opzioni per scadenza
   - Crea un nuovo cluster per ogni gap > 100 giorni
   
3. Per ogni cluster:
   - Se contiene sia opzioni COMPRATE che VENDUTE → potenziale strategia
   - Se contiene SOLO opzioni comprate → candidato protezione
   
4. Una PUT comprata è una Protezione se:
   a) È in un cluster senza opzioni vendute, OPPURE
   b) È l'UNICA opzione sul sottostante, OPPURE
   c) È separata da > 100 giorni dal cluster più vicino con opzioni vendute
```

---

### Esempio Pratico

**Scenario: Alibaba con 4 opzioni**

| Tipo | Strike | Scadenza | Qty |
|------|--------|----------|-----|
| PUT  | 85     | Feb 2026 | +1  |
| PUT  | 95     | Mar 2025 | -2  |
| PUT  | 100    | Mar 2025 | +1  |
| PUT  | 110    | Mar 2025 | +1  |

**Clustering Temporale (max 100 giorni):**
- Cluster A: [PUT 95, PUT 100, PUT 110] → tutte Mar 2025 (delta: 0 giorni)
- Cluster B: [PUT 85] → Feb 2026 (delta da Cluster A: ~330 giorni)

**Analisi per Cluster:**
- Cluster A: ha sia comprate (+1×100, +1×110) che vendute (-2×95) → **Strategia**
- Cluster B: solo comprate (+1×85), isolata temporalmente → **Protezione**

**Risultato:**
- PUT 85 Feb 2026 → **Protezione**
- PUT 95/100/110 Mar 2025 → Step 5 rileva **Put Broken Wing Butterfly**

---

### Caso Limite: Due Gambe Isolate

**Scenario: PUT comprata + PUT venduta con scadenze lontane**

| Tipo | Strike | Scadenza | Qty |
|------|--------|----------|-----|
| PUT  | 85     | Feb 2026 | +1  |
| PUT  | 100    | Mar 2025 | -1  |

**Clustering:**
- Cluster A: [PUT 100 Mar 2025] → venduta, isolata
- Cluster B: [PUT 85 Feb 2026] → comprata, isolata

**Risultato:**
- Delta temporale: ~330 giorni > 100 → **Non sono la stessa strategia**
- PUT 85 Feb 2026 → **Protezione** (se ho il sottostante)
- PUT 100 Mar 2025 → **Naked Put** (Step 6)

---

### Modifiche Tecniche

**File: `src/lib/derivativeStrategies.ts`**

**1. Nuova Funzione Helper: `clusterByExpiry`**

```typescript
/**
 * Raggruppa le opzioni in cluster basati sulla vicinanza temporale delle scadenze.
 * Due opzioni sono nello stesso cluster se la distanza tra le loro scadenze è ≤ maxDaysGap.
 */
function clusterByExpiry(options: Position[], maxDaysGap: number = 100): Position[][] {
  if (options.length === 0) return [];
  
  // Ordina per scadenza
  const sorted = [...options].sort((a, b) => {
    const dateA = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
    const dateB = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
    return dateA - dateB;
  });
  
  const clusters: Position[][] = [];
  let currentCluster: Position[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const prevDate = sorted[i - 1].expiry_date ? new Date(sorted[i - 1].expiry_date).getTime() : 0;
    const currDate = sorted[i].expiry_date ? new Date(sorted[i].expiry_date).getTime() : 0;
    const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
    
    if (diffDays <= maxDaysGap) {
      // Stessa cluster
      currentCluster.push(sorted[i]);
    } else {
      // Nuovo cluster
      clusters.push(currentCluster);
      currentCluster = [sorted[i]];
    }
  }
  
  clusters.push(currentCluster);
  return clusters;
}
```

**2. Nuova Funzione Helper: `clusterHasSoldOptions`**

```typescript
/**
 * Verifica se un cluster contiene opzioni vendute (quantity < 0)
 */
function clusterHasSoldOptions(cluster: Position[]): boolean {
  return cluster.some(o => o.quantity < 0);
}
```

**3. Modifica Step 2 (Protezioni)**

Prima di classificare una PUT comprata come protezione, verificare se appartiene a un cluster con opzioni vendute:

```typescript
// ============ STEP 2: Find Protezioni (Long PUT) ============

// Per ogni sottostante, raggruppa TUTTE le opzioni (non solo PUT)
const allOptionsByUnderlying = new Map<string, Position[]>();

for (const d of filteredDerivatives) {
  if (usedDerivatives.has(d.id)) continue;
  const underlyingKey = normalizeForMatching(d.underlying || d.description);
  
  if (!allOptionsByUnderlying.has(underlyingKey)) {
    allOptionsByUnderlying.set(underlyingKey, []);
  }
  allOptionsByUnderlying.get(underlyingKey)!.push(d);
}

// Per ogni sottostante con PUT comprate e stock
for (const [underlyingKey, allOptions] of allOptionsByUnderlying.entries()) {
  const stock = findUnderlyingStock(allOptions[0], stockPositions);
  if (!stock || stock.quantity <= 0) continue;
  
  const boughtPuts = allOptions.filter(o => o.option_type === 'put' && o.quantity > 0);
  if (boughtPuts.length === 0) continue;
  
  // Crea cluster temporali per TUTTE le opzioni su questo sottostante
  const clusters = clusterByExpiry(allOptions, 100);
  
  for (const put of boughtPuts) {
    // Trova il cluster a cui appartiene questa PUT
    const putCluster = clusters.find(c => c.some(o => o.id === put.id));
    
    if (!putCluster) continue;
    
    // Se il cluster ha opzioni vendute → potenziale strategia, rinvia
    if (clusterHasSoldOptions(putCluster)) {
      // NON classificare come protezione, lascia che Step 5 la gestisca
      // Aggiungi a partialProtectionCandidates come fallback
      if (!partialProtectionCandidates.has(underlyingKey)) {
        partialProtectionCandidates.set(underlyingKey, { 
          puts: [], 
          stock,
          deferredForStrategy: true 
        });
      }
      partialProtectionCandidates.get(underlyingKey)!.puts.push(put);
      continue;
    }
    
    // Cluster senza opzioni vendute → questa PUT è una protezione
    const stockContracts = Math.floor(stock.quantity / 100);
    const allLongPuts = boughtPuts.reduce((sum, p) => sum + p.quantity, 0);
    const isPartial = stockContracts - allLongPuts > 0;
    
    longPuts.push({
      option: put,
      underlying: stock,
      contracts: put.quantity,
      isPartial
    });
    usedDerivatives.add(put.id);
  }
}
```

**4. Aggiornamento Step 6 (Fallback)**

Le PUT rinviate che non sono state usate in strategie diventano protezioni:

```typescript
// Step 6: Singole gambe
for (const option of singleLegs) {
  // ... codice esistente ...
  
  // Check if this is a deferred PUT that didn't form a strategy
  if (option.option_type === 'put' && option.quantity > 0) {
    const candidate = partialProtectionCandidates.get(underlyingKey);
    if (candidate?.deferredForStrategy && candidate.puts.some(p => p.id === option.id)) {
      // Era stata rinviata, ma nessuna strategia è stata riconosciuta
      // → Classifica come protezione (fallback)
      const stockContracts = Math.floor(candidate.stock.quantity / 100);
      const totalPuts = candidate.puts.reduce((s, p) => s + p.quantity, 0);
      
      longPuts.push({
        option,
        underlying: candidate.stock,
        contracts: option.quantity,
        isPartial: stockContracts - totalPuts > 0
      });
      usedDerivatives.add(option.id);
      continue;
    }
  }
  
  // ... resto del codice esistente ...
}
```

---

### Flusso Risultante

```text
STEP 0: Override manuali

STEP 1: Covered Call (CALL vendute con stock)

STEP 2: Protezioni (PUT comprate con stock)
   ├─ Clusterizza TUTTE le opzioni per sottostante (max 100 giorni)
   ├─ Per ogni PUT comprata:
   │   ├─ Se il suo cluster ha opzioni vendute → RINVIA
   │   └─ Se il suo cluster è "puro" (solo comprate) → Protezione
   └─ Le PUT rinviate restano disponibili per Step 3-5

STEP 3: Iron Condor

STEP 4: Double Diagonal

STEP 5: Altre Strategie
   └─ Riceve le PUT rinviate e forma pattern (Butterfly, Spread, ecc.)

STEP 6: Singole gambe
   ├─ PUT rinviate non usate → Protezione (fallback)
   ├─ PUT vendute → Naked Put
   └─ CALL comprate → Leap Call
```

---

### Tabella Riepilogativa

| Scenario | Cluster | Risultato |
|----------|---------|-----------|
| PUT comprata isolata (unica opzione) | - | Protezione |
| PUT comprata + PUT vendute stessa scadenza | Misto | Rinvia → Step 5 cerca strategia |
| PUT comprata + PUT vendute scadenze > 100gg | Separati | Protezione + Naked Put |
| 4 PUT (Butterfly) tutte stessa scadenza | Unico misto | Rinvia → Put Broken Wing Butterfly |
| PUT 85 Feb26 + 3 PUT Mar25 | 2 cluster | PUT 85 = Protezione, altre = Butterfly |

---

### Vantaggi della Soluzione

1. **Dinamica**: non dipende da date fisse, solo dalla distanza relativa tra gambe
2. **Robusta**: funziona anche quando le protezioni si avvicinano alla scadenza
3. **Fallback sicuro**: le PUT rinviate che non formano strategie diventano comunque protezioni
4. **Preserva logica esistente**: non modifica `detectStrategyName`, solo il flusso di classificazione

---

### File Modificato

| File | Modifica |
|------|----------|
| `src/lib/derivativeStrategies.ts` | +2 nuovi helper, modifica Step 2, aggiorna Step 6 |
