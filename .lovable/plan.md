

## Colorazione condizionale del bottone Calcolatrice

### Obiettivo

Quando ci sono dati salvati nella calcolatrice (ordini caricati), il bottone deve essere blu/azzurro. Quando non ci sono dati, deve rimanere grigio con trasparenza e highlight on hover.

### Modifiche

**File: `src/pages/Derivatives.tsx`** -- 4 punti dove appare il bottone Calculator

Per ogni bottone, la classe CSS del `Button` cambia in base alla presenza di dati salvati:

1. **Covered Call (riga ~800-803)**: condizione su `savedPremium && savedPremium.orders_json.length > 0`
2. **Iron Condor (riga ~1179-1182)**: condizione su `hasSavedGP`
3. **Double Diagonal (riga ~1459-1462)**: condizione su `hasSavedGP`
4. **Altre Strategie (riga ~1803-1806)**: condizione su `hasSavedGP`

Per ciascuno, il className del Button diventa:

- **Con dati**: `"h-7 w-7 shrink-0 text-primary hover:text-primary hover:bg-primary/20"` (blu/azzurro)
- **Senza dati**: `"h-7 w-7 shrink-0 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"` (grigio con trasparenza, highlight on hover)

Esempio di codice per ogni bottone:

```typescript
<Button
  variant="ghost"
  size="icon"
  className={`h-7 w-7 shrink-0 ${
    hasSavedGP
      ? 'text-primary hover:text-primary hover:bg-primary/20'
      : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted'
  }`}
  onClick={...}
>
  <Calculator className="w-3.5 h-3.5" />
</Button>
```

Per la Covered Call (dove non esiste `hasSavedGP` ma esiste `savedPremium`), la condizione sara':
```typescript
const hasCalcData = savedPremium && savedPremium.orders_json.length > 0;
```

### Nessuna modifica ad altri file

Solo `Derivatives.tsx` necessita aggiornamenti.

