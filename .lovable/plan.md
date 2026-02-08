

## Obiettivo
Risolvere definitivamente i tre bug che causano:
1. Falsi positivi nel banner "strumenti non visualizzati"
2. Impossibilità di modificare i settori dei derivati dalla pagina admin
3. Mancata risoluzione settoriale per derivati con nomi aziendali (es. "PALANTIR TECHNOLOGIES" → deve trovare PLTR)

---

## Bug #1: Banner indica "mancanti" strumenti già presenti nella torta

### Causa
Il codice confronta `np.underlying` (es. `PALANTIR TECHNOLOGIES`) con il set `displayed` che contiene invece nomi formattati (es. `PALANTIR TECHNOLOGIES (PUT 24)`).

### Soluzione
Modificare la logica di popolamento del set `displayed` per estrarre il nome base (senza suffissi come `(PUT 24)`, `(LEAP CALL)`, `(Iron Condor)` ecc.) OPPURE modificare il check per usare `.startsWith()` o `.includes()`.

**File**: `src/components/risk/SectorAllocationView.tsx`

```typescript
// Invece di:
for (const instr of sector.instruments) {
  displayed.add(instr.name);
}

// Fare:
for (const instr of sector.instruments) {
  displayed.add(instr.name);
  // Estrai anche il nome base (prima di parentesi) per matching derivati
  const baseNameMatch = instr.name.match(/^(.+?)\s*\(/);
  if (baseNameMatch) {
    displayed.add(baseNameMatch[1].trim());
  }
}
```

E per le strategie, il check deve cercare anche nel nome composto:
```typescript
// Per strategie, il nome nel sectorExposure è "UNDERLYING (StrategyName)"
// Il check attuale cerca solo "UNDERLYING", quindi fallisce

// Modificare il check per strategie:
const stratDisplayName = strat.underlying; // es. "META PLATFORMS"
const foundAnyVersion = displayed.has(stratDisplayName) || 
  [...displayed].some(d => d.startsWith(stratDisplayName + ' ('));
```

---

## Bug #2: Admin Gestione Settori non mostra i derivati

### Causa
La query carica solo `asset_type = 'stock'` con ISIN non nullo. I derivati hanno `asset_type = 'derivative'` e ISIN nullo → esclusi.

### Soluzione
Modificare `SectorMappingManager` per includere anche i nomi degli underlying dei derivati, permettendo all'admin di assegnare settori anche a questi.

**File**: `src/components/admin/SectorMappingManager.tsx`

```typescript
// 1. Caricare ANCHE gli underlying unici dai derivati
const { data: derivatives } = await supabase
  .from('positions')
  .select('underlying, description')
  .eq('asset_type', 'derivative')
  .not('underlying', 'is', null);

// 2. Estrarre nomi unici e creare "ISIN sintetici" per visualizzarli
const derivativeUnderlyings = [...new Set(
  (derivatives || []).map(d => d.underlying).filter(Boolean)
)];

// 3. Per ogni underlying, verificare se esiste già un mapping con ISIN sintetico
//    Se sì, mostrare il settore corrente; se no, mostrare "Non assegnato"
```

Questo richiede una modifica più ampia per:
- Visualizzare nella tabella sia stock (con ISIN reale) che derivati (con ISIN sintetico `TICKER:XXX`)
- Permettere il salvataggio per entrambi i tipi

---

## Bug #3: Mancata risoluzione ticker per nomi aziendali

### Causa
L'estrazione ticker da `"PALANTIR TECHNOLOGIES"` produce `"PALANTIR"` (prima parola, 5+ lettere) anziché `"PLTR"`.

La query `.in('ticker', tickersToFetch)` cerca `PALANTIR` nel DB, ma il mapping ha `ticker = 'PLTR'`.

### Soluzione
Due approcci complementari:

**A) Estendere COMPANY_NAME_TO_TICKER nel frontend** (`src/lib/sectorExposure.ts`):
```typescript
'PALANTIR': 'PLTR',
'PALANTIR TECHNOLOGIES': 'PLTR',
'ALPHABET': 'GOOGL',
'GOOGLE': 'GOOGL',
// ... altri mapping comuni
```

**B) Modificare `useSectorMappings` per usare anche la colonna `description`** nel matching:
```typescript
// Dopo aver estratto potentialTickers, cercare anche con LIKE o ilike
// su una nuova query che cerca il nome azienda nella descrizione
```

**C) Affidarsi all'AI resolution** (già presente) che dovrebbe risolvere `"PALANTIR TECHNOLOGIES"` → `PLTR` → `Technology`.

Il problema è che l'AI resolution viene chiamata solo per `derivativeNamesToResolve`, ma questi vengono filtrati se esiste già un mapping che "contiene" il ticker:
```typescript
for (const [key, mapping] of Object.entries(newMappings)) {
  if (key.startsWith('ticker:') && upperName.includes(mapping.ticker.toUpperCase())) {
    return false; // Skip, already have this
  }
}
```

Se `newMappings` ha `ticker:PLTR` con ticker=`PLTR`, e il nome è `PALANTIR TECHNOLOGIES`, il check `upperName.includes('PLTR')` è **FALSE** → non viene skippato → viene mandato all'AI.

Quindi l'AI dovrebbe essere chiamata, ma potrebbe esserci un altro problema:
- L'AI potrebbe non essere stata chiamata perché i mapping esistenti coprono già questi nomi
- Oppure l'AI ha fallito e non ha salvato i risultati

---

## Piano di implementazione

### Fase 1: Fix immediato del banner (falsi positivi)
1. Modificare `SectorAllocationView.tsx` per popolare `displayed` con sia il nome completo che il nome base
2. Aggiornare i check per Naked Put, Leap Call e Strategies per usare matching più flessibile

### Fase 2: Estendere SectorMappingManager per derivati
1. Aggiungere query per caricare underlying unici dai derivati
2. Creare una sezione separata o un tab "Derivati" nella tabella
3. Permettere salvataggio con ISIN sintetico `TICKER:XXX`

### Fase 3: Migliorare risoluzione ticker
1. Estendere `COMPANY_NAME_TO_TICKER` con mapping comuni (PALANTIR→PLTR, ecc.)
2. Aggiungere fallback: se il nome contiene un nome azienda noto, usare il ticker corrispondente

---

## File da modificare

| File | Modifica |
|------|----------|
| `src/components/risk/SectorAllocationView.tsx` | Fix matching banner per nomi formattati vs base |
| `src/components/admin/SectorMappingManager.tsx` | Aggiungere caricamento e gestione underlying derivati |
| `src/lib/sectorExposure.ts` | Estendere COMPANY_NAME_TO_TICKER con più mapping |
| `src/hooks/useSectorMappings.ts` | (Opzionale) Migliorare estrazione ticker da nomi aziendali |

---

## Test di accettazione

1. Banner non deve più segnalare come "mancante" uno strumento che appare nella torta/dettaglio
2. Nella pagina Admin > Gestione Settori, devono apparire anche underlying dei derivati (es. PALANTIR TECHNOLOGIES, META PLATFORMS)
3. La strategia META PLATFORMS Iron Condor deve apparire in "Communication Services"
4. Naked Put PALANTIR TECHNOLOGIES deve apparire in "Technology"

