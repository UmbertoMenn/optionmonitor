

## Piano: Unificare tutti i consumer sulle configurazioni strategia salvate

### Problema
5 su 7 consumer di `categorizeDerivatives` non passano `strategyConfigs`, quindi Risk Analyzer, Equity Exposure, snapshot storico, staging e cache alert usano l'auto-classificazione ignorando le configurazioni salvate nel wizard.

### Soluzione
Passare `strategyConfigs` a tutti i consumer. Dove i consumer sono hook React, aggiungere `useStrategyConfigurations()`. Dove sono funzioni server-side (uploadSnapshot, stagingCalculator, refreshStrategyCache), caricare le config da database prima di chiamare `categorizeDerivatives`.

### File da modificare

**1. `src/hooks/useRiskAnalysis.ts`**
- Importare e usare `useStrategyConfigurations()`
- Passare `strategyConfigs` a `categorizeDerivatives(derivs, snap, pOverrides, pConfigs)` sia nel path aggregato che in quello singolo

**2. `src/hooks/useEquityExposurePct.ts`**
- Importare e usare `useStrategyConfigurations()`
- Passare `strategyConfigs` a `categorizeDerivatives` in `analyzePositions`

**3. `src/lib/uploadSnapshot.ts`**
- Caricare `strategy_configurations` da database per il portfolio corrente
- Passarle a `categorizeDerivatives`

**4. `src/lib/stagingCalculator.ts`**
- Caricare `strategy_configurations` da database per il portfolio corrente
- Passarle a `categorizeDerivatives`

**5. `src/lib/refreshStrategyCache.ts`**
- Caricare `strategy_configurations` da database per il portfolio corrente
- Passarle a `categorizeDerivatives`

### Dettagli tecnici

Per i **hook React** (useRiskAnalysis, useEquityExposurePct), il pattern è:
```typescript
import { useStrategyConfigurations } from './useStrategyConfigurations';

const { configs: strategyConfigs } = useStrategyConfigurations();
// ...
const cats = categorizeDerivatives(derivs, snap, overrides, strategyConfigs);
```

Per le **funzioni server-side** (uploadSnapshot, stagingCalculator, refreshStrategyCache), il pattern è:
```typescript
const { data: configsRaw } = await supabase
  .from('strategy_configurations')
  .select('*')
  .eq('portfolio_id', portfolioId);
const strategyConfigs = (configsRaw || []) as StrategyConfiguration[];
// ...
const categories = categorizeDerivatives(derivatives, positions, overrides, strategyConfigs);
```

Per il path **aggregato** in useRiskAnalysis e useEquityExposurePct, filtrare le config per portfolio_id come già fatto per gli overrides:
```typescript
const configsByPortfolio = new Map<string, StrategyConfiguration[]>();
strategyConfigs.forEach(c => {
  if (!configsByPortfolio.has(c.portfolio_id)) configsByPortfolio.set(c.portfolio_id, []);
  configsByPortfolio.get(c.portfolio_id)!.push(c);
});
// ...
const pConfigs = configsByPortfolio.get(pid) || [];
const cats = categorizeDerivatives(derivs, snap, pOverrides, pConfigs);
```

### Risultato atteso
Ogni pagina e ogni calcolo (Risk Analyzer, Equity Exposure, snapshot, staging, cache alert) userà le configurazioni strategia salvate. La PUT BAIDU classificata come DRCC nel wizard sarà trattata come DRCC ovunque nell'app.

### Logica max loss
Nessuna modifica alla logica di calcolo max loss per strategia (`universalMaxLoss.ts`, `riskCalculator.ts`). Queste funzioni ricevono le categorie già classificate e calcolano il rischio. Cambia solo la fonte della classificazione (config salvate invece di auto-detect).

