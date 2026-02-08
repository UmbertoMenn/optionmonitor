

## Obiettivo
1. Mostrare TUTTI i settori nella legenda del grafico a torta (non solo i primi 8)
2. Rimuovere il banner di debug degli strumenti non visualizzati

---

## Modifiche

### File: `src/components/risk/SectorAllocationView.tsx`

#### 1. Rimuovere il banner di debug (righe 424-477)

Eliminare completamente il blocco `Collapsible` che contiene il banner "strumenti non visualizzati":

```typescript
// RIMUOVERE questo blocco intero (righe 424-477):
{missingInstrumentsAnalysis.missing.length > 0 && (
  <Collapsible open={debugBannerOpen} onOpenChange={setDebugBannerOpen}>
    ...
  </Collapsible>
)}
```

E anche:
- La variabile di stato `debugBannerOpen` (riga 420)
- Il `useMemo` `missingInstrumentsAnalysis` (righe 244-418) - non più necessario

#### 2. Mostrare tutti i settori nella legenda con possibilità di espansione

Attualmente la legenda mostra solo 8 settori (riga 597):
```typescript
{chartData.slice(0, 8).map((sector) => (
```

Modificare per mostrare tutti i settori, oppure i primi 8 con un toggle "Mostra tutti":

**Opzione scelta**: Aggiungere uno stato `showAllSectors` e un pulsante per espandere/collassare la lista completa.

```typescript
// Aggiungere stato
const [showAllSectors, setShowAllSectors] = useState(false);

// Nella legenda (riga 596-621):
<div className="flex-1 space-y-1.5 max-h-48 overflow-y-auto">
  {(showAllSectors ? chartData : chartData.slice(0, 8)).map((sector) => (
    <div key={sector.name} className="flex items-center justify-between text-sm">
      {/* ... contenuto esistente ... */}
    </div>
  ))}
  {chartData.length > 8 && (
    <button
      onClick={() => setShowAllSectors(!showAllSectors)}
      className="w-full text-xs text-primary hover:underline pt-2"
    >
      {showAllSectors 
        ? 'Mostra meno' 
        : `Mostra altri ${chartData.length - 8} settori`}
    </button>
  )}
</div>
```

---

## Riepilogo modifiche

| Elemento | Azione |
|----------|--------|
| Banner debug "strumenti non visualizzati" | **Rimosso** completamente |
| `missingInstrumentsAnalysis` useMemo | **Rimosso** (non più necessario) |
| `debugBannerOpen` stato | **Rimosso** |
| Legenda torta (8 settori fissi) | **Espandibile** con toggle per mostrare tutti i settori |
| Altezza max legenda | Aumentata da `max-h-40` a `max-h-48` per più spazio |

---

## Risultato atteso

1. Nessun banner confusionario nella pagina Sector Allocation
2. Il grafico a torta mostra i primi 8 settori con un link "Mostra altri X settori"
3. Cliccando sul link, la lista si espande mostrando TUTTI i settori
4. Il totale visualizzato coincide con la somma di tutti i settori visibili

