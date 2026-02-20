

## Semplificazione Regole di Aggiustamento

### Problema attuale
- "Prezzo vicino a barriera" ha un campo "direction" (approaching/breached) inutile -- deve sempre significare "si avvicina"
- "Max Trigger" e "Cooldown" sono parametri confusi e inutili
- Le azioni disponibili sono troppe e poco chiare (close_all, close_leg, compound, ecc.)
- Gli strike vengono calcolati con percentuali continue invece di allinearsi a una griglia reale (ogni 5 unita)

### Cosa cambia

#### 1. Interfaccia `AdjustmentRule` semplificata

La regola diventa:
- **Condizione**: `price_near_barrier` (unica condizione) con `legType` (put/call venduta) e `distancePct` (percentuale di avvicinamento alla barriera)
- **Azione**: solo 3 opzioni:
  - `roll_strike` -- rolla solo lo strike (chiude la gamba e riapre allo strike piu vicino alla nuova barriera %)
  - `roll_expiry` -- rolla solo la scadenza (stessa strike, scadenza successiva)
  - `roll_both` -- rolla strike e scadenza insieme
- **Strike step**: parametro configurabile (default 5) che determina l'incremento degli strike disponibili. Quando si rolla, il nuovo strike viene arrotondato al multiplo di `strikeStep` piu vicino alla barriera % impostata
- **Priorita**: mantenuta per ordinare le regole
- Rimossi: `maxTriggers`, `cooldownDays`, `delta_threshold`, `days_to_expiry`, `pl_threshold`, `close_all`, `close_leg`, `add_leg`, `compound`

#### 2. Logica di selezione strike

Quando una regola si attiva (prezzo si avvicina alla barriera):
1. Calcola il nuovo strike target: `prezzo_sottostante * (1 +/- newBarrierPct / 100)`
2. Arrotonda al multiplo di `strikeStep` piu vicino (es. se strikeStep=5 e target=87.3, lo strike diventa 85 o 90)
3. Vende/compra (stessa direzione della gamba originale) al nuovo strike

#### 3. File coinvolti

| File | Modifica |
|------|----------|
| `src/lib/adjustmentRules.ts` | Semplificazione interfacce, rimozione condizioni/azioni inutili, nuovi preset |
| `src/components/simulator/AdjustmentRuleEditor.tsx` | UI semplificata: solo condizione barriera, 3 azioni, strike step, niente max trigger/cooldown |
| `src/lib/backtestEngine.ts` | Aggiornamento `evaluateCondition` e `executeAction` per usare le nuove regole con strike step |

---

### Dettaglio tecnico

**adjustmentRules.ts -- Nuove interfacce**:

```text
AdjustmentCondition:
  type: 'price_near_barrier'  (unica opzione)
  legType: 'sold_put' | 'sold_call'
  distancePct: number  (es. 5 = si attiva quando il prezzo e entro il 5% dello strike)

AdjustmentAction:
  type: 'roll_strike' | 'roll_expiry' | 'roll_both'
  newBarrierPct: number  (nuova distanza % dallo strike per il roll, es. 10 = nuovo strike al 10% dal prezzo)
  rollMonths: number  (solo per roll_expiry e roll_both, default 1)

AdjustmentRule:
  id: string
  name: string
  condition: AdjustmentCondition
  action: AdjustmentAction
  strikeStep: number  (default 5, incremento degli strike)
  priority: number
```

**backtestEngine.ts -- Nuova logica roll_strike**:

```text
1. Prezzo attuale S, gamba venduta con strike K
2. Distanza = |S - K| / K * 100
3. Se distanza <= condition.distancePct -> attiva regola
4. Nuovo strike target = S * (1 - newBarrierPct/100) per put, S * (1 + newBarrierPct/100) per call
5. Arrotonda: newStrike = Math.round(target / strikeStep) * strikeStep
6. Chiudi vecchia gamba, apri nuova allo strike arrotondato
```

**AdjustmentRuleEditor.tsx -- UI semplificata**:

Ogni regola mostra:
- Nome (editabile)
- Tipo gamba: Put venduta / Call venduta
- Distanza attivazione: input numerico + "%"
- Azione: select con 3 opzioni (Rolla barriera / Rolla scadenza / Rolla entrambi)
- Nuova barriera %: input numerico (visibile per roll_strike e roll_both)
- Mesi avanti: input numerico (visibile per roll_expiry e roll_both)
- Strike step: input numerico (default 5)
- Priorita: input numerico

Rimossi completamente: Max trigger, Cooldown, condizioni delta/DTE/P&L, azioni close_all/close_leg/compound.

