
## Obiettivo
Aggiungere un flag "Elimina regola dopo trigger" agli avvisi di prezzo. Quando questo flag è attivo, la regola verrà automaticamente eliminata dopo che l'avviso viene triggerato.

---

## Modifiche al Database

### 1. Nuova colonna nella tabella `price_alerts`

```sql
ALTER TABLE price_alerts 
ADD COLUMN delete_after_trigger boolean NOT NULL DEFAULT false;
```

---

## Modifiche al Frontend

### 2. File: `src/types/alerts.ts`

Aggiungere il campo all'interfaccia `PriceAlert`:

```typescript
export interface PriceAlert {
  // ... campi esistenti
  delete_after_trigger: boolean;  // NUOVO
}
```

### 3. File: `src/hooks/usePriceAlerts.ts`

Aggiornare `useCreatePriceAlert` per accettare il nuovo parametro:

```typescript
mutationFn: async (alert: {
  ticker: string;
  direction: 'above' | 'below';
  target_price: number;
  cooldown_minutes?: number;
  delete_after_trigger?: boolean;  // NUOVO
}) => {
  // ... insert con delete_after_trigger
}
```

### 4. File: `src/components/derivatives/AlertSettingsDialog.tsx`

#### A. Aggiungere stato per il nuovo flag
```typescript
const [newPriceDeleteAfterTrigger, setNewPriceDeleteAfterTrigger] = useState(false);
```

#### B. Aggiungere checkbox nel form "Nuovo avviso di prezzo"
Sotto il campo "Prezzo target", aggiungere:
```tsx
<div className="flex items-center gap-2 pt-2">
  <Checkbox
    id="delete-after-trigger"
    checked={newPriceDeleteAfterTrigger}
    onCheckedChange={(checked) => setNewPriceDeleteAfterTrigger(checked === true)}
  />
  <Label htmlFor="delete-after-trigger" className="text-sm cursor-pointer">
    Elimina regola dopo trigger
  </Label>
</div>
```

#### C. Passare il flag alla mutation
```typescript
await createPriceAlertMutation.mutateAsync({
  ticker,
  direction: newPriceDirection,
  target_price: targetPrice,
  cooldown_minutes: cooldownMinutes,
  delete_after_trigger: newPriceDeleteAfterTrigger,  // NUOVO
});
```

#### D. Mostrare badge nella lista degli avvisi configurati
Per ogni avviso con `delete_after_trigger === true`, aggiungere un indicatore visivo:
```tsx
{alert.delete_after_trigger && (
  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
    Una tantum
  </Badge>
)}
```

---

## Modifiche all'Edge Function

### 5. File: `supabase/functions/check-alerts/index.ts`

Nella sezione "PRICE ALERTS" (righe 1259-1293), dopo l'inserimento dell'alert e l'aggiornamento dello stato, aggiungere la logica di eliminazione:

```typescript
// Dopo aver creato l'alert...
if (priceAlert.delete_after_trigger) {
  // Elimina la regola
  await supabase
    .from('price_alerts')
    .delete()
    .eq('id', priceAlert.id);
  
  // Elimina anche lo stato associato
  await supabase
    .from('alert_states')
    .delete()
    .eq('position_key', positionKey);
    
  console.log(`Price alert ${priceAlert.id} deleted after trigger`);
} else {
  // Altrimenti aggiorna solo last_triggered_at (comportamento esistente)
  await supabase
    .from('price_alerts')
    .update({ last_triggered_at: new Date().toISOString() })
    .eq('id', priceAlert.id);
}
```

---

## Riepilogo modifiche

| Componente | Modifica |
|------------|----------|
| Database | Nuova colonna `delete_after_trigger` (boolean, default false) |
| `src/types/alerts.ts` | Campo `delete_after_trigger` nell'interfaccia `PriceAlert` |
| `src/hooks/usePriceAlerts.ts` | Supporto per il nuovo parametro nella creazione |
| `AlertSettingsDialog.tsx` | Checkbox nel form + badge "Una tantum" nella lista |
| `check-alerts/index.ts` | Logica di eliminazione automatica dopo trigger |

---

## Risultato atteso

1. Nel form "Nuovo avviso di prezzo" compare un checkbox "Elimina regola dopo trigger"
2. Gli avvisi con questa opzione attiva mostrano un badge "Una tantum"
3. Quando l'avviso viene triggerato, la regola viene eliminata automaticamente dal database
4. L'utente non deve più cancellare manualmente gli avvisi "one-shot"
