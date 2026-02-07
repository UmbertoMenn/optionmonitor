
# Piano: Indicatore Mercato Chiuso per Prezzi Stale

## Obiettivo
Modificare l'indicatore di prezzo non aggiornato (triangolino rosso) per mostrare **"Mercato chiuso"** quando il mercato di riferimento è effettivamente chiuso, distinguendo tra titoli USA ed europei.

## Orari di Mercato da Implementare

| Mercato | Orario Locale | Orario CET (inverno) | Orario CEST (estate) |
|---------|---------------|----------------------|----------------------|
| **USA** (NYSE/NASDAQ) | 09:30-16:00 ET | 15:30-22:00 | 15:30-22:00 |
| **Europa** (vari) | ~09:00-17:30 | 09:00-17:30 | 09:00-17:30 |

**Weekend**: Tutti i mercati sono chiusi sabato e domenica.

## Logica di Rilevamento

```text
┌─────────────────────────────────────────────┐
│           isStale = true?                   │
│                  │                          │
│                  ▼                          │
│    ┌─────────────────────────────┐          │
│    │  Determina tipo ticker     │          │
│    │  (EU suffix o US default)  │          │
│    └─────────────────────────────┘          │
│                  │                          │
│         ┌───────┴───────┐                   │
│         ▼               ▼                   │
│    ┌─────────┐     ┌─────────┐              │
│    │ EU Mkt  │     │ US Mkt  │              │
│    └────┬────┘     └────┬────┘              │
│         │               │                   │
│         ▼               ▼                   │
│  isMarketOpen(EU)?   isMarketOpen(US)?      │
│         │               │                   │
│    ┌────┴────┐     ┌────┴────┐              │
│    ▼         ▼     ▼         ▼              │
│  Aperto   Chiuso  Aperto   Chiuso           │
│    │         │     │         │              │
│    ▼         ▼     ▼         ▼              │
│ "Prezzo"  "Mercato" "Prezzo" "Mercato"      │
│ "non agg" "chiuso"  "non agg" "chiuso"      │
└─────────────────────────────────────────────┘
```

## Modifiche Tecniche

### 1. Nuovo helper: `src/lib/marketHours.ts`

Creare un modulo dedicato per la logica degli orari di mercato:

```typescript
// Suffissi ticker europei (riuso logica edge function)
const EU_SUFFIXES = ['.MI', '.DE', '.SW', '.PA', '.AS', '.L', '.MC', '.BR', '.VI', '.CO', '.HE', '.ST', '.OL', '.LS'];

export function isEuropeanTicker(ticker: string): boolean {
  return EU_SUFFIXES.some(suffix => ticker.toUpperCase().endsWith(suffix));
}

export function isMarketOpen(ticker: string): boolean {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  
  // Weekend - tutti i mercati chiusi
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  
  // Get current time in CET/CEST
  const cetOffset = getCETOffset(now);
  const cetHour = (now.getUTCHours() + cetOffset) % 24;
  const cetMinutes = now.getUTCMinutes();
  const cetTime = cetHour * 60 + cetMinutes;
  
  if (isEuropeanTicker(ticker)) {
    // EU: 09:00-17:30 CET
    const euOpen = 9 * 60;      // 540
    const euClose = 17 * 60 + 30; // 1050
    return cetTime >= euOpen && cetTime < euClose;
  } else {
    // US: 15:30-22:00 CET (09:30-16:00 ET)
    const usOpen = 15 * 60 + 30;  // 930
    const usClose = 22 * 60;      // 1320
    return cetTime >= usOpen && cetTime < usClose;
  }
}

// Helper per gestire ora legale CET/CEST
function getCETOffset(date: Date): number {
  // Semplificazione: CET = UTC+1, CEST = UTC+2
  // L'ora legale inizia l'ultima domenica di marzo e finisce l'ultima domenica di ottobre
  const month = date.getUTCMonth(); // 0-11
  if (month >= 3 && month < 10) return 2; // CEST (Apr-Sep)
  if (month === 2 || month === 10) {
    // Marzo o Ottobre - calcolo preciso necessario
    // Semplificazione: assume CEST per marzo dopo il 25, CET per ottobre dopo il 25
    const day = date.getUTCDate();
    if (month === 2) return day >= 25 ? 2 : 1;
    if (month === 10) return day >= 25 ? 1 : 2;
  }
  return 1; // CET (Nov-Feb)
}
```

### 2. Modifica: `src/components/ui/stale-price-indicator.tsx`

Aggiungere prop per il ticker e usare la logica mercato:

```typescript
interface StalePriceIndicatorProps {
  className?: string;
  ticker?: string;  // Nuovo: ticker per determinare il mercato
}

export function StalePriceIndicator({ className, ticker }: StalePriceIndicatorProps) {
  const isMarketClosed = ticker && !isMarketOpen(ticker);
  const message = isMarketClosed ? "Mercato chiuso" : "Prezzo non aggiornato";
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AlertTriangle 
          className={`w-3 h-3 text-destructive animate-pulse ml-1 cursor-help ${className || ''}`}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p>{message}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

### 3. Modifica: `src/pages/Derivatives.tsx`

Passare il ticker al componente `StalePriceIndicator` in tutte le occorrenze (7 punti):

```typescript
// Esempio per Covered Call (linea ~662)
{option.underlying && underlyingPrices[option.underlying]?.isStale && (
  <StalePriceIndicator ticker={underlyingPrices[option.underlying]?.ticker} />
)}
```

### 4. Aggiornare `UnderlyingPrice` interface

L'interfaccia già include `ticker?: string`, quindi non servono modifiche al type.

## File da Modificare/Creare

| File | Azione |
|------|--------|
| `src/lib/marketHours.ts` | **NUOVO** - Logica orari mercato |
| `src/components/ui/stale-price-indicator.tsx` | Modificare - Aggiungere prop ticker e logica |
| `src/pages/Derivatives.tsx` | Modificare - Passare ticker in 7 punti |

## Vantaggi

1. **Chiarezza**: L'utente capisce subito se il prezzo è stale per un problema tecnico o perché il mercato è chiuso
2. **Precisione**: Distingue tra mercati USA ed europei con orari differenti
3. **Consistenza**: Usa la stessa logica di identificazione ticker dell'edge function
4. **Fuso orario**: Calcolo corretto per CET/CEST

## Edge Cases Gestiti

- **Weekend**: Mostra "Mercato chiuso" per tutti i ticker
- **Pre-market/After-hours USA**: Mostra "Mercato chiuso" (non gestiamo extended hours)
- **Festività**: Non gestite esplicitamente (mostrerebbe "Prezzo non aggiornato" - accettabile)
- **Ticker senza suffisso EU**: Assume mercato USA (comportamento conservativo)
