
# Piano: Aggiungere Percentuali all'Equity Exposure

## Obiettivo

Implementare due miglioramenti nella vista Equity Exposure del Risk Analyzer:

1. **Card Principale**: Mostrare la percentuale del rischio totale rispetto al valore degli asset del portafoglio (grandTotal / Valore Asset Portfolio × 100)

2. **Barra Naked PUT**: Aggiungere una percentuale accanto al valore del rischio Naked PUT che indica il rapporto con il valore totale dei Bond (totalNakedPutRisk / totalBondRisk × 100), con un tooltip esplicativo

---

## Analisi Tecnica

### Dati Disponibili

Dall'analisi di `useRiskAnalysis.ts` e `riskCalculator.ts`:

- `grandTotal`: Somma di tutti i rischi (disponibile in analysis)
- `totalBondRisk`: Rischio totale obbligazioni (disponibile in analysis)
- `totalNakedPutRisk`: Rischio Naked PUT (disponibile in analysis)

Dall'analisi di `usePortfolio.ts`:

- Il valore totale degli asset (esclusi derivati) e calcolato in `summary.totalValue`

### Problema

Attualmente `EquityExposureView` riceve solo l'oggetto `analysis: RiskAnalysis`. Per calcolare la percentuale rispetto al valore degli asset del portafoglio, e necessario passare anche il valore totale del portafoglio.

---

## Implementazione

### 1. Modificare l'interfaccia di EquityExposureView

File: `src/components/risk/EquityExposureView.tsx`

```typescript
interface EquityExposureViewProps {
  analysis: RiskAnalysis;
  portfolioTotalValue?: number;  // Nuovo: valore totale asset portafoglio
}
```

### 2. Aggiungere la percentuale nella Card Principale

Sotto "Somma di tutte le categorie di rischio", aggiungere:

```typescript
// Nel CardContent della card principale
<div className="text-xs text-muted-foreground mt-1">
  Somma di tutte le categorie di rischio
</div>
{portfolioTotalValue && portfolioTotalValue > 0 && (
  <div className="text-xs text-muted-foreground mt-0.5">
    ({((grandTotal / portfolioTotalValue) * 100).toFixed(1)}% del valore asset)
  </div>
)}
```

### 3. Aggiungere percentuale Naked PUT vs Bond

Modificare l'array `riskCategories` per includere una percentuale opzionale vs bond:

```typescript
const nakedPutVsBondPct = analysis.totalBondRisk > 0 
  ? (analysis.totalNakedPutRisk / analysis.totalBondRisk) * 100 
  : null;
```

Nel rendering della barra Naked PUT, aggiungere accanto al valore:

```typescript
// Per la categoria Naked PUT, aggiungere dopo il valore:
{cat.label === 'Rischio Naked PUT' && nakedPutVsBondPct !== null && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-xs text-red-400 ml-2 cursor-help">
          [{nakedPutVsBondPct.toFixed(0)}% vs Bond]
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm">
        <p>Percentuale del rischio Naked PUT rispetto al valore totale delle obbligazioni in portafoglio.</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

### 4. Passare portfolioTotalValue da RiskAnalyzer

File: `src/pages/RiskAnalyzer.tsx`

Aggiungere l'import di `usePortfolio` e passare il valore:

```typescript
// Aggiungere in RiskAnalyzer:
const { summary } = usePortfolio();

// Nel rendering:
<EquityExposureView 
  analysis={analysis} 
  portfolioTotalValue={summary?.totalValue} 
/>
```

---

## Risultato Visivo

### Card Principale

```
Esposizione Totale in Equity e Commodities (i)
€ 1.234.567
Somma di tutte le categorie di rischio
(75.3% del valore asset)
```

### Barra Naked PUT

```
Rischio Naked PUT         € 45.000 (3.6%) [120% vs Bond]
Strike × Contratti × 100
[████████                    ]
```

Il testo "[120% vs Bond]" appare in rosso chiaro e al passaggio del mouse mostra il tooltip: "Percentuale del rischio Naked PUT rispetto al valore totale delle obbligazioni in portafoglio."

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/components/risk/EquityExposureView.tsx` | Aggiungere prop `portfolioTotalValue`, percentuale nella card principale, percentuale vs bond per Naked PUT con tooltip |
| `src/pages/RiskAnalyzer.tsx` | Importare `usePortfolio`, passare `summary?.totalValue` a EquityExposureView |
