
# Piano: Soppressione Avvisi di Distanza quando lo Stato è già Critico

## Problema

Quando una strategia è già in stato critico (OOR, ITM), il sistema genera anche l'avviso di distanza che è logicamente ridondante:

```text
Esempio CRM Double Diagonal:
  ❌ "CRM si avvicina allo strike della put venduta" (distanza)
  ✅ "La strategia è OOR (fuori dal range venduto)" (stato)
```

Se il prezzo ha già superato lo strike, l'avviso "si avvicina" non ha senso.

## Soluzione

Modificare la logica in `supabase/functions/check-alerts/index.ts` per:
1. Calcolare PRIMA la condizione di stato (OOR/ITM)
2. Usare quel risultato per decidere se generare l'avviso di distanza

## Strategie Coinvolte

| Strategia | Stato Critico | Avviso Distanza da Sopprimere |
|-----------|---------------|-------------------------------|
| Covered Call | ITM (price > call strike) | `distance_covered_call` |
| Naked Put | ITM (price < put strike) | `distance_naked_put` |
| Iron Condor | OOR lato PUT | `distance_iron_condor_put` |
| Iron Condor | OOR lato CALL | `distance_iron_condor_call` |
| Double Diagonal | OOR lato PUT | `distance_double_diagonal_put` |
| Double Diagonal | OOR lato CALL | `distance_double_diagonal_call` |
| Alternative DD | OOR lato PUT | `distance_alternative_dd_put` |
| Alternative DD | OOR lato CALL | `distance_alternative_dd_call` |

## Modifiche Tecniche

### File: `supabase/functions/check-alerts/index.ts`

#### 1. Covered Call (linee 356-448)

Calcolare `isITM` prima e usarlo per condizionare l'avviso di distanza:

```typescript
// ============ COVERED CALL ============
if (strategyType === 'Covered Call') {
  const soldCallStrike = strategy.sold_call_strike || 0;
  if (soldCallStrike <= 0) continue;
  
  // Calcola stato ITM PRIMA
  const isITM = underlyingPrice > soldCallStrike;
  
  // ITM Alert (invariato)
  // ... codice esistente ...
  
  // Distance Alert - SOPPRESSO se già ITM
  const distConfig = getEffectiveConfig(configs || [], ALERT_TYPES.DISTANCE_COVERED_CALL, ticker);
  if (distConfig.enabled && !isITM) {  // ← AGGIUNTO: && !isITM
    // ... codice esistente ...
  }
}
```

#### 2. Naked Put (linee 450-543)

```typescript
// ============ NAKED PUT ============
if (strategyType === 'Naked Put') {
  const soldPutStrike = strategy.sold_put_strike || 0;
  if (soldPutStrike <= 0) continue;
  
  // Calcola stato ITM PRIMA
  const isITM = underlyingPrice < soldPutStrike;
  
  // ITM Alert (invariato)
  // ... codice esistente ...
  
  // Distance Alert - SOPPRESSO se già ITM
  const distConfig = getEffectiveConfig(configs || [], ALERT_TYPES.DISTANCE_NAKED_PUT, ticker);
  if (distConfig.enabled && !isITM) {  // ← AGGIUNTO: && !isITM
    // ... codice esistente ...
  }
}
```

#### 3. Iron Condor (linee 545-685)

Per IC serve distinguere quale lato è OOR:

```typescript
// ============ IRON CONDOR ============
if (strategyType === 'Iron Condor') {
  const soldPutStrike = strategy.sold_put_strike || 0;
  const soldCallStrike = strategy.sold_call_strike || 0;
  if (soldPutStrike <= 0 || soldCallStrike <= 0) continue;
  
  // Calcola stato OOR PRIMA - distinguendo il lato
  const isOOR_Put = underlyingPrice < soldPutStrike;
  const isOOR_Call = underlyingPrice > soldCallStrike;
  const isOOR = isOOR_Put || isOOR_Call;
  
  // OOR Alert (invariato, usa isOOR)
  // ... codice esistente ...
  
  // Distance PUT - SOPPRESSO se già OOR lato PUT
  const putDistConfig = getEffectiveConfig(configs || [], ALERT_TYPES.DISTANCE_IRON_CONDOR_PUT, ticker);
  if (putDistConfig.enabled && !isOOR_Put) {  // ← AGGIUNTO: && !isOOR_Put
    // ... codice esistente ...
  }
  
  // Distance CALL - SOPPRESSO se già OOR lato CALL
  const callDistConfig = getEffectiveConfig(configs || [], ALERT_TYPES.DISTANCE_IRON_CONDOR_CALL, ticker);
  if (callDistConfig.enabled && !isOOR_Call) {  // ← AGGIUNTO: && !isOOR_Call
    // ... codice esistente ...
  }
}
```

#### 4. Double Diagonal (linee 687-830)

Stessa logica di Iron Condor:

```typescript
// ============ DOUBLE DIAGONAL ============
if (strategyType === 'Double Diagonal') {
  const soldPutStrike = strategy.sold_put_strike || 0;
  const soldCallStrike = strategy.sold_call_strike || 0;
  if (soldPutStrike <= 0 || soldCallStrike <= 0) continue;
  
  // Calcola stato OOR PRIMA - distinguendo il lato
  const isOOR_Put = underlyingPrice < soldPutStrike;
  const isOOR_Call = underlyingPrice > soldCallStrike;
  const isOOR = isOOR_Put || isOOR_Call;
  
  // OOR Alert (invariato, usa isOOR)
  // ... codice esistente ...
  
  // Distance PUT - SOPPRESSO se già OOR lato PUT
  if (putDistConfig.enabled && !isOOR_Put) {  // ← AGGIUNTO
    // ...
  }
  
  // Distance CALL - SOPPRESSO se già OOR lato CALL
  if (callDistConfig.enabled && !isOOR_Call) {  // ← AGGIUNTO
    // ...
  }
}
```

#### 5. Alternative DD (linee successive)

Stessa logica di Double Diagonal.

## Logica di Soppressione per Lato

La soppressione deve essere **specifica per lato**:

```text
┌─────────────────────────────────────────────────────────┐
│  Prezzo < Put Strike → OOR PUT                          │
│    → Sopprime solo distance_*_put                       │
│    → distance_*_call rimane attivo (lato CALL è safe)   │
├─────────────────────────────────────────────────────────┤
│  Prezzo > Call Strike → OOR CALL                        │
│    → Sopprime solo distance_*_call                      │
│    → distance_*_put rimane attivo (lato PUT è safe)     │
└─────────────────────────────────────────────────────────┘
```

## Reset dello Stato Distanza quando Stato Critico Attivo

Quando una posizione passa da "distanza pericolosa" a "OOR/ITM", lo stato dell'avviso di distanza deve essere resettato a "safe" per evitare che rimanga bloccato in stato "alerted":

```typescript
// Quando isOOR_Put diventa true, resetta lo stato distance_put a 'safe'
if (isOOR_Put) {
  const distPutStateKey = `dd_put_dist_${strategy.strategy_key}:${ALERT_TYPES.DISTANCE_DOUBLE_DIAGONAL_PUT}`;
  const distPutState = statesMap.get(distPutStateKey);
  if (distPutState?.current_state === 'alerted') {
    await supabase.from('alert_states')
      .update({ current_state: 'safe' })
      .eq('id', distPutState.id);
  }
}
```

## Riepilogo Modifiche

| Sezione | Linee Appross. | Modifica |
|---------|----------------|----------|
| Covered Call | 356-448 | Aggiungere `&& !isITM` al check distanza |
| Naked Put | 450-543 | Aggiungere `&& !isITM` al check distanza |
| Iron Condor | 545-685 | Separare `isOOR_Put/Call`, usarli per sopprimere |
| Double Diagonal | 687-830 | Separare `isOOR_Put/Call`, usarli per sopprimere |
| Alternative DD | ~831-970 | Separare `isOOR_Put/Call`, usarli per sopprimere |

## Risultato Atteso

**Prima**:
```
📨 CRM si avvicina allo strike della put venduta (warning)
📨 La strategia è OOR (fuori dal range venduto) (critical)
```

**Dopo**:
```
📨 La strategia è OOR (fuori dal range venduto) (critical)
```

Solo l'avviso più significativo viene inviato.
