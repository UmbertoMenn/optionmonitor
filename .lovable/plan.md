

## Piano: Modifiche alla Card "Azioni Necessarie"

### Obiettivo
Modificare la card riepilogativa "Azioni Necessarie" secondo le seguenti specifiche:
1. Sostituire "Protezioni Attive" con "Call da rivendere"
2. Garantire che la card Iron Condor OOR sia sempre visibile (anche se vuota)
3. Cambiare l'icona della sezione Leap Call nel dettaglio con il razzo (Rocket)

---

### Modifiche Dettagliate

#### 1. File: `src/components/derivatives/DerivativesSummaryCard.tsx`

**Rimuovere**:
- La sezione "Protezioni Attive" (Long Put ITM)
- Il relativo calcolo `activeProtections` (righe 340-360)
- La sezione UI corrispondente (righe 564-583)

**Aggiungere**:
- Nuova sezione "Call da rivendere" che calcola i ticker con azioni disponibili per nuove Covered Call
- Formula: `floor(azioni possedute / 100) - contratti CC vendute su stesso sottostante >= 1`

**Logica Call da rivendere**:
```typescript
const availableCallsToSell = useMemo(() => {
  const result: { ticker: string; availableShares: number }[] = [];
  
  stockPositions.forEach(stock => {
    const normalizedKey = normalizeForMatching(stock.description || '');
    const potentialContracts = Math.floor(stock.quantity / 100);
    
    // Count total sold call contracts for this underlying
    let soldCallContracts = 0;
    
    // From Covered Calls
    categories.coveredCalls.forEach(cc => {
      const ccKey = normalizeForMatching(cc.underlying.description || cc.option.underlying || '');
      if (ccKey === normalizedKey) {
        soldCallContracts += cc.contractsCovered;
      }
    });
    
    const available = potentialContracts - soldCallContracts;
    if (available >= 1) {
      result.push({
        ticker: stock.ticker || stock.description?.split(' ')[0] || 'N/A',
        availableShares: available * 100
      });
    }
  });
  
  return result.sort((a, b) => b.availableShares - a.availableShares);
}, [stockPositions, categories.coveredCalls]);
```

**Icona per Call da rivendere**: `TrendingUp` (verde) - coerente con le Call

**Garantire Iron Condor sempre visibile**:
- La card Iron Condor OOR utilizza già `alwaysVisible={categories.ironCondors.length > 0}`
- Questo va mantenuto per mostrare la sezione anche quando vuota

**Aggiornare `hasContent`**:
- Rimuovere `activeProtections.length > 0`
- Aggiungere `availableCallsToSell.length > 0`

---

#### 2. File: `src/pages/Derivatives.tsx`

**Cambiare icona sezione Leap Call** (riga 420):
- Da: `<TrendingUp className="w-5 h-5 text-green-500" />`
- A: `<Rocket className="w-5 h-5 text-blue-500" />`

**Importare Rocket** nell'import delle icone lucide-react (riga 10)

---

### Layout Finale delle 8 Card

| N° | Sezione | Icona | Colore | Criterio |
|----|---------|-------|--------|----------|
| 1 | Call non coperte | ShieldAlert | Rosso | net sold > covered |
| 2 | Call da rivendere | TrendingUp | Verde | shares available >= 100 |
| 3 | Covered Call ITM | ShieldAlert | Ambra | strike < price |
| 4 | Double Diagonal OOR | Layers | Viola | fuori range |
| 5 | Iron Condor OOR | Target | Ambra | fuori range (sempre visibile) |
| 6 | Naked Put ITM | CircleDollarSign | Arancione | ITM |
| 7 | Leap Call in Gain | Rocket | Blu | price > PMC |
| 8 | Altre Strategie OOR/OOB | Puzzle | Ciano | fuori range/breakeven |

---

### Riepilogo File Modificati

| File | Modifica |
|------|----------|
| `src/components/derivatives/DerivativesSummaryCard.tsx` | Sostituzione "Protezioni Attive" → "Call da rivendere", importazione TrendingUp |
| `src/pages/Derivatives.tsx` | Cambiare icona Leap Call da TrendingUp a Rocket |

