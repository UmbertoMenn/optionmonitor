
# Piano: Aggiornamento Solo Azioni + Correzione Controvalore con Cambio

## Problema Identificato

### 1. Cron Job Aggiorna Troppi Asset
Attualmente l'edge function `update-prices-cron` aggiorna:
- Azioni (stock) ✓ da mantenere
- ETF ✗ da rimuovere
- Commodities ✗ da rimuovere

### 2. Market Value Non Considera il Cambio
Il calcolo attuale nel cron job:
```
market_value = current_price × quantity
```

Dovrebbe essere:
```
market_value = current_price × quantity / exchange_rate  (per valute diverse da EUR)
```

**Esempio AMD (currency: USD, exchange_rate: 1.197)**:
| Campo | Valore Attuale | Valore Corretto |
|-------|----------------|-----------------|
| current_price | 236.73 USD | 236.73 USD |
| quantity | 700 | 700 |
| market_value | 165,711 (errato) | **138,438 EUR** |

---

## Soluzione Proposta

### Modifiche all'Edge Function

**File**: `supabase/functions/update-prices-cron/index.ts`

**1. Limitare agli Asset Type "stock" soltanto**:
```typescript
// DA
.in('asset_type', ['stock', 'etf', 'commodity', 'Stock', 'ETF', 'Commodity']);

// A
.in('asset_type', ['stock', 'Stock']);
```

**2. Aggiornare il Tasso di Cambio in Tempo Reale**:
Aggiungere una funzione per recuperare i tassi di cambio EUR/USD e EUR/HKD da Yahoo Finance (EURUSD=X, EURHKD=X).

**3. Correggere il Calcolo del Market Value**:
```typescript
// Recupera exchange rate attuale
let exchangeRate = 1;
if (position.currency === 'USD') {
  exchangeRate = await fetchExchangeRate('EURUSD=X');
} else if (position.currency === 'HKD') {
  exchangeRate = await fetchExchangeRate('EURHKD=X');
}

// Calcola market_value in EUR
const newMarketValue = (priceData.price * position.quantity) / exchangeRate;

// Aggiorna anche l'exchange_rate nella posizione
await supabase
  .from('positions')
  .update({
    current_price: priceData.price,
    market_value: newMarketValue,
    exchange_rate: exchangeRate,
    updated_at: new Date().toISOString(),
  })
  .eq('id', position.id);
```

---

## Architettura Aggiornata

```text
┌─────────────────────┐     ogni 5 min      ┌───────────────────────┐
│    pg_cron Job      │ ──────────────────► │  update-prices-cron   │
│  (lun-ven 9-23 IT)  │                     │    Edge Function      │
└─────────────────────┘                     └───────────┬───────────┘
                                                        │
                              ┌─────────────────────────┼────────────────────────┐
                              │                         │                        │
                              ▼                         ▼                        ▼
                    ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
                    │ Yahoo Finance   │      │ Yahoo Finance   │      │    positions    │
                    │  Stock Prices   │      │  Exchange Rates │      │   (SOLO AZIONI) │
                    │  (AAPL, GOOGL)  │      │  (EURUSD=X)     │      │                 │
                    └─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## Flusso di Calcolo Corretto

```text
Per ogni azione (stock):
│
├─► Recupera prezzo da Yahoo (es. 236.73 USD)
│
├─► Recupera cambio EUR/USD live (es. 1.04)
│
├─► Calcola: market_value = (236.73 × 700) / 1.04 = 159,324 EUR
│
└─► Aggiorna database: current_price, market_value, exchange_rate
```

---

## Dettaglio Tecnico

### Nuova Funzione per Exchange Rates

```typescript
async function fetchExchangeRate(pair: string): Promise<number> {
  // pair = "EURUSD=X" o "EURHKD=X"
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${pair}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0...' },
    });
    
    const data = await response.json();
    const rate = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    
    return rate || 1;
  } catch (error) {
    console.error(`Failed to fetch ${pair}:`, error);
    return 1; // fallback a 1 (nessuna conversione)
  }
}
```

### Posizioni da Aggiornare

| Valuta | Count | Ticker Cambio |
|--------|-------|---------------|
| USD | 32 azioni | EURUSD=X |
| HKD | 2 azioni (Alibaba HK, Tencent) | EURHKD=X |
| EUR | 0 azioni | N/A |

---

## Correzione Dati Esistenti

Dopo il deploy, eseguire un aggiornamento manuale per correggere i market_value esistenti con i nuovi tassi di cambio.

---

## File da Modificare

| File | Azione |
|------|--------|
| `supabase/functions/update-prices-cron/index.ts` | Modificare filtro asset_type + aggiungere logica exchange rate |
| Database: `positions` | I market_value verranno corretti automaticamente al prossimo ciclo |

---

## Risultato Atteso

**Prima (errato)**:
```
AMD: 700 × 236.73 = 165,711 EUR ❌
```

**Dopo (corretto)**:
```
AMD: 700 × 236.73 / 1.04 = 159,324 EUR ✓
```

---

## Note Importanti

- Gli ETF e le commodities NON verranno più aggiornati automaticamente
- Se in futuro si volessero aggiornare anche ETF/commodities, sarà sufficiente riaggiungere gli asset_type al filtro
- Il tasso di cambio viene salvato nella colonna `exchange_rate` per ogni posizione, permettendo un calcolo retroattivo corretto

