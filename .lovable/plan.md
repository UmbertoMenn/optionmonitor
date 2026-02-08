
# Piano: Correzione Severity e Dettagli Opzione nelle Notifiche

## Problema 1: Severity "CRITICAL" per avvisi di distanza

**Causa identificata**: Nella edge function `check-alerts`, linea 431, la formula:
```typescript
severity: distancePct < distConfig.threshold_pct / 2 ? 'critical' : 'warning'
```
Assegna `critical` se la distanza è inferiore alla metà della soglia. Esempio: soglia 2%, distanza 0.5% → CRITICAL.

**Soluzione**: Gli avvisi di distanza dovrebbero essere sempre `warning`. Solo gli avvisi di stato (ITM, OOR, OOB) sono `critical`.

---

## Problema 2: Mancano i dettagli dell'opzione (es. "CALL 280 APR/26")

**Causa identificata**: 
- La tabella `strategy_cache` non salva le date di scadenza
- La tabella `alerts` non ha un campo per l'expiry
- Il sistema non può quindi mostrare "CALL 280 APR/26"

**Soluzione**: Aggiungere campi expiry alla pipeline completa.

---

## Modifiche Tecniche

### 1. Migrazione Database

Aggiungere colonne alla tabella `alerts`:
```sql
ALTER TABLE alerts ADD COLUMN option_type text;
ALTER TABLE alerts ADD COLUMN option_expiry date;
```

Aggiungere colonne alla tabella `strategy_cache`:
```sql
ALTER TABLE strategy_cache ADD COLUMN sold_call_expiry date;
ALTER TABLE strategy_cache ADD COLUMN sold_put_expiry date;
```

### 2. Modifiche a `src/lib/strategyCache.ts`

Aggiornare l'interfaccia `StrategyRecord`:
```typescript
interface StrategyRecord {
  // ... campi esistenti ...
  sold_call_expiry: string | null;  // formato ISO
  sold_put_expiry: string | null;
}
```

Salvare l'expiry dell'opzione venduta:
```typescript
// Per Covered Call
records.push({
  // ...
  sold_call_expiry: cc.option.expiry_date || null,
});

// Per Naked Put
records.push({
  // ...
  sold_put_expiry: np.option.expiry_date || null,
});
```

### 3. Modifiche a `supabase/functions/check-alerts/index.ts`

**A. Correggere severity per avvisi di distanza** (in tutte le 8 occorrenze):
```typescript
// PRIMA (errato)
severity: distancePct < distConfig.threshold_pct / 2 ? 'critical' : 'warning',

// DOPO (corretto)
severity: 'warning',
```

**B. Aggiungere expiry alla interface StrategyCache**:
```typescript
interface StrategyCache {
  // ... campi esistenti ...
  sold_call_expiry: string | null;
  sold_put_expiry: string | null;
}
```

**C. Includere option_type e option_expiry negli insert**:
```typescript
// Per Covered Call distance alert
await supabase.from('alerts').insert({
  // ... campi esistenti ...
  option_type: 'call',
  option_expiry: strategy.sold_call_expiry,
});

// Per Naked Put distance alert
await supabase.from('alerts').insert({
  // ... campi esistenti ...
  option_type: 'put',
  option_expiry: strategy.sold_put_expiry,
});
```

### 4. Modifiche a `supabase/functions/send-notification/index.ts`

**A. Aggiornare AlertPayload**:
```typescript
interface AlertPayload {
  // ... campi esistenti ...
  option_type?: string;
  option_expiry?: string;
}
```

**B. Riscrivere `getStrikeDisplay()` per formattare "Opzione: CALL 280 APR/26"**:
```typescript
function formatOptionDisplay(
  alertType: string, 
  optionType?: string,
  strikePrice?: number, 
  optionExpiry?: string,
  breakeven?: number
): { label: string; value: string } | null {
  // Per OOB alerts, mostra breakeven
  if (alertType === 'action_strategy_oob') {
    if (breakeven) {
      return { label: 'Breakeven', value: `$${breakeven.toFixed(2)}` };
    }
    return null;
  }
  
  if (!strikePrice) return null;
  
  // Determina tipo opzione dal alert_type se non fornito
  let type = optionType?.toUpperCase();
  if (!type) {
    if (alertType.includes('_call') || alertType === 'action_covered_call_itm') {
      type = 'CALL';
    } else if (alertType.includes('_put') || alertType === 'action_naked_put_itm') {
      type = 'PUT';
    }
  }
  
  // Formatta scadenza (es. "JUL/26")
  let expiryStr = '';
  if (optionExpiry) {
    const date = new Date(optionExpiry);
    const months = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 
                   'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
    const month = months[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    expiryStr = ` ${month}/${year}`;
  }
  
  const strikeStr = Math.floor(strikePrice) === strikePrice 
    ? strikePrice.toString() 
    : strikePrice.toFixed(2);
  
  return { 
    label: 'Opzione', 
    value: `${type} ${strikeStr}${expiryStr}` 
  };
}
```

**C. Aggiornare le chiamate nei template**:
```typescript
const optionInfo = formatOptionDisplay(
  alertData.alert_type,
  alertData.option_type,
  alertData.strike_price, 
  alertData.option_expiry,
  alertData.threshold_value
);
```

---

## Esempio Output Notifiche

**Prima**:
```
🟡 Warning
📈 Ticker: AAPL
📊 Strategia: Covered Call
🎯 Strike: CALL $280.00
```

**Dopo**:
```
🟡 Warning
📈 Ticker: AAPL
📊 Strategia: Covered Call
📋 Opzione: CALL 280 LUG/26
```

---

## Riepilogo Modifiche

| File | Modifica |
|------|----------|
| Migrazione SQL | +2 colonne `alerts`, +2 colonne `strategy_cache` |
| `src/lib/strategyCache.ts` | Aggiungere salvataggio expiry opzioni |
| `supabase/functions/check-alerts/index.ts` | Severity `warning` per distanza, includere option_type/expiry |
| `supabase/functions/send-notification/index.ts` | Nuova funzione `formatOptionDisplay()` con formato "CALL 280 LUG/26" |

---

## Risultato Atteso

1. ✅ Avvisi di distanza sempre con bollino **giallo** (warning)
2. ✅ Avvisi di stato mantengono bollino **rosso** (critical)
3. ✅ Notifiche mostrano "Opzione: CALL 280 LUG/26" invece di "Strike: CALL $280.00"
