

## Fix definitivo: Persistenza strategie derivati

### Problema risolto
Salvando 3 strategie per lo stesso sottostante (es. GOOGLE), il sistema ne mostrava solo 2 a causa di deduplicazione automatica per `underlying + strategy_type`.

### Modifiche applicate

1. **Database**: rimosso vincolo UNIQUE su `(portfolio_id, underlying, strategy_type)`, aggiunto campo `sort_order`
2. **useStrategyConfigurations.ts**: rimossa deduplicazione in `upsertBatch`, lettura ordinata per `sort_order`, `upsert` singolo convertito in `insert`
3. **StrategyConfigWizard.tsx**: rimossa deduplicazione in `handleSave`, aggiunto `sort_order` progressivo
4. **derivativeStrategies.ts**: in config-only mode, ogni config produce un `GroupedOtherStrategy` separato (non più raggruppato per underlying); aggiunto `configId` e `configStrategyType` a `GroupedOtherStrategy`
5. **Derivatives.tsx**: classificazione put_spread/diagonal_put_spread usa `configStrategyType` dal gruppo, non più `find()` per underlying
6. **StrategyReconciliationDialog.tsx**: `handleSave` aggiunge `sort_order` progressivo
