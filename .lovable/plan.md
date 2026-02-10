

## Sostituzione emoji sirena con campanella nelle notifiche

### Obiettivo
Sostituire l'emoji 🚨 (sirena) con 🔔 (campanella) in tutte le notifiche email e Telegram.

### Modifiche

**File: `supabase/functions/send-notification/index.ts`**

1. **Riga 141** (email header h2): da `🚨 Avviso Portafoglio` a `🔔 Avviso Portafoglio`
2. **Riga 213** (telegram text): da `🚨 *Avviso Portafoglio*` a `🔔 *Avviso Portafoglio*`

Due sole righe da modificare, nessun impatto sulla logica.

