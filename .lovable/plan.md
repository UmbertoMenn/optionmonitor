

# Piano: Sistema Override Manuale con Accoppiamento Titoli e Strategie Multi-Gamba

## Problema

L'algoritmo automatico sbaglia a classificare alcune opzioni (es. NETEASE, ENI). Serve un sistema che permetta:

1. Spostare opzioni in categorie diverse
2. **Accoppiare opzioni con titoli** (per Covered Call/Protezioni) con controllo sui titoli "liberi"
3. **Accoppiare 4 opzioni insieme** per formare Iron Condor o Double Diagonal

## Soluzione

### Flusso Utente

```text
SCENARIO 1: Spostare in Covered Call
-----------------------------------------
Opzione NETEASE CALL venduta in "Altre Strategie"
       |
       v
Click su icona "Sposta"
       |
       v
Menu: [Covered Call] [Protezione] [Iron Condor] [Double Diagonal] [...]
       |
       v
Seleziona "Covered Call"
       |
       v
Dialog mostra titoli liberi:
  - AZ.NETEASE INC-ADR (200 azioni) - 100 usate da altra CC
  - [Seleziona questo titolo]
       |
       v
Conferma -> NETEASE appare in Covered Call


SCENARIO 2: Creare Iron Condor manuale
-----------------------------------------
4 opzioni NETEASE in "Altre Strategie" (non riconosciute)
       |
       v
Click su "Crea strategia manuale" nell'header "Altre Strategie"
       |
       v
Dialog wizard:
  1. Seleziona tipo: [Iron Condor] [Double Diagonal]
  2. Seleziona sottostante: [NETEASE]
  3. Seleziona 4 gambe:
     - PUT venduta: NETEASE 120 FEB/26
     - PUT comprata: NETEASE 100 FEB/26
     - CALL venduta: NETEASE 160 FEB/26
     - CALL comprata: NETEASE 180 FEB/26
       |
       v
Conferma -> Iron Condor appare nella sezione dedicata
```

---

## Architettura Tecnica

### 1. Nuova tabella: `derivative_overrides`

```sql
CREATE TABLE public.derivative_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL,
  
  -- Tipo di override
  override_type TEXT NOT NULL CHECK (override_type IN (
    'single',      -- Singola opzione spostata
    'multi_leg'    -- Strategia multi-gamba creata manualmente
  )),
  
  -- Per override singoli
  position_id UUID,                    -- FK all'opzione
  target_category TEXT,                -- covered_call, protection, naked_put, leap_call, other
  linked_stock_id UUID,                -- FK al titolo accoppiato (per covered call/protezione)
  
  -- Per strategie multi-gamba
  strategy_type TEXT,                  -- iron_condor, double_diagonal
  sold_put_id UUID,
  bought_put_id UUID,
  sold_call_id UUID,
  bought_call_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_single CHECK (
    override_type != 'single' OR (position_id IS NOT NULL AND target_category IS NOT NULL)
  ),
  CONSTRAINT valid_multi_leg CHECK (
    override_type != 'multi_leg' OR (
      strategy_type IS NOT NULL AND 
      sold_put_id IS NOT NULL AND bought_put_id IS NOT NULL AND
      sold_call_id IS NOT NULL AND bought_call_id IS NOT NULL
    )
  )
);
```

### 2. Tracking Titoli Liberi

Nuovo calcolo per determinare quante azioni sono ancora disponibili per nuove covered call:

```typescript
interface AvailableStock {
  position: Position;
  totalShares: number;
  usedShares: number;      // Usate da covered call esistenti
  availableShares: number; // Libere per nuove associazioni
  availableContracts: number;
}

function calculateAvailableStocks(
  stockPositions: Position[],
  existingCoveredCalls: CoveredCallPosition[],
  manualOverrides: DerivativeOverride[]
): AvailableStock[] {
  // 1. Somma tutte le azioni per sottostante
  // 2. Sottrai quelle usate da covered call automatiche
  // 3. Sottrai quelle usate da override manuali
  // 4. Ritorna lista con disponibilita
}
```

### 3. Nuovi Componenti UI

| Componente | Funzione |
|------------|----------|
| `MoveOptionMenu.tsx` | Dropdown su ogni riga opzione con categorie target |
| `LinkStockDialog.tsx` | Dialog per selezionare il titolo da accoppiare |
| `CreateMultiLegDialog.tsx` | Wizard per creare Iron Condor/Double Diagonal manuale |
| `OverrideBadge.tsx` | Badge "Manuale" per indicare override attivo |
| `AvailableStocksSelector.tsx` | Lista titoli liberi con quantita disponibile |

### 4. Modifiche a `categorizeDerivatives`

```typescript
export function categorizeDerivatives(
  derivatives: Position[],
  allPositions: Position[],
  overrides?: DerivativeOverride[]  // NUOVO parametro
): DerivativeCategories {
  
  // STEP 0: Applica override manuali PRIMA della logica automatica
  const { 
    manualCoveredCalls,
    manualProtections,
    manualIronCondors,
    manualDoubleDiagonals,
    usedByOverrides,
    usedStockShares  // Map<stockId, sharesUsed>
  } = applyManualOverrides(derivatives, allPositions, overrides);
  
  // Aggiungi alle categorie
  coveredCalls.push(...manualCoveredCalls);
  longPuts.push(...manualProtections);
  ironCondors.push(...manualIronCondors);
  doubleDiagonals.push(...manualDoubleDiagonals);
  
  // Escludi posizioni con override dalla logica automatica
  const autoDerivatives = derivatives.filter(d => !usedByOverrides.has(d.id));
  
  // STEP 1-7: Logica automatica esistente
  // MA: considera usedStockShares quando calcola copertura
}
```

### 5. Hook: `useDerivativeOverrides`

```typescript
interface DerivativeOverride {
  id: string;
  portfolioId: string;
  overrideType: 'single' | 'multi_leg';
  
  // Per single
  positionId?: string;
  targetCategory?: OverrideCategory;
  linkedStockId?: string;
  
  // Per multi_leg
  strategyType?: 'iron_condor' | 'double_diagonal';
  soldPutId?: string;
  boughtPutId?: string;
  soldCallId?: string;
  boughtCallId?: string;
}

function useDerivativeOverrides() {
  return {
    overrides,
    isLoading,
    
    // Operazioni singole
    moveToCategory: (positionId, category, linkedStockId?) => {},
    removeOverride: (positionId) => {},
    
    // Operazioni multi-gamba
    createIronCondor: (soldPutId, boughtPutId, soldCallId, boughtCallId) => {},
    createDoubleDiagonal: (soldPutId, boughtPutId, soldCallId, boughtCallId) => {},
    removeMultiLeg: (overrideId) => {},
    
    // Utility
    getAvailableStocks: (underlying: string) => AvailableStock[],
    getUnassignedOptions: () => Position[]
  };
}
```

---

## File da Creare/Modificare

| File | Azione | Descrizione |
|------|--------|-------------|
| Migrazione SQL | Creare | Tabella `derivative_overrides` con RLS |
| `src/types/derivativeOverrides.ts` | Creare | Tipi per override |
| `src/hooks/useDerivativeOverrides.ts` | Creare | Hook CRUD + calcolo titoli liberi |
| `src/components/derivatives/MoveOptionMenu.tsx` | Creare | Menu dropdown per spostare |
| `src/components/derivatives/LinkStockDialog.tsx` | Creare | Dialog selezione titolo |
| `src/components/derivatives/CreateMultiLegDialog.tsx` | Creare | Wizard Iron Condor/Double Diagonal |
| `src/components/derivatives/OverrideBadge.tsx` | Creare | Indicatore visivo |
| `src/lib/derivativeStrategies.ts` | Modificare | Applicare override prima di auto-classificazione |
| `src/pages/Derivatives.tsx` | Modificare | Integrare menu e dialogs |

---

## Interazione UI Dettagliata

### Menu Spostamento (su ogni riga opzione)

```
[Icona Sposta] -> Dropdown:
  |
  +-- Sposta in Covered Call...    (solo per CALL vendute)
  |     |
  |     +-- [Dialog selezione titolo con disponibilita]
  |
  +-- Sposta in Protezione...      (solo per PUT comprate)
  |     |
  |     +-- [Dialog selezione titolo con disponibilita]
  |
  +-- Sposta in Naked Put          (solo per PUT vendute)
  +-- Sposta in Leap Call          (solo per CALL comprate)
  +-- Sposta in Altre Strategie
  |
  +-- [Rimuovi override]           (solo se gia presente)
```

### Dialog Selezione Titolo

```
+------------------------------------------+
|  Accoppia con Titolo                     |
+------------------------------------------+
|  CALL NETEASE 145 FEB/26 (-1 contratto)  |
|                                          |
|  Seleziona il titolo da coprire:         |
|                                          |
|  [ ] AZ.NETEASE INC-ADR                  |
|      200 azioni totali                   |
|      100 azioni usate (altra CC)         |
|      100 azioni disponibili (1 contratto)|
|                                          |
|  [Annulla]              [Conferma]       |
+------------------------------------------+
```

### Wizard Creazione Multi-Gamba

```
+------------------------------------------+
|  Crea Strategia Manuale                  |
+------------------------------------------+
|  Step 1: Tipo Strategia                  |
|  ( ) Iron Condor                         |
|  ( ) Double Diagonal                     |
|                                          |
|  Step 2: Seleziona Gambe                 |
|                                          |
|  PUT Venduta:   [Dropdown opzioni disp]  |
|  PUT Comprata:  [Dropdown opzioni disp]  |
|  CALL Venduta:  [Dropdown opzioni disp]  |
|  CALL Comprata: [Dropdown opzioni disp]  |
|                                          |
|  [Annulla]              [Crea Strategia] |
+------------------------------------------+
```

---

## Validazioni

1. **Covered Call**: Solo CALL vendute, titolo deve avere azioni libere sufficienti
2. **Protezione**: Solo PUT comprate, titolo deve esistere
3. **Iron Condor**: 4 gambe con stesso sottostante, stessa scadenza, strikes validi
4. **Double Diagonal**: 4 gambe, vendute stessa scadenza, comprate stessa scadenza piu lunga

---

## Indicatori Visivi

- **Badge "M"** (blu): Override manuale attivo
- **Tooltip**: "Classificazione manuale - clicca per rimuovere"
- **Barra disponibilita titoli**: Mostra visivamente quante azioni sono libere

