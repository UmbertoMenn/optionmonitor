
# Piano Aggiornato: Equity Exposure Storica nel Benchmark

## Correzione Logica Fondamentale

L'equity exposure del **punto N** determina il rendimento benchmark **dal punto N al punto N+1**.

```text
Timeline:
────────────────────────────────────────────────────────────►
     Punto 1          Punto 2          Punto 3         Oggi
     (40% eq)         (60% eq)         (70% eq)
        │                │                │              │
        ├────────────────┤                │              │
        │  Benchmark:    │                │              │
        │  40% Eq + 60% Bond              │              │
        │                │                │              │
                         ├────────────────┤              │
                         │  Benchmark:    │              │
                         │  60% Eq + 40% Bond            │
                         │                │              │
                                          ├──────────────┤
                                          │  Benchmark:  │
                                          │  70% Eq + 30% Bond
```

---

## Modifiche al Database

### Nuova colonna in `historical_data`

```sql
ALTER TABLE historical_data 
ADD COLUMN equity_exposure_pct numeric DEFAULT 0.6;

COMMENT ON COLUMN historical_data.equity_exposure_pct IS 
  'Equity exposure % (0-1) del portafoglio alla data dello snapshot. 
   Usata per calcolare il benchmark nel periodo successivo.';
```

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/types/historicalData.ts` | Aggiungi `equity_exposure_pct` ai tipi |
| `src/components/dashboard/Dashboard.tsx` | Includi equity exposure nel salvataggio snapshot |
| `src/components/dashboard/HistoricalDataForm.tsx` | Nuovo campo input per equity exposure % |
| `src/hooks/useHistoricalData.ts` | Gestisci il nuovo campo nell'upsert |
| `src/hooks/useBenchmarkData.ts` | Usa equity exposure storica punto-per-punto |
| `src/components/dashboard/charts/PerformanceEvolutionChart.tsx` | Aggiorna tooltip benchmark |

---

## Dettagli Implementazione

### 1. Tipi (`src/types/historicalData.ts`)

```typescript
export interface HistoricalDataEntry {
  id: string;
  portfolio_id: string;
  snapshot_date: string;
  total_value: number;
  netting_total: number;
  netting_ex_cc: number;
  netting_ex_cc_np: number;
  deposits: number;
  average_balance: number;
  equity_exposure_pct: number; // NUOVO: 0-1, default 0.6
  created_at: string;
  updated_at: string;
}

export interface HistoricalDataInput {
  snapshot_date: string;
  total_value: number;
  netting_total: number;
  netting_ex_cc: number;
  netting_ex_cc_np: number;
  deposits: number;
  average_balance: number;
  equity_exposure_pct: number; // NUOVO
}
```

### 2. Dashboard - Salvataggio Snapshot

```typescript
// In Dashboard.tsx
const { equityExposurePct } = useEquityExposurePct();

// Nel onClick di "Salva Snapshot"
upsertHistoricalData({
  snapshot_date: portfolio.snapshot_date,
  total_value: summary?.totalValue ?? 0,
  netting_total: netting.nettingTotal,
  netting_ex_cc: netting.nettingExCoveredCall,
  netting_ex_cc_np: netting.nettingExCCAndNP,
  deposits: 0,
  average_balance: 0,
  equity_exposure_pct: equityExposurePct, // NUOVO: salva exposure attuale
});
```

### 3. HistoricalDataForm - Campo manuale

Nuove props:
```typescript
interface HistoricalDataFormProps {
  // ... esistenti ...
  currentEquityExposurePct: number; // Per "Usa valori attuali"
}
```

Nuovo campo nel form:
- Label: "Equity Exposure (%)"
- Input numerico: 0-100 (visualizzazione user-friendly)
- Conversione: input/100 per salvare come 0-1
- Placeholder: "es. 65"

Il bottone "Usa valori attuali" popola anche questo campo.

### 4. useBenchmarkData - Logica corretta

```typescript
export function useBenchmarkData(
  historicalData: HistoricalDataEntry[], // Include equity_exposure_pct
  selectedPeriod: string,
  currentEquityExposure?: number // Exposure attuale per ultimo periodo
) {
  // ...
  
  // Ordina per data crescente
  const sortedHistory = [...historicalData].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  );
  
  let cumulativeBenchmarkReturn = 0;
  
  for (let i = 0; i < sortedHistory.length; i++) {
    const entry = sortedHistory[i];
    const nextDate = i < sortedHistory.length - 1 
      ? sortedHistory[i + 1].snapshot_date 
      : today; // Ultimo punto → oggi
    
    // CHIAVE: L'equity exposure di QUESTO punto
    // determina il benchmark per il periodo SUCCESSIVO
    const equityPct = entry.equity_exposure_pct > 0 
      ? entry.equity_exposure_pct 
      : 0.6; // Fallback per dati legacy
    
    // Calcola rendimenti Equity e Bond nel periodo
    const equityReturn = getEquityReturnBetween(entry.snapshot_date, nextDate);
    const bondReturn = getBondReturnBetween(entry.snapshot_date, nextDate);
    
    // Benchmark ponderato per il periodo
    const periodReturn = equityPct * equityReturn + (1 - equityPct) * bondReturn;
    
    // Compounding
    cumulativeBenchmarkReturn = (1 + cumulativeBenchmarkReturn) * (1 + periodReturn) - 1;
  }
  
  // ...
}
```

### 5. Tooltip Benchmark aggiornato

```typescript
const benchmarkTooltip = (
  <>
    <strong>Benchmark Dinamico Ponderato</strong>
    <br /><br />
    Paniere Equity (Media URTH/SPY/ACWI/EXSA.DE) e Bond (AGG) 
    ponderato per l'equity exposure storica del portafoglio.
    <br /><br />
    <strong>Ponderazione variabile:</strong> Il peso Equity/Bond 
    cambia nel tempo in base all'esposizione salvata in ogni snapshot.
    L'exposure di ciascun punto determina la ponderazione 
    per il periodo successivo.
    <br /><br />
    Equity exposure attuale: <strong>{(equityExposurePct * 100).toFixed(0)}%</strong>
  </>
);
```

---

## Edge Cases

| Scenario | Comportamento |
|----------|---------------|
| Snapshot legacy senza equity_exposure_pct | Usa fallback 60% |
| equity_exposure_pct = 0 | Usa fallback 60% (0 = non impostato) |
| equity_exposure_pct = 0.01 (intenzionale 1%) | Usa 1% (valore valido) |
| Solo 1 snapshot | Usa la sua equity exposure per tutto il periodo fino ad oggi |
| Form: input > 100 | Clamp a 100 |
| Form: input < 0 | Clamp a 0 |

---

## Flusso Utente

1. **Salvataggio automatico snapshot**: L'equity exposure attuale viene catturata automaticamente
2. **Inserimento manuale**: L'utente deve inserire l'equity exposure che aveva in quella data storica
3. **Modifica snapshot esistente**: Può correggere l'equity exposure se era sbagliata
4. **Visualizzazione benchmark**: Ogni segmento del grafico usa la ponderazione appropriata

---

## Migrazione Dati

I dati esistenti senza `equity_exposure_pct` useranno il default 60%.
L'utente può modificare ogni entry per inserire il valore corretto se lo ricorda.

---

## Test di Verifica

1. **Scenario multi-periodo**:
   - Salva snapshot gen 2024 con equity 40%
   - Salva snapshot feb 2024 con equity 70%
   - Verifica che il benchmark gen→feb usi 40%, feb→oggi usi 70%

2. **Form manuale**:
   - Inserisci dato storico con equity 50%
   - Verifica salvataggio corretto (0.5 nel DB)

3. **Tooltip**:
   - Hover su "Benchmark" nel grafico
   - Verifica menzione ponderazione variabile
