

## Gestioni Patrimoniali (GP) — Piano di Implementazione

### Panoramica

Aggiungere il supporto per il caricamento di file Excel di Gestioni Patrimoniali (GP), con un formato diverso dal portfolio standard. I dati GP verranno salvati in una tabella dedicata e integrati in tutti i calcoli della dashboard, donut chart e Risk Analyzer.

### Formato del file GP

Il file ha sezioni: **Liquidità**, **Euro -> Azioni**, **USD -> Azioni** (potenzialmente anche Obbligazioni). Colonne: Cod. Tit., Descrizione, Quantita, Controvalore, % Patr., Quotazione, Data quotaz., Cambio, ecc. Le righe "Totale" vanno ignorate.

---

### 1. Database — Nuova tabella `gp_holdings`

Creare una tabella per memorizzare le singole righe della GP:

```sql
CREATE TABLE public.gp_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  asset_type text NOT NULL,       -- 'stock', 'bond', 'cash'
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  market_value numeric NOT NULL DEFAULT 0,
  price numeric,
  currency text DEFAULT 'EUR',
  exchange_rate numeric DEFAULT 1,
  weight_pct numeric,
  ticker_code text,               -- Cod. Tit. dal file
  price_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.gp_holdings ENABLE ROW LEVEL SECURITY;
-- RLS policies: admins ALL, users own portfolios (same pattern as positions)
```

Aggiungere anche colonne `gp_total_value` e `gp_cash_value` alla tabella `portfolios` per il totale GP.

### 2. Parser GP — `src/lib/gpExcelParser.ts`

Nuovo file che:
- Riconosce sezioni: "Liquidità", "-> Azioni", "-> Obbligazioni" in base alle intestazioni
- Estrae per ogni riga: description, quantity, market_value (Controvalore), price (Quotazione), currency, exchange_rate (Cambio), weight_pct (% Patr.)
- Ignora righe "Totale"
- Restituisce `{ holdings: GPHolding[], cashValue: number, totalValue: number }`

### 3. FileUploader — Carousel con 2 slide

**File: `src/components/dashboard/FileUploader.tsx`**

- Wrappare il contenuto in un `Carousel` con 2 slide:
  - Slide 1: "Carica Portfolio" (uploader attuale, invariato)
  - Slide 2: "Carica GP" — stesso layout dropzone ma chiama `parseGPExcel` e salva in `gp_holdings`
- Al caricamento GP: cancella i vecchi `gp_holdings` del portfolio, inserisci i nuovi, aggiorna `portfolios.gp_total_value` e `portfolios.gp_cash_value`

### 4. Hook — `src/hooks/useGPHoldings.ts`

Nuovo hook che:
- Fetcha `gp_holdings` per il portfolio corrente
- Calcola totali per asset_type (stock, bond, cash)
- Supporta aggregazione per viste aggregate

### 5. Tipo Portfolio — aggiungere campi GP

**File: `src/types/portfolio.ts`**
- Aggiungere `gp_total_value?: number | null` e `gp_cash_value?: number | null` a `Portfolio`

### 6. Dashboard — Integrare GP nei totali

**File: `src/components/dashboard/Dashboard.tsx`**
- Importare `useGPHoldings`
- Passare i dati GP a `StatsCards`, `PortfolioDonutChart`, `DynamicPortfolioChart`

**File: `src/hooks/usePortfolio.ts` — `calculateSummary`**
- Se esistono dati GP, sommare al `totalValue` il `gp_total_value`
- Aggiungere le componenti GP (azioni GP, bond GP, cash GP) a `byAssetType` per il donut chart, **oppure** sommarle ai tipi esistenti (stock, bond, cash)

### 7. PositionsTable — Tab "Gestioni Patrimoniali"

**File: `src/components/dashboard/PositionsTable.tsx`**
- Aggiungere tab "GP" nell'array `assetTabs`
- Quando selezionato, mostrare le righe da `gp_holdings` con le colonne appropriate (Descrizione, Quantità, Controvalore, Valuta, Cambio)
- La tabella riceverà i dati GP come prop aggiuntiva

### 8. Donut Chart — Includere GP

**File: `src/components/dashboard/PortfolioDonutChart.tsx`**
- Le componenti GP (azioni, bond, cash) vengono sommate ai rispettivi tipi nel `summary.byAssetType` (gestito nel punto 6)

### 9. Risk Analyzer — Toggle GP

**File: `src/components/risk/EquityExposureView.tsx`**
- Aggiungere stato `includeGP` (default: true)
- Aggiungere toggle "GP" nella sezione toggle
- Se attivo, sommare il valore azionario GP al `dynamicGrandTotal`

**File: `src/components/risk/CurrencyExposureView.tsx`**
- Stesso toggle GP per includere/escludere l'esposizione valutaria della GP

**File: `src/components/risk/SectorAllocationView.tsx`**
- Toggle GP (le azioni GP non hanno settore granulare, quindi vanno come "Gestione Patrimoniale" o escluse)

**File: `src/hooks/useRiskAnalysis.ts`**
- Passare i dati GP e calcolare un `totalGPStockRisk` e `totalGPBondRisk` separati nel `RiskAnalysis`

**File: `src/lib/riskCalculator.ts`**
- Aggiungere campi `totalGPStockRisk`, `totalGPBondRisk`, `gpStockDetails` a `RiskAnalysis`

### 10. Staging Calculator & Snapshot

**File: `src/lib/stagingCalculator.ts`**
- Includere `gp_total_value` nel calcolo del `totalValue`

**File: `src/lib/uploadSnapshot.ts`**
- Includere GP nel totale storico

### 11. Consolidated Holdings (Risk Analyzer)

- Il toggle GP deve funzionare anche nella vista holdings consolidate: se attivo, le azioni GP vengono mostrate nella lista delle holdings

---

### File da creare
- `src/lib/gpExcelParser.ts`
- `src/hooks/useGPHoldings.ts`

### File da modificare
- `src/components/dashboard/FileUploader.tsx` — carousel 2 slide
- `src/components/dashboard/Dashboard.tsx` — integrare GP
- `src/components/dashboard/PositionsTable.tsx` — tab GP
- `src/components/dashboard/PortfolioDonutChart.tsx` — includere GP
- `src/components/dashboard/StatsCards.tsx` — sommare GP ai totali
- `src/types/portfolio.ts` — campi GP su Portfolio
- `src/hooks/usePortfolio.ts` — calculateSummary con GP
- `src/components/risk/EquityExposureView.tsx` — toggle GP
- `src/components/risk/CurrencyExposureView.tsx` — toggle GP
- `src/components/risk/SectorAllocationView.tsx` — toggle GP
- `src/hooks/useRiskAnalysis.ts` — calcolo GP risk
- `src/lib/riskCalculator.ts` — campi GP in RiskAnalysis
- `src/lib/stagingCalculator.ts` — includere GP nel totale
- Migration SQL per `gp_holdings` + colonne su `portfolios`

### Migrazione DB

```sql
-- 1. Tabella gp_holdings
CREATE TABLE public.gp_holdings ( ... );
ALTER TABLE public.gp_holdings ENABLE ROW LEVEL SECURITY;
-- Policies standard (admin ALL, users own portfolios)

-- 2. Colonne GP su portfolios
ALTER TABLE public.portfolios 
  ADD COLUMN gp_total_value numeric DEFAULT 0,
  ADD COLUMN gp_cash_value numeric DEFAULT 0;
```

