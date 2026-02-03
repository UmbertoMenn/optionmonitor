

## Obiettivo

Aggiungere il badge **IB** (In Breakeven - verde) e **OOB** (Out Of Breakeven - rosso) per le strategie diverse da "Short Strangle" e "Alternative Double Diagonal" nella sezione "Altre Strategie".

## Logica

- Utilizzare le funzioni esistenti in `optionCalculator.ts` per calcolare i breakeven:
  - `getPriceRangeForPositions()` - determina il range di prezzo da analizzare
  - `calculateOptionPayoff()` - calcola il payoff per ogni punto di prezzo
  - `findBreakevenPoints()` - trova i punti dove il payoff attraversa lo zero
- Se il prezzo del sottostante è **tra** i breakeven (min e max), mostrare **IB** (verde)
- Se il prezzo del sottostante è **fuori** dai breakeven, mostrare **OOB** (rosso)
- Per strategie con un solo breakeven o nessun breakeven, non mostrare il badge

## Modifiche

### File: `src/pages/Derivatives.tsx`

**1. Import delle funzioni di calcolo:**
```typescript
import { 
  calculateOptionPayoff, 
  findBreakevenPoints, 
  getPriceRangeForPositions 
} from '@/lib/optionCalculator';
```

**2. Nel componente `GroupedOtherStrategyRow`:**

Dopo la logica esistente per IR/OOR (Short Strangle e Alternative Double Diagonal), aggiungere il calcolo dei breakeven per le altre strategie:

```typescript
// Logica per badge IB/OOB (strategie diverse da IR/OOR)
const showBreakevenBadge = !showRangeBadge && hasUnderlyingPrice;
let isInBreakeven = false;
let breakevens: number[] = [];

if (showBreakevenBadge) {
  // Converte le opzioni in DerivativePosition per usare le funzioni esistenti
  const derivativePositions = options.map(o => ({
    ...o.option,
    strike_price: o.option.strike_price || 0,
    option_type: o.option.option_type as OptionType,
  })) as DerivativePosition[];
  
  // Calcola il payoff e trova i breakeven
  const priceRange = getPriceRangeForPositions(derivativePositions);
  const payoffPoints = calculateOptionPayoff(derivativePositions, underlyingPrice, priceRange);
  breakevens = findBreakevenPoints(payoffPoints);
  
  // Se ci sono almeno 2 breakeven, verifica se il prezzo è nel range
  if (breakevens.length >= 2) {
    const minBE = Math.min(...breakevens);
    const maxBE = Math.max(...breakevens);
    isInBreakeven = underlyingPrice >= minBE && underlyingPrice <= maxBE;
  } else if (breakevens.length === 1) {
    // Con un solo breakeven, mostra IB se siamo in profitto a quel prezzo
    // (il payoff al prezzo corrente è positivo)
    const currentPayoff = payoffPoints.find(p => Math.abs(p.price - underlyingPrice) < (priceRange.max - priceRange.min) / 100);
    isInBreakeven = currentPayoff ? currentPayoff.payoff >= 0 : false;
  }
}
```

**3. Badge UI:**

Aggiungere dopo il badge IR/OOR esistente:

```typescript
{showBreakevenBadge && breakevens.length > 0 && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge 
        variant="outline"
        className={`text-xs shrink-0 ${isInBreakeven 
          ? 'text-green-500 border-green-500' 
          : 'text-red-500 border-red-500'}`}
      >
        {isInBreakeven ? 'IB' : 'OOB'}
      </Badge>
    </TooltipTrigger>
    <TooltipContent>
      <p>{isInBreakeven 
        ? `In Breakeven: prezzo tra ${breakevens.map(b => b.toFixed(2)).join(' e ')}` 
        : `Out of Breakeven: prezzo fuori dal range ${breakevens.map(b => b.toFixed(2)).join('-')}`}</p>
    </TooltipContent>
  </Tooltip>
)}
```

## Riepilogo Badge per Strategie

| Strategia | Badge | Colore Verde | Colore Rosso |
|-----------|-------|--------------|--------------|
| Short Strangle | IR / OOR | In Range | Out Of Range |
| Alternative Double Diagonal | IR / OOR | In Range | Out Of Range |
| Altre Strategie | IB / OOB | In Breakeven | Out Of Breakeven |

