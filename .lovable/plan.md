

## Fix: Netflix classificata come ETF e azioni non mostrate nell'override

### Problema 1: Bug nel parser Excel

La funzione `isETF()` in `src/lib/excelParser.ts` controlla se la descrizione contiene la stringa "ETF" con un semplice `descUpper.includes('ETF')`. Il problema e' che "N**ETF**LIX" contiene la sottostringa "ETF", quindi Netflix viene classificata come ETF invece di azione.

Questo significa che:
- Netflix non viene trovata da `findUnderlyingStock()` (che filtra solo `asset_type === 'stock'`)
- La CALL venduta su Netflix non viene matchata come Covered Call
- Qualsiasi futuro titolo con "ETF" nel nome avrebbe lo stesso problema

### Problema 2: Azioni non mostrate nell'override

Quando si tenta l'override manuale della CALL Netflix su "Covered Call", il dialog di collegamento non mostra Netflix perche' `Derivatives.tsx` passa solo `positions.filter(p => p.asset_type === 'stock')` come `availableStocks`.

### Soluzione

#### 1. `src/lib/excelParser.ts` - Fix matching ETF con word boundary

Cambiare il pattern "ETF" (e "UCITS") nell'array `ETF_ISSUER_PATTERNS` per richiedere che sia una parola intera, non una sottostringa. Implementazione: usare un regex con word boundary `\b` per i pattern corti (ETF, UCITS, VNG, SSG, WTR) invece di `includes()`.

```typescript
// Separare i pattern in due gruppi:
// 1. Pattern corti che richiedono word boundary (ETF, UCITS, VNG, SSG, WTR)
// 2. Pattern lunghi che possono usare includes() (ISHARES, VANGUARD, SPDR, ecc.)

const ETF_WORD_BOUNDARY_PATTERNS = ['ETF', 'UCITS', 'VNG', 'SSG', 'WTR'];
const ETF_SUBSTRING_PATTERNS = [
  'ISHARES', 'ISHSIII', 'ISHSIV', 'ISHSV', 'ISHSVII',
  'VANGUARD', 'SPDR', 'LYXOR', 'AMUNDI', 'XTRACKERS', 'XTRK',
  'INVESCO', 'VANECK', 'WISDOMTREE', 'UBS ETF', 'HSBC ETF', 'FRANKLIN'
];
```

Nella funzione `isETF()`:
```typescript
// Word boundary check per pattern corti
for (const pattern of ETF_WORD_BOUNDARY_PATTERNS) {
  const regex = new RegExp(`\\b${pattern}\\b`);
  if (regex.test(descUpper)) return true;
}

// Substring check per pattern lunghi (invariato)
for (const pattern of ETF_SUBSTRING_PATTERNS) {
  if (descUpper.includes(pattern)) return true;
}
```

#### 2. `src/pages/Derivatives.tsx` - Includere ETF nelle azioni disponibili per override

Modificare la variabile `stockPositions` usata come `availableStocks` nel `MoveOptionMenu` per includere anche gli ETF. In questo modo, anche se un titolo e' (correttamente o erroneamente) classificato come ETF, sara' disponibile nel dialog di collegamento.

```typescript
// Da:
const stockPositions = useMemo(() => 
  positions.filter(p => p.asset_type === 'stock'),
  [positions]
);

// A:
const stockPositions = useMemo(() => 
  positions.filter(p => p.asset_type === 'stock' || p.asset_type === 'etf'),
  [positions]
);
```

**Nota**: questo cambiamento e' sicuro perche' `findUnderlyingStock()` continua a filtrare internamente per `asset_type === 'stock'`, quindi gli ETF non verranno matchati automaticamente. Saranno pero' disponibili nella lista "Altri titoli disponibili" del dialog override, risolvendo il problema dell'override manuale.

#### 3. `src/lib/derivativeStrategies.ts` - Estendere `findUnderlyingStock` per includere ETF con ISIN di azioni USA

Aggiungere un fallback: se il matching tra azioni non trova risultati, provare anche sulle posizioni di tipo 'etf' il cui ISIN inizia con "US" (che non sono veri ETF ma potenziali azioni misclassificate).

```typescript
export function findUnderlyingStock(option: Position, stocks: Position[]): Position | undefined {
  const stocksOnly = stocks.filter(s => s.asset_type === 'stock');
  
  // ... logica esistente con stocksOnly ...
  
  // Fallback: cercare tra ETF con ISIN US (potenziali azioni misclassificate)
  const usEtfs = stocks.filter(s => 
    s.asset_type === 'etf' && s.isin?.startsWith('US')
  );
  if (usEtfs.length > 0) {
    // Ripetere la stessa logica di matching su usEtfs
    // ...
  }
  
  return undefined;
}
```

### Dati da correggere

La posizione Netflix esistente nel DB ha `asset_type = 'etf'`. Al prossimo upload del file Excel per AndreaZ, sara' automaticamente corretta in `'stock'` grazie al fix del parser. Non serve una migrazione manuale.

### File modificati

| File | Modifica |
|------|----------|
| `src/lib/excelParser.ts` | Word boundary per pattern "ETF" e "UCITS" nella funzione `isETF()` |
| `src/pages/Derivatives.tsx` | Includere ETF in `stockPositions` per il dialog override |
| `src/lib/derivativeStrategies.ts` | Fallback in `findUnderlyingStock` per ETF con ISIN US |

