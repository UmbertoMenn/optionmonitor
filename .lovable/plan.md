
# Piano: Aggiornamento Holdings Consolidate

## Obiettivo
Aggiungere il Max Loss delle strategie alle Holdings Consolidate, mostrare il prezzo di mercato (invece del PMC) nelle Leap Call nel dialog di dettaglio, e sostituire la descrizione testuale con un tooltip informativo.

---

## Modifiche Pianificate

### 1. Aggiungere Max Loss Strategie alle Holdings Consolidate

**File: `src/lib/sectorExposure.ts`**

- Estendere l'interfaccia `ConsolidatedHoldingWithDetails`:
  - Aggiungere campo `strategyRisk: number` per il rischio Max Loss delle strategie
  - Aggiungere array `strategyDetails` con i dettagli delle strategie (nome, maxLoss, etc.)
  
- Nella funzione `calculateConsolidatedTopHoldings`:
  - Aggiungere un loop per processare `analysis.strategyDetails`
  - Per ogni strategia, aggregare il `maxLossEUR` all'holding corrispondente
  - Includere il `strategyRisk` nel calcolo del `totalExposure`

### 2. Aggiornare la UI per mostrare il badge Strategie

**File: `src/components/risk/EquityExposureView.tsx`**

- Nella sezione Holdings Consolidate:
  - Rimuovere il paragrafo descrittivo sotto il titolo
  - Aggiungere un tooltip accanto al titolo "Holdings Consolidate" con la spiegazione dell'aggregazione
  - Aggiungere un nuovo badge viola per "Strategie" (simile agli altri badge)
  - Aggiornare la logica di sorting per includere `strategyRisk`

### 3. Aggiornare il dialog di dettaglio

**File: `src/components/risk/HoldingBreakdownDialog.tsx`**

- Aggiungere sezione per visualizzare i dettagli delle strategie (Max Loss)
- Modificare la descrizione delle Leap Call: mostrare `Prezzo Mkt` invece di `PMC`
- Aggiungere badge viola nel footer per le strategie

---

## Dettagli Tecnici

### Nuova struttura `ConsolidatedHoldingWithDetails`

```typescript
export interface ConsolidatedHoldingWithDetails extends ConsolidatedHolding {
  // ... campi esistenti ...
  strategyRisk: number;  // NUOVO: Max Loss totale strategie
  strategyDetails: Array<{  // NUOVO
    strategyName: string;
    maxLossEUR: number;
    hasUnlimitedRisk: boolean;
  }>;
}
```

### Logica di aggregazione strategie

```typescript
// Nella funzione calculateConsolidatedTopHoldings
for (const strat of analysis.strategyDetails) {
  const holding = getOrCreateHolding(strat.underlying);
  
  holding.strategyRisk += strat.maxLossEUR;
  holding.sources.push({
    type: 'strategy',
    name: strat.strategyName,
    exposure: strat.maxLossEUR,
  });
  holding.strategyDetails.push({
    strategyName: strat.strategyName,
    maxLossEUR: strat.maxLossEUR,
    hasUnlimitedRisk: strat.hasUnlimitedRisk,
  });
}

// Aggiornare il calcolo totalExposure
holding.totalExposure = stockPart + holding.nakedPutRisk + holding.leapCallRisk + holding.strategyRisk;
```

### Tooltip per Holdings Consolidate

Testo tooltip: "Aggregazione dell'esposizione per sottostante: Stock diretti, Naked PUT (strike × contratti × 100), Leap Call (prezzo di mercato × contratti × 100) e Max Loss delle strategie complesse."

### Descrizione Leap Call nel dialog

**Prima:** `{lc.contracts} ctr × PMC {formatNumber(lc.avgCost, 2)}`

**Dopo:** `{lc.contracts} ctr × Mkt {formatNumber(lc.marketPrice, 2)}`

---

## File Modificati

| File | Tipo Modifica |
|------|---------------|
| `src/lib/sectorExposure.ts` | Estensione interface + logica aggregazione |
| `src/components/risk/EquityExposureView.tsx` | UI: rimuovi descrizione, aggiungi tooltip, badge viola |
| `src/components/risk/HoldingBreakdownDialog.tsx` | UI: sezione strategie, descrizione Leap Call |

---

## Note Implementative

- Il badge viola per le strategie seguirà lo stesso stile degli altri badge esistenti (PUT rosso, LEAP ambra)
- La logica di matching per le strategie utilizzerà la stessa funzione `getOrCreateHolding` già usata per gli altri tipi
- Il tooltip utilizzerà l'icona `HelpCircle` come standard uniforme del progetto
