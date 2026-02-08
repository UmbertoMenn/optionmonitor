
Obiettivo
- Correggere il bug per cui il grafico “Evoluzione Rendimento” (e anche “Evoluzione Patrimonio”) mostra una data duplicata (es. 30/01 due volte) quando l’Excel caricato ha una snapshot_date antecedente all’ultimo snapshot salvato nei dati storici.
- Aggiungere un avviso in alto in dashboard quando l’Excel caricato è più vecchio dell’ultimo snapshot storico: “Attenzione: Excel caricato con data antecedente all'ultimo snapshot salvato”.

Analisi critica (perché succede davvero)
- In Dashboard passiamo ai grafici:
  - currentDate = portfolio.snapshot_date (presa dall’Excel caricato)
  - historicalData = snapshot salvati in historical_data
- In src/components/dashboard/charts/PerformanceEvolutionChart.tsx oggi la logica:
  1) ordina gli snapshot storici in ordine crescente
  2) costruisce data[]
  3) se currentDate è diversa dall’ULTIMO elemento di data[] (cioè dalla data più recente degli snapshot storici), fa data.push(currentPoint)
- Se currentDate è antecedente all’ultimo snapshot storico (es. Excel 30/01 ma ultimo storico 07/02), il currentPoint viene comunque “pushato in coda”:
  - l’array finale diventa cronologicamente sbagliato (… 30/01, 07/02, 30/01)
  - con XAxis categoriale, Recharts disegna i tick nell’ordine dell’array → appare 30/01 due volte ed è “un errore” perché il punto “corrente” non è realmente il più recente.
- Lo stesso identico problema esiste anche in src/components/dashboard/charts/PortfolioEvolutionChart.tsx.
- Inoltre useBenchmarkData riceve currentDate e può aggiungere un punto benchmark su una data che non rappresenta il “presente” (se currentDate è più vecchia dell’ultimo snapshot), peggiorando coerenza e tooltip.

Decisione di comportamento (per evitare ambiguità)
- “Punto corrente” (da Excel) va mostrato nel grafico SOLO se è più recente dell’ultimo snapshot storico disponibile (cioè se rappresenta davvero l’ultimo stato).
- Se l’Excel è più vecchio dell’ultimo snapshot storico:
  - NON aggiungiamo il punto corrente al grafico (così sparisce la duplicazione/ordine errato)
  - mostriamo l’avviso in alto in dashboard come richiesto.

Cosa implementerò (modifiche puntuali)

1) Fix logica “current point” in PerformanceEvolutionChart.tsx
File: src/components/dashboard/charts/PerformanceEvolutionChart.tsx

A. Calcolo “last snapshot date” (globale, non filtrato)
- Calcolare una variabile lastSnapshotDate = max(snapshot_date) su historicalData (non su filteredHistoricalData), perché:
  - il timeRange può nascondere l’ultimo snapshot, ma la regola “Excel antecedente all’ultimo snapshot salvato” deve basarsi sul reale ultimo snapshot salvato, non su quello filtrato.

B. Effective currentDate (solo se veramente più recente)
- Definire:
  - const canAppendCurrent = currentDate && currentValue > 0 && lastSnapshotDate && new Date(currentDate) > lastSnapshotDate
- Solo se canAppendCurrent === true, aggiungere il punto corrente.

C. De-dup robusto per data
- Anche quando canAppendCurrent è true, evitare duplicati controllando contro TUTTI i punti (non solo l’ultimo):
  - if (!data.some(d => d.date === currentDate)) { push(...) }

D. Allineamento benchmark: non passare currentDate “vecchia” a useBenchmarkData
- Oggi useBenchmarkData può aggiungere returns per currentDate anche se non è più recente.
- Definire:
  - const effectiveCurrentDateForBenchmark = canAppendCurrent ? currentDate : null
- Passare effectiveCurrentDateForBenchmark a useBenchmarkData al posto di currentDate.

E. (Opzionale ma consigliato) Garantire ordinamento finale
- Anche se non necessario dopo la nuova condizione, aggiungere un sort finale dell’array data per sicurezza prima del return (protezione futura se la logica cambia).

Risultato atteso
- Se Excel=30/01 e storico include 07/02:
  - nel grafico restano solo i punti storici correttamente ordinati (… 30/01, 07/02)
  - non appare più la seconda “30/01” a destra.

2) Fix identico in PortfolioEvolutionChart.tsx
File: src/components/dashboard/charts/PortfolioEvolutionChart.tsx

- Replicare la stessa strategia:
  - lastSnapshotDate = max su historicalData
  - canAppendCurrent solo se currentDate > lastSnapshotDate
  - de-dup su qualsiasi elemento data.some(...)
  - (Opzionale) sort finale di sicurezza

3) Aggiungere avviso in alto in Dashboard quando Excel è antecedente all’ultimo snapshot
File: src/components/dashboard/Dashboard.tsx

A. Recuperare latestEntry dallo hook useHistoricalData
- In Dashboard oggi destrutturiamo useHistoricalData(portfolio?.id) ma non latestEntry.
- Includere latestEntry.

B. Calcolo condizione warning
- const excelDate = portfolio?.snapshot_date
- const lastSavedSnapshotDate = latestEntry?.snapshot_date
- showWarning = excelDate && lastSavedSnapshotDate && new Date(excelDate) < new Date(lastSavedSnapshotDate)

C. Rendering banner in alto (sotto header o subito sotto ViewModeSelector)
- Usare i componenti UI già presenti:
  - import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
  - icona (es. AlertTriangle da lucide-react) coerente con design
- Testo (come richiesto dall’utente) in evidenza:
  - “Attenzione: Excel caricato con data antecedente all'ultimo snapshot salvato”
- (Consigliato) In description mostrare anche le due date per chiarezza, senza cambiare il messaggio principale:
  - “Excel: 30/01/26 — Ultimo snapshot: 07/02/26”
  - Questo aiuta a capire immediatamente il perché dell’avviso.

4) Verifica rapida (manuale) che userò come checklist
- Scenario riproduzione:
  1) storico contiene snapshot 07/02/2026 (e magari anche 30/01/2026)
  2) carico Excel con snapshot_date = 30/01/2026
- Atteso:
  - il grafico “Evoluzione Rendimento” NON mostra duplicazioni della data
  - l’ordine delle date in ascissa è corretto (… 30/01, 07/02)
  - compare il banner “Attenzione…” in alto
  - benchmark e tooltip non mostrano un “current” fuori contesto
- Scenario normale:
  - carico Excel con data successiva all’ultimo snapshot
  - atteso: nessun banner; il grafico mostra anche il punto corrente (non salvato) come ultimo punto.

Rischi/edge case considerati
- Nessun dato storico: niente warning, e il grafico già mostra lo stato “Nessun dato storico”.
- currentDate uguale a latestEntry.snapshot_date: niente warning e niente duplicazione (de-dup).
- TimeRange non MAX: il warning deve basarsi sul vero ultimo snapshot salvato (non sul filtro), quindi resta corretto.
- Prestazioni: calcolare max date su historicalData è O(n) e n è tipicamente piccolo; trascurabile.

File coinvolti
- src/components/dashboard/charts/PerformanceEvolutionChart.tsx
- src/components/dashboard/charts/PortfolioEvolutionChart.tsx
- src/components/dashboard/Dashboard.tsx
