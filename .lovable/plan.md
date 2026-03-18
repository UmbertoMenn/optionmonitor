

## Fix: Daily Briefing non arriva all'admin

### Causa root
Il loop principale (riga 782) itera solo su `notifiableUsers` — utenti con `notify_email` o `notify_telegram` personali attivi. Nessun utente (tranne l'admin) li ha attivi. L'invio all'admin è annidato dentro questo loop (riga 860-875), quindi non viene mai eseguito per gli utenti senza notifiche personali.

### Dati verificati
- **Bonamini**: 17 strategie, 1 sezione snapshot → briefing disponibile, ma `notify_email=false, notify_telegram=false` → non entra nel loop
- **Silvello**: 59 strategie, 1 sezione snapshot → stesso problema
- **Grecchi**: 58 strategie → stesso problema  
- **Admin toggle attivi**: telegram=true per 5 utenti su 6 in `admin_notification_preferences`
- **Log odierno**: "Found 1 users with notifications enabled" → solo l'admin stesso, il cui portafoglio ha 0 sezioni

### Soluzione
Modificare `supabase/functions/daily-briefing/index.ts` per separare i due flussi:

1. **Caricare TUTTI gli utenti** (non solo quelli con notifiche attive) — rinominare `notifiableUsers` → `allUsers`
2. **Il loop processa tutti gli utenti**: genera le `portfolioBriefings` per chiunque abbia dati monitorabili
3. **Invio all'utente**: resta condizionato a `user.notify_telegram` / `user.notify_email` (invariato)
4. **Invio all'admin**: avviene per OGNI utente con briefing non vuoto, controllando solo i toggle admin (`admin_notify_telegram`/`admin_notify_email`) e le preferenze per-utente (`admin_notification_preferences`), indipendentemente dai toggle personali dell'utente
5. **Caricare le `admin_notification_preferences`** una sola volta fuori dal loop (attualmente non vengono caricate affatto nel daily-briefing, a differenza di `send-notification`)

### Dettaglio modifiche (righe 755-876)

**Riga 760-762** — Rimuovere il filtro:
```typescript
// PRIMA: const notifiableUsers = (profiles || []).filter(p => p.notify_telegram || p.notify_email);
// DOPO:  const allUsers = (profiles || []).filter(p => !adminUserIds.has(p.user_id));
```
(Spostare il fetch degli adminUserIds prima di questo punto)

**Riga 766-776** — Spostare PRIMA della riga 760. Aggiungere fetch delle `admin_notification_preferences`:
```typescript
const { data: adminPrefs } = await supabase
  .from("admin_notification_preferences")
  .select("admin_user_id, target_user_id, notify_email, notify_telegram")
  .in("admin_user_id", Array.from(adminUserIds));
```

**Riga 782** — Cambiare `for (const user of notifiableUsers)` → `for (const user of allUsers)`

**Riga 847-858** — L'invio all'utente resta condizionato (invariato)

**Riga 860-875** — L'invio all'admin usa le `admin_notification_preferences` caricate:
```typescript
for (const admin of adminProfiles) {
  if (admin.user_id === user.user_id) continue;
  const pref = adminPrefsMap.get(`${admin.user_id}:${user.user_id}`);
  const shouldTelegram = admin.admin_notify_telegram && (pref ? pref.notify_telegram : true);
  const shouldEmail = admin.admin_notify_email && (pref ? pref.notify_email : true);
  // ... send
}
```

**Aggiungere anche il briefing del portafoglio admin** (attualmente l'admin è escluso da `allUsers` ma potrebbe avere portafogli propri con dati — il suo "Copia di Portafoglio Principale" ha 0 sezioni ora, ma potrebbe averne in futuro). L'admin viene processato come un utente normale per i propri portafogli.

### File modificato
- `supabase/functions/daily-briefing/index.ts` (sezione righe 755-876)

