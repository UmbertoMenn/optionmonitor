

## Rimozione prefisso [ADMIN] dalle notifiche Email e Telegram

### Problema
Nelle notifiche inviate all'admin, il titolo contiene `[ADMIN]` (es. "🚨 [ADMIN] Avviso Portafoglio"). Questo prefisso va rimosso sia dalle email che da Telegram. Le notifiche admin manterranno comunque la riga "Utente: NomeUtente" per distinguerle.

### Modifiche

**File: `supabase/functions/send-notification/index.ts`**

Rimuovere tutte le occorrenze di `adminPrefix`:

1. **Riga 122** (email): rimuovere `const adminPrefix = isAdmin ? "[ADMIN] " : "";`
2. **Riga 138** (email subject): da `${adminPrefix}${severityEmoji} Avviso Portfolio:...` a `${severityEmoji} Avviso Portfolio:...`
3. **Riga 142** (email header h2): da `🚨 ${adminPrefix}Avviso Portafoglio` a `🚨 Avviso Portafoglio`
4. **Riga 202** (telegram): rimuovere `const adminPrefix = isAdmin ? "*[ADMIN]* " : "";`
5. **Riga 215** (telegram text): da `🚨 ${adminPrefix}*Avviso Portafoglio*` a `🚨 *Avviso Portafoglio*`

La riga "Utente: NomeUtente" resta visibile nelle notifiche admin per identificare il proprietario del portafoglio.

