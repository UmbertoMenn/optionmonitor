

## Fix: Segno del Lordo Premi perso nel calcolo

### Problema

Il bug e' in due punti dove `Math.abs()` rimuove il segno dal premio lordo.

**In `orderFileParser.ts`** (righe 562 e 625):
```typescript
grossPremium: Math.abs(netPremium)  // BUG: segno perso
```

Quando le operazioni sono prevalentemente acquisti (come per AppLovin), `netPremium` e' -5870, ma `grossPremium` diventa +5870.

**In `calculatePremiumMetrics`** (riga 655):
```typescript
const netPremium = parseResult.grossPremium - commissions;  // Usa il valore senza segno
```

Questo usa `grossPremium` (sempre positivo) invece di `parseResult.netPremium` (con segno), quindi anche il netto risulta sempre positivo.

**In `CallPremiumCalculatorDialog.tsx`** la funzione `recalculateMetrics` ha lo stesso problema:
```typescript
grossPremium: Math.abs(netPremium)  // BUG: segno perso
```

### Soluzione

**File: `src/lib/orderFileParser.ts`**

1. Riga 562 (`filterAndCalculateIronCondorPremiums`): cambiare `grossPremium: Math.abs(netPremium)` in `grossPremium: netPremium`
2. Riga 625 (`filterAndCalculateCallPremiums`): stessa modifica
3. Riga 655 (`calculatePremiumMetrics`): cambiare `parseResult.grossPremium` in `parseResult.netPremium` per preservare il segno nel calcolo del netto commissioni

**File: `src/components/derivatives/CallPremiumCalculatorDialog.tsx`**

4. Nella funzione `recalculateMetrics` (~riga 115): cambiare `grossPremium: Math.abs(netPremium)` in `grossPremium: netPremium`

### Effetto

- "Lordo Premi" mostrera' il valore con segno corretto (es. -5870 per AppLovin)
- "Netto Commissioni" sara' calcolato correttamente (lordo - commissioni, preservando il segno)
- "Lordo Unitario" e "Netto Unitario" avranno il segno corretto
- Nessun impatto su altre funzionalita'

