
# Piano: Fix Toggle + Tooltip per Currency Exposure e Sector Allocation

## Problema 1: Toggle Non Funzionanti

### Causa Radice

I toggle granulari (`includeProtections`, `includeNakedPut`, `includeStrategies`, `includeLeapCall`) sono:
- ✅ Gestiti nello state di `RiskAnalyzer.tsx`
- ✅ Passati ai componenti UI (`CurrencyExposureView`, `SectorAllocationView`)
- ❌ **NON** passati alle funzioni di calcolo

Le funzioni `calculateCurrencyExposure` e `calculateSectorExposure` accettano solo:
```typescript
// currencyExposure.ts
interface CurrencyExposureOptions {
  includeDerivatives?: boolean;
  includeBonds?: boolean;
}

// sectorExposure.ts
interface SectorExposureOptions {
  includeDerivatives?: boolean;
  sectorMappings?: Record<string, SectorMapping>;
}
```

---

## Modifiche Tecniche

### 1. `src/lib/currencyExposure.ts` (linee 85-230)

**Aggiornare interfaccia opzioni** (linee 85-88):
```typescript
export interface CurrencyExposureOptions {
  includeBonds?: boolean;        // default: true
  includeProtections?: boolean;  // default: true
  includeNakedPut?: boolean;     // default: true
  includeStrategies?: boolean;   // default: true
  includeLeapCall?: boolean;     // default: true
}
```

**Aggiornare logica in `calculateCurrencyExposure`**:
- Linee 122-139: Protezioni → condizionare con `includeProtections` (attualmente usa `includeDerivatives`)
- Linee 180-195: Naked PUT → condizionare con `includeNakedPut`
- Linee 197-212: Leap CALL → condizionare con `includeLeapCall`
- Linee 214-229: Strategie → condizionare con `includeStrategies`

---

### 2. `src/lib/sectorExposure.ts` (linee 313-490)

**Aggiornare interfaccia opzioni** (linee 313-316):
```typescript
export interface SectorExposureOptions {
  includeNakedPut?: boolean;     // default: true
  includeStrategies?: boolean;   // default: true
  includeLeapCall?: boolean;     // default: true
  sectorMappings?: Record<string, SectorMapping>;
}
```

**Aggiornare logica in `calculateSectorExposure`** (linee 436+):
- Il blocco `if (includeDerivatives)` deve essere sostituito con controlli granulari:
  - Naked PUT → `if (includeNakedPut)`
  - Leap CALL → `if (includeLeapCall)`
  - Strategie → `if (includeStrategies)`

---

### 3. `src/hooks/useCurrencyExposure.ts` (linee 19-37)

**Aggiornare interfaccia opzioni**:
```typescript
export interface UseCurrencyExposureOptions {
  includeBonds?: boolean;
  includeProtections?: boolean;
  includeNakedPut?: boolean;
  includeStrategies?: boolean;
  includeLeapCall?: boolean;
}
```

**Passare nuovi flag a `calculateCurrencyExposure`** (linea 35-36):
```typescript
const baseCurrencyExposure = useMemo(() => 
  calculateCurrencyExposure(analysis, { 
    includeBonds, 
    includeProtections, 
    includeNakedPut, 
    includeStrategies, 
    includeLeapCall 
  }), 
  [analysis, includeBonds, includeProtections, includeNakedPut, includeStrategies, includeLeapCall]
);
```

---

### 4. `src/pages/RiskAnalyzer.tsx` (linee 45-52 e 122-124)

**Passare toggle granulari a `useCurrencyExposure`** (linea 45-52):
```typescript
const {
  exposures: currencyExposure,
  ...
} = useCurrencyExposure({ 
  includeBonds, 
  includeProtections, 
  includeNakedPut, 
  includeStrategies, 
  includeLeapCall 
});
```

**Passare toggle granulari a `calculateSectorExposure`** (linea 122-124):
```typescript
const sectorExposure = useMemo(() => {
  return calculateSectorExposure(analysis, allocations, { 
    includeNakedPut, 
    includeStrategies, 
    includeLeapCall, 
    sectorMappings 
  });
}, [analysis, allocations, includeNakedPut, includeStrategies, includeLeapCall, sectorMappings]);
```

---

## Problema 2: Tooltip da Aggiornare

### Tooltip Attuale (Equity Exposure - Riferimento)
```tsx
<TooltipContent className="max-w-xs text-sm">
  <p className="mb-2">Usa i toggle per includere/escludere componenti dal totale:</p>
  <ul className="list-disc ml-4 space-y-1">
    <li><b>Protezioni</b>: calcola azioni al netto delle Long PUT</li>
    <li><b>Naked Put</b>: include rischio Naked PUT (Strike × Ctr × 100)</li>
    <li><b>Strategie</b>: include Max Loss delle strategie</li>
    <li><b>Leap Call</b>: include valore di mercato Leap Call</li>
  </ul>
</TooltipContent>
```

### 5. `src/components/risk/CurrencyExposureView.tsx` (linee 194-209)

**Aggiornare tooltip** (linea ~204):
```tsx
<TooltipContent side="bottom" className="max-w-xs text-sm">
  <p className="mb-2">Usa i toggle per includere/escludere componenti dal totale:</p>
  <ul className="list-disc ml-4 space-y-1">
    <li><b>Bond</b>: include obbligazioni nell'esposizione</li>
    <li><b>Protezioni</b>: include Long PUT (valorizzate a mercato)</li>
    <li><b>Naked Put</b>: include rischio Naked PUT</li>
    <li><b>Strategie</b>: include Max Loss delle strategie</li>
    <li><b>Leap Call</b>: include valore di mercato Leap Call</li>
  </ul>
  <p className="mt-2 text-muted-foreground">Le azioni sono sempre valorizzate al lordo delle protezioni.</p>
</TooltipContent>
```

### 6. `src/components/risk/SectorAllocationView.tsx` (linee 244-248)

**Aggiornare tooltip** (linea ~244):
```tsx
<TooltipContent side="bottom" className="max-w-xs text-sm">
  <p className="mb-2">Usa i toggle per includere/escludere componenti dal totale:</p>
  <ul className="list-disc ml-4 space-y-1">
    <li><b>Naked Put</b>: include rischio Naked PUT per settore</li>
    <li><b>Strategie</b>: include Max Loss delle strategie per settore</li>
    <li><b>Leap Call</b>: include valore di mercato Leap Call per settore</li>
  </ul>
  <p className="mt-2 text-muted-foreground">Commodities, Bond e Protezioni (Long PUT) sono sempre escluse dall'analisi settoriale.</p>
</TooltipContent>
```

---

## Riepilogo File da Modificare

| File | Modifiche |
|------|-----------|
| `src/lib/currencyExposure.ts` | Interfaccia opzioni granulari + logica condizionale per ogni categoria |
| `src/lib/sectorExposure.ts` | Interfaccia opzioni granulari + logica condizionale per naked put, leap call, strategie |
| `src/hooks/useCurrencyExposure.ts` | Interfaccia + passaggio toggle a `calculateCurrencyExposure` |
| `src/pages/RiskAnalyzer.tsx` | Passaggio toggle granulari a hook e funzione di calcolo |
| `src/components/risk/CurrencyExposureView.tsx` | Tooltip aggiornato con spiegazione toggle |
| `src/components/risk/SectorAllocationView.tsx` | Tooltip aggiornato con spiegazione toggle |

---

## Risultato Atteso

1. **Toggle funzionanti**: Ogni toggle aggiornerà immediatamente i dati visualizzati (totali, grafico, accordion dettagli) nella rispettiva vista
2. **Tooltip informativi**: L'utente potrà capire il funzionamento dei toggle passando il mouse sull'icona `ℹ️` accanto al titolo
