
# Piano: Pulizia Database e Prevenzione Errori Futuri

## Problema Identificato

Ho commesso un errore di analisi leggendo dati dal "Portafoglio test 1" (che avrebbe dovuto essere cancellato) invece che dal "Portfolio Principale" attualmente selezionato. La logica del codice è corretta - il problema era nei miei dati di riferimento.

## Stato Attuale Corretto

Nel **Portfolio Principale** (quello selezionato), le PUT Alibaba sono:

| Strike | Quantità | Tipo |
|--------|----------|------|
| 165 | -1 | Naked PUT |
| 170 | -1 | Naked PUT |
| 90 | +1 | Long PUT (protezione) |

**Non esiste nessuna PUT 190** nel Portfolio Principale.

## Azioni da Eseguire

### 1. Cancellare il "Portafoglio test 1"

Eliminerò definitivamente il portfolio di test che contiene dati vecchi:

```sql
-- Prima le posizioni
DELETE FROM positions WHERE portfolio_id = '8a98cfe3-c8c1-443f-b262-d83574cb2bfc';

-- Poi i dati correlati (deposits, historical_data, derivative_overrides)
DELETE FROM deposits WHERE portfolio_id = '8a98cfe3-c8c1-443f-b262-d83574cb2bfc';
DELETE FROM historical_data WHERE portfolio_id = '8a98cfe3-c8c1-443f-b262-d83574cb2bfc';
DELETE FROM derivative_overrides WHERE portfolio_id = '8a98cfe3-c8c1-443f-b262-d83574cb2bfc';

-- Infine il portfolio stesso
DELETE FROM portfolios WHERE id = '8a98cfe3-c8c1-443f-b262-d83574cb2bfc';
```

### 2. Implementare "Blocco Portfolio" durante Import Excel

Come richiesto, modificherò `FileUploader.tsx` per catturare il `portfolio.id` all'inizio dell'operazione e usare quello per tutto il processo:

```typescript
// In FileUploader.tsx - onDrop function
const onDrop = useCallback(async (acceptedFiles: File[]) => {
  const file = acceptedFiles[0];
  if (!file) return;

  // IMPORTANTE: Cattura il portfolio ID all'inizio
  const targetPortfolioId = portfolio?.id;
  if (!targetPortfolioId) {
    toast.error('Nessun portfolio selezionato');
    return;
  }

  setIsProcessing(true);
  // ... resto del codice usa targetPortfolioId invece di portfolio.id
```

## File da Modificare

| File | Modifica |
|------|----------|
| Database | Cancellare "Portafoglio test 1" e tutti i dati correlati |
| `src/components/dashboard/FileUploader.tsx` | Catturare portfolio ID all'inizio e usarlo per tutto il processo |

## Risultato Atteso

1. Rimane solo il "Portfolio Principale" nel database
2. Durante l'import Excel, il portfolio target rimane fisso anche se l'utente cambia selezione durante l'elaborazione
