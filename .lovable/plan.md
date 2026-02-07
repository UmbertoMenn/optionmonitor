
## Aggiunta Pulsante "Reset Sistema Avvisi" nella Gestione Avvisi

### Obiettivo
Aggiungere un pulsante nel dialog "Gestione Avvisi" che permetta all'utente di pulire completamente la memoria del sistema di avvisi. Questo è utile quando vengono caricati Excel sbagliati con posizioni errate, permettendo di ricominciare da capo con il monitoraggio.

### Cosa verrà pulito
Il reset eliminerà i seguenti dati per l'utente corrente:
1. **`alert_states`** - La "memoria" delle posizioni monitorate (stati safe/alerted)
2. **`alerts`** - Lo storico degli avvisi generati (ultimi 24h e oltre)

**Non verranno toccati:**
- Le configurazioni degli avvisi (soglie, cooldown, ticker override)
- Gli avvisi di prezzo custom
- Le impostazioni di notifica (Email/Telegram)

---

### Implementazione

#### 1. Modifica Database: Aggiungere policy DELETE su `alerts`
Attualmente gli utenti non possono eliminare i propri avvisi. È necessario aggiungere una RLS policy:

```sql
CREATE POLICY "Users can delete own alerts"
ON alerts FOR DELETE
USING (user_id = auth.uid());
```

#### 2. Nuovo Hook: `useResetAlertSystem`
Creare un hook in `src/hooks/useAlerts.ts` che:
- Elimina tutti i record da `alert_states` per l'utente
- Elimina tutti i record da `alerts` per l'utente
- Invalida le query cache correlate

#### 3. Modifica UI: `AlertSettingsDialog.tsx`
- Aggiungere un nuovo tab "Reset" oppure inserire il pulsante nel footer del dialog
- Il pulsante avrà un'icona di warning (⚠️) e testo "Reset Sistema Avvisi"
- Al click, aprire un AlertDialog di conferma con:
  - Titolo: "Sei sicuro di voler resettare il sistema avvisi?"
  - Descrizione dettagliata di cosa verrà eliminato
  - Pulsante "Annulla" e pulsante rosso "Conferma Reset"

---

### UI Preview

**Footer del dialog modificato:**
```
[⚠️ Reset Sistema]                      [Annulla] [Salva]
```

**Dialog di conferma:**
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Sei sicuro di voler resettare?               │
│                                                 │
│ Questa azione eliminerà:                        │
│ • Lo storico di tutti gli avvisi generati       │
│ • La memoria degli stati delle posizioni        │
│   (safe/alerted)                                │
│                                                 │
│ Il sistema ricomincerà a monitorare le          │
│ posizioni da zero. Utile se hai caricato        │
│ un Excel sbagliato con posizioni errate.        │
│                                                 │
│ Le tue configurazioni (soglie, notifiche)       │
│ NON verranno modificate.                        │
│                                                 │
│                     [Annulla] [🗑️ Conferma Reset]│
└─────────────────────────────────────────────────┘
```

---

### File da Modificare
1. **Migrazione SQL** - Nuova policy DELETE per tabella `alerts`
2. **`src/hooks/useAlerts.ts`** - Aggiungere hook `useResetAlertSystem`
3. **`src/components/derivatives/AlertSettingsDialog.tsx`** - Aggiungere pulsante e dialog di conferma

---

### Dettagli Tecnici

**Hook `useResetAlertSystem`:**
```typescript
export function useResetAlertSystem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      // Delete all alert_states
      const { error: statesError } = await supabase
        .from('alert_states')
        .delete()
        .eq('user_id', user.id);
      if (statesError) throw statesError;
      
      // Delete all alerts
      const { error: alertsError } = await supabase
        .from('alerts')
        .delete()
        .eq('user_id', user.id);
      if (alertsError) throw alertsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['unread-alerts-count'] });
    },
  });
}
```

**Posizionamento pulsante:**
Il pulsante "Reset Sistema" sarà posizionato nel `DialogFooter`, allineato a sinistra, separato visivamente dai pulsanti "Annulla" e "Salva" che rimangono a destra.
