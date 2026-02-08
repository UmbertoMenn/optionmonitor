
# Piano: Aggiungere Nome Utente nelle Notifiche Admin

## Problema Attuale

Le funzioni `sendEmail` e `sendTelegram` ricevono già il flag `isAdmin`, ma **non hanno accesso al nome dell'utente** proprietario della posizione. L'admin riceve notifiche con `[ADMIN]` ma non sa di chi sia l'avviso.

## Soluzione

Modificare le funzioni per accettare un parametro opzionale `userName` che viene mostrato **solo nelle notifiche admin**.

---

## Modifiche Tecniche

**File**: `supabase/functions/send-notification/index.ts`

### 1. Aggiornare la firma delle funzioni

Aggiungere parametro `userName?: string` a entrambe le funzioni:

```typescript
async function sendEmail(
  email: string,
  alertData: AlertPayload,
  isAdmin: boolean = false,
  userName?: string  // ← nuovo parametro
): Promise<{ success: boolean; error?: string }>

async function sendTelegram(
  chatId: string,
  alertData: AlertPayload,
  isAdmin: boolean = false,
  userName?: string  // ← nuovo parametro
): Promise<{ success: boolean; error?: string }>
```

### 2. Modificare il template Email per Admin

Aggiungere riga "Utente" nella tabella HTML quando `isAdmin && userName`:

```html
${isAdmin && userName ? `
<tr>
  <td style="padding: 8px 0; color: #6b7280;">Utente:</td>
  <td style="padding: 8px 0;"><strong>${userName}</strong></td>
</tr>
` : ''}
```

### 3. Modificare il template Telegram per Admin

Aggiungere riga "Utente" nel messaggio quando `isAdmin && userName`:

```typescript
let text = `🚨 ${adminPrefix}*Avviso Portafoglio*
${severityEmoji} *${severityLabel}*
${isAdmin && userName ? `\n👤 *Utente:* ${userName}` : ''}

📈 *Ticker:* ${alertData.ticker}
...`
```

### 4. Passare il nome utente quando si notificano gli Admin

Modificare le chiamate nel ciclo admin (linee 315-334):

```typescript
// Prima
const emailResult = await sendEmail(admin.email, alertData, true);
const telegramResult = await sendTelegram(admin.telegram_chat_id, alertData, true);

// Dopo
const emailResult = await sendEmail(admin.email, alertData, true, userProfile.full_name || userProfile.email);
const telegramResult = await sendTelegram(admin.telegram_chat_id, alertData, true, userProfile.full_name || userProfile.email);
```

Se `full_name` è null, usa l'email come fallback.

---

## Esempio Output

**Telegram Admin (dopo modifica)**:
```
🚨 [ADMIN] Avviso Portafoglio
🔴 Critical

👤 Utente: Mario Rossi      ← NUOVO

📈 Ticker: AAPL
📊 Strategia: Covered Call
📝 Messaggio: Opzione ITM
🎯 Strike: CALL $185.00

Prezzo AAPL: $187.50
```

**Email Admin (dopo modifica)**:
```
┌─────────────────────────────┐
│ [ADMIN] Avviso Portafoglio  │
│ 🔴 Critical                 │
├─────────────────────────────┤
│ Utente:   Mario Rossi  ← NUOVO
│ Ticker:   AAPL              │
│ Strategia: Covered Call     │
│ Messaggio: Opzione ITM      │
└─────────────────────────────┘
```

---

## Riepilogo

| Linee | Modifica |
|-------|----------|
| 81-84 | Aggiungere parametro `userName` a `sendEmail` |
| 110-114 | Aggiungere riga "Utente" nel template HTML |
| 151-154 | Aggiungere parametro `userName` a `sendTelegram` |
| 166-171 | Aggiungere riga "Utente" nel template Telegram |
| 316, 327 | Passare `userProfile.full_name \|\| userProfile.email` alle chiamate admin |

---

## Risultato Atteso

- **Utente normale**: riceve notifiche senza modifiche (come prima)
- **Admin**: riceve notifiche con il nome dell'utente proprietario della posizione, così sa immediatamente di chi è l'avviso
