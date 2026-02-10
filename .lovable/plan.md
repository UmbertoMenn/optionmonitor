

## Gestione Notifiche Admin per Portafogli Utenti

### Obiettivo
Aggiungere nel pannello admin due toggle per controllare se l'admin riceve le copie delle notifiche (email e Telegram) generate dai portafogli degli utenti. Attualmente l'admin riceve SEMPRE tutto senza possibilita di disattivare.

### Modifiche

**1. Database: nuove colonne nella tabella `profiles`**

Aggiungere due colonne booleane:
- `admin_notify_email` (default `true`) - controlla ricezione email copie admin
- `admin_notify_telegram` (default `true`) - controlla ricezione Telegram copie admin

```sql
ALTER TABLE public.profiles
  ADD COLUMN admin_notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN admin_notify_telegram boolean NOT NULL DEFAULT true;
```

**2. UI: nuovo tab "Notifiche" nel pannello admin**

File: `src/components/admin/AdminPanel.tsx`

Aggiungere un quinto tab "Notifiche" (icona Bell) nella TabsList, con contenuto un componente `AdminNotificationSettings`.

File: `src/components/admin/AdminNotificationSettings.tsx` (nuovo)

Una Card con:
- Titolo "Notifiche Admin"
- Descrizione che spiega che questi toggle controllano le copie delle notifiche utenti
- Due righe con Switch:
  - "Email utenti" - toggle per `admin_notify_email`
  - "Telegram utenti" - toggle per `admin_notify_telegram`
- Lettura/scrittura diretta sulla tabella `profiles` dell'admin corrente

**3. Edge Function: rispettare i nuovi toggle**

File: `supabase/functions/send-notification/index.ts`

Nella sezione admin (righe 350-391), modificare la query per includere `admin_notify_email` e `admin_notify_telegram`, e condizionare l'invio:
- Invia email admin solo se `admin.admin_notify_email === true`
- Invia Telegram admin solo se `admin.admin_notify_telegram === true`

### Dettagli tecnici

La query admin nella edge function cambiera da:
```typescript
.select("email, notify_email, notify_telegram, telegram_chat_id, user_id")
```
a:
```typescript
.select("email, admin_notify_email, admin_notify_telegram, telegram_chat_id, user_id")
```

E le condizioni di invio da:
```typescript
if (admin.email) { ... }
if (admin.telegram_chat_id) { ... }
```
a:
```typescript
if (admin.admin_notify_email && admin.email) { ... }
if (admin.admin_notify_telegram && admin.telegram_chat_id) { ... }
```

