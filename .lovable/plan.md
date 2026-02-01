

# Piano: Fix Auto-Creazione Settori per Stock Mancanti

## Problema Identificato

Il sistema ha le funzioni AI (`fetchSectorWithAI`) implementate correttamente, ma **non vengono mai chiamate** perché:

| Fase | Codice Attuale | Problema |
|------|----------------|----------|
| Upload Excel | Posizioni salvate con ISIN | ✅ OK |
| Risk Analyzer | `useSectorMappings` cerca in `isin_mappings` | ❌ Molti ISIN non esistono nella tabella |
| Edge function `update-sectors` | Aggiorna solo record con `sector IS NULL` | ❌ Cerca solo record **già esistenti** |

**Dati dal database**:
- 60 posizioni stock con ISIN
- Solo 31 record in `isin_mappings` (18 senza sector)
- Molti stock (Alphabet, JPM, ecc.) non hanno proprio il record

---

## Causa Root

La funzione `updateMissingSectors` (linee 525-582 in `update-prices-cron/index.ts`) fa:
```typescript
// PROBLEMA: cerca solo record GIÀ ESISTENTI con sector=null
let query = supabase
  .from('isin_mappings')
  .select('isin, ticker')
  .is('sector', null);  // ← Solo esistenti!
```

**Non crea mai nuovi record per ISIN sconosciuti.**

---

## Soluzione

Modificare `useSectorMappings.ts` per:
1. Identificare ISIN che **non esistono** in `isin_mappings`
2. Chiamare l'edge function con modalità `resolve-and-get-sectors` 
3. L'edge function dovrà **creare i record** con ISIN → Ticker → Sector (via Yahoo + AI fallback)

### Modifiche Tecniche

#### 1. Nuovo Modo `resolve-and-get-sectors` in Edge Function

**File**: `supabase/functions/update-prices-cron/index.ts`

Aggiungere un nuovo handler che:
1. Riceve lista di ISIN
2. Per ogni ISIN:
   - Se esiste in `isin_mappings` con sector → skip
   - Se esiste senza sector → aggiorna con AI
   - Se **non esiste** → crea nuovo record (resolve ticker + get sector via AI)

```typescript
// Nuovo handler per risolvere ISIN mancanti completamente
if (body.mode === 'resolve-and-get-sectors') {
  const isins = body.isins || [];
  const results = [];
  
  for (const isin of isins) {
    // 1. Check if mapping exists
    const { data: existing } = await supabase
      .from('isin_mappings')
      .select('ticker, sector')
      .eq('isin', isin)
      .single();
    
    if (existing?.sector) {
      // Already has sector, skip
      results.push({ isin, sector: existing.sector, source: 'cache' });
      continue;
    }
    
    // 2. Need to resolve or update
    let ticker = existing?.ticker;
    
    if (!ticker) {
      // Resolve ISIN to ticker via Yahoo Search
      const searchResult = await searchYahooByISIN(isin);
      ticker = searchResult?.ticker || null;
    }
    
    if (!ticker) {
      results.push({ isin, sector: null, error: 'Could not resolve ticker' });
      continue;
    }
    
    // 3. Get sector (Yahoo + AI fallback)
    const sectorInfo = await fetchYahooSectorInfo(ticker, '');
    
    // 4. Save to database (UPSERT)
    await supabase.from('isin_mappings').upsert({
      isin,
      ticker,
      sector: sectorInfo.sector,
      industry: sectorInfo.industry,
      source: sectorInfo.sector ? 'ai' : 'unknown',
      last_verified_at: new Date().toISOString()
    }, { onConflict: 'isin' });
    
    results.push({ 
      isin, 
      ticker, 
      sector: sectorInfo.sector, 
      source: 'resolved' 
    });
  }
  
  return new Response(JSON.stringify({ success: true, results }), ...);
}
```

#### 2. Modificare `useSectorMappings.ts`

**File**: `src/hooks/useSectorMappings.ts`

Cambiare la logica per:
1. Trovare ISIN **completamente mancanti** (non in tabella)
2. Chiamare il nuovo endpoint `resolve-and-get-sectors`

```typescript
const fetchMappings = useCallback(async (isins: string[]) => {
  // 1. Fetch existing mappings
  const { data } = await supabase
    .from('isin_mappings')
    .select('isin, ticker, sector, industry')
    .in('isin', isins);
  
  // 2. Build lookup and find missing
  const existingIsins = new Set(data?.map(d => d.isin) || []);
  const missingIsins = isins.filter(isin => !existingIsins.has(isin));
  const needsSectorUpdate = data?.filter(d => d.ticker && !d.sector).map(d => d.isin) || [];
  
  // 3. All ISINs that need resolution (missing + no sector)
  const toResolve = [...new Set([...missingIsins, ...needsSectorUpdate])];
  
  if (toResolve.length > 0) {
    // Call new endpoint that creates records
    await supabase.functions.invoke('update-prices-cron', {
      body: { mode: 'resolve-and-get-sectors', isins: toResolve }
    });
    
    // Re-fetch after resolution
    const { data: updatedData } = await supabase
      .from('isin_mappings')
      .select('isin, ticker, sector, industry')
      .in('isin', isins);
    
    // Update state with new mappings
    const newMappings = {};
    for (const row of updatedData || []) {
      if (row.sector) {
        newMappings[row.isin] = { ticker: row.ticker, sector: row.sector, industry: row.industry };
      }
    }
    setMappings(newMappings);
  }
}, [hasFetched]);
```

#### 3. Passare Descrizione Stock per Migliore Risoluzione AI

Il problema è che l'AI ha bisogno della descrizione per capire il settore (es. "AZ.ALPHABET INC-CL A").

Modificare per passare le descrizioni:

```typescript
// In useSectorMappings.ts - ricevere anche le descrizioni
fetchMappings(stockIsins, stockDescriptions) 

// In edge function - usare descrizione per AI fallback
const sectorInfo = await fetchYahooSectorInfo(ticker, description);
```

---

## Flusso Risultante

```text
1. Utente carica Excel con "AZ.ALPHABET INC-CL A" (ISIN: US02079K3059)
   │
   ▼
2. Posizione salvata in `positions` con ISIN
   │
   ▼
3. Utente apre Risk Analyzer → Sector view
   │
   ▼
4. useSectorMappings cerca US02079K3059 in isin_mappings → NON ESISTE
   │
   ▼
5. Chiama edge function mode='resolve-and-get-sectors'
   │
   ├─ Yahoo Search: US02079K3059 → GOOGL
   ├─ Yahoo Quote API → 401 Error
   └─ Lovable AI: "Settore di GOOGL (Alphabet)?" → "Communication Services"
   │
   ▼
6. CREA nuovo record in isin_mappings:
   { isin: US02079K3059, ticker: GOOGL, sector: "Communication Services" }
   │
   ▼
7. Risk Analyzer mostra: ALPHABET → Communication Services ✓
```

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| `supabase/functions/update-prices-cron/index.ts` | Aggiungere handler `resolve-and-get-sectors` che crea nuovi record |
| `src/hooks/useSectorMappings.ts` | Identificare ISIN mancanti e chiamare nuovo endpoint |
| `src/pages/RiskAnalyzer.tsx` | Passare descrizioni stock al hook |

---

## Risultato Atteso

| Prima | Dopo |
|-------|------|
| 60 stock, 31 record in `isin_mappings` | 60 stock, 60 record in `isin_mappings` |
| ~50% stock in "Other" | <5% in "Other" |
| AI mai chiamata | AI chiamata automaticamente per ogni stock sconosciuto |
| Richiede Admin Panel | Zero intervento manuale |

