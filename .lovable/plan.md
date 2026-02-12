

## Fix allineamento a destra e prezzo troncato in Iron Condor e Double Diagonal

### Problemi identificati

Confrontando con "Altre Strategie" (che funziona bene), i problemi sono:

**Double Diagonal** - grid attuale a 11 colonne:
`[1.25rem_minmax(6rem,1fr)_2rem_3rem_3rem_auto_6rem_6rem_4.5rem_6rem_7rem]`

1. La colonna PS (col 9) e solo `4.5rem`, troppo stretta: il prezzo viene troncato ("PS: 456,...")
2. C'e una colonna fantasma inutilizzata da `6rem` (col 10) tra PS e P/L che spreca spazio e spinge il contenuto lontano dal bordo destro

**Iron Condor** - grid attuale a 13 colonne:
`[1.25rem_minmax(6rem,1fr)_2rem_2rem_3rem_3rem_5rem_6rem_6rem_4.5rem_6rem_6.5rem_7rem]`

1. L'ultima colonna (col 13, `7rem`) non ha contenuto: dopo ML non c'e nulla, ma la colonna esiste e spinge tutto a sinistra
2. Il contenuto non arriva al bordo destro come in "Altre Strategie"

### Soluzione

**File: `src/pages/Derivatives.tsx`**

#### 1. Double Diagonal (riga 1358)

Ridurre da 11 a 10 colonne rimuovendo la colonna vuota, e allargare PS:

```text
Da: [1.25rem_minmax(6rem,1fr)_2rem_3rem_3rem_auto_6rem_6rem_4.5rem_6rem_7rem]
A:  [1.25rem_minmax(6rem,1fr)_2rem_3rem_3rem_auto_6rem_6rem_7rem_7rem]
```

Mappatura colonne risultante:
- Col 1: Chevron (1.25rem)
- Col 2: Underlying (minmax 6rem, 1fr)
- Col 3: OptionStrat (2rem)
- Col 4: IR/OOR (3rem)
- Col 5: Scadenze (3rem)
- Col 6: PUT spread (auto)
- Col 7: CALL spread (6rem)
- Col 8: Contratti (6rem)
- Col 9: PS - da 4.5rem a **7rem** (prezzo visibile per intero)
- Col 10: P/L (7rem)

Oltre al cambio grid, rimuovere la riga vuota (linea 1457) che generava la cella fantasma nella colonna 10.

#### 2. Iron Condor (riga 1120)

Ridurre da 13 a 12 colonne rimuovendo l'ultima colonna inutilizzata:

```text
Da: [1.25rem_minmax(6rem,1fr)_2rem_2rem_3rem_3rem_5rem_6rem_6rem_4.5rem_6rem_6.5rem_7rem]
A:  [1.25rem_minmax(6rem,1fr)_2rem_2rem_3rem_3rem_5rem_6rem_7rem_4.5rem_6rem_6.5rem]
```

Mappatura colonne risultante:
- Col 1-8: invariate (Chevron, Underlying, Badge IC, OptionStrat, IR/OOR, Scadenza, PUT spread, CALL spread)
- Col 9: PS - da 6rem a **7rem** (coerente con DD)
- Col 10: Contratti (4.5rem)
- Col 11: GP (6rem)
- Col 12: ML (6.5rem) - diventa l'ultima colonna, contenuto arriva al bordo destro

### Cosa NON cambia
- Nessuna logica di calcolo
- Tutti i dati, badge, pulsanti e tooltip restano identici
- Il contenuto espanso (CollapsibleContent) resta invariato
- Le altre sezioni (Covered Call, Naked Put, Long Put, Leap Call, Altre Strategie) non vengono toccate

