

## Fix: i flussi di cassa salvati per Iron Condor, Double Diagonal e Altre Strategie vengono cancellati

### Causa del problema
In `src/lib/strategyCache.ts` (righe 285-334), la funzione di pulizia dei dati orfani costruisce la lista delle chiavi attive (`activeCCKeys`) partendo **solo** da `categories.coveredCalls`. Tutti i record salvati nella tabella `covered_call_premiums` che non corrispondono a una Covered Call attiva vengono cancellati. Questo include i flussi di cassa salvati per Iron Condor, Double Diagonal e Altre Strategie.

### Soluzione
Estendere la logica di costruzione di `activeCCKeys` per includere anche le chiavi (ticker, option_symbol) provenienti da:
- `categories.ironCondors`
- `categories.doubleDiagonals`
- `categories.otherStrategies`

### Dettaglio tecnico

**File: `src/lib/strategyCache.ts`** (dopo riga 295)

Aggiungere l'estrazione delle chiavi attive anche dalle altre categorie di strategie multi-leg, utilizzando lo stesso pattern gia' presente per le Covered Call. Per ciascuna strategia (Iron Condor, Double Diagonal, Altre Strategie), iterare sulle gambe e aggiungere le coppie `(ticker, option_symbol)` alla lista `activeCCKeys`, in modo che il cleanup non le consideri orfane.

In pratica, bisogna aggiungere dopo il blocco `categories.coveredCalls.forEach(...)`:

1. **Iron Condors**: iterare su `categories.ironCondors`, estrarre il ticker e aggiungere le 4 option_symbol delle gambe (soldPut, boughtPut, soldCall, boughtCall), usando la chiave composita salvata dalla calcolatrice.

2. **Double Diagonals**: iterare su `categories.doubleDiagonals`, stessa logica.

3. **Altre Strategie**: iterare su `categories.otherStrategies`, estrarre ticker e option_symbol di ogni gamba.

Inoltre, per queste strategie multi-leg il `option_symbol` salvato nella calcolatrice non corrisponde al formato `C{strike}_{expiry}` delle Covered Call, ma utilizza un formato diverso (es. `C110_2026-06-21`). Servira' verificare quale formato viene usato al salvataggio nel dialog `CallPremiumCalculatorDialog` e assicurarsi che la chiave nel cleanup corrisponda.

### Rischio
Nessun rischio: si tratta solo di aggiungere chiavi alla lista di quelle da preservare. Nessun dato verra' cancellato che non dovrebbe esserlo.

