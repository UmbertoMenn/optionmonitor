
# Piano: Sincronizzazione Frontend con Aggiornamenti Server-Side

## Problema Attuale

Il sistema presenta una **duplicazione di logica** e un **gap di sincronizzazione**:

### Flusso Attuale (Problematico)

| Componente | Cosa Fa | Problema |
|------------|---------|----------|
| **Cron Job (Server)** | Aggiorna `positions` nel DB ogni 5 min | ✅ Funziona |
| **LivePricesContext (Client)** | Chiama `fetch-market-prices` ogni 5 min | ❌ Duplicato! |
| **usePortfolio (Client)** | Legge dal DB una sola volta | ❌ Non vede gli aggiornamenti |
| **Dashboard/Derivatives/Risk** | Usano dati misti | ⚠️ Inconsistenza |

### Comportamento Attuale
- **Utente online**: Il client chiama le API dei prezzi in parallelo al cron, sovrascrivendo i dati DB
- **Utente offline**: I dati nel DB vengono aggiornati dal cron, ma quando l'utente torna online vede ancora i vecchi dati in cache
- **Cambio pagina**: Nessun refresh dei dati - la cache di React Query mantiene dati stantii

---

## Soluzione Proposta

Unificare il sistema in modo che:
1. **Il cron job rimane l'unica fonte di aggiornamento prezzi**
2. **Il client fa polling sul database** per leggere i dati aggiornati
3. **Tutte le pagine vedono gli stessi dati** provenienti dal database

### Nuova Architettura

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    CRON JOB (ogni 5 min)                            │
│              update-prices-cron → positions table                   │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE (positions)                              │
│  - current_price: aggiornato dal cron                               │
│  - market_value: ricalcolato dal cron                               │
│  - updated_at: timestamp ultimo aggiornamento                       │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            │ POLLING ogni 60 secondi (READ-ONLY)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND                                          │
│                                                                      │
│  usePortfolio() → refetchInterval: 60000                            │
│  LivePricesContext → SEMPLIFICATO (solo tracking direzione)         │
│                                                                      │
│  Dashboard ──┐                                                       │
│  Derivatives ─┼── Tutti leggono dallo stesso hook                   │
│  Risk Analyzer┘                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Modifiche da Implementare

### Fase 1: Aggiungere Polling al Database

**File: `src/hooks/usePortfolio.ts`**

Modificare la query delle posizioni per fare polling ogni 60 secondi:

```typescript
const positionsQuery = useQuery({
  queryKey: ['positions', portfolio?.id],
  queryFn: async () => { ... },
  enabled: !!portfolio?.id,
  refetchInterval: 60000, // Polling ogni 60 secondi
  staleTime: 30000, // Considera i dati freschi per 30 secondi
});
```

### Fase 2: Semplificare LivePricesContext

**File: `src/contexts/LivePricesContext.tsx`**

Rimuovere il polling client-side delle API esterne. Il context diventa solo:
1. **Storage per i prezzi precedenti** (per il feedback visivo 45s)
2. **Tracking della direzione** (up/down)
3. **Nessuna chiamata a fetch-market-prices**

I dati vengono presi direttamente dal database (già aggiornati dal cron).

### Fase 3: Semplificare usePositionsWithLivePrices

**File: `src/hooks/usePositionsWithLivePrices.ts`**

Invece di "applicare prezzi live" ai dati DB, ora:
1. Legge i dati dal DB (già aggiornati dal cron)
2. Confronta con i valori precedenti per calcolare la direzione
3. Passa i dati direttamente alle pagine

### Fase 4: Aggiornare il Feedback Visivo

Il feedback visivo rosso/verde per 45 secondi deve ora basarsi su:
1. Salvare l'ultimo `current_price` noto per ogni posizione
2. Quando il polling porta nuovi dati, confrontare con il vecchio prezzo
3. Applicare la classe CSS appropriata

---

## Vantaggi della Nuova Architettura

| Aspetto | Prima | Dopo |
|---------|-------|------|
| Chiamate API prezzi | Client + Server (duplicato) | Solo Server (cron) |
| Consistenza dati | Potenziale mismatch | Sempre consistente |
| Carico su API esterne | Ogni utente chiama Yahoo/Tradier | Una sola chiamata ogni 5 min |
| Utente offline | Dati nel DB non visibili al ritorno | Vede subito dati aggiornati |
| Pagine sincronizzate | Ognuna può avere dati diversi | Tutte vedono gli stessi dati |

---

## Dettagli Tecnici

### Polling con React Query

```typescript
// usePortfolio.ts
const positionsQuery = useQuery({
  queryKey: ['positions', portfolio?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('portfolio_id', portfolio.id);
    return data as Position[];
  },
  enabled: !!portfolio?.id,
  refetchInterval: 60000,      // Poll ogni 60 secondi
  refetchIntervalInBackground: false, // Non pollare in background
  staleTime: 30000,            // Cache valida per 30s
});
```

### Tracking Direzione Prezzi

```typescript
// LivePricesContext.tsx (semplificato)
interface PriceHistory {
  [positionId: string]: {
    previousPrice: number;
    currentPrice: number;
    direction: 'up' | 'down' | null;
    directionTimestamp: number | null;
  };
}

// Quando arrivano nuovi dati dal DB polling:
function updatePriceHistory(positions: Position[]) {
  const newHistory = {};
  for (const pos of positions) {
    const old = priceHistory[pos.id];
    const direction = 
      !old ? null :
      pos.current_price > old.currentPrice ? 'up' :
      pos.current_price < old.currentPrice ? 'down' : 
      old.direction; // mantieni se invariato
    
    newHistory[pos.id] = {
      previousPrice: old?.currentPrice ?? pos.current_price,
      currentPrice: pos.current_price,
      direction,
      directionTimestamp: direction !== old?.direction ? Date.now() : old?.directionTimestamp,
    };
  }
  setPriceHistory(newHistory);
}
```

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/hooks/usePortfolio.ts` | Aggiungere `refetchInterval: 60000` |
| `src/contexts/LivePricesContext.tsx` | Semplificare: rimuovere fetch API, tenere solo tracking |
| `src/hooks/usePositionsWithLivePrices.ts` | Usare dati DB direttamente, aggiungere tracking direzione |
| `src/components/dashboard/LivePriceBadge.tsx` | Adattare per usare i nuovi dati |
| `src/components/dashboard/LivePriceIndicator.tsx` | Mostrare "ultimo aggiornamento" dal DB |

---

## Indicatore "Ultimo Aggiornamento"

Attualmente `LivePriceIndicator` mostra quando il client ha fatto l'ultimo fetch. Dovrà invece mostrare:
- **L'orario dell'ultimo aggiornamento dal cron** (campo `updated_at` nelle positions)
- Un badge che indica "Server-side" per rassicurare l'utente

---

## Risposta alla Tua Domanda

**No, attualmente le pagine NON si aggiornano automaticamente quando il cron aggiorna il database.**

Il cron job funziona correttamente lato server, ma:
1. Il frontend non rileva le modifiche al database
2. La cache di React Query mantiene i vecchi dati
3. Il `LivePricesContext` fa chiamate duplicate alle API

Con le modifiche proposte:
- Il database diventa la "single source of truth"
- Tutte le pagine (Dashboard, Derivati, Risk Analyzer) vedranno gli stessi dati aggiornati
- Il polling ogni 60 secondi garantisce che l'UI si aggiorni entro 1 minuto dall'aggiornamento server-side
