
# Piano: Gestione Ticker nel Dialog Avvisi

## Problema Identificato

Nel dialog "Gestione Avvisi", l'utente deve inserire manualmente i ticker per gli override, ma:
1. Il placeholder dice "Es. APPLOVIN" che NON è un ticker valido (il ticker corretto è "APP")
2. L'utente non vede quali ticker sono disponibili dalle sue strategie/posizioni
3. Se il sistema non riconosce un ticker, non c'è modo di correggerlo

## Soluzione

Mostrare nel dialog un **elenco selezionabile** dei ticker già risolti dalle strategie dell'utente, senza duplicati, e permettere l'inserimento manuale con salvataggio dell'override per il futuro.

---

## Modifiche Previste

### 1. Passare i dati delle strategie al Dialog

**File**: `src/components/derivatives/DerivativesSummaryCard.tsx`

Il dialog `AlertSettingsDialog` attualmente non riceve dati sulle strategie. Devo passargli:
- `categories` (le strategie categorizzate)
- `underlyingPrices` (contiene i ticker risolti dalla edge function)

Questo permetterà di estrarre i ticker unici già risolti.

---

### 2. Mostrare i Ticker Disponibili nel Tab "Per Ticker"

**File**: `src/components/derivatives/AlertSettingsDialog.tsx`

Modifiche:
- Ricevere `categories` e `underlyingPrices` come props
- Estrarre i ticker unici da tutte le strategie (IC, DD, CC, NP, Leap, etc.)
- Mostrare una **lista cliccabile** dei ticker disponibili sopra il campo di input
- Se un ticker NON è stato risolto (es. "APPLOVIN INC" senza mapping), mostrarlo con un badge "⚠️ Ticker sconosciuto" e permettere all'utente di inserire manualmente il ticker corretto
- Salvare l'override nella tabella `underlying_mappings` per uso futuro (per singolo utente? No, la tabella è globale, quindi beneficerà tutti)

**Nuova UI Tab "Per Ticker"**:

```text
┌─────────────────────────────────────────────────────────────┐
│ Ticker disponibili dalle tue strategie:                     │
│                                                             │
│  [AAPL] [AMZN] [APP] [GOOGL] [NVDA] [MSFT] [TSLA]          │
│                                                             │
│  Clicca su un ticker per aggiungere un override             │
│                                                             │
│ ⚠️ Ticker non risolti:                                      │
│  PINDUODUO INC → [inserisci ticker] [Salva]                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Override configurati:                                       │
│                                                             │
│  [APP]  ──────●────────── 10%  [🗑️]                        │
│  [NVDA] ─────────●─────── 5%   [🗑️]                        │
│                                                             │
│ + Aggiungi manualmente: [__________] [Aggiungi]            │
└─────────────────────────────────────────────────────────────┘
```

---

### 3. Estrarre i Ticker Unici dalle Strategie

Nuova funzione helper per estrarre i ticker da tutte le categorie:

```typescript
function extractUniqueTickers(
  categories: DerivativeCategories,
  underlyingPrices: Record<string, UnderlyingPrice>
): { 
  resolved: Array<{ underlying: string; ticker: string }>;
  unresolved: string[];
} {
  const allUnderlyings = new Set<string>();
  
  // Raccoglie tutti gli underlying da IC, DD, CC, NP, Leap, etc.
  categories.ironCondors.forEach(ic => allUnderlyings.add(ic.underlying));
  categories.doubleDiagonals.forEach(dd => allUnderlyings.add(dd.underlying));
  categories.coveredCalls.forEach(cc => allUnderlyings.add(cc.option.underlying || ''));
  categories.nakedPuts.forEach(np => allUnderlyings.add(np.option.underlying || ''));
  categories.leapCalls.forEach(lc => allUnderlyings.add(lc.option.underlying || ''));
  categories.groupedOtherStrategies.forEach(g => allUnderlyings.add(g.underlying));
  
  const resolved: Array<{ underlying: string; ticker: string }> = [];
  const unresolved: string[] = [];
  
  for (const underlying of allUnderlyings) {
    if (!underlying) continue;
    
    const priceData = underlyingPrices[underlying];
    if (priceData?.ticker) {
      // Già risolto - evita duplicati per ticker
      if (!resolved.some(r => r.ticker === priceData.ticker)) {
        resolved.push({ underlying, ticker: priceData.ticker });
      }
    } else {
      unresolved.push(underlying);
    }
  }
  
  return { 
    resolved: resolved.sort((a, b) => a.ticker.localeCompare(b.ticker)),
    unresolved: unresolved.sort()
  };
}
```

---

### 4. Permettere l'Override Manuale per Ticker Non Risolti

Se un underlying non ha un ticker risolto, l'utente può inserirlo manualmente. Questo viene salvato nella tabella `underlying_mappings` con `source: 'manual-alert-config'`.

**Nuova funzione nel hook o componente**:

```typescript
async function saveTickerMapping(underlying: string, ticker: string): Promise<void> {
  await supabase
    .from('underlying_mappings')
    .upsert({
      underlying,
      ticker: ticker.toUpperCase(),
      source: 'manual-alert-config',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'underlying' });
}
```

---

### 5. Aggiornare il Placeholder e Rimuovere Esempio Errato

Nel campo di input manuale, cambiare:
- Da: `placeholder="Es. APPLOVIN"`
- A: `placeholder="Es. APP, NVDA"`

---

## Riassunto File da Modificare

| File | Modifica |
|------|----------|
| `src/components/derivatives/DerivativesSummaryCard.tsx` | Passare `categories` e `underlyingPrices` al Dialog |
| `src/components/derivatives/AlertSettingsDialog.tsx` | Ricevere props, estrarre ticker, mostrare lista selezionabile, gestire override manuali per ticker non risolti |

---

## Flusso Utente

1. L'utente apre il dialog "Gestione Avvisi"
2. Nel tab "Per Ticker" vede:
   - Lista di ticker già risolti dalle sue strategie (es. AAPL, AMZN, APP, NVDA...)
   - Eventuali underlying non risolti con possibilità di inserire il ticker manualmente
3. Clicca su un ticker per aggiungerlo agli override
4. Configura la soglia con lo slider
5. Salva → il ticker viene usato per gli avvisi personalizzati
6. Se ha inserito un override manuale, questo viene salvato globalmente per uso futuro

---

## Considerazioni sulla Tabella `underlying_mappings`

La tabella è globale (non ha `user_id`), quindi:
- Gli override manuali beneficeranno tutti gli utenti
- Il campo `source` distingue i mapping: `'manual'`, `'fetch-underlying-prices'`, `'manual-alert-config'`

Questo è coerente con la memoria del sistema che indica che i mapping sono condivisi globalmente.
