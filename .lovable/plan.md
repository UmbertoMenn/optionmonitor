

## Fix "undefined" nella descrizione opzione delle notifiche

### Problema
Quando vengono generati avvisi di tipo **ITM** (Covered Call ITM, Naked Put ITM) e **OOR** (Iron Condor/Double Diagonal/Alternative DD Out of Range), i campi `option_type` e `option_expiry` non vengono inclusi nell'inserimento nella tabella `alerts`. Di conseguenza, nelle notifiche Telegram ed Email appare "undefined 300" o "undefined 420" al posto di "CALL 300 MAR/26".

### Causa radice
In `check-alerts/index.ts`, gli insert per alert ITM e OOR omettono `option_type` e `option_expiry`. Il fallback in `send-notification` basato su `alertType.includes('_call')` funziona solo per alcuni tipi ma non per `action_dd_ic_oor`.

### Soluzione: doppio intervento

**1. File: `supabase/functions/check-alerts/index.ts`**

Aggiungere `option_type` e `option_expiry` a TUTTI gli insert di alert che attualmente li omettono:

- **Covered Call ITM** (~riga 388): aggiungere `option_type: 'call'` e `option_expiry: strategy.sold_call_expiry`
- **Naked Put ITM** (~riga 500): aggiungere `option_type: 'put'` e `option_expiry: strategy.sold_put_expiry`
- **Iron Condor OOR** (~riga 598-611): aggiungere `option_type: side === 'PUT' ? 'put' : 'call'` e `option_expiry: side === 'PUT' ? strategy.sold_put_expiry : strategy.sold_call_expiry`
- **Double Diagonal OOR** (sezione DD): stessa logica del IC OOR
- **Alternative DD OOR** (sezione Alt DD): stessa logica del IC OOR

**2. File: `supabase/functions/send-notification/index.ts`**

Aggiungere un fallback difensivo in `formatOptionDisplay` per gestire i casi in cui `type` rimane `undefined` dopo tutti i tentativi di deduzione:

```typescript
// Dopo tutti i tentativi di determinare type (riga ~86):
if (!type) {
  // Se non riusciamo a determinare il tipo, mostriamo solo lo strike
  return { label: 'Strike', value: `${strikeStr}${expiryStr}` };
}
```

Questo garantisce che anche se un alert futuro arriva senza `option_type`, non apparira mai "undefined" nel messaggio.

### Riepilogo modifiche
| File | Modifica |
|------|----------|
| `check-alerts/index.ts` | Aggiungere `option_type` e `option_expiry` a 5 blocchi di insert (ITM e OOR) |
| `send-notification/index.ts` | Fallback difensivo quando `type` e `undefined` |

