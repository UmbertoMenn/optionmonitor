Ho controllato il codice e i dati di SilviaS. Il grafico non si aggiorna perché ci sono ancora due problemi distinti:

1. Nei componenti dei grafici (`PortfolioEvolutionChart` e `PerformanceEvolutionChart`) il punto corrente viene aggiunto solo se la data corrente è successiva all'ultimo snapshot storico. Se esiste già uno snapshot nello stesso giorno, il grafico continua a usare il valore congelato in `historical_data`, quindi non prende il valore live delle card.
2. Lo snapshot del 2026-05-04 di SilviaS contiene già la GP: `historical_data.total_value = 5.217.687,84`, mentre il portafoglio principale è `4.785.946,89` e la GP è `431.740,95`. Quindi la rimozione del salvataggio snapshot durante upload GP previene nuovi casi, ma non corregge il punto storico già salvato e non protegge da GP caricata prima del portfolio.

Piano di intervento:

1. Correggere i grafici storici
   - In `PortfolioEvolutionChart.tsx`, quando `currentDate` coincide con una data già presente in `historicalData`, sostituire quel punto con `currentValue` e marcarlo come punto corrente.
   - Se `currentDate` è più recente dell'ultimo snapshot, continuare ad aggiungerlo come oggi.
   - Non lasciare duplicati per la stessa data.
   - Applicare la stessa logica a `PerformanceEvolutionChart.tsx`, ricalcolando rendimento e P/L sul valore live sostitutivo.

2. Separare correttamente snapshot portfolio e GP
   - In `uploadSnapshot.ts`, fare in modo che lo snapshot salvato da upload portfolio includa la GP solo se la GP risulta già allineata o precedente alla data del file portfolio.
   - Se la GP è stata caricata dopo il portfolio, non deve entrare nello snapshot storico di quella data.
   - Questo evita che un caricamento GP successivo modifichi indirettamente il valore storico del portafoglio.

3. Correggere il caso “GP caricata per prima”
   - Rafforzare `GpSnapshotMissingBanner` perché non si basi solo sul confronto tra `gp.updated_at` e `portfolio.snapshot_date`, che può fallire quando sono nello stesso giorno.
   - Il banner deve verificare anche se lo snapshot esistente per quella data manca oppure contiene valori non coerenti con il live corrente.
   - Messaggio: lo snapshot storico non verrà aggiornato finché non viene caricato un nuovo file Portafoglio non-GP.

4. Aggiornare lo snapshot esistente dopo upload portfolio
   - Dopo un upload portfolio, invalidare/refetchare in modo più robusto `historical-data`, `positions`, `portfolios`, `gp-holdings` e query correlate, così il grafico non resta su cache vecchia.
   - Il grafico deve comunque essere corretto subito grazie al punto corrente live, anche prima del refetch.

5. Nota importante sui dati già salvati
   - Il codice correggerà la visualizzazione usando il valore live per il punto corrente.
   - Lo snapshot storico già salvato per SilviaS resta in database finché non viene rigenerato da un nuovo upload portfolio o corretto manualmente. Posso anche aggiungere una piccola azione/admin utility per rigenerare lo snapshot corrente, ma per questa correzione mi concentro sul bug UI/logico e sulla prevenzione dei nuovi casi.

File previsti:
- `src/components/dashboard/charts/PortfolioEvolutionChart.tsx`
- `src/components/dashboard/charts/PerformanceEvolutionChart.tsx`
- `src/lib/uploadSnapshot.ts`
- `src/components/dashboard/GpSnapshotMissingBanner.tsx`
- `src/components/dashboard/FileUploader.tsx`