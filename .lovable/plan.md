## Obiettivo

Rendere il toggle "Protezioni" deterministico per tutti i ticker con DR-CC (reale o sintetica) o Protezione pura (long PUT), eliminando i doppi calcoli tra Risk Analyzer e Holdings Consolidate.

## Modifiche

### 1. `src/lib/riskCalculator.ts` — single source of truth
Per ogni stock reale, popolare in `StockRiskDetail`:
- `riskEURWithoutProtection`: rischio senza la PUT di protezione DR-CC e senza pure long PUT (mantiene il cap della CC).
- `riskEUR`: come oggi (con DR-CC.protectionPut + long PUT pure applicate).
- `protectionSavingsEUR = riskEURWithoutProtection − riskEUR`.
- `hasProtection = true` se la DR-CC ha `protectionPut` **oppure** esiste una long PUT pura mappata su quel ticker.
- Aggiungere `drccProtectionStrike` / `drccProtectionContracts` per i tooltip.

Per le sintetiche (già presenti):
- Confermare `synthetic.riskEURWithoutProtection` (senza la long PUT di protezione) e `synthetic.riskEUR` (con protezione) coerenti.

### 2. `src/lib/sectorExposure.ts`
In `calculateConsolidatedTopHoldings`:
- Rimuovere il calcolo locale di `putSavingsEUR`.
- `stockRiskGross = stock.riskEURWithoutProtection` (+ `synthetic.riskEURWithoutProtection`).
- `stockRiskNet = stock.riskEUR` (+ `synthetic.riskEUR`).
- Il toggle `includeProtections` sceglie tra i due valori per ogni riga.

### 3. `src/components/risk/EquityExposureView.tsx`
- Totali: `grossPureStockRisk = Σ riskEURWithoutProtection` (reale + sintetico), `netStockRisk = Σ riskEUR`.
- Lista ticker e ordinamento usano gli stessi valori.
- Badge "Protezione" verde quando `hasProtection` (sia per DR-CC reale che sintetica che long PUT pura).

### 4. `src/components/risk/HoldingBreakdownDialog.tsx`
- Mostrare riga "Protezione DR-CC: −X €" anche per i DR-CC reali (oggi visibile solo per le sintetiche), usando `protectionSavingsEUR` e `drccProtectionStrike/Contracts`.

### 5. Test di regressione (`src/lib/__tests__/`)
- DR-CC reale (es. Baidu/ASTS) reagisce al toggle.
- DR-CC sintetica reagisce al toggle.
- Protezione pura (long PUT) reagisce al toggle.
- Long PUT dentro put spread / diagonal / iron condor / double diagonal **non** riducono il rischio stock.
- Holdings Consolidate e Risk Analyzer mostrano lo stesso `protectionSavingsEUR` per ogni ticker.

## Garanzie
- Una sola fonte di verità: `riskCalculator`. Tutti gli altri moduli leggono i suoi campi senza ricalcolare.
- Solo DR-CC.protectionPut e "Protezione pura (long PUT)" contano come protezione stock. Tutte le altre PUT comprate (spread/condor/diagonali) sono ignorate ai fini del toggle.
