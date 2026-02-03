

# Piano: Ordinamento Decrescente per Importo nella Equity Exposure

## Obiettivo
Ordinare sempre tutti i grafici, tabelle e liste nella vista Equity Exposure per importo (rischio) in ordine decrescente.

---

## Elementi da Ordinare

### 1. Grafico a Barre - `riskCategories` (linee 113-176)

L'array `riskCategories` viene usato per:
- Il grafico a ciambella (Donut Chart) - linee 241-265
- La legenda del grafico - linee 270-288
- Il grafico a barre orizzontale - linee 301-352

**Soluzione**: Aggiungere `.sort((a, b) => b.value - a.value)` dove l'array viene utilizzato.

```typescript
// Prima del rendering, ordinare per valore decrescente
const sortedRiskCategories = useMemo(() => 
  [...riskCategories].filter(c => c.value > 0).sort((a, b) => b.value - a.value),
  [riskCategories]
);
```

---

### 2. Dettaglio ETF Azionari (linee 374-456)

Attualmente gli ETF vengono mostrati nell'ordine originale di `etfDetails`.

**Soluzione**: Ordinare `etfDetails` per `riskEUR` decrescente.

```typescript
const sortedETFDetails = useMemo(() => 
  [...etfDetails].sort((a, b) => b.riskEUR - a.riskEUR),
  [etfDetails]
);
```

---

### 3. Dettaglio Stocks (linee 477-559)

Attualmente gli stocks vengono mostrati nell'ordine originale di `pureStockDetails`.

**Soluzione**: Ordinare `pureStockDetails` per `riskEUR` decrescente.

```typescript
const sortedPureStockDetails = useMemo(() => 
  [...pureStockDetails].sort((a, b) => b.riskEUR - a.riskEUR),
  [pureStockDetails]
);
```

---

### 4. Dettaglio Commodities (linee 580-600)

Attualmente le commodities vengono mostrate nell'ordine originale.

**Soluzione**: Ordinare `commodityDetails` per `riskEUR` decrescente.

```typescript
const sortedCommodityDetails = useMemo(() => 
  [...commodityDetails].sort((a, b) => b.riskEUR - a.riskEUR),
  [commodityDetails]
);
```

---

### 5. Dettaglio Naked PUT (linee 621-640)

Attualmente le Naked PUT vengono mostrate nell'ordine originale.

**Soluzione**: Ordinare `nakedPutDetails` per `riskEUR` decrescente.

```typescript
const sortedNakedPutDetails = useMemo(() => 
  [...nakedPutDetails].sort((a, b) => b.riskEUR - a.riskEUR),
  [nakedPutDetails]
);
```

---

### 6. Dettaglio Leap Call (linee 662-681)

Attualmente le Leap Call vengono mostrate nell'ordine originale.

**Soluzione**: Ordinare `leapCallDetails` per `riskEUR` decrescente.

```typescript
const sortedLeapCallDetails = useMemo(() => 
  [...leapCallDetails].sort((a, b) => b.riskEUR - a.riskEUR),
  [leapCallDetails]
);
```

---

### 7. Dettaglio Strategie (linee 703-752)

Attualmente le strategie vengono mostrate nell'ordine originale.

**Soluzione**: Ordinare `strategyDetails` per `maxLossEUR` decrescente.

```typescript
const sortedStrategyDetails = useMemo(() => 
  [...strategyDetails].sort((a, b) => b.maxLossEUR - a.maxLossEUR),
  [strategyDetails]
);
```

---

### 8. Holdings Consolidate (linee 803-864)

Le Holdings Consolidate sono già calcolate dal hook `calculateConsolidatedTopHoldings`.

**Verifica**: Controllare se sono già ordinate per `totalExposure`. In caso contrario, aggiungere ordinamento.

```typescript
const sortedConsolidatedHoldings = useMemo(() => 
  [...consolidatedHoldings].sort((a, b) => b.totalExposure - a.totalExposure),
  [consolidatedHoldings]
);
```

---

## Modifiche Tecniche

### File: `src/components/risk/EquityExposureView.tsx`

#### Nuovi `useMemo` per gli array ordinati (dopo linea 110)

```typescript
// Sorted arrays for consistent descending order display
const sortedRiskCategories = useMemo(() => 
  riskCategories.filter(c => c.value > 0).sort((a, b) => b.value - a.value),
  [riskCategories]
);

const sortedETFDetails = useMemo(() => 
  [...etfDetails].sort((a, b) => b.riskEUR - a.riskEUR),
  [etfDetails]
);

const sortedPureStockDetails = useMemo(() => 
  [...pureStockDetails].sort((a, b) => b.riskEUR - a.riskEUR),
  [pureStockDetails]
);

const sortedCommodityDetails = useMemo(() => 
  [...commodityDetails].sort((a, b) => b.riskEUR - a.riskEUR),
  [commodityDetails]
);

const sortedNakedPutDetails = useMemo(() => 
  [...nakedPutDetails].sort((a, b) => b.riskEUR - a.riskEUR),
  [nakedPutDetails]
);

const sortedLeapCallDetails = useMemo(() => 
  [...leapCallDetails].sort((a, b) => b.riskEUR - a.riskEUR),
  [leapCallDetails]
);

const sortedStrategyDetails = useMemo(() => 
  [...strategyDetails].sort((a, b) => b.maxLossEUR - a.maxLossEUR),
  [strategyDetails]
);

const sortedConsolidatedHoldings = useMemo(() => 
  [...consolidatedHoldings].sort((a, b) => b.totalExposure - a.totalExposure),
  [consolidatedHoldings]
);
```

#### Sostituzioni nei render

| Linea | Da | A |
|-------|----|----|
| 242, 250, 270, 301 | `riskCategories.filter(c => c.value > 0)` | `sortedRiskCategories` |
| 376 | `etfDetails.map(...)` | `sortedETFDetails.map(...)` |
| 479 | `pureStockDetails.map(...)` | `sortedPureStockDetails.map(...)` |
| 582 | `commodityDetails.map(...)` | `sortedCommodityDetails.map(...)` |
| 623 | `nakedPutDetails.map(...)` | `sortedNakedPutDetails.map(...)` |
| 664 | `leapCallDetails.map(...)` | `sortedLeapCallDetails.map(...)` |
| 705 | `strategyDetails.map(...)` | `sortedStrategyDetails.map(...)` |
| 804 | `consolidatedHoldings.map(...)` | `sortedConsolidatedHoldings.map(...)` |

---

## Riepilogo

| Sezione | Criterio Ordinamento | Campo |
|---------|---------------------|-------|
| Risk Categories (grafico) | Decrescente | `value` |
| ETF Azionari | Decrescente | `riskEUR` |
| Stocks | Decrescente | `riskEUR` |
| Commodities | Decrescente | `riskEUR` |
| Naked PUT | Decrescente | `riskEUR` |
| Leap Call | Decrescente | `riskEUR` |
| Strategie | Decrescente | `maxLossEUR` |
| Holdings Consolidate | Decrescente | `totalExposure` |

---

## File Modificato

- `src/components/risk/EquityExposureView.tsx`

