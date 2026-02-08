

# Piano: Toggle Posizionati a Destra del Titolo (Layout Side-by-Side)

## Situazione Attuale

I toggle sono sotto il valore totale, in una riga orizzontale in fondo alla card.

## Layout Richiesto

I toggle devono essere **a destra** del titolo "Esposizione in Equity e Commodities", impilati verticalmente.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ 🛡️ Esposizione in Equity e Commodities  ℹ️     │  [✓] Protezioni        │
│                                                 │  [✓] Naked Put         │
│ €1,234,567                                      │  [✓] Strategie         │
│ Somma di tutte le categorie di rischio          │  [✓] Leap Call         │
│ (45.2% del valore asset)                        │                        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Modifica

Ristrutturare il `CardContent` con un layout flex row:

**Prima (linee 271-348):**
```tsx
<CardContent className="pt-6">
  <div className="flex items-center justify-between gap-2 mb-2">
    {/* Titolo con icona e tooltip */}
  </div>
  <div className="text-3xl font-bold">€1,234,567</div>
  <div className="text-xs">Descrizione...</div>
  
  {/* Toggle in fondo, riga orizzontale */}
  <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t">
    ...toggles...
  </div>
</CardContent>
```

**Dopo:**
```tsx
<CardContent className="pt-6">
  <div className="flex justify-between gap-4">
    {/* Colonna sinistra: titolo, valore, descrizione */}
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        {/* Icona + Titolo + Tooltip */}
      </div>
      <div className="text-3xl font-bold">€1,234,567</div>
      <div className="text-xs">Descrizione...</div>
    </div>
    
    {/* Colonna destra: toggle impilati verticalmente */}
    <div className="flex flex-col gap-2 border-l border-border/50 pl-4">
      <div className="flex items-center gap-2">
        <Switch .../> <Label>Protezioni</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch .../> <Label>Naked Put</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch .../> <Label>Strategie</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch .../> <Label>Leap Call</Label>
      </div>
    </div>
  </div>
</CardContent>
```

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/components/risk/EquityExposureView.tsx` | Ristrutturare CardContent (linee 270-348) con layout flex side-by-side |

---

## Risultato

- Toggle **a destra** del contenuto principale
- Impilati **verticalmente** uno sotto l'altro
- Separati da un bordo verticale (`border-l`) per chiarezza visiva
- Il resto della card (valore, descrizione) rimane a sinistra

