

## Piano: Ottimizzazione Layout Card "Azioni Necessarie"

### Analisi dei Problemi Attuali
1. **Disparità contenuto**: Card con 1 elemento vs card con 10+ elementi creano altezze diverse
2. **Numero dispari**: Se alcune card sono vuote, la griglia risulta sbilanciata
3. **Titoli poco evidenti**: Font piccolo (`text-sm`) e colore neutro
4. **Larghezza eccessiva**: Card troppo larghe con spazio vuoto a destra

---

### Soluzione Proposta: Layout "Masonry" con Tag Flow

Invece di 8 card separate, creo un **layout unificato a flusso continuo** dove:
- Ogni categoria è una **riga compatta** con titolo colorato + badge/ticker inline
- Gli elementi sono visualizzati come **tag compatti** in flusso orizzontale
- La card Iron Condor è sempre visibile (anche vuota)
- Il layout si adatta automaticamente al contenuto

```text
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ AZIONI NECESSARIE                                        │
├─────────────────────────────────────────────────────────────┤
│ 🔴 Call non coperte:  [AAPL:2NC] [MSFT:1NC] [+3]            │
│ 🟡 Covered Call ITM:  [GOOGL $150 ×2]                       │
│ 🟣 Double Diagonal OOR:  [TSLA OOR] [NVDA OOR]              │
│ 🟡 Iron Condor OOR:  Nessun elemento                        │
│ 🟠 Naked Put ITM:  [AMD $120 ×1]                            │
│ 🚀 Leap Call in Gain:  [AMZN $200 ×1 G]                     │
│ 🟢 Call da rivendere:  [AAPL 200az] [MSFT 100az]            │
│ 🔵 Altre Strategie:  [SPY Put Spread OOB]                   │
└─────────────────────────────────────────────────────────────┘
```

---

### Modifiche Tecniche

#### File: `src/components/derivatives/DerivativesSummaryCard.tsx`

**1) Nuovo componente `CompactSection` (sostituisce `ExpandableSection`)**
```typescript
function CompactSection({ 
  title, 
  icon: Icon,
  iconColor,
  titleColor,  // Nuovo: colore del titolo stesso
  items, 
  renderItem,
  alwaysVisible = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const INITIAL_SHOW = 8;  // Mostra 8 tag inline
  const hasMore = items.length > INITIAL_SHOW;
  const displayItems = isExpanded ? items : items.slice(0, INITIAL_SHOW);
  
  if (items.length === 0 && !alwaysVisible) return null;
  
  return (
    <div className="flex flex-wrap items-center gap-2 py-2 border-b border-border/50 last:border-b-0">
      {/* Titolo colorato con icona */}
      <div className="flex items-center gap-1.5 min-w-[180px]">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className={`text-sm font-bold ${titleColor}`}>{title}:</span>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      
      {/* Items come tag inline */}
      {items.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">Nessun elemento</span>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {displayItems.map((item, idx) => renderItem(item, idx))}
          {hasMore && !isExpanded && (
            <button 
              onClick={() => setIsExpanded(true)}
              className="text-xs text-primary hover:underline"
            >
              +{items.length - INITIAL_SHOW} altri
            </button>
          )}
          {hasMore && isExpanded && (
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-xs text-muted-foreground hover:underline"
            >
              mostra meno
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**2) Render items come badge/tag compatti**
```typescript
// Esempio per Covered Call ITM
renderItem={(cc, idx) => (
  <Badge 
    key={idx}
    variant="outline" 
    className="text-xs bg-amber-500/10 border-amber-500/30 text-foreground"
  >
    <AlertTriangle className="w-2.5 h-2.5 text-amber-500 mr-1" />
    {cc.ticker} ${cc.strike} ×{cc.contracts}
  </Badge>
)}
```

**3) Layout principale a lista verticale**
```tsx
<CardContent className="pt-0 space-y-0">
  {/* Ogni categoria su una riga, layout verticale */}
  <CompactSection title="Call non coperte" ... alwaysVisible={uncoveredCalls.length > 0} />
  <CompactSection title="Covered Call ITM" ... />
  <CompactSection title="Double Diagonal OOR" ... />
  <CompactSection title="Iron Condor OOR" ... alwaysVisible={true} />  {/* SEMPRE visibile */}
  <CompactSection title="Naked Put ITM" ... />
  <CompactSection title="Leap Call in Gain" ... />
  <CompactSection title="Call da rivendere" ... />
  <CompactSection title="Altre Strategie" ... />
</CardContent>
```

**4) Colori titoli (matching icone)**

| Sezione | Icona | Colore Titolo |
|---------|-------|---------------|
| Call non coperte | ShieldAlert | `text-red-500` |
| Covered Call ITM | ShieldAlert | `text-amber-500` |
| Double Diagonal OOR | Layers | `text-purple-500` |
| Iron Condor OOR | Target | `text-amber-500` |
| Naked Put ITM | CircleDollarSign | `text-orange-500` |
| Leap Call in Gain | Rocket | `text-blue-500` |
| Call da rivendere | TrendingUp | `text-green-500` |
| Altre Strategie | Puzzle | `text-cyan-500` |

---

### Vantaggi della Nuova Struttura

| Problema | Soluzione |
|----------|-----------|
| Card con altezze diverse | Ogni categoria è una riga singola, altezza uniforme |
| Numero dispari di card | Layout verticale, non c'è più la griglia 3 colonne |
| Titoli poco visibili | Font bold + colore matching icona |
| Card troppo larghe | Tag inline che occupano solo lo spazio necessario |
| Iron Condor non visibile | `alwaysVisible={true}` hardcoded |

---

### File Modificati

| File | Modifiche |
|------|-----------|
| `src/components/derivatives/DerivativesSummaryCard.tsx` | Sostituzione layout da griglia a lista verticale con tag inline |

