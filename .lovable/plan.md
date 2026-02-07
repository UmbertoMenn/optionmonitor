

# Piano: Visualizzazione "UNIT" e Rendimento % nella Riga Covered Call

## Problema Identificato

Dallo screenshot, la colonna mostra solo `$11.63` senza la label "UNIT:" e manca il rendimento percentuale (non annualizzato).

**Codice attuale** (linee 687-698 di `Derivatives.tsx`):
```tsx
<span ...>
  {netPerShare !== undefined ? `$${netPerShare.toFixed(2)}` : '-'}
</span>
```

**Risultato visivo attuale**: `$11.63`
**Risultato desiderato**: `UNIT: $11,63 (6.8%)`

---

## Soluzione

### 1. Modifica alla colonna UNIT in `CoveredCallRow`

**File**: `src/pages/Derivatives.tsx`

Modificare la colonna 8 (UNIT) per:
- Aggiungere la label "UNIT:" prima del valore
- Calcolare il rendimento % al volo: `yieldPct = (netPerShare / underlyingPrice) * 100`
- Mostrare il rendimento % tra parentesi dopo il valore in dollari
- Usare `formatNumber` per il formato italiano (virgola come decimale)

**Prima**:
```tsx
{netPerShare !== undefined ? `$${netPerShare.toFixed(2)}` : '-'}
```

**Dopo**:
```tsx
{netPerShare !== undefined 
  ? <>
      UNIT: {formatNumber(netPerShare, 2)} $ 
      {underlyingPrice > 0 && (
        <span className="text-muted-foreground ml-1">
          ({formatNumber((netPerShare / underlyingPrice) * 100, 1)}%)
        </span>
      )}
    </>
  : '-'
}
```

### 2. Adattamento larghezza colonna

Poiché il contenuto sarà più lungo (es. `UNIT: 11,63 $ (6.8%)`), potrebbe essere necessario allargare leggermente la colonna nella griglia CSS.

**Attuale**: `5rem` per la colonna UNIT
**Nuovo**: `7rem` o `8rem` per accomodare il testo aggiuntivo

---

## Esempio Visivo

| Prima | Dopo |
|-------|------|
| `$11.63` | `UNIT: 11,63 $ (6,8%)` |
| `$-2.50` | `UNIT: -2,50 $ (-1,5%)` |

---

## File Coinvolti

| File | Modifiche |
|------|-----------|
| `src/pages/Derivatives.tsx` | Modifica colonna UNIT in `CoveredCallRow`: aggiungere label "UNIT:", calcolare e mostrare rendimento %, eventuale allargamento griglia |

---

## Note Tecniche

- Il rendimento % viene calcolato dinamicamente come `(netPerShare / underlyingPrice) * 100`
- Non è necessario modificare il database poiché i dati sono già disponibili
- Il calcolo è identico a quello usato nella calcolatrice (`yieldPct` in `PremiumMetrics`)
- Il formato usa `formatNumber` per rispettare lo stile italiano (virgola decimale)

