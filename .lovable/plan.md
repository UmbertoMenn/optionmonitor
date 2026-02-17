

## Fix: Operazioni calcolatrice cancellate dal cleanup orfani

### Causa radice

Ogni volta che la pagina Derivati si apre, viene chiamata `saveStrategyCache()` che, alla fine, esegue un "cleanup orfani" sulla tabella `covered_call_premiums`. Questo cleanup:

1. Costruisce la lista delle chiavi attive (ticker + option_symbol) partendo dalle strategie categorizzate
2. Per ogni strategia, risolve il ticker tramite `resolveTicker(underlying, underlyingPrices)`
3. Se il ticker NON viene risolto (ritorna `null`), la strategia viene **saltata** dalla lista attiva
4. I record salvati nella calcolatrice con quel ticker vengono quindi considerati "orfani" e **cancellati**

Il problema e' che `resolveTicker` fallisce per la maggioranza dei sottostanti (nel DB strategy_cache, quasi tutti i ticker sono null). Questo accade perche' la mappa `underlyingPrices` viene passata dal componente Derivatives.tsx e potrebbe non avere un mapping per tutti i sottostanti.

In pratica: l'utente salva le operazioni nella calcolatrice (dove il ticker e' disponibile dall'UI), poi la prossima volta che apre la pagina Derivati, il cleanup cancella quei dati perche' non riesce a ricostruire la stessa chiave ticker.

### Soluzione

**Non cancellare MAI** i premi dalla calcolatrice durante il cleanup automatico. I dati della calcolatrice sono inseriti manualmente dall'utente e devono essere trattati come dati persistenti, non come cache derivata.

### Modifiche

**1. `src/lib/strategyCache.ts` - Rimuovere completamente il cleanup dei covered_call_premiums**

Eliminare l'intero blocco di codice (righe 294-374) che cancella i "premi orfani". Questo blocco e' la causa diretta della perdita dati.

La cancellazione dei premi deve avvenire SOLO tramite:
- Il pulsante "Reset" esplicito nella calcolatrice (azione utente consapevole)
- L'eliminazione dell'intero portafoglio

**2. `src/hooks/useCoveredCallPremiums.ts` - Rimuovere la funzione `deleteOrphanedPremiums` (se presente)**

Verificare e rimuovere eventuali chiamate automatiche di pulizia orfani nei hook, mantenendo solo la cancellazione esplicita via UI.

### Dettaglio tecnico

```text
// IN strategyCache.ts - RIMUOVERE TUTTO QUESTO BLOCCO:

// Cleanup orphaned covered call premiums        <-- DA ELIMINARE
// Extract active (ticker, option_symbol)...     <-- DA ELIMINARE  
// ... tutto fino alla fine della funzione       <-- DA ELIMINARE

// MANTENERE solo:
console.log(`[StrategyCache] Saved ${records.length} strategies for portfolio ${portfolioId}`);
```

### Risultato

- I dati della calcolatrice non verranno MAI piu' cancellati automaticamente
- L'utente mantiene il pieno controllo dei propri dati tramite il pulsante Reset
- Il salvataggio della strategy_cache continua a funzionare normalmente (solo la parte di cleanup premi viene rimossa)

### File modificati

| File | Modifica |
|------|----------|
| `src/lib/strategyCache.ts` | Rimuovere blocco cleanup covered_call_premiums (righe 294-374) |
| `src/hooks/useCoveredCallPremiums.ts` | Rimuovere `deleteOrphanedPremiums` se usata in automatico |

