
# Piano: Correzione Badge "P!" Covered Call

## Problema Identificato

Il badge "P!" (copertura parziale) viene mostrato erroneamente per ogni singola riga di Covered Call, considerando solo i contratti di quella specifica riga anziché la somma di **tutte** le call vendute per lo stesso sottostante.

### Esempio del bug attuale:
- Google: 500 azioni possedute (= 5 contratti potenziali)
- Covered Call 1: strike $200, 3 contratti
- Covered Call 2: strike $210, 2 contratti

**Comportamento attuale (errato)**:
- Riga 1: vede 3 contratti vs 5 potenziali → mostra P! (2 scoperti)
- Riga 2: vede 2 contratti vs 5 potenziali → mostra P! (3 scoperti)

**Comportamento corretto**:
- Totale contratti venduti = 3 + 2 = 5
- 5 contratti venduti = 5 potenziali → **NESSUN P!**

---

## Soluzione

### Strategia
1. Calcolare un aggregato per sottostante con il **totale dei contratti Covered Call venduti**
2. Passare questo aggregato come prop a `CoveredCallRow`
3. Usare il totale aggregato per calcolare la copertura parziale

---

## Modifiche File

### File: `src/pages/Derivatives.tsx`

#### 1. Aggiungere calcolo totale contratti per sottostante

Dopo il calcolo delle categorie, aggiungere:

```typescript
// Calculate total covered call contracts per underlying
const totalCoveredCallContractsByUnderlying = useMemo(() => {
  const totals: Record<string, number> = {};
  categories.coveredCalls.forEach(cc => {
    const underlyingName = cc.underlying.description || cc.option.underlying || '';
    if (underlyingName) {
      totals[underlyingName] = (totals[underlyingName] || 0) + cc.contractsCovered;
    }
  });
  return totals;
}, [categories.coveredCalls]);
```

#### 2. Aggiornare interfaccia RowProps

```typescript
interface CoveredCallRowProps extends RowProps {
  coveredCall: CoveredCallPosition;
  totalContractsForUnderlying: number;
}
```

#### 3. Modificare chiamata CoveredCallRow

```typescript
{categories.coveredCalls.map((cc, index) => (
  <CoveredCallRow 
    key={index} 
    coveredCall={cc} 
    stockPositions={stockPositions} 
    getOverrideForPosition={getOverrideForPosition}
    totalContractsForUnderlying={
      totalCoveredCallContractsByUnderlying[
        cc.underlying.description || cc.option.underlying || ''
      ] || cc.contractsCovered
    }
  />
))}
```

#### 4. Aggiornare logica badge in CoveredCallRow

```typescript
function CoveredCallRow({ 
  coveredCall, 
  stockPositions, 
  getOverrideForPosition,
  totalContractsForUnderlying 
}: CoveredCallRowProps) {
  // ...existing code...
  
  // Calculate partial coverage using TOTAL contracts for this underlying
  const sharesOwned = underlying.quantity || 0;
  const potentialContracts = Math.floor(sharesOwned / 100);
  const uncoveredContracts = potentialContracts - totalContractsForUnderlying;
  const isPartialCoverage = uncoveredContracts >= 1;
  
  // ...rest of component...
}
```

---

## Esempio Post-Correzione

### Google con 500 azioni e 5 contratti totali venduti:

| Riga | Strike | Contratti Riga | Totale Sottostante | Potenziali | Scoperti | Badge P! |
|------|--------|----------------|---------------------|------------|----------|----------|
| 1 | $200 | 3 | 5 | 5 | 0 | ❌ No |
| 2 | $210 | 2 | 5 | 5 | 0 | ❌ No |

### Apple con 400 azioni e 3 contratti totali venduti:

| Riga | Strike | Contratti Riga | Totale Sottostante | Potenziali | Scoperti | Badge P! |
|------|--------|----------------|---------------------|------------|----------|----------|
| 1 | $180 | 2 | 3 | 4 | 1 | ✅ Sì |
| 2 | $190 | 1 | 3 | 4 | 1 | ✅ Sì |

---

## Riepilogo Modifiche

| Sezione | Modifica |
|---------|----------|
| useMemo nuovo | Calcola `totalCoveredCallContractsByUnderlying` |
| Interfaccia | Aggiungi prop `totalContractsForUnderlying` |
| Chiamata CoveredCallRow | Passa il totale aggregato |
| Logica badge | Usa `totalContractsForUnderlying` invece di `contractsCovered` |

---

## Note

- La chiave per l'aggregazione usa `underlying.description` (nome titolo in portafoglio) come identificativo primario
- Il tooltip continua a mostrare il numero di contratti scoperti rispetto al totale delle azioni possedute
- Questa logica è coerente con come funziona `isPartial` per le Long Put in `derivativeStrategies.ts`
