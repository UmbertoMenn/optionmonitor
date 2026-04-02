

## Fix: escludere "TITOLI NON VALORIZZABILI" dal parsing Excel e chiarire ruolo archivio derivati

### Problema

1. **"TITOLI NON VALORIZZABILI"** è una sezione del file Excel che il parser non riconosce. Poiché non c'è un `if` per questa sezione, le righe vengono parsate sotto la sezione precedente (es. azioni/derivati). BIO ON SPA finisce così tra i derivati con `asset_type = 'derivative'` senza `option_type`, `underlying` né `strike_price`.

2. **L'archivio derivati** è stato erroneamente usato per escludere BIO ON da tutto, ma la sua funzione corretta è solo nascondere un sottostante dalla pagina Strategie Derivati, non dai calcoli generali.

### Correzione

#### 1. Excel Parser — `src/lib/excelParser.ts`

Aggiungere il riconoscimento della sezione "TITOLI NON VALORIZZABILI" nella catena di `if` delle sezioni (riga ~211-233). Quando viene rilevata:
- Impostare `currentSection = null` (o un nuovo flag `skipSection = true`)
- Tutte le righe successive verranno saltate fino alla prossima sezione riconosciuta
- Questo impedisce che BIO ON e simili vengano importati come posizioni

Pattern da matchare: `firstCell.includes('NON VALORIZZABIL')` o `firstCell.includes('TITOLI NON VALORIZZABILI')`.

#### 2. Archivio derivati — ripristinare il significato corretto

Verificare che l'archivio (`archived_underlyings`) venga usato SOLO per:
- Pagina Strategie Derivati: esclusione dalla visualizzazione e dal conteggio `needsWizard`
- Auto-classifica nel Wizard: esclusione dai suggerimenti

E NON venga usato per:
- Calcolo netting
- Calcolo rischio / equity exposure
- Snapshot / staging
- Totali patrimonio

File da verificare: `src/lib/derivativeStrategies.ts` (il filtro archivio nel `configOnly` path), `src/lib/refreshStrategyCache.ts`, `src/hooks/useDerivativeNetting.ts`, `src/hooks/useRiskAnalysis.ts`.

### Risultato atteso

- Al prossimo upload Excel, BIO ON e qualsiasi titolo sotto "TITOLI NON VALORIZZABILI" non verrà più importato
- L'archivio derivati tornerà ad avere solo il ruolo UI nella pagina Strategie Derivati
- I calcoli di netting, rischio e patrimonio non saranno influenzati dall'archivio derivati

### File da modificare

- `src/lib/excelParser.ts` — aggiungere sezione "NON VALORIZZABILI" come sezione da ignorare
- Verificare e, se necessario, correggere `src/lib/derivativeStrategies.ts`, `src/lib/refreshStrategyCache.ts` per assicurarsi che l'archivio non escluda dai calcoli analitici

