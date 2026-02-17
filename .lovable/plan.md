

## Fix: check-alerts ignora gli override manuali

### Problema

La edge function `check-alerts` legge le strategie dalla tabella `strategy_cache` e genera avvisi in base al tipo di strategia. Quando un utente sposta una posizione con un override manuale (es. da "Naked Put" a "Altre Strategie"), la `check-alerts` continua a trattarla come Naked Put perche':

1. La `strategy_cache` potrebbe non essere stata aggiornata dopo l'override (errore `duplicate key` nei log Postgres impedisce il salvataggio)
2. La `check-alerts` non controlla MAI la tabella `derivative_overrides`, quindi anche con cache aggiornata non c'e' un meccanismo di sicurezza

### Dati attuali

La PUT 430 MAR/26 UNH (position `6dee94df`) risulta:
- In `strategy_cache`: tipo "Naked Put" (entry `np_UNITEDHEALTH GROUP INC (DEL)_430_202603`)
- In `derivative_overrides`: override verso `target_category: 'other'`

La `check-alerts` vede "Naked Put" con strike 430 e prezzo UNH ~293, quindi genera correttamente un alert ITM. Il problema e' che non dovrebbe monitorarla come Naked Put.

### Soluzione

#### 1. `supabase/functions/check-alerts/index.ts` - Filtrare posizioni con override

Per ogni portfolio, caricare gli override da `derivative_overrides` e costruire un set di `position_id` con override. Prima di processare ogni strategia dalla cache, verificare se TUTTI i suoi `position_ids` sono liberi da override che li spostano in una categoria diversa.

```text
// Per ogni portfolio:
1. Fetch derivative_overrides per il portfolio
2. Costruire mappa: position_id -> target_category
3. Per ogni strategia nella cache:
   - Controllare se qualche position_id ha un override
   - Se l'override sposta la posizione in una categoria diversa dal strategy_type, SKIP
```

Logica di matching categoria-strategia:
- override `target_category: 'naked_put'` corrisponde a `strategy_type: 'Naked Put'`
- override `target_category: 'covered_call'` corrisponde a `strategy_type: 'Covered Call'`
- override `target_category: 'other'` corrisponde a tutte le `Altre Strategie`
- Se l'override sposta verso una categoria DIVERSA -> la strategia non va monitorata con il tipo originale

#### 2. `src/lib/strategyCache.ts` - Gestire errore duplicate key

Sostituire il pattern DELETE + INSERT con UPSERT per evitare errori di constraint quando due salvataggi concorrono. Oppure usare un approccio piu' robusto con try/catch e retry.

```text
// Attuale (fragile):
DELETE FROM strategy_cache WHERE portfolio_id = X
INSERT INTO strategy_cache VALUES (...)

// Nuovo (robusto):
// Usare upsert con onConflict su (portfolio_id, strategy_key)
// Poi eliminare le entries che non sono piu' presenti
```

### Dettaglio modifica check-alerts

```text
// Dopo il fetch di strategy_cache, aggiungere:
const { data: overridesData } = await supabase
  .from('derivative_overrides')
  .select('position_id, target_category, strategy_type, override_type')
  .eq('portfolio_id', portfolioId);

// Costruire set di position_id con override single
const overriddenPositions = new Map<string, string>();
for (const ov of (overridesData || [])) {
  if (ov.override_type === 'single' && ov.position_id) {
    overriddenPositions.set(ov.position_id, ov.target_category);
  }
}

// Nel loop delle strategie, prima di processare:
for (const strategy of activeStrategies) {
  // Check if any position in this strategy has been overridden
  const hasOverride = strategy.position_ids.some(pid => {
    const overrideCategory = overriddenPositions.get(pid);
    if (!overrideCategory) return false;
    // Map strategy_type to expected category
    const expectedCategory = mapStrategyTypeToCategory(strategy.strategy_type);
    return overrideCategory !== expectedCategory;
  });
  
  if (hasOverride) {
    console.log(`[${portfolioId}] Skipping ${strategy.strategy_type} ${strategy.ticker} - position overridden`);
    continue;
  }
  // ... resto della logica
}
```

Funzione helper per il mapping:
```text
function mapStrategyTypeToCategory(strategyType: string): string {
  switch (strategyType) {
    case 'Naked Put': return 'naked_put';
    case 'Covered Call': return 'covered_call';
    case 'LEAP Call': return 'leap_call';
    default: return 'other';
  }
}
```

### Dettaglio modifica strategyCache.ts

```text
// Invece di DELETE + INSERT, usare upsert:
const { error: upsertError } = await supabase
  .from('strategy_cache')
  .upsert(batch, { onConflict: 'portfolio_id,strategy_key' });

// Poi eliminare le entries obsolete:
const activeKeys = new Set(records.map(r => r.strategy_key));
const { data: existing } = await supabase
  .from('strategy_cache')
  .select('strategy_key')
  .eq('portfolio_id', portfolioId);

const keysToDelete = (existing || [])
  .filter(e => !activeKeys.has(e.strategy_key))
  .map(e => e.strategy_key);

if (keysToDelete.length > 0) {
  await supabase
    .from('strategy_cache')
    .delete()
    .eq('portfolio_id', portfolioId)
    .in('strategy_key', keysToDelete);
}
```

### File modificati

| File | Modifica |
|------|----------|
| `supabase/functions/check-alerts/index.ts` | Fetch override e skip strategie con posizioni overriddate |
| `src/lib/strategyCache.ts` | Sostituire DELETE+INSERT con UPSERT + cleanup obsolete |

### Risultato

- La PUT 430 UNH non generera' piu' alert come Naked Put perche' check-alerts vedra' l'override verso "other"
- Il salvataggio della cache non fallira' piu' per constraint duplicate key
- Il sistema e' robusto anche se la cache non viene aggiornata immediatamente dopo un override

