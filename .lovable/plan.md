
Sintesi:
Correggerò la card “Posizioni da monitorare” in modo che usi sempre il ticker reale come chiave di confronto e come etichetta mostrata. Ho verificato i dati di silvias: `BABA` ha 200 azioni e 2 call vendute in De-Risking Covered Call, `CRM` ha 100 azioni e 1 call venduta in De-Risking Covered Call. Quindi oggi sono falsi positivi generati dalla logica frontend, non dai dati.

Piano:
1. Correggere la causa strutturale nel linking delle strategie configurate
- In `src/lib/derivativeStrategies.ts`, nei rami con `strategy_configurations` (`covered_call` e `derisking_covered_call`), cambiare la risoluzione di `linkedStock`.
- Oggi, se `linked_stock_id` non esiste più dopo un re-upload, il codice non fa fallback e usa uno stock fittizio.
- Va cambiato in: prova `linked_stock_id`; se non trova nulla, fallback a `findUnderlyingStock(...)`.
- Questo evita che una strategia resti agganciata a un nome dummy non allineato allo stock reale.

2. Rifare il matching della card monitoraggio usando il ticker, non il nome
- In `src/components/derivatives/DerivativesSummaryCard.tsx`, introdurre un resolver unico del ticker per la card, basato sui ticker già risolti in `underlyingPrices`.
- Regola: usare match esatto / mapping già noto; niente `split(' ')[0]`, niente confronto per nome normalizzato come logica principale.
- Se il ticker non è disponibile, usare un fallback controllato; non il nome del titolo come output principale.

3. Sistemare definitivamente “Call da rivendere”
- Riscrivere `availableCallsToSell` perché confronti:
  - azioni possedute per ticker
  - covered call vendute per ticker
  - de-risking covered call vendute per ticker
- Così casi come:
  - `ALIBABA GROUP HOLDING LTD` vs `ALIBABA GROUP HOLDING LTD SPON ADS EACH REP 8 ORD SHS`
  - `SALESFORCE.COM INC` vs `SALESFORCE INC`
  non romperanno più il conteggio.
- Risultato atteso: per silvias non compariranno più `BABA` e `CRM` in “Call da rivendere”.

4. Mostrare solo ticker in tutta la card
- Sostituire gli output che oggi usano nome o prima parola del nome con il ticker risolto.
- Questo vale per le varie sezioni della card che oggi usano pattern come `description.split(' ')[0]` o `underlying.split(' ')[0]`.
- L’obiettivo è che l’interfaccia mostri sempre `BABA`, `CRM`, `AAPL`, ecc., mai `ALIBABA`, `SALESFORCE`, ecc.

5. Allineare la logica riutilizzata nella card
- Centralizzare il bilancio “azioni possedute / call vendute / call comprate” in un unico passaggio interno, così “Call non coperte” e “Call da rivendere” non dipendono da due logiche diverse.
- In questo bilancio includere esplicitamente anche le `deRiskingCoveredCalls`.

Dettagli tecnici:
- File da modificare:
  - `src/components/derivatives/DerivativesSummaryCard.tsx`
  - `src/lib/derivativeStrategies.ts`
- Nessuna modifica database necessaria.
- La fix correggerà anche il contenuto salvato in `monitoring_snapshot`, perché la snapshot viene costruita dalla stessa card.

Verifica prevista:
- Aprire la pagina Derivatives con l’utente silvias.
- Controllare che `BABA` e `CRM` non compaiano in “Call da rivendere”.
- Verificare che la card mostri solo ticker reali.
- Verificare che dopo refresh il risultato resti coerente e che la snapshot salvata usi ticker corretti.
