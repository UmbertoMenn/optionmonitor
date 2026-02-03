

## Obiettivo

Applicare la logica del badge **IR/OOR** (basata sugli strike) anche alle strategie:
- Put Spread
- Call Spread  
- Diagonal Put Spread
- Diagonal Call Spread

Invece di calcolare i breakeven matematici (che per le diagonali spesso falliscono), useremo una logica semplice basata sugli strike.

## Logica Proposta

Per le strategie SPREAD (verticali o diagonali):

| Strategia | Logica IR/OOR |
|-----------|---------------|
| **Put Spread** (Bull Put Spread) | IR se prezzo >= strike PUT venduta |
| **Call Spread** (Bear Call Spread) | IR se prezzo <= strike CALL venduta |
| **Diagonal Put Spread** | IR se prezzo >= strike PUT venduta |
| **Diagonal Call Spread** | IR se prezzo <= strike CALL venduta |

Per gli spread, il range mostrato sarà lo strike venduto (non un range min-max).

## Modifiche Tecniche

### File: `src/pages/Derivatives.tsx`

**1. Aggiornare la lista delle strategie che usano la logica "Range" (linee ~1183-1185):**

```typescript
// Strategie che usano la logica IR/OOR basata sugli strike
const isAltDoubleDiagonal = strategyName === 'Alternative Double Diagonal';
const isShortStrangle = strategyName === 'Short Strangle';
const isPutSpread = strategyName === 'Put Spread' || strategyName === 'Diagonal Put Spread';
const isCallSpread = strategyName === 'Call Spread' || strategyName === 'Diagonal Call Spread';
const showRangeBadge = isAltDoubleDiagonal || isShortStrangle || isPutSpread || isCallSpread;
```

**2. Modificare la logica di calcolo IR/OOR (linee ~1187-1201):**

```typescript
let isInRange = false;
let soldPutStrike = 0;
let soldCallStrike = 0;
let rangeDisplay = '';

if (showRangeBadge && hasUnderlyingPrice) {
  if (isAltDoubleDiagonal || isShortStrangle) {
    // Logica esistente: range tra PUT venduta e CALL venduta
    const soldPut = options.find(o => o.option.option_type === 'put' && o.option.quantity < 0);
    const soldCall = options.find(o => o.option.option_type === 'call' && o.option.quantity < 0);
    
    if (soldPut && soldCall) {
      soldPutStrike = soldPut.option.strike_price || 0;
      soldCallStrike = soldCall.option.strike_price || 0;
      isInRange = underlyingPrice >= soldPutStrike && underlyingPrice <= soldCallStrike;
      rangeDisplay = `${soldPutStrike} - ${soldCallStrike}`;
    }
  } else if (isPutSpread) {
    // Put Spread: IR se prezzo >= strike PUT venduta
    const soldPut = options.find(o => o.option.option_type === 'put' && o.option.quantity < 0);
    if (soldPut) {
      soldPutStrike = soldPut.option.strike_price || 0;
      isInRange = underlyingPrice >= soldPutStrike;
      rangeDisplay = `≥ ${soldPutStrike}`;
    }
  } else if (isCallSpread) {
    // Call Spread: IR se prezzo <= strike CALL venduta
    const soldCall = options.find(o => o.option.option_type === 'call' && o.option.quantity < 0);
    if (soldCall) {
      soldCallStrike = soldCall.option.strike_price || 0;
      isInRange = underlyingPrice <= soldCallStrike;
      rangeDisplay = `≤ ${soldCallStrike}`;
    }
  }
}
```

**3. Aggiornare la condizione del badge (linea ~1268):**

```typescript
// Cambiare la condizione da:
{showRangeBadge && hasUnderlyingPrice && soldPutStrike > 0 && soldCallStrike > 0 ? (

// A:
{showRangeBadge && hasUnderlyingPrice && rangeDisplay ? (
```

**4. Aggiornare la visualizzazione del range (linea ~1317-1320):**

```typescript
) : showRangeBadge && hasUnderlyingPrice && rangeDisplay ? (
  <span className="text-xs text-muted-foreground">
    {rangeDisplay}
  </span>
)
```

**5. Aggiornare i tooltip (linea ~1281-1283):**

```typescript
<TooltipContent>
  <p>{isInRange 
    ? `In Range: prezzo ${rangeDisplay}` 
    : `Out of Range: prezzo non ${rangeDisplay}`}</p>
</TooltipContent>
```

## Risultato Atteso

| Strategia | Prezzo | Strike Venduto | Badge | Display |
|-----------|--------|----------------|-------|---------|
| Diagonal Put Spread TSLA | 280 | PUT 250 | IR | ≥ 250 |
| Diagonal Put Spread TSLA | 240 | PUT 250 | OOR | ≥ 250 |
| Call Spread AAPL | 180 | CALL 200 | IR | ≤ 200 |
| Call Spread AAPL | 210 | CALL 200 | OOR | ≤ 200 |

