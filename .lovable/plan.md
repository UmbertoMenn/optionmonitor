

## Toggle admin generali che propagano a tutti gli utenti

Quando l'admin toglie/attiva il toggle generale "Email utenti" o "Telegram utenti", lo stato deve propagarsi a tutti i profili utente nella lista sottostante.

### Modifiche

**File: `src/components/admin/AdminNotificationSettings.tsx`**

Nella funzione `updateSetting`, dopo aver aggiornato il campo admin (`admin_notify_email` / `admin_notify_telegram`), eseguo un batch update su tutti i profili non-admin:

- Se toggle `admin_notify_email` cambia → aggiorna `notify_email` su tutti gli utenti nella lista
- Se toggle `admin_notify_telegram` cambia → aggiorna `notify_telegram` su tutti gli utenti nella lista (solo quelli con `telegram_chat_id` se si disattiva; se si attiva, solo quelli con Telegram collegato)

Concretamente:
1. Dopo l'update del proprio profilo admin, chiamo `supabase.from('profiles').update({ notify_email: value }).neq('user_id', user.id)` (per email) oppure `.update({ notify_telegram: value }).neq('user_id', user.id).not('telegram_chat_id', 'is', null)` (per telegram, solo utenti con Telegram collegato)
2. Aggiorno lo stato locale `userProfiles` di conseguenza
3. Mostro toast "Notifiche aggiornate per tutti gli utenti"

Nessuna migrazione DB necessaria — la policy "Admins can update all profiles" già copre questo caso.

