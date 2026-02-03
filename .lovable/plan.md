
# Piano: Miglioramenti Visualizzazione Strategie Derivati

## Obiettivo
Aggiungere indicatori di performance e copertura alle sezioni Leap Call e Covered Call nella pagina Strategie Derivati.

---

## Modifiche Richieste

### 1. Leap Call - Variazione % Prezzo vs PMC

**Logica**: Per opzioni comprate (long), il profitto si realizza quando il prezzo sale rispetto al PMC.
- **Verde**: variazione positiva (prezzo > PMC = guadagno)
- **Rosso**: variazione negativa (prezzo < PMC = perdita)

**Formula**: `((prezzo_corrente - pmc) / pmc) * 100`

**Posizione**: A fianco del prezzo corrente, come badge colorato

---

### 2. Covered Call - Variazione % Prezzo vs PMC

**Logica**: Per opzioni vendute (short), il profitto si realizza quando il prezzo scende rispetto al PMC (puoi ricomprare a meno).
- **Verde**: variazione negativa (prezzo < PMC = guadagno)
- **Rosso**: variazione positiva (prezzo > PMC = perdita)

**Formula**: `((prezzo_corrente - pmc) / pmc) * 100`

**Posizione**: A fianco del prezzo corrente, come badge colorato

---

### 3. Covered Call - Badge "P!" (Protezione Parziale)

**Logica**: Mostrare il badge "P!" quando le call vendute non coprono tutte le azioni possedute.

**Formula**: 
```
azioni_scoperte = (azioni_possedute / 100) - contratti_call_venduti
mostra_badge = azioni_scoperte >= 1
```

**Esempio**:
- 500 azioni possedute, 3 call vendute → 5 - 3 = 2 azioni scoperte → mostra "P!"
- 300 azioni possedute, 3 call vendute → 3 - 3 = 0 → NON mostra "P!"

**Stile**: Identico al badge "P!" presente nelle Protezioni (Long Put)

---

## Modifiche File

### File: `src/pages/Derivatives.tsx`

#### A) Funzione `LeapCallRow` (righe 1425-1525)

Aggiungere calcolo e visualizzazione della variazione percentuale:

```typescript
// Calcolo variazione % prezzo vs PMC
const currentPrice = option.current_price || 0;
const avgCost = option.avg_cost || 0;
const priceChangePct = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : null;

// Nel JSX, dopo il prezzo corrente:
{priceChangePct !== null && (
  <span className={`text-xs font-medium ${priceChangePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
    {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(1)}%
  </span>
)}
```

#### B) Funzione `CoveredCallRow` (righe 469-573)

**B.1** Aggiungere calcolo variazione % (colori invertiti per opzioni vendute):

```typescript
// Calcolo variazione % prezzo vs PMC
const currentPrice = option.current_price || 0;
const avgCost = option.avg_cost || 0;
const priceChangePct = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : null;

// Nel JSX, dopo il prezzo corrente:
// Per opzioni vendute: verde se negativo (guadagno), rosso se positivo (perdita)
{priceChangePct !== null && (
  <span className={`text-xs font-medium ${priceChangePct <= 0 ? 'text-green-500' : 'text-red-500'}`}>
    {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(1)}%
  </span>
)}
```

**B.2** Aggiungere logica badge "P!" (copertura parziale):

```typescript
// Calcolo copertura parziale
// contractsCovered = numero di call vendute su questo sottostante
// underlying.quantity = azioni possedute
const sharesOwned = underlying.quantity || 0;
const potentialContracts = Math.floor(sharesOwned / 100);
const uncoveredContracts = potentialContracts - contractsCovered;
const isPartialCoverage = uncoveredContracts >= 1;

// Nel JSX, dopo il badge ITM/OTM:
{isPartialCoverage && (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-black border-2 border-yellow-400 text-yellow-400 text-xs font-bold cursor-help shrink-0">
        P!
      </span>
    </TooltipTrigger>
    <TooltipContent>
      <p>Copertura parziale: {uncoveredContracts} contratti scoperti</p>
    </TooltipContent>
  </Tooltip>
)}
```

---

## Riepilogo Modifiche

| Componente | Modifica | Colore |
|------------|----------|--------|
| LeapCallRow | Variazione % prezzo vs PMC | Verde se +, Rosso se - |
| CoveredCallRow | Variazione % prezzo vs PMC | Verde se -, Rosso se + |
| CoveredCallRow | Badge "P!" copertura parziale | Giallo/nero (stile esistente) |

---

## Note Tecniche

- La logica di colorazione invertita per le Covered Call riflette la natura delle opzioni vendute: il venditore guadagna quando il prezzo dell'opzione scende
- Il badge "P!" per le Covered Call segue la stessa logica delle Protezioni ma con significato inverso: indica che NON tutte le azioni sono coperte da call vendute
- Il tooltip del badge "P!" mostra quanti contratti aggiuntivi potrebbero essere venduti
