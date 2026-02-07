
# Piano: Calcolatrice Premi CALL per Covered Call

## Obiettivo
Aggiungere un pulsante calcolatrice su ogni riga Covered Call che permette di:
1. Caricare un file PDF o Excel con gli ordini eseguiti
2. Filtrare solo gli ordini "Eseguito" di tipo CALL per il sottostante specifico
3. Calcolare i premi netti incassati

## Flusso Utente

```text
+---------------------------------------+
|  COVERED CALL ROW                     |
|  NVIDIA OPTION CALL 150 MAR/26  [🧮]  | <-- Click calcolatrice
+---------------------------------------+
                |
                v
+---------------------------------------+
|  DIALOG: Calcola Premi CALL           |
|  Sottostante: NVIDIA                  |
|---------------------------------------|
|  [📄 Carica file ordini (PDF/Excel)]  |
|  Formati: .xls, .xlsx, .pdf           |
|---------------------------------------|
|  Costo unitario transazione:          |
|  [10] USD                             |
|---------------------------------------|
|  RISULTATI (dopo upload):             |
|  +--------------------------------+   |
|  | Ordini trovati: 12             |   |
|  | Vendite: 8  |  Acquisti: 4     |   |
|  +--------------------------------+   |
|  | Lordo Premi:      $2,450.00    |   |
|  | Commissioni:      $120.00      |   |
|  | Netto Comm.:      $2,330.00    |   |
|  +--------------------------------+   |
|  | Lordo Unitario:   $24.50       |   |
|  | Netto Unitario:   $23.30       |   |
|  +--------------------------------+   |
|                                       |
|  [Chiudi]                             |
+---------------------------------------+
```

## Logica di Calcolo

### 1. Parsing del File Ordini

Dal file Excel caricato:
- **Colonne chiave**: Operazione, Simbolo, Stato, Prz Medio, Qta Eseguita, Call/Put
- **Filtro**: `Stato === "Eseguito"` AND `Call/Put === "CALL"`
- **Matching sottostante**: Il simbolo contiene il ticker (es. "TSLA" in "TSLAG6C480")

### 2. Calcoli

| Metrica | Formula |
|---------|---------|
| Valore ordine | `quantita × prezzo_medio × 100` |
| Segno | Vendita = +, Acquisto = - |
| **Lordo Premi** | Somma valori assoluti (val. assoluto del netto) |
| **Commissioni** | `numero_ordini × costo_unitario` |
| **Netto Commissioni** | `Lordo - Commissioni` |
| **Lordo Unitario** | `Lordo / (contratti_cc × 100)` |
| **Netto Unitario** | `Netto / (contratti_cc × 100)` |

Nota: I "contratti CC" sono quelli attualmente in portafoglio per quella covered call.

## Modifiche Tecniche

### File da creare/modificare

| File | Azione |
|------|--------|
| `src/components/derivatives/CallPremiumCalculatorDialog.tsx` | **NUOVO** - Dialog con upload e calcoli |
| `src/lib/orderFileParser.ts` | **NUOVO** - Parser per file ordini |
| `src/pages/Derivatives.tsx` | Aggiungere icona calcolatrice a CoveredCallRow |

### 1. Parser File Ordini (`src/lib/orderFileParser.ts`)

```typescript
interface ParsedOrder {
  operation: 'buy' | 'sell';
  symbol: string;
  status: string;
  avgPrice: number;
  quantity: number;
  optionType: 'CALL' | 'PUT';
}

// Parsing Excel: stessa libreria xlsx gia in uso
// Parsing PDF: richiede estrazione testo tabellare
```

### 2. Dialog Calcolatrice (`src/components/derivatives/CallPremiumCalculatorDialog.tsx`)

Componenti:
- Dropzone per file (PDF/Excel)
- Input numerico per costo transazione (default: 10 USD)
- Tabella risultati con i 4 valori calcolati
- Dettaglio ordini trovati (espandibile)

Props:
```typescript
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  underlying: string;        // Nome sottostante per matching
  ticker?: string;           // Ticker risolto (es. TSLA, NVDA)
  contractsInPortfolio: number; // Per calcolo unitario
}
```

### 3. Modifica CoveredCallRow

Aggiungere icona `Calculator` con onClick che apre il dialog:

```tsx
<Button variant="ghost" size="icon" onClick={() => setShowCalculator(true)}>
  <Calculator className="w-4 h-4" />
</Button>

<CallPremiumCalculatorDialog
  open={showCalculator}
  onOpenChange={setShowCalculator}
  underlying={option.underlying}
  ticker={underlyingPrices[option.underlying]?.ticker}
  contractsInPortfolio={contractsCovered}
/>
```

## Supporto PDF

Per i PDF, il parsing e piu complesso:
- Opzione 1: Usare `pdfjs-dist` per estrarre testo
- Opzione 2: Richiedere solo Excel inizialmente, aggiungere PDF in seguito

**Raccomandazione**: Iniziare con solo Excel (formato identico al file fornito), aggiungere PDF come miglioramento futuro.

## Matching Sottostante

Il simbolo nell'Excel (es. "TSLAG6C480") contiene:
- Ticker: TSLA
- Codice opzione: G6 (mese/anno)
- Tipo: C (Call) o P (Put)
- Strike: 480

Per il matching, estraiamo i primi 2-4 caratteri del simbolo e confrontiamo con il ticker risolto della covered call.

## Note UI

- L'icona calcolatrice appare solo nelle righe Covered Call
- Il dialog e modale e non blocca la navigazione
- I risultati rimangono visibili finche il dialog e aperto
- Possibilita di caricare piu file per aggiornare i calcoli
