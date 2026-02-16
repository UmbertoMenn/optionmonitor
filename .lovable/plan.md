

## Risoluzione automatica dei ticker non risolti dalla sezione admin

### Problema

La sezione admin mostra 56 ticker non risolti, ma richiede l'inserimento manuale di ciascuno. Il sistema ha gia' tutte le capacita' per risolvere i ticker automaticamente (mapping statici, Yahoo Finance, AI inference) tramite la Edge Function `fetch-underlying-prices`, ma questa logica non viene invocata dalla sezione admin.

### Soluzione

Aggiungere un pulsante **"Risolvi Automaticamente"** nella sezione admin "Ticker Non Risolti" che:

1. Prende tutti i nomi non risolti
2. Li invia alla Edge Function `fetch-underlying-prices` (che gia' implementa il flusso completo: mapping statici -> Yahoo Finance -> AI inference -> salvataggio in `underlying_mappings`)
3. Mostra il progresso e il risultato (quanti risolti vs quanti ancora irrisolti)
4. Aggiorna automaticamente la lista

### Dettaglio tecnico

**File: `src/components/admin/TickerMappingManager.tsx`**

1. Aggiungere uno stato `isAutoResolving` e una funzione `handleAutoResolve`
2. La funzione chiama `supabase.functions.invoke('fetch-underlying-prices', { body: { underlyings: unresolvedUnderlyings } })`
3. Dopo la risposta, esegue `refetch()` per aggiornare la lista
4. Mostra un toast con il risultato: "Risolti X su Y ticker"
5. Il pulsante viene posizionato accanto al titolo della sezione "Ticker Non Risolti", con icona di magic wand o simile

```text
// Pseudo-codice della funzione:
const handleAutoResolve = async () => {
  setIsAutoResolving(true);
  try {
    const { data, error } = await supabase.functions.invoke('fetch-underlying-prices', {
      body: { underlyings: unresolvedUnderlyings }
    });
    
    if (error) throw error;
    
    const resolvedCount = Object.keys(data?.prices || {}).length;
    toast.success(`Risolti automaticamente ${resolvedCount} su ${unresolvedUnderlyings.length} ticker`);
    
    // Refresh the lists
    refetch();
  } catch (err) {
    toast.error('Errore nella risoluzione automatica');
  } finally {
    setIsAutoResolving(false);
  }
};
```

6. Il pulsante nella UI:
```text
<Button onClick={handleAutoResolve} disabled={isAutoResolving}>
  {isAutoResolving ? <Loader2 className="animate-spin" /> : <Wand2 />}
  Risolvi Automaticamente
</Button>
```

### Comportamento atteso

- L'admin clicca "Risolvi Automaticamente"
- La Edge Function tenta di risolvere ogni underlying tramite:
  - Mapping statici (NVIDIA -> NVDA, PAYPAL -> PYPL, ecc.)
  - Yahoo Finance search
  - AI inference (Lovable AI) con validazione Yahoo
- I ticker risolti vengono salvati automaticamente in `underlying_mappings`
- La lista si aggiorna mostrando solo quelli rimasti irrisolti
- Quelli che non possono essere risolti restano nella lista per override manuale

### File da modificare

| File | Modifica |
|---|---|
| `src/components/admin/TickerMappingManager.tsx` | Aggiungere pulsante "Risolvi Automaticamente" che invoca la Edge Function `fetch-underlying-prices` con tutti gli underlying non risolti |

