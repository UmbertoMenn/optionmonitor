
## Fix: Impostazioni avvisi per il portafoglio del cliente (in modalita admin)

### Problema
Quando l'admin visualizza il portafoglio di un cliente, la sezione "Gestione avvisi" mostra le configurazioni dell'admin stesso anziche quelle del cliente. Questo accade perche tutti gli hook (`useAlertConfigs`, `usePriceAlerts`, `useAlerts`, `useResetAlertSystem`) usano `user.id` da `useAuth()`, che e sempre l'ID dell'admin loggato.

### Causa radice
1. Gli hook di alert usano `useAuth().user.id` (admin) invece del `user_id` del proprietario del portafoglio
2. Le tabelle `alert_configs`, `price_alerts`, `alert_states`, `alerts` non hanno policy RLS per l'admin, quindi l'admin non puo leggere/scrivere dati di altri utenti

### Soluzione

#### Parte 1: Aggiungere policy RLS admin (migrazione database)

Aggiungere policy `ALL` per admin alle 4 tabelle coinvolte:

```sql
-- alert_configs
CREATE POLICY "Admins can manage all alert configs"
  ON public.alert_configs FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- alert_states
CREATE POLICY "Admins can manage all alert states"
  ON public.alert_states FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- alerts (aggiungere INSERT + ALL per admin)
CREATE POLICY "Admins can manage all alerts"
  ON public.alerts FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- price_alerts
CREATE POLICY "Admins can manage all price alerts"
  ON public.price_alerts FOR ALL
  USING (has_role(auth.uid(), 'admin'));
```

#### Parte 2: Modificare gli hook per usare l'user_id corretto

**File: `src/hooks/useAlertConfigs.ts`**

- Importare `usePortfolioContext` per accedere a `isAdminMode` e `adminViewUserId`
- In `useAlertConfigs()`: quando `isAdminMode`, fare la query con `.eq('user_id', adminViewUserId)` invece di `user.id`
- In `useBatchUpsertAlertConfigs()`: usare `adminViewUserId` come `user_id` nei dati di upsert quando in admin mode
- In `useDeleteAlertConfig()`: usare l'user_id corretto nella delete
- In `useInitializeDefaultConfigs()`: usare l'user_id corretto
- La queryKey includera l'effective user_id per evitare cache condivisa

**File: `src/hooks/usePriceAlerts.ts`**

- Importare `usePortfolioContext`
- In `usePriceAlerts()`: query con user_id del proprietario del portafoglio
- In `useCreatePriceAlert()`: inserire con user_id del proprietario
- In `useDeletePriceAlert()` e `useTogglePriceAlert()`: queste operano per ID della regola, non per user_id, quindi non necessitano modifiche (le policy RLS admin garantiranno l'accesso)

**File: `src/hooks/useAlerts.ts`**

- Importare `usePortfolioContext`
- In `useAlerts()`: query con user_id del proprietario quando in admin mode
- In `useUnreadAlertsCount()`: stessa modifica
- In `useMarkAlertAsRead()`, `useMarkAllAlertsAsRead()`, `useDeleteAlert()`: usare user_id corretto dove usato come filtro
- In `useResetAlertSystem()`: cancellare alert_states e alerts dell'utente proprietario, non dell'admin

**Pattern comune per tutti gli hook:**
```typescript
const { user } = useAuth();
const { isAdminMode, adminViewUserId } = usePortfolioContext();
const effectiveUserId = isAdminMode ? adminViewUserId : user?.id;
```

#### Parte 3: Nascondere il tab "Notifiche" in admin mode

**File: `src/components/derivatives/AlertSettingsDialog.tsx`**

- Importare `usePortfolioContext`
- Quando `isAdminMode`, nascondere il tab "Notifiche" (le notifiche Telegram/email sono personali dell'utente e non devono essere modificabili dall'admin)
- Opzionale: mostrare un banner/badge nell'header del dialog indicando "Impostazioni di [nome utente]"

### File coinvolti
1. **Migrazione SQL** -- 4 policy RLS admin
2. `src/hooks/useAlertConfigs.ts` -- effective user_id in tutte le funzioni
3. `src/hooks/usePriceAlerts.ts` -- effective user_id per query e create
4. `src/hooks/useAlerts.ts` -- effective user_id per query, mark read, delete, reset
5. `src/components/derivatives/AlertSettingsDialog.tsx` -- nascondere tab Notifiche in admin mode

### Note importanti
- Il tab "Notifiche" viene nascosto perche contiene le impostazioni Telegram/email personali dell'utente (generate-code, unlink, etc.) che non devono essere gestite dall'admin
- Le query key includeranno l'effective user_id per evitare conflitti di cache tra la vista admin e la vista propria
- La griglia dei tab passera da 6 a 5 colonne quando in admin mode
