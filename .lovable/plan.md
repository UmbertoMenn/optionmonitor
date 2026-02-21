

## Fix: allExpiries non copre abbastanza scadenze future

### Causa del bug

Riga 160-162 di `src/lib/backtestEngine.ts`:
```text
const lastBarDate = new Date(priceData[priceData.length - 1].date);
lastBarDate.setMonth(lastBarDate.getMonth() + 3);
const allExpiries = getMonthlyExpiries(..., formatDate(lastBarDate));
```

Le scadenze vengono generate solo fino a 3 mesi dopo l'ultima barra. Se l'ultima barra e febbraio 2026, le scadenze arrivano fino a maggio 2026 circa.

Quando un roll crea una leg con scadenza maggio 2026 e il prezzo continua a salire, `executeApproachRule` chiama `findNextExpiry(leg.expiryDate, allExpiries)` cercando una scadenza **dopo** maggio 2026. Non ne trova nessuna, ritorna `null`, e il roll viene bloccato.

### Soluzione

Estendere il range di `allExpiries` da +3 mesi a **+12 mesi** oltre l'ultima barra. Questo garantisce che ci sia sempre almeno una scadenza mensile disponibile dopo qualsiasi leg creata durante il backtest.

### Modifica

| File | Riga | Modifica |
|------|------|----------|
| `src/lib/backtestEngine.ts` | 161 | Cambiare `lastBarDate.setMonth(lastBarDate.getMonth() + 3)` in `lastBarDate.setMonth(lastBarDate.getMonth() + 12)` |

### Dettaglio tecnico

Con +12 mesi, se l'ultima barra e febbraio 2026:
- `allExpiries` arriva fino a febbraio 2027
- Una leg con scadenza maggio 2026 trova giugno 2026 come prossima scadenza
- Una leg con scadenza gennaio 2027 trova febbraio 2027
- Nessun roll viene piu bloccato per mancanza di scadenze disponibili

