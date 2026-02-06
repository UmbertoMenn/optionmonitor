
# Piano: Avvisi di Prezzo su Ticker Personalizzati

## Obiettivo

Estendere il sistema di gestione avvisi per permettere all'utente di impostare avvisi di prezzo su ticker che non sono presenti nel portafoglio. Ad esempio, monitorare quando il prezzo di LEU scende sotto 80$ o sale sopra 100$.

## Panoramica delle Modifiche

### 1. Modifica del Titolo del Dialog

**File**: `src/components/derivatives/DerivativesSummaryCard.tsx`

Aggiornare il tooltip/aria-label del pulsante ingranaggio per riflettere la nuova funzionalità.

**File**: `src/components/derivatives/AlertSettingsDialog.tsx`

- Cambiare il titolo da "Gestione Avvisi" a "Gestione avvisi e notifiche"
- Aggiornare la descrizione del dialog

### 2. Nuovo Tab "Prezzo" nel Dialog

**File**: `src/components/derivatives/AlertSettingsDialog.tsx`

Aggiungere un sesto tab chiamato "Prezzo" per gestire gli avvisi di prezzo su ticker personalizzati.

Funzionalita del nuovo tab:
- Campo input per inserire un nuovo ticker (es. LEU)
- Selezione del tipo di avviso: "Sotto soglia" / "Sopra soglia"
- Campo numerico per il valore target (prezzo)
- Switch per abilitare/disabilitare l'avviso
- Lista degli avvisi configurati con possibilita di modifica/eliminazione
- Visualizzazione del prezzo corrente (se disponibile nella cache)

### 3. Nuova Tabella Database: `price_alerts`

Creare una nuova tabella per memorizzare gli avvisi di prezzo personalizzati:

```text
price_alerts
├── id (uuid, PK)
├── user_id (uuid, FK -> auth.users)
├── ticker (text, NOT NULL)
├── direction ('above' | 'below')
├── target_price (numeric, NOT NULL)
├── enabled (boolean, default true)
├── last_triggered_at (timestamp)
├── cooldown_minutes (integer, default 240)
├── created_at (timestamp)
├── updated_at (timestamp)
```

Con indice unico su `(user_id, ticker, direction, target_price)` e RLS policies per l'utente proprietario.

### 4. Nuovo Tipo di Alert

**File**: `src/types/alerts.ts`

Aggiungere un nuovo tipo di alert:
- `PRICE_ALERT_ABOVE` = 'price_alert_above'
- `PRICE_ALERT_BELOW` = 'price_alert_below'

Questi dovranno essere aggiunti anche all'enum nel database.

### 5. Nuovo Hook per Price Alerts

**File**: `src/hooks/usePriceAlerts.ts` (nuovo file)

```text
Funzioni esportate:
├── usePriceAlerts()        - Fetch avvisi prezzo dell'utente
├── useCreatePriceAlert()   - Crea nuovo avviso
├── useUpdatePriceAlert()   - Aggiorna avviso esistente
├── useDeletePriceAlert()   - Elimina avviso
└── useTogglePriceAlert()   - Abilita/disabilita
```

### 6. Integrazione con Sistema di Caching Prezzi

Per i ticker non presenti nel portafoglio:

1. **Al salvataggio dell'avviso**: 
   - Chiamare `fetch-underlying-prices` per validare il ticker
   - Salvare il mapping in `underlying_mappings`
   - Se valido, salvare il prezzo iniziale in `underlying_prices`

2. **Nel cron job `update-underlying-prices-cron`**:
   - Aggiungere query per recuperare i ticker dalla nuova tabella `price_alerts`
   - Unire con i ticker esistenti da stock e derivati

### 7. Integrazione nel Sistema di Alert

**File**: `supabase/functions/check-alerts/index.ts`

Aggiungere logica per controllare gli avvisi di prezzo:

```text
Per ogni price_alert abilitato:
├── Recupera prezzo corrente da underlying_prices
├── Confronta con target_price
├── Se direction = 'below' e price <= target -> trigger
├── Se direction = 'above' e price >= target -> trigger
├── Rispetta cooldown e logica di stato
└── Genera alert con messaggio appropriato
```

## Modifiche Tecniche Dettagliate

### Database Migration

```sql
-- Aggiungere nuovi tipi alert all'enum
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'price_alert_above';
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'price_alert_below';

-- Nuova tabella price_alerts
CREATE TABLE public.price_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    ticker text NOT NULL,
    direction text NOT NULL CHECK (direction IN ('above', 'below')),
    target_price numeric NOT NULL CHECK (target_price > 0),
    enabled boolean NOT NULL DEFAULT true,
    last_triggered_at timestamptz,
    cooldown_minutes integer NOT NULL DEFAULT 240,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, ticker, direction, target_price)
);

-- Indici
CREATE INDEX idx_price_alerts_user_enabled ON price_alerts(user_id, enabled);
CREATE INDEX idx_price_alerts_ticker ON price_alerts(ticker);

-- RLS
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own price alerts"
    ON price_alerts FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own price alerts"
    ON price_alerts FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own price alerts"
    ON price_alerts FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own price alerts"
    ON price_alerts FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER set_price_alerts_updated_at
    BEFORE UPDATE ON price_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### UI del Nuovo Tab

Il tab "Prezzo" mostra:

```text
┌─────────────────────────────────────────────────────────┐
│ Crea avvisi di prezzo su qualsiasi ticker, anche se    │
│ non presente nel tuo portafoglio.                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌───────────────────────────────────────────────────┐  │
│ │ Nuovo avviso                                       │  │
│ │                                                    │  │
│ │ Ticker: [____LEU____]  Verifica ✓                 │  │
│ │                                                    │  │
│ │ Tipo: ○ Sotto soglia  ● Sopra soglia              │  │
│ │                                                    │  │
│ │ Prezzo target: [___100.00___] USD                 │  │
│ │                                                    │  │
│ │ [+ Aggiungi avviso]                               │  │
│ └───────────────────────────────────────────────────┘  │
│                                                         │
│ ┌───────────────────────────────────────────────────┐  │
│ │ Avvisi configurati                                 │  │
│ │                                                    │  │
│ │ LEU  ↑ > 100.00$  [Toggle ●]        [🗑]          │  │
│ │      Prezzo attuale: 85.50$                       │  │
│ │                                                    │  │
│ │ LEU  ↓ < 70.00$   [Toggle ●]        [🗑]          │  │
│ │      Prezzo attuale: 85.50$                       │  │
│ │                                                    │  │
│ │ SOFI ↓ < 8.00$    [Toggle ○]        [🗑]          │  │
│ │      Prezzo attuale: 9.25$                        │  │
│ └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Modifica Cron Job

**File**: `supabase/functions/update-underlying-prices-cron/index.ts`

Aggiungere query per recuperare ticker da price_alerts:

```typescript
// Step 2.5: Get tickers from price_alerts
const { data: priceAlerts } = await supabase
  .from('price_alerts')
  .select('ticker')
  .eq('enabled', true);

const tickersFromPriceAlerts = [...new Set(
  priceAlerts?.map(p => p.ticker).filter(Boolean) || []
)];

// Merge with existing tickers
const uniqueTickers = [...new Set([
  ...tickersFromStocks, 
  ...tickersFromDerivatives,
  ...tickersFromPriceAlerts
])];
```

### Modifica Check Alerts

**File**: `supabase/functions/check-alerts/index.ts`

Aggiungere funzione per controllare price alerts:

```typescript
async function checkPriceAlerts(
  supabase: any,
  userId: string,
  underlyingPrices: Map<string, number>
) {
  // Fetch enabled price alerts for user
  const { data: alerts } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true);

  for (const alert of alerts || []) {
    const currentPrice = underlyingPrices.get(alert.ticker);
    if (!currentPrice) continue;

    const isTriggered = alert.direction === 'above' 
      ? currentPrice >= alert.target_price
      : currentPrice <= alert.target_price;

    if (isTriggered) {
      // Check cooldown, generate alert, update last_triggered_at
    }
  }
}
```

## Riepilogo File da Modificare/Creare

| File | Azione |
|------|--------|
| `src/components/derivatives/AlertSettingsDialog.tsx` | Modifica titolo + nuovo tab |
| `src/types/alerts.ts` | Aggiunta nuovi tipi alert |
| `src/hooks/usePriceAlerts.ts` | Nuovo file |
| `supabase/functions/update-underlying-prices-cron/index.ts` | Aggiunta query price_alerts |
| `supabase/functions/check-alerts/index.ts` | Logica verifica price alerts |
| Database migration | Nuova tabella + enum update |

## Flusso Utente

1. Utente apre "Gestione avvisi e notifiche"
2. Seleziona tab "Prezzo"
3. Inserisce ticker (es. LEU)
4. Il sistema verifica il ticker tramite Yahoo Finance
5. Se valido, l'utente imposta direzione e prezzo target
6. Salva l'avviso
7. Il cron job inizia a monitorare il prezzo
8. Quando la condizione e soddisfatta, l'utente riceve notifica via email/Telegram
