

## Problema

I toggle per-utente nella sezione Admin attualmente modificano `notify_email`/`notify_telegram` sul profilo dell'utente, cambiando le notifiche che l'utente stesso riceve. Dovrebbero invece controllare solo se l'admin riceve le copie per quel specifico utente.

Serve una nuova tabella per le preferenze admin per-utente, e il toggle generale deve propagare a tutti i record di questa tabella.

## Piano

### 1. Nuova tabella `admin_notification_preferences`

```sql
CREATE TABLE public.admin_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  notify_email boolean NOT NULL DEFAULT true,
  notify_telegram boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, target_user_id)
);

ALTER TABLE public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own notification preferences"
ON public.admin_notification_preferences FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = admin_user_id)
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = admin_user_id);
```

### 2. Modifiche a `AdminNotificationSettings.tsx`

- Caricare le preferenze dalla nuova tabella invece di leggere `notify_email`/`notify_telegram` dai profili utente
- `updateSetting` (toggle generale): oltre a salvare `admin_notify_email`/`admin_notify_telegram`, fare upsert su `admin_notification_preferences` per tutti gli utenti, impostando il campo corrispondente al valore del toggle
- Aggiornare lo stato locale `userProfiles` per riflettere il cambio
- `updateUserSetting` (toggle per-utente): fare upsert su `admin_notification_preferences` per quel singolo utente (non piu su `profiles`)
- I toggle per-utente mostrano lo stato dalla tabella `admin_notification_preferences`

### 3. Modifiche a `send-notification` edge function

Nella sezione admin (step 4), per ogni admin:
- Controllare se esiste un record in `admin_notification_preferences` per `(admin.user_id, alertData.user_id)`
- Se esiste: usare `override.notify_email` / `override.notify_telegram` in combinazione con `admin_notify_email` / `admin_notify_telegram`
- Se non esiste: comportamento attuale (usa solo il toggle generale)

Logica: invia copia admin solo se `admin_notify_X` generale E `override.notify_X` per-utente sono entrambi `true` (o override non esiste = default true).

### 4. Flusso risultante

```text
Toggle generale Email OFF → upsert notify_email=false per tutti → admin non riceve email da nessuno
Toggle generale Email ON  → upsert notify_email=true per tutti → admin riceve email da tutti
Toggle per-utente Email OFF per AndreaS → upsert notify_email=false per AndreaS → admin non riceve email da AndreaS
Toggle generale Telegram OFF → stessa logica per telegram
```

