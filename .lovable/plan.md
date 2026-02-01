
# Piano: Toggle Attivo di Default + Avvisi Commodities/Bond

## Modifiche Richieste

L'utente ha richiesto 3 modifiche:

| # | Modifica | Vista | File |
|---|----------|-------|------|
| 1 | Toggle "Includi Derivati" attivo di default | Risk Analyzer | `RiskAnalyzer.tsx` |
| 2 | Avviso che le commodities sono escluse | Sector Allocation | `SectorAllocationView.tsx` |
| 3 | Toggle "Includi Bond" + avviso se disattivato | Currency Exposure | `CurrencyExposureView.tsx`, `currencyExposure.ts` |

---

## Dettaglio Implementazione

### 1. Toggle Derivati Attivo di Default

**File**: `src/pages/RiskAnalyzer.tsx` (linea 30)

```typescript
// Da:
const [includeDerivatives, setIncludeDerivatives] = useState(false);

// A:
const [includeDerivatives, setIncludeDerivatives] = useState(true);
```

### 2. Avviso Commodities Escluse (Sector Allocation)

**File**: `src/components/risk/SectorAllocationView.tsx`

Aggiungere un avviso sotto l'avviso derivati (sempre visibile, non controllato da toggle):

```typescript
// Dopo l'avviso derivati esistente (linea ~136)
<div className="flex items-center gap-2 mt-3 p-2 rounded-md bg-blue-500/10 border border-blue-500/30">
  <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
  <span className="text-xs text-blue-600 dark:text-blue-400">
    Commodities escluse dall'analisi settoriale
  </span>
</div>
```

Importare `Info` da lucide-react.

### 3. Toggle Bond + Avviso (Currency Exposure)

**File**: `src/components/risk/CurrencyExposureView.tsx`

**3.1 Aggiungere props per bonds:**

```typescript
interface CurrencyExposureViewProps {
  // ... props esistenti
  includeBonds: boolean;
  onIncludeBondsChange: (value: boolean) => void;
}
```

**3.2 Aggiungere toggle UI:**

Accanto al toggle derivati, aggiungere:

```typescript
<div className="flex items-center gap-2">
  <Switch 
    id="include-bonds"
    checked={includeBonds}
    onCheckedChange={onIncludeBondsChange}
  />
  <Label htmlFor="include-bonds" className="text-sm text-muted-foreground cursor-pointer">
    Includi Bond
  </Label>
</div>
```

**3.3 Aggiungere avviso se bond esclusi:**

```typescript
{!includeBonds && (
  <div className="flex items-center gap-2 mt-3 p-2 rounded-md bg-blue-500/10 border border-blue-500/30">
    <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
    <span className="text-xs text-blue-600 dark:text-blue-400">
      Obbligazioni escluse dall'analisi
    </span>
  </div>
)}
```

---

**File**: `src/pages/RiskAnalyzer.tsx`

**3.4 Gestire stato bonds:**

```typescript
const [includeBonds, setIncludeBonds] = useState(true);

// Nel calcolo currencyExposure:
const baseCurrencyExposure = useMemo(() => 
  calculateCurrencyExposure(analysis, { includeDerivatives, includeBonds }), 
  [analysis, includeDerivatives, includeBonds]
);

// Passare a CurrencyExposureView:
<CurrencyExposureView 
  // ... props esistenti
  includeBonds={includeBonds}
  onIncludeBondsChange={setIncludeBonds}
/>
```

---

**File**: `src/lib/currencyExposure.ts`

**3.5 Modificare calcolo per supportare bonds:**

```typescript
export interface CurrencyBreakdown {
  stocks: number;
  bonds: number;        // NUOVO
  commodities: number;
  nakedPuts: number;
  leapCalls: number;
  strategies: number;
}

export interface InstrumentDetail {
  name: string;
  riskEUR: number;
  riskOriginal: number;
  category: 'stocks' | 'bonds' | 'commodities' | 'nakedPuts' | 'leapCalls' | 'strategies';
  // ...
}

export interface CurrencyExposureOptions {
  includeDerivatives?: boolean;
  includeBonds?: boolean;  // NUOVO
}
```

**3.6 Modificare RiskAnalysis per includere bondDetails:**

Prima devo verificare se `RiskAnalysis` ha già i dettagli dei bond. Dalla lettura del codice, noto che `riskCalculator.ts` non calcola i bond separatamente. I bond potrebbero essere inclusi negli stockDetails o potrebbero essere gestiti in modo diverso.

Guardando il file `riskCalculator.ts` linee 150-154:
```typescript
// Include only stocks and ETFs (commodities are calculated separately)
const stockAssetTypes = ['stock', 'etf'];
```

I **bond sono esclusi** dal calcolo del rischio attuale! Questo significa che per includere i bond nell'analisi valutaria, bisogna:

1. Aggiungere `BondRiskDetail` interface
2. Aggiungere `calculateBondRisk()` function
3. Estendere `RiskAnalysis` con `bondDetails`
4. Modificare `currencyExposure.ts` per usare i bondDetails

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/pages/RiskAnalyzer.tsx` | Toggle derivati default `true`, nuovo stato `includeBonds`, passare props |
| `src/components/risk/SectorAllocationView.tsx` | Aggiungere avviso commodities escluse |
| `src/components/risk/CurrencyExposureView.tsx` | Aggiungere toggle bond + avviso |
| `src/lib/currencyExposure.ts` | Estendere interfacce con `bonds`, filtrare se disabilitato |
| `src/lib/riskCalculator.ts` | Aggiungere `BondRiskDetail` e `calculateBondRisk()` |
| `src/hooks/useRiskAnalysis.ts` | Passare bonds a RiskAnalysis |

---

## Risultato Visivo Atteso

### Sector Allocation
```text
┌─────────────────────────────────────────────┐
│  📊 Esposizione Settoriale Totale           │
│  € 123.456                                  │
│                                             │
│  ⚠️ Derivati esclusi dall'analisi           │  ← se toggle OFF
│  ℹ️ Commodities escluse dall'analisi        │  ← SEMPRE VISIBILE
└─────────────────────────────────────────────┘
```

### Currency Exposure
```text
┌─────────────────────────────────────────────┐
│  💰 Esposizione Valutaria Totale            │
│                                             │
│  ◯ Includi Derivati   ◯ Includi Bond       │  ← DUE TOGGLE
│                                             │
│  € 234.567                                  │
│                                             │
│  ⚠️ Derivati esclusi dall'analisi           │  ← se toggle OFF
│  ℹ️ Obbligazioni escluse dall'analisi       │  ← se toggle OFF
└─────────────────────────────────────────────┘
```
