

# Piano: Layout Side-by-Side per Currency Exposure e Sector Allocation

## Obiettivo

Applicare lo stesso layout di Equity Exposure (toggle impilati verticalmente a destra, separati da bordo) a:

1. **Currency Exposure** - Toggle: Bond, Protezioni, Naked Put, Strategie, Leap Call
2. **Sector Allocation** - Toggle: Naked Put, Strategie, Leap Call (+ mantenere info box esclusioni)

---

## Layout di Riferimento (Equity Exposure - linee 272-349)

```tsx
<div className="flex justify-between gap-4">
  {/* Left column: title, value, description */}
  <div className="flex-1">
    {/* Icona + Titolo + Tooltip */}
    {/* Valore totale */}
    {/* Descrizione */}
  </div>
  
  {/* Right column: toggles stacked vertically */}
  <div className="flex flex-col gap-2 border-l border-border/50 pl-4">
    {/* Toggle 1 */}
    {/* Toggle 2 */}
    {/* ... */}
  </div>
</div>
```

---

## Modifica 1: Currency Exposure

**File**: `src/components/risk/CurrencyExposureView.tsx`

### Props da aggiungere all'interfaccia (linee 19-29)

```typescript
interface CurrencyExposureViewProps {
  // ... esistenti ...
  includeProtections: boolean;
  onIncludeProtectionsChange: (value: boolean) => void;
  includeNakedPut: boolean;
  onIncludeNakedPutChange: (value: boolean) => void;
  includeStrategies: boolean;
  onIncludeStrategiesChange: (value: boolean) => void;
  includeLeapCall: boolean;
  onIncludeLeapCallChange: (value: boolean) => void;
}
```

### Ristrutturare CardContent (linee 220-296)

**Prima**: Toggle inline con il titolo (`flex items-center justify-between`)

**Dopo**:
```tsx
<CardContent className="pt-6">
  <div className="flex justify-between gap-4">
    {/* Left column: title, value, description */}
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-primary/20">
          <Coins className="w-4 h-4 text-primary" />
        </div>
        <span className="text-sm font-medium text-primary">Esposizione Valutaria Totale</span>
        <TooltipProvider>...</TooltipProvider>
      </div>
      <div className="text-3xl font-bold text-primary">{formatEUR(grandTotal)}</div>
      {/* Non-EUR totale */}
      {/* Info ETF analizzati */}
      {/* Warning boxes (derivati/bond esclusi) */}
    </div>
    
    {/* Right column: toggles stacked vertically */}
    <div className="flex flex-col gap-2 border-l border-border/50 pl-4">
      <div className="flex items-center gap-2">
        <Switch id="bonds-toggle" checked={includeBonds} onCheckedChange={onIncludeBondsChange} />
        <Label htmlFor="bonds-toggle" className="text-sm cursor-pointer">Bond</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="protections-toggle" checked={includeProtections} onCheckedChange={onIncludeProtectionsChange} />
        <Label htmlFor="protections-toggle" className="text-sm cursor-pointer">Protezioni</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="naked-put-toggle" checked={includeNakedPut} onCheckedChange={onIncludeNakedPutChange} />
        <Label htmlFor="naked-put-toggle" className="text-sm cursor-pointer">Naked Put</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="strategies-toggle" checked={includeStrategies} onCheckedChange={onIncludeStrategiesChange} />
        <Label htmlFor="strategies-toggle" className="text-sm cursor-pointer">Strategie</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="leap-call-toggle" checked={includeLeapCall} onCheckedChange={onIncludeLeapCallChange} />
        <Label htmlFor="leap-call-toggle" className="text-sm cursor-pointer">Leap Call</Label>
      </div>
    </div>
  </div>
</CardContent>
```

---

## Modifica 2: Sector Allocation

**File**: `src/components/risk/SectorAllocationView.tsx`

### Props da aggiungere all'interfaccia (linee 26-38)

```typescript
interface SectorAllocationViewProps {
  // ... esistenti (rimuovere includeDerivatives/onIncludeDerivativesChange singoli) ...
  includeNakedPut: boolean;
  onIncludeNakedPutChange: (value: boolean) => void;
  includeStrategies: boolean;
  onIncludeStrategiesChange: (value: boolean) => void;
  includeLeapCall: boolean;
  onIncludeLeapCallChange: (value: boolean) => void;
}
```

### Ristrutturare CardContent (linee 222-298)

**Dopo**:
```tsx
<CardContent className="pt-6">
  <div className="flex justify-between gap-4">
    {/* Left column: title, value, description */}
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-primary/20">
          <Building2 className="w-4 h-4 text-primary" />
        </div>
        <span className="text-sm font-medium text-primary">Esposizione Settoriale Totale</span>
        <TooltipProvider>...</TooltipProvider>
      </div>
      <div className="text-3xl font-bold text-primary">{formatEUR(grandTotal)}</div>
      {/* Settore principale */}
      {/* Info settori identificati / ETF / AI resolving */}
      
      {/* INFO BOX - MANTENUTO */}
      <div className="flex items-center gap-2 mt-3 p-2 rounded-md bg-blue-500/10 border border-blue-500/30">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <span className="text-xs text-blue-600 dark:text-blue-400">
          Commodities, Bond e Protezioni (Long Put) escluse dall'analisi settoriale
        </span>
      </div>
    </div>
    
    {/* Right column: toggles stacked vertically (NO Protezioni) */}
    <div className="flex flex-col gap-2 border-l border-border/50 pl-4">
      <div className="flex items-center gap-2">
        <Switch id="naked-put-sector-toggle" checked={includeNakedPut} onCheckedChange={onIncludeNakedPutChange} />
        <Label htmlFor="naked-put-sector-toggle" className="text-sm cursor-pointer">Naked Put</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="strategies-sector-toggle" checked={includeStrategies} onCheckedChange={onIncludeStrategiesChange} />
        <Label htmlFor="strategies-sector-toggle" className="text-sm cursor-pointer">Strategie</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="leap-call-sector-toggle" checked={includeLeapCall} onCheckedChange={onIncludeLeapCallChange} />
        <Label htmlFor="leap-call-sector-toggle" className="text-sm cursor-pointer">Leap Call</Label>
      </div>
    </div>
  </div>
</CardContent>
```

---

## Modifica 3: Aggiornare i componenti parent

Bisognerà aggiornare anche i file che usano questi componenti per passare i nuovi props (state + handlers per i toggle aggiuntivi).

**File coinvolti**:
- `src/pages/RiskAnalyzer.tsx` (o il parent che usa CurrencyExposureView e SectorAllocationView)

---

## Riepilogo Modifiche

| File | Modifiche |
|------|-----------|
| `src/components/risk/CurrencyExposureView.tsx` | Layout side-by-side, 5 toggle: Bond, Protezioni, Naked Put, Strategie, Leap Call |
| `src/components/risk/SectorAllocationView.tsx` | Layout side-by-side, 3 toggle: Naked Put, Strategie, Leap Call + info box |
| Parent component (RiskAnalyzer o simile) | Nuovi state per i toggle aggiuntivi |

---

## Risultato Atteso

**Currency Exposure**:
```text
┌──────────────────────────────────────────────────────────────────────────┐
│ 💰 Esposizione Valutaria Totale  ℹ️             │  [✓] Bond              │
│                                                 │  [✓] Protezioni        │
│ 972.999 €                                       │  [✓] Naked Put         │
│ Non-EUR totale: 596.412 €                       │  [✓] Strategie         │
│ Rischio aggregato per valuta ✓ 8 ETF analizzati │  [✓] Leap Call         │
└──────────────────────────────────────────────────────────────────────────┘
```

**Sector Allocation**:
```text
┌──────────────────────────────────────────────────────────────────────────┐
│ 🏢 Esposizione Settoriale Totale  ℹ️            │  [✓] Naked Put         │
│                                                 │  [✓] Strategie         │
│ 554.748 €                                       │  [✓] Leap Call         │
│ Settore principale: Technology (65.2%)          │                        │
│ 13 settori identificati ✓ 8 ETF analizzati      │                        │
│                                                 │                        │
│ ℹ️ Commodities, Bond e Protezioni escluse...    │                        │
└──────────────────────────────────────────────────────────────────────────┘
```

