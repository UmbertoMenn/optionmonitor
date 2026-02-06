

# Piano: Completamento Sistema Notifiche Ibrido Email + Telegram

## Stato Attuale

Il database e il trigger sono già configurati. Mancano le Edge Functions e l'interfaccia utente.

## Fase 1: Configurazione Secrets

Prima di procedere con l'implementazione, sono necessarie due chiavi API:

### RESEND_API_KEY
Per inviare email professionali. Come ottenerla:
1. Vai su https://resend.com e crea un account gratuito
2. Vai su https://resend.com/domains e verifica il tuo dominio email
3. Vai su https://resend.com/api-keys e crea una nuova API key
4. Copia la chiave (inizia con `re_`)

### TELEGRAM_BOT_TOKEN
Per inviare messaggi Telegram. Come ottenerlo:
1. Apri Telegram e cerca @BotFather
2. Invia `/newbot` e segui le istruzioni
3. Copia il token (formato: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

---

## Fase 2: Edge Function `send-notification`

Creare `supabase/functions/send-notification/index.ts`:

- Riceve dati alert dal trigger database
- Recupera profilo utente e preferenze
- Recupera admin dalla tabella `user_roles`
- Invia Email via Resend se `notify_email = true`
- Invia Telegram se `notify_telegram = true` e `telegram_chat_id` presente
- Notifica anche gli admin
- Registra risultati in `notification_logs`

---

## Fase 3: Edge Function `telegram-link`

Creare `supabase/functions/telegram-link/index.ts`:

Gestisce due endpoint:

**POST /generate** - Genera codice di linking:
- Crea codice univoco (es: LINK-A7F3K2)
- Salva in `telegram_link_codes` con scadenza 10 minuti
- Restituisce codice da mostrare all'utente

**POST /verify** - Verifica codice dal bot:
- Riceve `code` e `chat_id` dal webhook Telegram
- Verifica validita e scadenza
- Aggiorna `profiles.telegram_chat_id`
- Marca codice come usato

---

## Fase 4: Frontend Components

### 4.1 `src/hooks/useNotificationSettings.ts`
Hook per gestire preferenze:
- Fetch/update `notify_email`, `notify_telegram`
- Generazione codice Telegram
- Stato collegamento Telegram

### 4.2 `src/components/settings/NotificationSettings.tsx`
UI con:
- Switch per Email notifications
- Switch per Telegram notifications
- Pulsante "Collega Telegram" con codice
- Badge stato collegamento

---

## Fase 5: Aggiornamento Configurazione

Aggiungere a `supabase/config.toml`:
```toml
[functions.send-notification]
verify_jwt = false

[functions.telegram-link]
verify_jwt = false
```

---

## File da Creare

| File | Descrizione |
|------|-------------|
| `supabase/functions/send-notification/index.ts` | Invio notifiche Email e Telegram |
| `supabase/functions/telegram-link/index.ts` | Gestione collegamento Telegram |
| `src/hooks/useNotificationSettings.ts` | Hook gestione preferenze |
| `src/components/settings/NotificationSettings.tsx` | UI preferenze notifiche |

---

## Ordine Implementazione

1. Richiesta secrets RESEND_API_KEY e TELEGRAM_BOT_TOKEN
2. Creazione edge function `send-notification`
3. Creazione edge function `telegram-link`
4. Creazione hook e componente frontend
5. Aggiornamento config.toml
6. Deploy e test

