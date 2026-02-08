

## Obiettivo
Aggiungere la possibilità per l'admin di eliminare singoli portafogli degli utenti direttamente dalla sezione "Portafogli" del pannello admin.

## Analisi della situazione attuale

- Il `PortfolioManager.tsx` mostra i portafogli raggruppati per utente con azioni "Copia" e "Apri"
- Esiste gia il hook `useClearPortfolio` che elimina i dati interni del portfolio ma non il portfolio stesso
- L'edge function `admin-delete-user` elimina l'intero utente con tutti i suoi dati
- Le RLS policies permettono gia agli admin di eliminare dati dai portafogli (policy "Admins can manage all...")

## Soluzione proposta

### Approccio client-side (preferito)
Dato che le policy RLS gia permettono agli admin di eliminare i dati delle tabelle correlate ai portafogli, possiamo implementare l'eliminazione direttamente lato client senza necessita di una nuova edge function.

### UI proposta
Aggiungere un pulsante "Elimina" con icona cestino accanto ai pulsanti esistenti (Copia, Apri) per ogni portafoglio utente.

```text
+----------------------------------------------------------+
| Portfolio Principale    €15,000    01/02/2025            |
|   [Copia] [Apri] [🗑️ Elimina]                            |
+----------------------------------------------------------+
```

## Modifiche tecniche

### 1. Nuovo hook: useDeletePortfolio.ts
Creare un hook dedicato per eliminare completamente un portfolio:

```typescript
export function useDeletePortfolio() {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const deletePortfolio = async (portfolioId: string) => {
    setIsDeleting(true);
    try {
      // 1. Elimina tabelle correlate (ordine corretto per FK)
      await supabase.from('derivative_overrides').delete().eq('portfolio_id', portfolioId);
      await supabase.from('positions').delete().eq('portfolio_id', portfolioId);
      await supabase.from('strategy_cache').delete().eq('portfolio_id', portfolioId);
      await supabase.from('covered_call_premiums').delete().eq('portfolio_id', portfolioId);
      await supabase.from('alert_states').delete().eq('portfolio_id', portfolioId);
      await supabase.from('alerts').delete().eq('portfolio_id', portfolioId);
      await supabase.from('historical_data').delete().eq('portfolio_id', portfolioId);
      await supabase.from('deposits').delete().eq('portfolio_id', portfolioId);
      
      // 2. Elimina il portfolio stesso
      await supabase.from('portfolios').delete().eq('id', portfolioId);
      
      // 3. Invalida cache
      await queryClient.invalidateQueries({ queryKey: ['admin-all-portfolios'] });
      
      toast.success('Portfolio eliminato con successo');
    } catch (error) {
      toast.error('Errore eliminazione portfolio');
      throw error;
    } finally {
      setIsDeleting(false);
    }
  };

  return { deletePortfolio, isDeleting };
}
```

### 2. PortfolioManager.tsx
- Importare il nuovo hook
- Aggiungere stato per il dialog di conferma eliminazione
- Aggiungere pulsante "Elimina" in entrambe le sezioni (I Miei Portafogli e Portafogli Utenti)
- Impedire eliminazione se l'utente ha un solo portfolio (opzionale)

### 3. Dialog di conferma
Riutilizzare lo stesso pattern del dialog di conferma eliminazione utente gia presente in `AdminPanel.tsx`:

```tsx
<Dialog open={!!portfolioToDelete} onOpenChange={...}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle className="text-loss">Conferma Eliminazione</DialogTitle>
      <DialogDescription>
        Stai per eliminare il portfolio "<strong>{portfolioToDelete?.name}</strong>".
        Verranno eliminati anche tutti i dati associati (posizioni, depositi, dati storici).
        Questa azione non puo essere annullata.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setPortfolioToDelete(null)}>Annulla</Button>
      <Button variant="destructive" onClick={handleDeletePortfolio}>
        Elimina Portfolio
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## File da creare/modificare

| File | Azione |
|------|--------|
| `src/hooks/useDeletePortfolio.ts` | Creare - nuovo hook per eliminazione portfolio |
| `src/components/admin/PortfolioManager.tsx` | Modificare - aggiungere UI eliminazione |

## Considerazioni di sicurezza

- Le policy RLS esistenti gia proteggono: solo gli admin possono eliminare dati di altri utenti
- La verifica admin avviene tramite `has_role(auth.uid(), 'admin')` nelle policy
- Non e necessaria una edge function aggiuntiva

## Considerazioni UX

- Mostrare nome portfolio e proprietario nel dialog di conferma
- Disabilitare il pulsante durante l'eliminazione con spinner
- Aggiornare automaticamente la lista dopo l'eliminazione
- Considerare se impedire l'eliminazione dell'ultimo portfolio di un utente (lasciarlo senza portfolios)

