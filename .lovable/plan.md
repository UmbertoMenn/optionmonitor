

## Problema

Il dialog di riconciliazione usa `normalizeUnderlying(pos.description)` per raggruppare le azioni per sottostante (riga 182 del dialog). Questo usa solo `getCanonicalKey` + `normalizeForMatching`, che produce chiavi diverse per azioni e derivati quando i nomi non coincidono esattamente.

Per esempio:
- Derivato underlying: `"SUPER MICRO COMP"` → normalizza a `"supermicrocomp"`
- Azione description: `"AZ. SUPER MICRO COMPUTER INC"` → normalizza a `"supermicrocomputerinc"`

Le due chiavi sono diverse, quindi le azioni di Super Micro non finiscono nel pool delle posizioni disponibili.

Il **wizard** invece usa `getUnderlyingKey(pos, allDerivatives)` che include un fallback con **token-overlap** (controlla se i token significativi come "SUPER", "MICRO" si sovrappongono) e anche un **includes** bidirezionale tra le stringhe normalizzate. Questo permette di associare correttamente `"SUPER MICRO COMPUTER"` con `"SUPER MICRO COMP"`.

## Soluzione

Replicare nel dialog di riconciliazione la stessa logica `getUnderlyingKey` del wizard, passando la lista dei derivati come riferimento per il matching delle azioni.

### Modifiche a `src/components/derivatives/StrategyReconciliationDialog.tsx`

1. Copiare le funzioni `getSignificantTokens`, `hasTokenOverlap` e `getUnderlyingKey` dal wizard (o importarle se estratte in un modulo condiviso)
2. Nella funzione `initStates`, sostituire il blocco che raggruppa le azioni (righe 180-198):
   - Invece di `normalizeUnderlying(raw)` sulle azioni, usare `getUnderlyingKey(pos, allDerivatives)` dove `allDerivatives` è la lista di tutte le posizioni derivative correnti
   - Questo garantisce che le azioni vengano associate allo stesso gruppo dei derivati tramite token-overlap e includes bidirezionale

### Nessuna modifica ad altri file

La logica di `reconcileConfigs` in `strategyReconciliation.ts` non è impattata perché opera solo sui derivati. Il problema è esclusivamente nel raggruppamento delle azioni nel pool del dialog.

