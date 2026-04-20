

## Fix completo: Netting allineato a Strategie Derivati + auto-cleanup config invalide

Combina il refactor del netting (già approvato) con la pulizia automatica delle config strategia che diventano invalide quando le posizioni cambiano (es. IC META con 4 gambe → 3 gambe dopo upload).

---

### Parte A — Netting copia esatta di Strategie Derivati (già approvato)

**File: `src/hooks/useDerivativeNetting.ts`**

1. Eliminare la ricostruzione `positionCategory` basata su raw positions
2. Costruire i leg canonici direttamente da `categories` (output di `categorizeDerivatives({ configOnly: true })`):
   - per ogni `coveredCalls[]`, `deRiskingCoveredCalls[]`, `ironCondors[]`, `doubleDiagonals[]`, `nakedPuts[]`, `leapCalls[]`, `longPuts[]`, `groupedOtherStrategies[]` → estrarre i `matchedPositions` virtuali (gambe già "affettate" dal resolver quantity-aware)
3. Calcolare orfani **quantity-aware**:
   ```text
   per ogni derivato originale:
     consumed = somma(quantity dei pezzi virtuali in tutte le categorie con stesso source id)
     residuo = |quantity originale| - consumed
     se residuo > 0 → crea gamba virtuale "orphan" con quantity proporzionale
   ```
4. Calcolo netting (totale, ex CC, ex CC&NP) sui leg canonici + residui:
   - Covered Call / De-Risking CC: solo perdita intrinseca ITM della sold call (capped a market value)
   - Naked Put: solo perdita intrinseca ITM (capped)
   - Tutte le altre 6 categorie + orphans: market value pieno
5. Stessa logica replicata in `getBreakdownForViewMode`

**File: `src/components/dashboard/DynamicPortfolioChart.tsx`**: nessuna modifica logica, solo verifica che la 10ª colonna "Posizioni Orfane" continui a renderizzarsi correttamente.

---

### Parte B — Auto-cleanup config invalide (nuovo)

**Problema**: una `strategy_configurations` di tipo `iron_condor` salvata con 4 leg signatures resta nel DB anche se l'utente carica un nuovo Excel dove una gamba è scomparsa. Il resolver in `categorizeDerivatives` non riesce a matchare la firma completa → la config non produce `matchedPositions` → META non appare in nessuna sezione e le 3 gambe residue finiscono in "Posizioni Orfane".

**Fix in 2 livelli**:

**B.1 — Rilevamento incompletezza nel resolver**

In `src/lib/derivativeStrategies.ts` (funzione `categorizeDerivatives`, ramo `configOnly`): quando una config ha `expectedLegs` (4 per IC/DD, 2 per put spread, 1 per CC/NP/Leap, ecc.) ma il resolver matcha < `expectedLegs`, marcare la config come **incompleta** e:
- non collocare i leg parzialmente matchati nella sezione strategica
- restituirli come parte di un nuovo array `categories.incompleteConfigPositions` (gambe virtuali con flag `incomplete: true` e riferimento alla config)
- la categoria di destinazione finale (orphans) li raccoglierà tramite la logica quantity-aware del netting

**B.2 — Notifica + cleanup UI nella pagina Strategie Derivati**

In `src/pages/Derivatives.tsx` (e/o componente correlato dove si listano le config):
- dopo `categorizeDerivatives({ configOnly: true })`, ispezionare le config che hanno generato 0 `matchedPositions` malgrado abbiano `expectedLegs > 0`
- mostrare un banner / toast: *"3 configurazioni non sono più valide perché le posizioni sottostanti sono cambiate (es. META Iron Condor: 4 gambe → 3 gambe). [Rivedi e correggi]"*
- aggiungere azione "Rimuovi configurazioni invalide" che chiama `deleteStrategyConfigurations(invalidIds)` (già esiste nel hook `useStrategyConfigurations`)

In alternativa più automatica (preferita): integrare con il dialogo già esistente di **Strategy Reconciliation** (vedi memoria `features/derivatives-management/strategy-reconciliation`). Quando il reconciliation engine viene eseguito post-upload, deve:
- rilevare config con leg mancanti (firma originale non più presente)
- proporle nel diff dialog come "Configurazione obsoleta — rimuovere"
- al conferma utente: cancellazione dal DB

**File da modificare per B**:
1. `src/lib/derivativeStrategies.ts` — esporre conteggio leg mancanti per config
2. `src/lib/strategyReconciliation.ts` — aggiungere check "config con leg insufficienti"
3. `src/components/derivatives/StrategyReconciliationDialog.tsx` — sezione "Configurazioni obsolete"

---

### Risultato atteso (Mauro G + scenari simili)

- **Netting dashboard**: MU resta in Double Diagonal, GOOGLE deep ITM in Covered/De-Risking CC, "Altre Strategie" mostra solo SMCI 38, "Posizioni Orfane" solo residui veri
- **META con IC degradato**: il sistema rileva la config IC orfana, mostra nel dialog di riconciliazione "META Iron Condor: 1 gamba mancante", l'utente può rimuoverla o riconfigurarla come Put Spread/Other; le 3 gambe residue finiscono correttamente in "Posizioni Orfane" del netting fino alla riconfigurazione
- **Coerenza 1:1** tra dashboard e pagina Strategie Derivati garantita dall'uso della stessa fonte canonica (`matchedPositions` del resolver)

