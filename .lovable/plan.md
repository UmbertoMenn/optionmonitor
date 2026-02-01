

# Piano: Auto-Ricerca Settori con Lovable AI (Stock + ETF Multi-Settore)

## Problema Identificato

L'analisi settoriale mostra molti titoli come "Other" perché:

| Tipo | Sistema Attuale | Problema |
|------|-----------------|----------|
| **Stock** | ISIN → `isin_mappings` → settore singolo | Molti ISIN non esistono nella tabella |
| **ETF** | justETF scraping → multi-settore | Se scraping fallisce, va tutto in "Other" |

## Soluzione: Lovable AI come Fallback Universale

Usare **Lovable AI** (già disponibile via `LOVABLE_API_KEY`) quando:
1. Per **Stock**: Yahoo Finance fallisce e il ticker non è in cache
2. Per **ETF**: justETF non restituisce dati settoriali (minimo 80% copertura, max 20% in Other)

---

## Architettura della Soluzione

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    Richiesta Settore                                 │
└──────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
         ┌──────────┐                     ┌──────────┐
         │  STOCK   │                     │   ETF    │
         └────┬─────┘                     └────┬─────┘
              │                                │
              ▼                                ▼
    ┌─────────────────┐              ┌─────────────────┐
    │ 1. Cache locale │              │ 1. justETF      │
    │    KNOWN_SECTORS│              │    scraping     │
    └────────┬────────┘              └────────┬────────┘
             │ miss                           │ fail/incomplete
             ▼                                ▼
    ┌─────────────────┐              ┌─────────────────┐
    │ 2. Database     │              │ 2. INDEX_SECTOR │
    │    isin_mappings│              │    FALLBACKS    │
    └────────┬────────┘              └────────┬────────┘
             │ miss                           │ miss
             ▼                                ▼
    ┌─────────────────┐              ┌─────────────────┐
    │ 3. LOVABLE AI   │              │ 3. LOVABLE AI   │
    │ "Settore GICS?" │              │ "Top 5 settori?"│
    │ → 1 settore     │              │ → Multi-settore │
    │                 │              │   (min 80%)     │
    └────────┬────────┘              └────────┬────────┘
             │                                │
             ▼                                ▼
    ┌─────────────────────────────────────────────────┐
    │              Salva in Cache Globale             │
    │    isin_mappings (stock) / etf_allocations (ETF)│
    └─────────────────────────────────────────────────┘
```

---

## Modifiche Tecniche

### 1. Nuova Funzione `fetchSectorWithAI` (Stock - Settore Singolo)

**File**: `supabase/functions/update-prices-cron/index.ts`

```typescript
async function fetchSectorWithAI(
  ticker: string, 
  description: string
): Promise<{ sector: string | null; industry: string | null }> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) return { sector: null, industry: null };
  
  const validSectors = [
    'Technology', 'Financials', 'Healthcare',
    'Consumer Discretionary', 'Consumer Staples', 'Industrials',
    'Energy', 'Materials', 'Utilities', 'Real Estate',
    'Communication Services'
  ];
  
  const prompt = `For the stock with ticker "${ticker}" (${description}), 
    provide the GICS sector classification.
    Valid sectors: ${validSectors.join(', ')}.
    Respond with ONLY the sector name, nothing else.`;
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
    }),
  });
  
  const data = await response.json();
  const sectorText = data.choices?.[0]?.message?.content?.trim();
  
  if (validSectors.includes(sectorText)) {
    console.log(`AI resolved sector for ${ticker}: ${sectorText}`);
    return { sector: sectorText, industry: null };
  }
  
  return { sector: null, industry: null };
}
```

### 2. Nuova Funzione `fetchETFSectorsWithAI` (ETF - Multi-Settore ≥80%)

**File**: `supabase/functions/fetch-etf-allocation/index.ts`

```typescript
async function fetchETFSectorsWithAI(
  isin: string,
  etfName: string
): Promise<Record<string, number>> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) return {};
  
  const validSectors = [
    'Technology', 'Financials', 'Healthcare',
    'Consumer Discretionary', 'Consumer Staples', 'Industrials',
    'Energy', 'Materials', 'Utilities', 'Real Estate',
    'Communication Services'
  ];
  
  const prompt = `For the ETF "${etfName}" (ISIN: ${isin}), provide the sector allocation breakdown.

IMPORTANT RULES:
1. Return the TOP 5 sectors with their percentage allocations
2. The percentages MUST sum to at least 80% (maximum 20% can go to "Other")
3. Use ONLY these sector names: ${validSectors.join(', ')}, Other
4. For broad market ETFs (MSCI World, S&P 500, etc.) distribute across multiple sectors
5. For thematic/sector ETFs, concentrate on the main sector(s)

Respond in this EXACT JSON format only:
{"Technology": 25, "Healthcare": 20, "Financials": 18, "Industrials": 12, "Consumer Discretionary": 10, "Other": 15}

Respond with ONLY the JSON object, no explanation.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',  // Modello più capace per JSON
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
      }),
    });
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate: only valid sectors, percentages are numbers
    const result: Record<string, number> = {};
    let total = 0;
    
    for (const [sector, pct] of Object.entries(parsed)) {
      if ((validSectors.includes(sector) || sector === 'Other') && typeof pct === 'number' && pct > 0) {
        result[sector] = pct;
        total += pct;
      }
    }
    
    // Validate minimum 80% coverage (max 20% in Other)
    const otherPct = result['Other'] || 0;
    if (otherPct <= 20 && total >= 80) {
      console.log(`AI resolved ETF sectors for ${etfName}: ${JSON.stringify(result)}`);
      return result;
    }
    
    // If Other > 20%, redistribute to make it compliant
    if (otherPct > 20 && Object.keys(result).length > 1) {
      const excess = otherPct - 20;
      result['Other'] = 20;
      
      // Distribute excess proportionally to other sectors
      const otherSectors = Object.entries(result).filter(([k]) => k !== 'Other');
      const otherTotal = otherSectors.reduce((s, [, v]) => s + v, 0);
      
      for (const [sector, pct] of otherSectors) {
        result[sector] = pct + (excess * pct / otherTotal);
      }
      
      return result;
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching ETF sectors with AI:', error);
    return {};
  }
}
```

### 3. Integrare AI Fallback in `fetch-etf-allocation`

**File**: `supabase/functions/fetch-etf-allocation/index.ts`

Aggiungere dopo i fallback esistenti (linea ~670):

```typescript
// Existing fallbacks...
if (Object.keys(sectorAllocations).length === 0) {
  // Try INDEX_SECTOR_FALLBACKS (existing)
  const fallbackSectors = getIndexFallbackSectors(name);
  if (Object.keys(fallbackSectors).length > 0) {
    Object.assign(sectorAllocations, fallbackSectors);
  }
}

// NEW: AI Fallback for ETFs without sector data
if (Object.keys(sectorAllocations).length === 0) {
  console.log(`No sector data for ${isin}, trying Lovable AI...`);
  const aiSectors = await fetchETFSectorsWithAI(isin, name);
  
  if (Object.keys(aiSectors).length > 0) {
    Object.assign(sectorAllocations, aiSectors);
    console.log(`AI populated sectors for ${name}:`, aiSectors);
  }
}
```

### 4. Integrare AI Fallback in `update-prices-cron`

**File**: `supabase/functions/update-prices-cron/index.ts`

Modificare `fetchYahooSectorInfo` per includere fallback AI:

```typescript
async function fetchYahooSectorInfo(
  ticker: string, 
  description?: string
): Promise<{ sector: string | null; industry: string | null }> {
  // 1. Check KNOWN_SECTORS (existing)
  const knownInfo = inferSectorFromName(ticker, description);
  if (knownInfo.sector) return knownInfo;
  
  // 2. Try Yahoo Finance API (existing)
  // ... existing code ...
  
  // 3. NEW: Fallback to Lovable AI
  if (description) {
    console.log(`Yahoo failed for ${ticker}, trying Lovable AI...`);
    const aiResult = await fetchSectorWithAI(ticker, description);
    if (aiResult.sector) {
      return aiResult;
    }
  }
  
  return { sector: null, industry: null };
}
```

### 5. Aggiornare `SectorMappingManager` per Admin

**File**: `src/components/admin/SectorMappingManager.tsx`

Modificare per caricare TUTTI gli ISIN stock dalle posizioni e usare UPSERT:

```typescript
async function loadMappings() {
  // 1. Carica TUTTI gli ISIN stock dalle posizioni
  const { data: positions } = await supabase
    .from('positions')
    .select('isin, description')
    .eq('asset_type', 'stock')
    .not('isin', 'is', null);
  
  // 2. Carica i mapping esistenti
  const { data: mappings } = await supabase
    .from('isin_mappings')
    .select('*');
  
  // 3. Combina: mostra tutti gli ISIN con info mapping se disponibile
  const uniqueIsins = [...new Set(positions?.map(p => p.isin) || [])];
  
  const combined = uniqueIsins.map(isin => {
    const mapping = mappings?.find(m => m.isin === isin);
    const position = positions?.find(p => p.isin === isin);
    return {
      isin,
      description: position?.description || '',
      ticker: mapping?.ticker || null,
      sector: mapping?.sector || null,
      hasMapping: !!mapping,
    };
  });
  
  setMappings(combined);
}

// UPSERT per creare nuovi record
async function handleSaveSector(isin: string) {
  const { error } = await supabase
    .from('isin_mappings')
    .upsert({
      isin,
      sector: pendingChanges[isin],
      source: 'manual',
      last_verified_at: new Date().toISOString(),
    }, { onConflict: 'isin' });
}
```

---

## Esempi di Output AI per ETF

| ETF | Nome | Output AI Atteso |
|-----|------|------------------|
| IE00B4L5Y983 | iShares Core MSCI World | `{"Technology": 24, "Financials": 15, "Healthcare": 12, "Consumer Discretionary": 11, "Industrials": 10, "Other": 18}` |
| IE00B5BMR087 | iShares Core S&P 500 | `{"Technology": 32, "Healthcare": 12, "Financials": 11, "Consumer Discretionary": 10, "Communication Services": 9, "Other": 16}` |
| IE00BFMXXD54 | Invesco EQQQ Nasdaq 100 | `{"Technology": 50, "Communication Services": 15, "Consumer Discretionary": 14, "Healthcare": 8, "Other": 13}` |
| LU1681045370 | Amundi MSCI Emerging Markets | `{"Financials": 22, "Technology": 20, "Consumer Discretionary": 14, "Communication Services": 10, "Materials": 8, "Other": 16}` |
| IE00B3XXRP09 | Vanguard S&P 500 | `{"Technology": 30, "Healthcare": 13, "Financials": 12, "Consumer Discretionary": 10, "Industrials": 8, "Other": 17}` |

---

## Flusso Operativo Risultante

### Per Stock:
```text
1. Utente carica Excel con "AZ.ALPHABET INC-CL A"
   │
   ▼
2. update-prices-cron:
   ├─ KNOWN_SECTORS["GOOGL"]? → No
   ├─ Database isin_mappings? → No
   ├─ Yahoo Finance → 401 Error
   └─ Lovable AI: "Qual è il settore di GOOGL?"
      └─ Risposta: "Communication Services"
   │
   ▼
3. Salva in isin_mappings:
   { isin: US02079K3059, sector: "Communication Services" }
   │
   ▼
4. TUTTI gli utenti vedono: ALPHABET → Communication Services ✓
```

### Per ETF:
```text
1. Utente carica Excel con "ISHSIII-CORE MSCI WLD"
   │
   ▼
2. fetch-etf-allocation:
   ├─ justETF scraping → Nessun dato settoriale
   ├─ INDEX_SECTOR_FALLBACKS → Non match
   └─ Lovable AI: "Top 5 settori per MSCI World ETF?"
      └─ Risposta: {"Technology": 24, "Financials": 15, ...}
   │
   ▼
3. Salva in etf_allocations:
   { isin: IE00B4L5Y983, sector_allocations: {...} }
   │
   ▼
4. TUTTI gli utenti vedono la distribuzione settoriale corretta ✓
```

---

## File da Creare/Modificare

| File | Azione | Descrizione |
|------|--------|-------------|
| `supabase/functions/update-prices-cron/index.ts` | Modifica | Aggiungere `fetchSectorWithAI()` per stock |
| `supabase/functions/fetch-etf-allocation/index.ts` | Modifica | Aggiungere `fetchETFSectorsWithAI()` per ETF multi-settore |
| `src/components/admin/SectorMappingManager.tsx` | Modifica | Caricare ISIN da positions, supportare UPSERT |

---

## Vantaggi

| Aspetto | Prima | Dopo |
|---------|-------|------|
| **Stock senza settore** | ~70% in "Other" | <5% in "Other" |
| **ETF senza scraping** | 100% in "Other" | Distribuzione multi-settore (≥80% identificato) |
| **Copertura settoriale ETF** | 0% se scraping fallisce | Minimo 80% (max 20% in Other) |
| **Manutenzione** | Aggiornare manualmente | Zero (AI impara automaticamente) |
| **Costo** | N/A | Lovable AI incluso |

---

## Validazione Output AI per ETF

L'AI deve rispettare questi vincoli:

1. **Minimo 80% copertura**: La somma dei settori identificati (escluso Other) deve essere ≥80%
2. **Massimo 20% in Other**: Il settore "Other" non può superare il 20%
3. **Settori validi**: Solo nomi GICS standard
4. **Formato JSON**: Output parsabile automaticamente

Se l'AI restituisce un output non conforme, il sistema:
1. Tenta di redistribuire automaticamente
2. Se fallisce, usa i fallback statici esistenti

