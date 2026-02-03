
# Piano: Badge IR/OOR per Strategie a Range

## Obiettivo
Aggiungere un badge visivo che indica se il prezzo del sottostante si trova all'interno del "range profittevole" (tra i due strike venduti) per le strategie:
- Iron Condor
- Double Diagonal  
- Alternative Double Diagonal

---

## Logica del Badge

| Badge | Colore | Condizione |
|-------|--------|------------|
| **IR** | Verde | Prezzo sottostante >= Strike PUT venduto AND <= Strike CALL venduto |
| **OOR** | Rosso | Prezzo sottostante < Strike PUT venduto OR > Strike CALL venduto |

### Formula
```typescript
const isInRange = underlyingPrice >= soldPutStrike && underlyingPrice <= soldCallStrike;
// IR = In Range (verde), OOR = Out Of Range (rosso)
```

---

## Modifiche File

### File: `src/pages/Derivatives.tsx`

---

### 1. Iron Condor - `IronCondorRow` (righe 747-928)

Aggiungere dopo `hasUnderlyingPrice`:

```typescript
// Calculate if underlying price is In Range (between sold strikes)
const soldPutStrike = soldPut.strike_price || 0;
const soldCallStrike = soldCall.strike_price || 0;
const isInRange = hasUnderlyingPrice && underlyingPrice >= soldPutStrike && underlyingPrice <= soldCallStrike;
```

Nel JSX, dopo il badge "IC", aggiungere:

```typescript
{hasUnderlyingPrice && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge 
        className={`text-xs shrink-0 ${isInRange 
          ? 'bg-green-500 text-white hover:bg-green-600' 
          : 'bg-red-500 text-white hover:bg-red-600'}`}
      >
        {isInRange ? 'IR' : 'OOR'}
      </Badge>
    </TooltipTrigger>
    <TooltipContent>
      <p>{isInRange 
        ? `In Range: prezzo tra ${soldPutStrike} e ${soldCallStrike}` 
        : `Out of Range: prezzo fuori da ${soldPutStrike}-${soldCallStrike}`}</p>
    </TooltipContent>
  </Tooltip>
)}
```

---

### 2. Double Diagonal - `DoubleDiagonalRow` (righe 931-1118)

Stessa logica dell'Iron Condor. Aggiungere dopo `hasUnderlyingPrice`:

```typescript
// Calculate if underlying price is In Range (between sold strikes)
const soldPutStrike = soldPut.strike_price || 0;
const soldCallStrike = soldCall.strike_price || 0;
const isInRange = hasUnderlyingPrice && underlyingPrice >= soldPutStrike && underlyingPrice <= soldCallStrike;
```

Nel JSX, dopo il badge "DD", aggiungere lo stesso badge IR/OOR.

---

### 3. Alternative Double Diagonal - `GroupedOtherStrategyRow` (righe 1121-1193)

Per questa strategia, devo estrarre gli strike venduti dalle opzioni:

```typescript
// Calculate IR/OOR for Alternative Double Diagonal
const isAltDoubleDiagonal = strategyName === 'Alternative Double Diagonal';
let isInRange = false;
let soldPutStrike = 0;
let soldCallStrike = 0;

if (isAltDoubleDiagonal && hasUnderlyingPrice) {
  // Find sold PUT and CALL strikes
  const soldPut = options.find(o => o.option.option_type === 'put' && o.option.quantity < 0);
  const soldCall = options.find(o => o.option.option_type === 'call' && o.option.quantity < 0);
  
  if (soldPut && soldCall) {
    soldPutStrike = soldPut.option.strike_price || 0;
    soldCallStrike = soldCall.option.strike_price || 0;
    isInRange = underlyingPrice >= soldPutStrike && underlyingPrice <= soldCallStrike;
  }
}
```

Nel JSX, dopo il badge del nome strategia, aggiungere:

```typescript
{isAltDoubleDiagonal && hasUnderlyingPrice && soldPutStrike > 0 && soldCallStrike > 0 && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge 
        className={`text-xs shrink-0 ${isInRange 
          ? 'bg-green-500 text-white hover:bg-green-600' 
          : 'bg-red-500 text-white hover:bg-red-600'}`}
      >
        {isInRange ? 'IR' : 'OOR'}
      </Badge>
    </TooltipTrigger>
    <TooltipContent>
      <p>{isInRange 
        ? `In Range: prezzo tra ${soldPutStrike} e ${soldCallStrike}` 
        : `Out of Range: prezzo fuori da ${soldPutStrike}-${soldCallStrike}`}</p>
    </TooltipContent>
  </Tooltip>
)}
```

---

## Riepilogo Modifiche

| Componente | Posizione Badge | Dati Utilizzati |
|------------|-----------------|-----------------|
| IronCondorRow | Dopo badge "IC" | `soldPut.strike_price`, `soldCall.strike_price`, `underlyingPrice` |
| DoubleDiagonalRow | Dopo badge "DD" | `soldPut.strike_price`, `soldCall.strike_price`, `underlyingPrice` |
| GroupedOtherStrategyRow | Dopo badge nome strategia | Estratti da `options` array (sold PUT/CALL) |

---

## Esempi Visivi

### Iron Condor con prezzo in range:
```
NVIDIA  [IC] [IR]  GEN/26  PUT 100/110  CALL 130/140  ...
         ↑    ↑
       tipo  verde (prezzo tra 110 e 130)
```

### Double Diagonal con prezzo out of range:
```
APPLE  [DD] [OOR]  DIC/25 - MAR/26  PUT 170/180  CALL 200/210  ...
        ↑    ↑
      tipo  rosso (prezzo sotto 180 o sopra 200)
```

---

## Note

- Il badge viene mostrato solo se il prezzo del sottostante e disponibile (`hasUnderlyingPrice`)
- Per Alternative Double Diagonal, verifica anche che gli strike venduti siano stati trovati
- Il tooltip spiega il range numerico per chiarezza
- Lo stile del badge e coerente con gli altri badge ITM/OTM esistenti
