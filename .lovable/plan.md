
## Dismissione permanente dei ticker non risolti

### Obiettivo
Aggiungere un pulsante "X" accanto a ogni ticker non risolto nel box amber della Gestione Avvisi. Cliccandolo, il ticker viene nascosto permanentemente per quell'utente e portafoglio. Il dismiss viene rimosso solo se il portafoglio viene cancellato (tramite cascade).

### Modifiche

#### 1. Nuova tabella DB: `dismissed_unresolved_tickers`

```sql
CREATE TABLE public.dismissed_unresolved_tickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  underlying TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, portfolio_id, underlying)
);

ALTER TABLE public.dismissed_unresolved_tickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dismissed tickers"
  ON public.dismissed_unresolved_tickers
  FOR ALL USING (auth.uid() = user_id);
```

- `ON DELETE CASCADE` su `portfolio_id` garantisce che cancellando il portafoglio si rimuovono anche tutti i dismiss.
- Vincolo UNIQUE per evitare duplicati.

#### 2. Nuovo hook: `src/hooks/useDismissedUnresolvedTickers.ts`

- `useDismissedUnresolvedTickers(portfolioId)`: query che recupera la lista dei ticker dismessi per utente/portafoglio.
- `useDismissUnresolvedTicker()`: mutation per inserire un dismiss.
- `useUndismissUnresolvedTicker()`: mutation per rimuovere un dismiss (opzionale, per eventuale ripristino futuro).

#### 3. Modifica `src/components/derivatives/AlertSettingsDialog.tsx`

- Importare il nuovo hook.
- Filtrare `unresolvedUnderlyings` rimuovendo quelli presenti nella lista dei dismessi.
- Aggiungere un pulsante "X" accanto a ogni badge di ticker non risolto nei due box amber (tab "Per Ticker" e tab "Prezzo").
- Al click, inserire il dismiss nel DB e aggiornare la lista.

### Dettagli tecnici

| File | Modifica |
|------|----------|
| Migrazione SQL | Nuova tabella `dismissed_unresolved_tickers` con RLS e cascade |
| `src/hooks/useDismissedUnresolvedTickers.ts` | Nuovo file con query + mutation |
| `src/components/derivatives/AlertSettingsDialog.tsx` | Filtrare unresolvedUnderlyings, aggiungere pulsante X su ogni badge |

### Flusso utente

1. L'utente vede il box "Ticker non risolti" con i badge amber
2. Clicca la X accanto a "FIRST REPUBLIC BANK/CA"
3. Il badge scompare immediatamente
4. Il dismiss e' persistente: riaprendo il dialog, il ticker resta nascosto
5. Se il portafoglio viene eliminato, tutti i dismiss associati vengono cancellati automaticamente (CASCADE)
