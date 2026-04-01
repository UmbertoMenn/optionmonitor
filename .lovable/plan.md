
### Cosa è successo davvero

Hai ragione: qui l’errore non è “un dettaglio UI”, è un errore di architettura.

Ho verificato il caso BIO ON e la situazione attuale è questa:
- in archivio esiste già `BIO ON`
- nelle configurazioni salvate non esiste alcuna strategia per `BIO ON`
- però in cache esiste ancora una riga `BIO ON` classificata come `Altre Strategie`
- inoltre la posizione BIO ON è salvata come `asset_type = derivative`, ma senza `option_type` e senza `underlying`: quindi tutti i fallback la trattano come derivato “orfano” e la buttano in `Altre Strategie`

### Perché continua a succedere

1. L’archivio è stato implementato solo nel Wizard  
   Oggi nasconde il ticker dalla lista del Wizard, ma non governa la classificazione vera.

2. `configOnly` non è davvero “solo configurazione salvata”  
   In `categorizeDerivatives`, anche in modalità `configOnly`, tutte le posizioni non matched vengono comunque spinte in `Altre Strategie`.

3. La logica è duplicata in più punti con regole diverse  
   Oltre alla pagina Derivati, anche cache, netting, rischio, snapshot e flusso wizard usano percorsi separati.

4. La cache backend continua a riclassificare BIO ON  
   `refreshStrategyCacheForPortfolio` ricostruisce `strategy_cache` senza rispettare archivio e senza modalità strettamente basata sulla configurazione salvata.

5. Anche il Wizard reintroduce il problema  
   Il bottone `Auto-classifica` lavora su tutte le posizioni, incluse quelle archiviate, quindi può rimetterle dentro senza che l’utente le veda.

### Perché l’errore si ripete

Perché oggi non esiste una sola fonte di verità.

La regola reale che tu vuoi è:
- strategie derivate visibili/calcolabili = solo quelle presenti nella configurazione salvata
- archivio = esclusione persistente dal perimetro strategico
- non configurato e non archiviato = da configurare, non da auto-mettere in `Altre Strategie`

In questo momento invece il sistema fa una via di mezzo:
- un po’ configurazione salvata
- un po’ fallback automatici
- un po’ filtro UI
- un po’ cache euristica

Ed è esattamente per questo che BIO ON continua a rientrare.

### Piano di correzione

1. Centralizzare la regola in un solo punto
- creare una logica condivisa di “scope strategie derivati”
- input: posizioni, configurazioni salvate, archivio
- output:
  - posizioni configurate
  - posizioni archiviate
  - posizioni non configurate da mostrare solo come “da configurare”

2. Rendere la classificazione strettamente config-driven
- `Altre Strategie` dovrà nascere solo da una configurazione salvata con tipo `other`
- gli orfani non dovranno più finire automaticamente in `Altre Strategie`

3. Far rispettare l’archivio ovunque, non solo nel Wizard
- pagina Derivati
- auto-classifica del Wizard
- controllo `needsWizard`
- riconciliazione
- cache strategie
- calcoli netting/risk/staging

4. Eliminare i matching incoerenti
- sostituire i confronti fragili basati su `includes`
- usare ovunque la stessa normalizzazione (`getCanonicalKey` / `normalizeForMatching`) come unica chiave logica

5. Rigenerare i derivati persistiti
- riscrivere `strategy_cache` in modalità stretta
- rimuovere voci archiviate o non configurate come BIO ON
- aggiornare i valori derivati dopo `archive/unarchive` e dopo `save config`

### File da correggere

- `src/lib/derivativeStrategies.ts`
- `src/pages/Derivatives.tsx`
- `src/components/derivatives/StrategyConfigWizard.tsx`
- `src/hooks/useDerivativeNetting.ts`
- `src/hooks/useRiskAnalysis.ts`
- `src/hooks/useEquityExposurePct.ts`
- `src/lib/uploadSnapshot.ts`
- `src/lib/stagingCalculator.ts`
- `src/lib/refreshStrategyCache.ts`

### Risultato atteso dopo la fix

- BIO ON archiviato non comparirà più in `Altre Strategie`
- non verrà più ripescato da `Auto-classifica`
- non farà scattare il Wizard come posizione “scoperta”
- non finirà più in `strategy_cache`
- non inquinerà netting, rischio o snapshot
- soprattutto: non potrà più riapparire da un altro percorso, perché la regola sarà unica e globale
