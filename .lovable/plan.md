
Diagnosi sintetica

1. Il salvataggio oggi collassa strategie distinte:
- `src/components/derivatives/StrategyConfigWizard.tsx` fonde tutto per `underlying + strategy_type`
- `src/hooks/useStrategyConfigurations.ts` rifonde di nuovo con la stessa chiave
- la tabella `strategy_configurations` ha un vincolo `UNIQUE(portfolio_id, underlying, strategy_type)`
Risultato: se GOOGLE ha più strategie dello stesso tipo, 3 diventano 2 (o peggio 1).

2. La pagina Derivati non è ancora davvero “config-driven”:
- `src/lib/derivativeStrategies.ts` in `configOnly` usa ancora logiche che ricompongono le gambe per sottostante
- `filterBySignatures` è 1:1 e non consuma correttamente `quantity_abs` su righe aggregate
- `groupOtherStrategiesByUnderlying()` riunisce di nuovo strategie diverse dello stesso sottostante
- `src/pages/Derivatives.tsx` per Put Spread / Diagonal Put Spread fa `find()` per underlying e quindi perde i casi con più config sullo stesso nome

3. La riconciliazione e i badge non usano la stessa logica della pagina:
- `needsWizard` ha matching “largo” e può segnalare falsi scoperti
- `StrategyReconciliationDialog` ricostruisce solo le config cambiate del sottostante coinvolto e rischia di perdere quelle sorelle rimaste invariate

Piano di fix definitivo

1. Correggere il modello dati delle configurazioni
- Rimuovere il vincolo sbagliato su `(portfolio_id, underlying, strategy_type)`
- Aggiungere un `sort_order` per salvare e rileggere le strategie esattamente nell’ordine configurato
- Lasciare 1 riga database = 1 strategia configurata, senza fusioni automatiche

2. Eliminare ogni deduplica lato frontend
- In `StrategyConfigWizard.handleSave()` salvare ogni strategia separatamente
- In `useStrategyConfigurations.upsertBatch()` smettere di fondere per `underlying + strategy_type`
- Leggere le config ordinate per `sort_order`

3. Introdurre un matcher unico e quantity-aware
- Estrarre una utility condivisa che consumi le gambe per config rispettando:
  - `option_type`
  - `strike`
  - `expiry`
  - `quantity_sign`
  - `quantity_abs`
- Il matcher dovrà poter assegnare quantità parziali della stessa riga aggregata a più config diverse, senza “bruciare” tutta la posizione alla prima strategia

4. Rendere la pagina Derivati rigidamente fedele alle config salvate
- In `categorizeDerivatives()` togliere nel percorso `configOnly` ogni ricostruzione euristica per config salvate
- Per Iron Condor / Double Diagonal / Put Spread / Diagonal Put Spread / Other: costruire 1 output per riga config, non 1 output per sottostante
- Smettere di usare `groupOtherStrategiesByUnderlying()` nel percorso config-only; il raggruppamento deve avvenire per config, non per underlying
- In `Derivatives.tsx` classificare le sezioni usando il `strategy_type` della config risolta, non un `find()` per underlying

5. Allineare wizard, riconciliazione e badge alla stessa sorgente di verità
- `needsWizard` dovrà usare lo stesso matcher strict della pagina
- `reconcileConfigs` dovrà riusare la stessa logica quantity-aware
- `StrategyReconciliationDialog` dovrà inizializzare e risalvare tutte le strategie del sottostante coinvolto, incluse quelle non cambiate, così da non cancellare “sorelle” valide
- Il wizard, alla riapertura, dovrà mostrare esattamente il numero di strategie salvate, senza riaccorparle

Dettagli tecnici / file coinvolti

- `supabase/migrations/...`
  - drop unique `(portfolio_id, underlying, strategy_type)`
  - add `sort_order`
  - nessun cambio RLS necessario

- `src/hooks/useStrategyConfigurations.ts`
  - rimuovere dedupe
  - salvare tutte le righe
  - leggere ordinate

- `src/components/derivatives/StrategyConfigWizard.tsx`
  - rimuovere merge finale per chiave
  - inviare `sort_order`
  - mantenere una strategia salvata per ogni card configurata

- `src/lib/derivativeStrategies.ts`
  - sostituire `filterBySignatures` nel percorso config-driven con matching quantity-aware
  - eliminare il regrouping per underlying nel percorso config-only

- `src/pages/Derivatives.tsx`
  - smettere di inferire il tipo strategia via `find()` per underlying
  - usare solo i risultati già risolti per config
  - correggere `needsWizard`

- `src/lib/strategyReconciliation.ts`
  - riusare il matcher condiviso per coerenza completa

- `src/components/derivatives/StrategyReconciliationDialog.tsx`
  - includere tutte le config del sottostante affetto, non solo quelle “changed”

Verifica finale che farò dopo l’implementazione

1. Caso GOOGLE con 3 strategie salvate:
- dopo “Salva configurazione” la pagina deve mostrarne 3, non 2

2. Riapertura wizard:
- “Riconfigura strategie” deve riaprire le stesse 3 strategie, senza riaccorparle

3. Strategie multiple stesso sottostante e stesso tipo:
- devono restare separate sia nel DB sia nella UI

4. Strategie costruite da quantità aggregate:
- una riga opzioni con quantità > 1 deve poter alimentare più config distinte se salvata così

5. Coerenza completa:
- pagina Derivati, wizard, riconciliazione e badge arancione devono dare lo stesso identico risultato
