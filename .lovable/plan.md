

## Fix: Valuta hardcoded a USD nelle Strategie Derivati

### Problema

Tutte le righe delle strategie derivati (Covered Call, Long Put, Naked Put, Iron Condor, ecc.) utilizzano `'USD'` come valuta hardcoded per la formattazione dei prezzi. Per titoli italiani come ENI (che operano in EUR), questo causa:

1. **Strike price con "$"** nella descrizione (es. "Eni - Stock CALL $15" invece di "CALL 15")
2. **PS (Prezzo Sottostante) mostrato come "0,00 $"** perche il sistema cerca il prezzo in USD
3. **PMC e prezzo opzione formattati con "$"** invece di "EUR"

### Causa tecnica

- `formatOptionDescription()` in `derivativeStrategies.ts` usa `$${option.strike_price}` hardcoded
- Tutte le ~211 occorrenze di `formatCurrency(..., 'USD')` in `Derivatives.tsx` ignorano la valuta reale della posizione (`option.currency`)

### Soluzione

**File 1: `src/lib/derivativeStrategies.ts`**

- Nella funzione `formatOptionDescription`: rimuovere il prefisso `$` dallo strike price e mostrare solo il valore numerico (es. "Eni - Stock CALL 15"). Lo strike e' gia contestualizzato dalla valuta dell'opzione, il simbolo e' ridondante e scorretto per le opzioni EUR.

**File 2: `src/pages/Derivatives.tsx`**

- Creare un helper locale che determina la valuta corretta per una posizione derivata:

```text
function getOptionCurrency(option: Position): string {
  return option.currency || 'USD';
}
```

- Sostituire tutte le occorrenze di `formatCurrency(valore, 'USD')` con `formatCurrency(valore, getOptionCurrency(option))` nelle seguenti righe/componenti:
  - `CoveredCallRow`: PS, PMC, prezzo opzione (righe 831, 852, 863, 893)
  - `LongPutRow`: PS, PMC, prezzo opzione
  - `NakedPutRow`: PS, PMC, prezzo opzione
  - `IronCondorRow`: PS, GP, ML, prezzi gambe
  - `DoubleDiagonalRow`: PS, prezzi gambe
  - `LeapCallRow`: PS, PMC, prezzo opzione
  - `GroupedOtherStrategyRow`: PS, GP, ML, prezzi gambe
- Per il campo "UNIT" (net per share) nella CoveredCallRow: usare la valuta dell'opzione invece di `$` hardcoded

### Riepilogo

| File | Modifica |
|---|---|
| `src/lib/derivativeStrategies.ts` | Rimuovere `$` hardcoded dallo strike in `formatOptionDescription` |
| `src/pages/Derivatives.tsx` | Sostituire tutte le occorrenze `'USD'` con la valuta reale della posizione (`option.currency`) |

