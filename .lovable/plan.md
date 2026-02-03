
## Piano: Card Riepilogativa Strategie Derivati

### Obiettivo
Aggiungere una card principale in alto nella pagina Derivati che riassuma lo stato di tutte le strategie e le potenziali azioni da intraprendere.

---

### Struttura della Card

La card sarà suddivisa in **6 sezioni** con informazioni visualizzate in modo compatto:

| Sezione | Contenuto | Stile |
|---------|-----------|-------|
| 1. Covered Call da vendere | Ticker × azioni scoperte | Neutro |
| 2. Call non coperte | Ticker + strategia | Rosso + triangolo |
| 3. Covered Call ITM | Ticker + strike + contratti | Giallo/Arancio |
| 4. Iron Condor IR/OOR | Lista ticker con badge | Verde/Rosso |
| 5. Double Diagonal IR/OOR | Lista ticker con badge (inclusi Alternative) | Verde/Rosso |
| 6. Altre Strategie IB/OOB/IR/OOR | Ticker + tipo badge | Verde/Rosso |

---

### Logica di Calcolo per Ogni Sezione

#### 1. Covered Call da vendere
**Formula**: Per ogni sottostante con azioni in portafoglio:
```
Contratti vendibili = floor(azioni possedute / 100) - contratti CALL vendute sullo stesso sottostante
```
Mostra solo se `Contratti vendibili >= 1`

**Output**: `AAPL: 100 azioni` (significa 1 contratto vendibile)

---

#### 2. Call vendute non coperte (Naked Call)
**Formula**:
```
Bilancio = floor(azioni possedute / 100) - (call vendute - call comprate)
```
Se `Bilancio < 0` → **Allarme**

**Scenari**:
- Azioni: 700 (7 contratti coperti)
- Call vendute: 8
- Call comprate: 0
- Bilancio: 7 - 8 = -1 → **NAKED CALL** (1 contratto scoperto)

**Output**: `AAPL: 1 NC (Covered Call)` con triangolo rosso

---

#### 3. Covered Call ITM
**Criterio**: `strike_price < prezzo_sottostante`

**Output**: `AAPL $180 ×2` (2 contratti ITM)

---

#### 4. Iron Condor IR/OOR
**Criterio**: Prezzo sottostante tra sold PUT strike e sold CALL strike

**Output**:
- `AMZN` con badge `IR` verde
- `GOOGL` con badge `OOR` rosso

---

#### 5. Double Diagonal IR/OOR
Include sia Double Diagonal che Alternative Double Diagonal (da `groupedOtherStrategies`)

**Output**: Come Iron Condor

---

#### 6. Altre Strategie IB/OOB/IR/OOR
Per ogni strategia in `groupedOtherStrategies`:
- Short Strangle, Put Spread, Call Spread → IR/OOR
- Altre strategie → IB/OOB

**Output**: `BABA Put BWB` con badge `IB` verde

---

### Modifiche Tecniche

**File: `src/pages/Derivatives.tsx`**

1. **Nuovo componente**: `DerivativesSummaryCard`
   - Riceve: `categories`, `stockPositions`, `underlyingPrices`
   - Calcola tutti i dati riepilogativi

2. **Posizionamento**: Subito dopo l'header, prima delle sezioni collapsibili

3. **Layout**: Card con griglia 2×3 o lista verticale compatta

---

### Dettagli Implementativi

**Calcolo Call non coperte**:
```typescript
// Per ogni sottostante, calcola il bilancio
const underlyingCallBalance = new Map<string, {
  owned: number,       // azioni possedute
  soldCalls: number,   // contratti call venduti
  boughtCalls: number, // contratti call comprati
  strategies: string[] // nomi strategie coinvolte
}>();

// Itera su Covered Call
categories.coveredCalls.forEach(cc => {
  const key = normalizeKey(cc.underlying.description);
  // Aggiungi sold calls...
});

// Itera su Iron Condor (hanno sold call + bought call)
categories.ironCondors.forEach(ic => {
  const key = normalizeKey(ic.underlying);
  // Aggiungi sold call e bought call...
});

// Itera su Double Diagonal
// Itera su groupedOtherStrategies
// ...

// Verifica bilancio
for (const [key, data] of underlyingCallBalance) {
  const coveredContracts = Math.floor(data.owned / 100);
  const netSoldCalls = data.soldCalls - data.boughtCalls;
  if (netSoldCalls > coveredContracts) {
    // Naked Call trovata!
  }
}
```

**Covered Call da vendere**:
```typescript
const availableForSale: { ticker: string, shares: number }[] = [];

// Trova tutti i sottostanti con stock
stockPositions.forEach(stock => {
  const potentialContracts = Math.floor(stock.quantity / 100);
  const soldContracts = totalCoveredCallContractsByUnderlying[stock.description] || 0;
  const available = potentialContracts - soldContracts;
  
  if (available >= 1) {
    availableForSale.push({
      ticker: stock.ticker || stock.description,
      shares: available * 100
    });
  }
});
```

---

### UI della Card

```text
┌─────────────────────────────────────────────────────────────────┐
│  📊 Riepilogo Strategie                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚠️ CALL NON COPERTE                     ✅ CALL VENDIBILI      │
│  • AAPL: 1 NC (Covered Call) ▲           • MSFT: 200 azioni    │
│                                          • GOOGL: 100 azioni   │
│                                                                 │
│  🔴 COVERED CALL ITM                     📊 IRON CONDOR         │
│  • NVDA $900 ×2                          • AMZN [IR]           │
│  • TSLA $250 ×1                          • SPY [OOR]           │
│                                                                 │
│  📈 DOUBLE DIAGONAL                      🎯 ALTRE STRATEGIE     │
│  • META [IR]                             • BABA Put BWB [IB]   │
│  • NFLX Alt.DD [OOR]                     • ORCL Short Str [IR] │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Stili

| Elemento | Stile |
|----------|-------|
| Sezione "Call non coperte" | Background rosso/10, bordo rosso |
| Badge IR/IB | Verde outline |
| Badge OOR/OOB | Rosso outline |
| Triangolo allarme | ▲ rosso (lucide AlertTriangle) |
| Ticker ITM | Testo ambra/giallo |

---

### File Modificato

| File | Modifica |
|------|----------|
| `src/pages/Derivatives.tsx` | +1 nuovo componente `DerivativesSummaryCard`, inserito dopo header |

---

### Considerazioni Aggiuntive

1. **Performance**: I calcoli sono memoizzati con `useMemo` per evitare ricalcoli ad ogni render

2. **Responsività**: Layout a griglia che si adatta a mobile (1 colonna) e desktop (2-3 colonne)

3. **Interattività**: I ticker sono cliccabili e scrollano alla sezione corrispondente (opzionale)

4. **Visibilità condizionale**: Ogni sezione appare solo se ha almeno un elemento da mostrare
