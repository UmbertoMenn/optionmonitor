

## Rimuovere emoji dai messaggi Telegram (tranne campanella e severity)

### Stato attuale

Il messaggio Telegram contiene queste emoji:
- 🔔 nel titolo "Avviso Portafoglio" -- **da mantenere**
- Severity emoji (🔴/🟡/🔵) -- **da mantenere**
- 👤 davanti a "Utente" -- da rimuovere
- 📈 davanti a "Ticker" -- da rimuovere
- 📊 davanti a "Strategia" -- da rimuovere
- 📝 davanti a "Messaggio" -- da rimuovere
- 📋 davanti a "Opzione/Breakeven" -- da rimuovere

### Modifiche

**File: `supabase/functions/send-notification/index.ts`**

Nella funzione `sendTelegram` (righe 218-228), sostituire il template del messaggio rimuovendo le emoji decorative:

```
Da:
👤 *Utente:* ...
📈 *Ticker:* ...
📊 *Strategia:* ...
📝 *Messaggio:* ...
📋 *Opzione:* ...

A:
*Utente:* ...
*Ticker:* ...
*Strategia:* ...
*Messaggio:* ...
*Opzione:* ...
```

Anche nell'email (riga 171) rimuovere 📋 dal label dell'opzione.

### Cosa NON cambia
- La 🔔 nel titolo resta
- Le emoji di severity (🔴🟡🔵) restano
- Nessuna modifica alla logica di invio
- Nessuna modifica al formato email (tranne 📋)

