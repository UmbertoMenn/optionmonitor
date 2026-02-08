

## Obiettivo
Aggiungere un tooltip informativo (icona "i") nell'header della pagina Strategie Derivati che spiega:
- I prezzi dei sottostanti (PS: xxxx) sono aggiornati ogni 5 minuti
- I prezzi delle opzioni sono statici e caricati dal file Excel

---

## Modifica

### File: `src/pages/Derivatives.tsx`

#### 1. Importare l'icona HelpCircle
Aggiungere `HelpCircle` all'import da lucide-react (riga 11).

#### 2. Aggiungere il tooltip nell'header
Posizionare l'icona informativa accanto al titolo "Strategie Derivati" (riga 202), con un tooltip di dimensioni maggiorate:

```tsx
<div className="flex items-center gap-2">
  <h1 className="text-lg font-bold">Strategie Derivati</h1>
  <Tooltip>
    <TooltipTrigger asChild>
      <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
    </TooltipTrigger>
    <TooltipContent className="max-w-xs p-3">
      <div className="space-y-2 text-sm">
        <p>
          <strong>Prezzi Sottostanti (PS):</strong> aggiornati automaticamente ogni 5 minuti durante le ore di mercato.
        </p>
        <p>
          <strong>Prezzi Opzioni:</strong> valori statici caricati dal file Excel.
        </p>
      </div>
    </TooltipContent>
  </Tooltip>
</div>
```

---

## Dettagli tecnici

| Elemento | Valore |
|----------|--------|
| Icona | `HelpCircle` (standard uniforme per tooltip informativi) |
| Dimensione icona | `w-4 h-4` |
| Larghezza tooltip | `max-w-xs` (~20rem) per maggiore leggibilità |
| Padding tooltip | `p-3` per più spazio interno |
| Stile | Testo strutturato con `<strong>` per i titoli |

---

## Risultato atteso

1. Un'icona "?" appare accanto al titolo "Strategie Derivati"
2. Al passaggio del mouse, compare un tooltip chiaro e ben formattato
3. Il tooltip spiega la differenza tra prezzi live (sottostanti) e statici (opzioni)

