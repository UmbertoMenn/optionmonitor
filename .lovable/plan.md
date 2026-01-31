
# Piano: Risk Analyzer - Esposizione Equity Reale

## Obiettivo
Creare una pagina Risk Analyzer che mostri l'esposizione reale in equity convertita in EUR, suddividendo il rischio in 4 categorie principali.

---

## Categorie di Rischio

### 1. Rischio Stocks (al netto di protezioni)
**Formula:**
```
Per ogni titolo azionario:
- Se NON ha PUT comprate → Rischio = Quantità × Prezzo × 100 / Cambio
- Se HA PUT comprate → Rischio = (Valore Azioni) - (Strike PUT × Contratti × 100) / Cambio
```

**Esempio concreto:**
- 100 azioni valore $1000 ciascuna = $100.000
- PUT comprata strike $800, 1 contratto (protegge 100 azioni)
- Rischio = $100.000 - ($800 × 1 × 100) = $100.000 - $80.000 = $20.000
- Rischio EUR = $20.000 / 1.1975 = €16.701

### 2. Rischio Naked PUT
**Formula:**
```
Rischio Naked PUT = Σ (Strike × Contratti × 100) / Cambio
```

**Esempio:**
- PUT venduta strike $1000, 2 contratti
- Rischio = $1000 × 2 × 100 = $200.000 / Cambio

### 3. Rischio Leap Call
**Formula:**
```
Rischio Leap Call = Σ (Contratti × PMC × 100) / Cambio
```

Il rischio delle LEAP CALL e il premio pagato (costo di acquisto), non il valore attuale.

**Esempio:**
- LEAP CALL, 3 contratti, PMC $15
- Rischio = 3 × $15 × 100 = $4.500 / Cambio

### 4. Rischio Strategie
**Formula:**
```
Rischio = Σ Max Loss di ogni strategia / Cambio
```

**Logica per strategia:**
- **Iron Condor**: Max Loss = max(PUT spread width, CALL spread width) × 100 × contratti - GP
- **Double Diagonal**: Max Loss = max spread × 100 × contratti - GP
- **Broken Wing Butterfly**: Max Loss calcolato in base alla struttura
- **Short Strangle**: Rischio = Strike PUT venduta × 100 × contratti (rischio infinito → usa strike PUT)
- **Vertical Spread**: Max Loss = ampiezza spread × 100 × contratti - premio
- **Altri spread definiti**: Max Loss specifico per tipo

---

## Struttura UI della Pagina

### Sezione 1: Card Riepilogo Totale
Layout a 4 colonne con:
1. **Rischio Stocks** (EUR) - con indicatore protezioni
2. **Rischio Naked PUT** (EUR)
3. **Rischio Leap Call** (EUR)
4. **Rischio Strategie** (EUR)
5. **Totale Esposizione** (EUR) - somma delle 4 categorie

Include un grafico a barre orizzontali comparativo delle 4 categorie.

### Sezione 2: Dettaglio Stocks per Sottostante (Collapsibile)
Per ogni titolo azionario:
- Nome titolo
- Valore azioni possedute (valuta originale + EUR)
- Protezioni attive: strike e contratti PUT comprate
- Rischio residuo calcolato
- Cambio applicato
- Barra visuale: verde (protetto) vs rosso (rischio)

### Sezione 3: Dettaglio Naked PUT (Collapsibile)
Per ogni naked put:
- Sottostante
- Strike e scadenza
- Numero contratti
- Esposizione totale (valuta originale + EUR)

### Sezione 4: Dettaglio Leap Call (Collapsibile)
Per ogni leap call:
- Sottostante
- Strike e scadenza
- Contratti e PMC
- Premio pagato totale (rischio)

### Sezione 5: Dettaglio Strategie (Collapsibile)
Per ogni strategia:
- Nome strategia (Iron Condor, Short Strangle, etc.)
- Sottostante
- Max Loss calcolato
- Dettaglio calcolo in tooltip

---

## File da Creare/Modificare

### Nuovo: `src/lib/riskCalculator.ts`

```typescript
// Interfacce
interface StockRiskDetail {
  underlying: string;
  stockValue: number;           // Valore azioni in valuta originale
  protectionStrike: number | null;
  protectionContracts: number;
  riskOriginal: number;         // Rischio in valuta originale
  riskEUR: number;              // Rischio convertito
  currency: string;
  exchangeRate: number;
  hasProtection: boolean;
}

interface NakedPutRiskDetail {
  underlying: string;
  strike: number;
  contracts: number;
  expiry: string;
  riskOriginal: number;
  riskEUR: number;
  currency: string;
  exchangeRate: number;
}

interface LeapCallRiskDetail {
  underlying: string;
  strike: number;
  contracts: number;
  avgCost: number;
  expiry: string;
  premiumPaid: number;          // Rischio = premio pagato
  riskEUR: number;
  currency: string;
  exchangeRate: number;
}

interface StrategyRiskDetail {
  strategyName: string;
  underlying: string;
  maxLoss: number;              // In valuta originale
  maxLossEUR: number;
  currency: string;
  exchangeRate: number;
  calculation: string;          // Descrizione calcolo per tooltip
}

interface RiskAnalysis {
  // Totali EUR
  totalStockRisk: number;
  totalNakedPutRisk: number;
  totalLeapCallRisk: number;
  totalStrategyRisk: number;
  grandTotal: number;
  
  // Dettagli
  stockDetails: StockRiskDetail[];
  nakedPutDetails: NakedPutRiskDetail[];
  leapCallDetails: LeapCallRiskDetail[];
  strategyDetails: StrategyRiskDetail[];
}

// Funzioni
function calculateStockRisk(stocks: Position[], longPuts: LongPutPosition[]): StockRiskDetail[];
function calculateNakedPutRisk(nakedPuts: NakedPutPosition[]): NakedPutRiskDetail[];
function calculateLeapCallRisk(leapCalls: LeapCallPosition[]): LeapCallRiskDetail[];
function calculateStrategyRisk(categories: DerivativeCategories): StrategyRiskDetail[];
function analyzePortfolioRisk(positions: Position[], categories: DerivativeCategories): RiskAnalysis;
```

Logica chiave per **Max Loss strategie**:
- Iron Condor/Double Diagonal: usa la formula esistente nel codice
- Short Strangle: `Strike PUT venduta × 100 × contratti`
- Vertical Spread: `|Strike1 - Strike2| × 100 × contratti - premio netto`
- Broken Wing Butterfly: calcolo specifico basato su strike

### Nuovo: `src/hooks/useRiskAnalysis.ts`

```typescript
function useRiskAnalysis() {
  const { positions } = usePortfolio();
  
  // Usa categorizeDerivatives esistente
  const categories = categorizeDerivatives(derivatives, positions);
  
  // Calcola rischio usando riskCalculator
  const riskAnalysis = analyzePortfolioRisk(positions, categories);
  
  return riskAnalysis;
}
```

### Modifica: `src/pages/RiskAnalyzer.tsx`

Struttura componente:
1. Header (esistente, aggiornato)
2. Summary Cards (4 card colorate + totale)
3. Grafico a barre comparativo
4. Sezioni collassabili per ogni categoria
5. Righe di dettaglio con tooltip esplicativi

---

## Visualizzazione Grafica

### Barra Comparativa Rischio

```text
  Stocks      ████████████████░░░░░░░░░░░░░░  €50.000 (40%)
  Naked PUT   █████████████░░░░░░░░░░░░░░░░░  €40.000 (32%)
  Leap Call   ████░░░░░░░░░░░░░░░░░░░░░░░░░░  €15.000 (12%)
  Strategie   █████░░░░░░░░░░░░░░░░░░░░░░░░░  €20.000 (16%)
```

### Barra Protezione per Singolo Stock

```text
  APPLE       ████████░░░░  Protetto: €80k | Rischio: €20k
              [Verde]  [Rosso]
```

---

## Considerazioni Tecniche

- Riutilizza `categorizeDerivatives` esistente per classificazione
- Riutilizza `getEffectiveExchangeRate` da `useDerivativeNetting.ts`
- Il campo `exchange_rate` nelle Position fornisce il cambio
- Il campo `avg_cost` fornisce il PMC per le Leap Call
- Gestisci i casi edge: cambio null (default 1), strike null, etc.
