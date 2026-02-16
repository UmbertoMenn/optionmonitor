

## Mostrare ticker non risolti + link admin per override manuale

### Problema attuale

1. La lista `unresolved` nella funzione `extractUniqueTickers` traccia solo i sottostanti dei **derivati** non risolti (righe 146-166). Le azioni con `ticker: null` che non hanno corrispondenza in `underlying_mappings` vengono semplicemente ignorate -- non appaiono ne' come risolte ne' come non risolte.

2. Non c'e' alcun collegamento diretto dal dialog degli avvisi alla sezione admin "Gestione Mapping Ticker" per risolvere i ticker mancanti.

### Soluzione

**File: `src/components/derivatives/AlertSettingsDialog.tsx`**

1. **Includere le azioni non risolte nella lista `unresolved`**: nella funzione `extractUniqueTickers`, dopo il loop sulle posizioni stock (riga 124-144), aggiungere le azioni che non hanno ne' ticker diretto ne' corrispondenza in `underlying_mappings` alla lista `unresolved`, usando la descrizione pulita (senza prefisso "AZ.").

2. **Mostrare la sezione "ticker non risolti" anche nei tab Prezzo e Ticker**: attualmente il box amber con i badge non risolti e' visibile solo nel tab Distanza (riga 849). Aggiungere la stessa sezione anche nel tab **Prezzo** (dopo i badge dei ticker disponibili, riga 971) e nel tab **Ticker** (dopo i badge cliccabili, riga 847).

3. **Aggiungere un pulsante "Gestisci Mapping" per admin**: dentro il box amber dei ticker non risolti, se `isAdminMode` e' true, mostrare un pulsante che naviga alla sezione admin Gestione Mapping Ticker (`/admin` con tab `tickers`), oppure un link informativo. Questo permette all'admin di aggiungere rapidamente i mapping mancanti.

### Dettaglio tecnico

```text
// In extractUniqueTickers, DOPO il loop stock positions (riga 144):

// Track unresolved stocks
positions
  .filter(p => p.asset_type === 'stock')
  .forEach(p => {
    // Skip if already resolved (had direct ticker or found mapping)
    if (p.ticker) return;
    const descCleaned = p.description.replace(/^AZ\./i, '').trim();
    const descNormalized = normalizeName(descCleaned);
    const hasMapping = allMappings.some(m => normalizeName(m.underlying) === descNormalized);
    if (!hasMapping) {
      unresolved.push(descCleaned);
    }
  });

// Nella sezione unresolved del tab Ticker + Prezzo (per admin):
{isAdminMode && unresolvedUnderlyings.length > 0 && (
  <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); navigate('/admin?tab=tickers'); }}>
    <Link2 className="w-4 h-4 mr-2" />
    Gestisci Mapping Ticker
  </Button>
)}
```

### Sezioni UI modificate

| Sezione | Modifica |
|---|---|
| Tab **Distanza** (esistente) | Aggiungere pulsante admin "Gestisci Mapping" nel box amber |
| Tab **Prezzo** | Aggiungere box amber con ticker non risolti + pulsante admin |
| Tab **Ticker** | Il box amber gia' presente -- aggiungere pulsante admin |

### File da modificare

| File | Modifica |
|---|---|
| `src/components/derivatives/AlertSettingsDialog.tsx` | (1) Aggiungere azioni non risolte a `unresolved` in `extractUniqueTickers`; (2) Mostrare box amber anche nel tab Prezzo; (3) Aggiungere pulsante admin per navigare a Gestione Mapping Ticker in tutti i box amber |

### Risultato atteso

- Le azioni senza ticker mappato appaiono nella lista "Ticker non risolti" con la descrizione pulita
- L'admin vede un pulsante per andare direttamente alla gestione mapping e risolvere i ticker mancanti
- Una volta risolti i mapping (nella sezione admin), i ticker appaiono automaticamente nei badge cliccabili alla riapertura del dialog
