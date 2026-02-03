
## Obiettivo

Uniformare il layout di tutte le sezioni derivati utilizzando un sistema a griglia coerente, basandosi sul modello già implementato in `GroupedOtherStrategyRow`.

## Analisi Layout Attuale

| Componente | Layout Attuale | Colonne Dati |
|------------|----------------|--------------|
| CoveredCallRow | flex | V/A, Descrizione, ITM/OTM, P!, Menu, PS, Contratti, PMC, Prezzo |
| LongPutRow | flex | A, Descrizione, ITM/OTM, P!, Menu, PS, Contratti, PMC, Prezzo |
| IronCondorRow | flex | Underlying, IR/OOR, Scadenza, PUT spread, CALL spread, Contratti, GP, ML |
| DoubleDiagonalRow | flex | Underlying, IR/OOR, Scadenze, PUT spread, CALL spread, Contratti, GP, ML |
| NakedPutRow | flex | V, Descrizione, ITM/OTM, Menu, PS, Contratti, PMC, Prezzo |
| LeapCallRow | flex | A, Descrizione, ITM/OTM, Menu, PS, Contratti, PMC, Prezzo |
| GroupedOtherStrategyRow | **grid** (modello) | Chevron, Underlying, Badge Strategia, IR/OOR, Range, Gambe, Call/Put, PS, P/L |

## Strategia di Implementazione

Data la diversa struttura dei dati tra le sezioni, creeremo **due tipi di grid layout**:

### Layout A: Opzioni Singole (Covered Call, Long Put, Naked Put, Leap Call)

Colonne uniformi per strategie con singola opzione:

```text
| Chevron | V/A | Descrizione | ITM/OTM | Badges | Menu | PS | Contratti | PMC | Prezzo+% |
```

Grid: `grid-cols-[auto_auto_1fr_auto_auto_auto_6rem_5rem_5.5rem_6rem]`

### Layout B: Strategie Multi-Gamba (Iron Condor, Double Diagonal)

Colonne uniformi per strategie a 4 gambe:

```text
| Chevron | Underlying | IR/OOR | Scadenza | PUT spread | CALL spread | Contratti | GP | ML |
```

Grid: `grid-cols-[auto_minmax(8rem,1fr)_auto_auto_7rem_7rem_5rem_6rem_6rem]`

## Modifiche Tecniche

### File: `src/pages/Derivatives.tsx`

**1. CoveredCallRow (linee ~536-605)**

Da:
```tsx
<div className="flex items-center justify-between p-3 ...">
  <div className="flex items-center gap-3 flex-1 min-w-0">
    ...
  </div>
  <div className="flex items-center gap-4 shrink-0">
    ...
  </div>
</div>
```

A:
```tsx
<div className="grid grid-cols-[auto_auto_minmax(10rem,1fr)_auto_auto_auto_6rem_5rem_5.5rem_6rem] gap-3 items-center p-3 ...">
  {/* Col 1: Chevron */}
  {/* Col 2: V/A Badge */}
  {/* Col 3: Descrizione */}
  {/* Col 4: ITM/OTM */}
  {/* Col 5: Badges (P!, Override) */}
  {/* Col 6: Menu */}
  {/* Col 7: PS */}
  {/* Col 8: Contratti */}
  {/* Col 9: PMC */}
  {/* Col 10: Prezzo+% */}
</div>
```

**2. LongPutRow (linee ~656-719)**

Stesso layout di CoveredCallRow.

**3. NakedPutRow (linee ~1609-1661)**

Stesso layout di CoveredCallRow.

**4. LeapCallRow (linee ~1712-1778)**

Stesso layout di CoveredCallRow.

**5. IronCondorRow (linee ~788-857)**

Da flex a grid con colonne specifiche per strategie multi-gamba:
```tsx
<div className="grid grid-cols-[auto_minmax(8rem,1fr)_auto_7rem_7rem_7rem_5rem_6rem_6rem] gap-3 items-center p-3 ...">
  {/* Col 1: Chevron */}
  {/* Col 2: Underlying */}
  {/* Col 3: IR/OOR Badge */}
  {/* Col 4: Scadenza */}
  {/* Col 5: PUT spread */}
  {/* Col 6: CALL spread */}
  {/* Col 7: Contratti */}
  {/* Col 8: GP */}
  {/* Col 9: ML */}
</div>
```

**6. DoubleDiagonalRow (linee ~996-1086)**

Simile a IronCondorRow, con adattamenti per le due scadenze:
```tsx
<div className="grid grid-cols-[auto_minmax(8rem,1fr)_auto_auto_7rem_7rem_5rem_6rem_6rem] gap-3 items-center p-3 ...">
  {/* Col 1: Chevron */}
  {/* Col 2: Underlying */}
  {/* Col 3: IR/OOR Badge */}
  {/* Col 4: Scadenze (sold-bought) */}
  {/* Col 5: PUT spread */}
  {/* Col 6: CALL spread */}
  {/* Col 7: Contratti */}
  {/* Col 8: GP */}
  {/* Col 9: ML */}
</div>
```

## Gestione Responsività

Per schermi ridotti, utilizzeremo:

1. **`minmax()` per colonne flessibili**: La colonna del nome/descrizione si restringe per prima
2. **Larghezze minime ridotte**: Le colonne numeriche avranno min-width ragionevoli (5-6rem)
3. **Overflow handling**: `truncate` e `text-ellipsis` per testi lunghi
4. **Gap ridotto su mobile**: Considerare `gap-2` invece di `gap-3` se necessario

## Risultato Atteso

Tutte le sezioni derivati avranno colonne allineate verticalmente:
- I badge (V/A, ITM/OTM, IR/OOR) saranno sempre nella stessa posizione
- I valori numerici (PS, PMC, Prezzo) saranno allineati a destra
- I menu e le azioni saranno in posizione fissa
- Il layout si adatterà a schermi ridotti senza sovrapposizioni
