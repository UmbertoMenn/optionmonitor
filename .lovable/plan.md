
# Piano: Rimuovere ETF e Aggiungere Leap Call alle Holdings Consolidate

## Obiettivo

1. **Rimuovere** la scomposizione degli ETF (top holdings) dalle Holdings Consolidate
2. **Aggiungere** l'esposizione delle Leap Call (premio pagato) alle Holdings Consolidate
3. **Rimuovere** tutto il codice backend per scraping/AI delle top holdings ETF

## Modifiche

### 1. Edge Function: `supabase/functions/fetch-etf-allocation/index.ts`

**Rimuovere completamente (~250 righe):**

| Elemento | Righe | Descrizione |
|----------|-------|-------------|
| `EXCLUDED_HOLDING_NAMES` | 22-35 | Array nomi esclusi |
| `hasValidTopHoldings()` | 38-49 | Funzione validazione |
| `fetchETFTopHoldingsFromProvider()` | 391-413 | Dispatcher provider |
| `scrapeSSGAHoldings()` | 416-455 | Scraping SSGA |
| `parseSSGAHoldings()` | 458-529 | Parser SSGA |
| `fetchETFTopHoldingsWithAI()` | 531-619 | Fallback AI Gemini |
| Logica top holdings in `scrapeJustETF()` | ~1054-1132 | Sezione "TOP HOLDINGS" |
| Chiamata AI nel `serve()` | ~1215-1225 | Fallback finale |

**Mantenere:**
- Scraping sector/country/currency allocations
- Fallback AI per sector allocations (utile per Risk Analyzer)

### 2. Logic: `src/lib/sectorExposure.ts`

**Modificare interfaccia `ConsolidatedHolding`:**

```typescript
export interface ConsolidatedHolding {
  name: string;
  // etfExposure: number;    // RIMUOVERE
  stockRisk: number;
  stockRiskWithProtection: number;
  nakedPutRisk: number;
  leapCallRisk: number;      // AGGIUNGERE: Premio pagato Leap Call
  totalExposure: number;
  sources: Array<{
    type: 'stock' | 'nakedPut' | 'leapCall';  // MODIFICARE: rimuovere 'etf', aggiungere 'leapCall'
    name: string;
    exposure: number;
    percentage?: number;
  }>;
}
```

**Modificare interfaccia `ConsolidatedHoldingWithDetails`:**

```typescript
export interface ConsolidatedHoldingWithDetails extends ConsolidatedHolding {
  nakedPutDetails: Array<{...}>;
  // etfDetails: Array<{...}>;   // RIMUOVERE
  stockDetails: Array<{...}>;
  leapCallDetails: Array<{       // AGGIUNGERE
    strike: number;
    contracts: number;
    avgCost: number;
    premiumPaid: number;
    expiry: string;
  }>;
}
```

**Modificare `calculateConsolidatedTopHoldings()`:**

1. **Rimuovere** sezione "1. Add ETF holdings" (righe 693-721)
2. **Aggiungere** sezione "4. Add Leap Call risk" dopo Naked PUT:

```typescript
// 4. Add Leap Call risk (premio pagato)
for (const lc of analysis.leapCallDetails) {
  const holding = getOrCreateHolding(lc.underlying);
  
  holding.leapCallRisk += lc.riskEUR;
  holding.sources.push({
    type: 'leapCall',
    name: `LEAP ${lc.strike} ${formatExpiry(lc.expiry)}`,
    exposure: lc.riskEUR,
  });
  holding.leapCallDetails.push({
    strike: lc.strike,
    contracts: lc.contracts,
    avgCost: lc.avgCost,
    premiumPaid: lc.premiumPaid,
    expiry: lc.expiry,
  });
}
```

3. **Modificare** calcolo totale:
```typescript
// Prima
holding.totalExposure = holding.etfExposure + stockPart + holding.nakedPutRisk;

// Dopo
holding.totalExposure = stockPart + holding.nakedPutRisk + holding.leapCallRisk;
```

### 3. UI: `src/components/risk/EquityExposureView.tsx`

**Modificare sezione Holdings Consolidate (righe 750-812):**

1. **Rimuovere** badge ETF:
```tsx
// RIMUOVERE
{hasETF && (
  <Badge className="...bg-cyan-500...">
    ETF: {formatEUR(holding.etfExposure)}
  </Badge>
)}
```

2. **Aggiungere** badge Leap Call:
```tsx
{hasLeapCall && (
  <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-amber-500/10 text-amber-500 border-amber-500/30">
    LEAP: {formatEUR(holding.leapCallRisk)}
  </Badge>
)}
```

3. **Aggiornare** descrizione:
```tsx
// Prima
<p className="text-sm text-muted-foreground mt-1">
  Aggregazione esposizione: ETF holdings + Stock diretti + Naked PUT
</p>

// Dopo
<p className="text-sm text-muted-foreground mt-1">
  Aggregazione esposizione: Stock diretti + Naked PUT + Leap Call
</p>
```

### 4. UI: `src/components/risk/HoldingBreakdownDialog.tsx`

**Modifiche:**

1. **Rimuovere** sezione "ETF Details" (righe 156-180)
2. **Aggiungere** sezione "Leap Call Details":

```tsx
{/* Leap Call Details */}
{holding.leapCallDetails.length > 0 && (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm font-semibold">
      <TrendingUp className="w-4 h-4 text-amber-500" />
      Leap Call
    </div>
    <div className="rounded-lg border bg-muted/30 divide-y">
      {holding.leapCallDetails.map((lc, i) => (
        <div key={i} className="p-3 flex justify-between items-center">
          <div>
            <div className="text-sm font-medium">
              Strike {formatNumber(lc.strike)}
            </div>
            <div className="text-xs text-muted-foreground">
              {lc.contracts} ctr × PMC {formatNumber(lc.avgCost, 2)} • {formatExpiry(lc.expiry)}
            </div>
          </div>
          <div className="font-medium text-amber-500">
            {formatEUR(lc.premiumPaid)}
          </div>
        </div>
      ))}
    </div>
    <div className="text-right text-sm font-medium">
      Subtotale LEAP: <span className="text-amber-500">{formatEUR(holding.leapCallRisk)}</span>
    </div>
  </div>
)}
```

3. **Aggiornare** badge footer:
```tsx
{/* RIMUOVERE badge ETF, AGGIUNGERE badge LEAP */}
{holding.leapCallRisk > 0 && (
  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
    LEAP: {formatEUR(holding.leapCallRisk)}
  </Badge>
)}
```

### 5. Hook: `src/hooks/useETFAllocations.ts`

**Semplificare:**
- Rimuovere logica di force refresh per `hasNoTopHoldings` (righe 31-38)
- L'hook continua a esistere per sector/currency allocations

## Riepilogo File

| File | Azione | Righe Stimate |
|------|--------|---------------|
| `supabase/functions/fetch-etf-allocation/index.ts` | Rimuovere ~250 righe codice top holdings | -250 |
| `src/lib/sectorExposure.ts` | Sostituire ETF con LeapCall in interfacce e calcolo | ~50 modificate |
| `src/components/risk/EquityExposureView.tsx` | Sostituire badge ETF con LEAP | ~20 modificate |
| `src/components/risk/HoldingBreakdownDialog.tsx` | Sostituire sezione ETF con LEAP | ~40 modificate |
| `src/hooks/useETFAllocations.ts` | Rimuovere force refresh top holdings | ~10 rimosse |

## Risultato Atteso

Dopo le modifiche, le **Holdings Consolidate** mostreranno:

| Fonte | Colore Badge | Calcolo |
|-------|-------------|---------|
| **Stock** | Blu/Verde | Valore azioni (con/senza protezioni) |
| **PUT** | Rosso | Strike × Contratti × 100 |
| **LEAP** | Ambra | Premio pagato (PMC × Contratti × 100) |

L'edge function sarà alleggerita di ~250 righe, nessuna chiamata AI per top holdings ETF, e il Risk Analyzer continuerà a funzionare normalmente per sector/currency/country allocations.

## Sezione Tecnica

### Dipendenze tra Modifiche

```text
1. Edge Function (backend)
   └── Rimuove scraping/AI top holdings
   └── Mantiene sector allocations
   
2. sectorExposure.ts (logic)
   ├── Rimuove ETF da interfacce
   ├── Aggiunge LeapCall a interfacce  
   └── Modifica calculateConsolidatedTopHoldings()
       ├── Rimuove step ETF
       ├── Aggiunge step LeapCall
       └── Aggiorna formula totalExposure

3. EquityExposureView.tsx (UI)
   └── Usa nuove proprietà da sectorExposure

4. HoldingBreakdownDialog.tsx (UI)
   └── Usa nuove proprietà da sectorExposure
```

### Formula Finale Holdings Consolidate

```
TotalExposure = StockRisk(+/-protezioni) + NakedPutRisk + LeapCallRisk

dove:
- StockRisk = Quantità × Prezzo (- protezioni se toggle attivo)
- NakedPutRisk = Strike × Contratti × 100 / Cambio
- LeapCallRisk = PMC × Contratti × 100 / Cambio
```
