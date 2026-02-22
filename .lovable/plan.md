

## Estendere il range di scadenze disponibili a 30 mesi

### Situazione attuale

In `src/lib/backtestEngine.ts`, riga 161:
```text
lastBarDate.setMonth(lastBarDate.getMonth() + 12);
```

Le scadenze mensili vengono generate fino a 12 mesi dopo l'ultima barra di prezzo. Se un roll cerca una scadenza oltre questo limite (es. con `roll_up_positive` che non trova credito netto positivo entro 12 mesi), il roll fallisce.

### Modifica

| File | Riga | Modifica |
|------|------|----------|
| `src/lib/backtestEngine.ts` | 161 | Cambiare `+ 12` in `+ 30` |

Questo garantisce che `executeApproachRule` e `executeProfitRule` possano cercare scadenze fino a 30 mesi nel futuro, coprendo anche scenari estremi con call deep ITM dove serve molto valore temporale per ottenere un credito netto positivo.

