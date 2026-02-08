
# Piano: Correzione Bug Edit + Aggiornamento USD Exposure Storico

## Problema 1: Bug nell'editing dei dati storici

Quando si modifica un dato storico e si clicca "Salva", viene creato un nuovo record invece di aggiornare quello esistente.

**Causa**: L'upsert usa `onConflict: 'portfolio_id,snapshot_date'` ma non passa l'`id` del record. Se l'utente cambia la data durante l'edit, viene creato un nuovo record.

**Soluzione**: 
- Aggiungere un campo `id` opzionale a `HistoricalDataInput`
- Passare l'`id` durante l'edit nel form
- Includere l'`id` nell'upsert quando presente

---

## Problema 2: USD Exposure storico al 80% invece del 43.8%

Il default della colonna database era 0.8 (80%) ma il valore reale attuale è 43.8%.

**Soluzione**: Creare una migrazione SQL per aggiornare tutti i record esistenti con il valore corretto.

---

## Modifiche

### 1. Types: `src/types/historicalData.ts`

Aggiungere campo `id` opzionale:

```typescript
export interface HistoricalDataInput {
  id?: string;  // NUOVO: opzionale, usato per update
  snapshot_date: string;
  // ... resto invariato
}
```

---

### 2. Hook: `src/hooks/useHistoricalData.ts`

Includere `id` nell'upsert quando presente:

```typescript
const upsertPayload: Record<string, unknown> = {
  portfolio_id: portfolioId,
  snapshot_date: entry.snapshot_date,
  // ... altri campi
};

// Se c'è un id, includerlo per l'update
if (entry.id) {
  upsertPayload.id = entry.id;
}

const { data, error } = await supabase
  .from('historical_data')
  .upsert(upsertPayload, {
    onConflict: 'id'  // Usa id se presente
  })
```

---

### 3. Form: `src/components/dashboard/HistoricalDataForm.tsx`

Passare l'`id` durante l'edit nel `handleSave`:

```typescript
const handleSave = () => {
  if (!formDate) return;
  
  // ... parsing valori ...
  
  onSave({
    id: editingId || undefined,  // NUOVO: passa l'id se stiamo editando
    snapshot_date: format(formDate, 'yyyy-MM-dd'),
    // ... resto invariato
  });
  
  resetForm();
};
```

---

### 4. Database Migration

Aggiornare tutti i record esistenti con USD exposure = 0.438 (43.8%):

```sql
UPDATE historical_data 
SET usd_exposure_pct = 0.438 
WHERE usd_exposure_pct = 0.8;
```

---

## File Coinvolti

| File | Modifica |
|------|----------|
| `src/types/historicalData.ts` | Aggiungere `id?: string` |
| `src/hooks/useHistoricalData.ts` | Gestire `id` nell'upsert |
| `src/components/dashboard/HistoricalDataForm.tsx` | Passare `editingId` a onSave |
| `supabase/migrations/*.sql` | UPDATE usd_exposure_pct |

---

## Risultato

1. L'editing dei dati storici aggiornerà correttamente il record esistente
2. Tutti i dati storici avranno USD exposure = 43.8% invece di 80%
