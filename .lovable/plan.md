
# Piano: Carousel Unificato e Selettore Data Storica

## Obiettivo
Creare un'esperienza utente coerente dove un singolo controllo carousel governa la visualizzazione di tutte le metriche (Base / Netting Totale / Netting ex CC), e un selettore data permette di scegliere lo snapshot storico per il calcolo dei rendimenti.

---

## Struttura Proposta

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  [●] [○] [○]  Vista: Base / Netting Totale / Netting ex CC               │
├────────────────┬────────────────┬────────────────┬───────────────────────┤
│  Patrimonio    │  Pat. Iniziale │  Giacenza      │  Profitto/Perdita     │
│  (dinamico)    │  + Versamenti  │  Media         │  (dinamico)           │
│                │                │                │  [📅 Selettore Data]  │
├────────────────┴────────────────┴────────────────┴───────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────┐  ┌─────────────────────┐   │
│  │     Grafico Barre (dinamico)            │  │   Dati Storici      │   │
│  │     Valore Asset vs Valore Nettato      │  │   Upload File       │   │
│  └─────────────────────────────────────────┘  └─────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Modifiche da Implementare

### 1. Nuovo Componente Controllo Vista Unificato

Creare una barra di navigazione sopra le 4 stat cards che:
- Mostra 3 indicatori dot (Base, Netting Totale, Netting ex CC)
- Mostra l'etichetta della vista corrente
- Permette di navigare con frecce sx/dx o click sui dot
- Lo stato viene passato a tutti i componenti figli

### 2. Rimozione Carousel Individuali da StatsCards

Attualmente `StatsCards` ha due carousel separati:
- Uno per `patrimonioView`
- Uno per `plView`

Da sostituire con:
- Un singolo prop `viewMode: 'base' | 'netting_total' | 'netting_ex_cc'` ricevuto dal parent
- Tutte le 4 card mostrano valori coerenti con la vista selezionata
- Rimuovere frecce e dot dai singoli card

### 3. Selettore Data Storica nella Card P/L

Aggiungere un dropdown o date picker nella card Profitto/Perdita che:
- Lista tutte le date storiche disponibili (da `historicalData`)
- Permette di selezionare quale snapshot usare come baseline
- Mostra la data selezionata come subtext

### 4. Unificazione Grafico Portfolio

Il `PortfolioCarousel` attuale con 3 slide diventa:
- Un singolo grafico che cambia dinamicamente in base a `viewMode`
- Slide 1 (Base): Grafico a ciambella composizione portafoglio
- Slide 2/3 (Netting): Grafico a barre comparativo

### 5. Gestione Stato Centralizzata

In `Dashboard.tsx`:
- Nuovo state: `viewMode` e `selectedHistoricalDate`
- Passare questi valori come props a `StatsCards` e `PortfolioCarousel`

---

## Dettagli Tecnici

### File da Modificare

| File | Modifiche |
|------|-----------|
| `src/components/dashboard/Dashboard.tsx` | Aggiungere stati `viewMode` e `selectedHistoricalDate`, creare barra controllo vista, rimuovere carousel dal PortfolioCarousel, passare props |
| `src/components/dashboard/StatsCards.tsx` | Ricevere `viewMode`, `selectedHistoricalEntry`, `historicalData` come props, rimuovere stati locali e carousel, aggiungere dropdown date nella card P/L |
| `src/hooks/useHistoricalData.ts` | Aggiungere funzione per trovare entry per data specifica |

### Nuovo Props per StatsCards

```typescript
interface StatsCardsProps {
  summary: PortfolioSummary;
  portfolio: Portfolio | null;
  nettingTotal: number;
  nettingExCC: number;
  viewMode: 'base' | 'netting_total' | 'netting_ex_cc';
  historicalData: HistoricalDataEntry[];
  selectedHistoricalDate: string | null;
  onHistoricalDateChange: (date: string | null) => void;
}
```

### Barra Controllo Vista

Componente posizionato sopra le stat cards:

```typescript
<div className="flex items-center justify-center gap-4 mb-4">
  <button onClick={prev}><ChevronLeft /></button>
  <div className="flex gap-2">
    {views.map((v, i) => (
      <button 
        key={v}
        onClick={() => setViewMode(v)}
        className={cn("w-2 h-2 rounded-full", viewMode === v ? "bg-primary" : "bg-muted")}
      />
    ))}
  </div>
  <span>{viewLabels[viewMode]}</span>
  <button onClick={next}><ChevronRight /></button>
</div>
```

### Logica Grafico Dinamico

Il grafico cambia in base a `viewMode`:
- **Base**: Mostra DonutChart composizione portafoglio
- **Netting Totale**: Mostra BarChart con confronto Base vs Netting Totale
- **Netting ex CC**: Mostra BarChart con confronto Base vs Netting ex CC

---

## Vantaggi

1. **Coerenza**: Tutti i valori mostrati appartengono alla stessa "prospettiva"
2. **Semplicità UX**: Un solo controllo invece di due carousel separati
3. **Flessibilità calcolo P/L**: L'utente può scegliere qualsiasi data storica come riferimento
4. **Meno confusione**: Non è più possibile avere Patrimonio in vista "base" e P/L in vista "netting"
