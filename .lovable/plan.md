

# Piano: Istogramma Rendimenti Annuali in Card Separata

## Obiettivo
Separare l'istogramma dei rendimenti annuali dal carousel principale, posizionandolo in una card indipendente alla destra del carousel.

---

## Layout Attuale vs Nuovo

**Attuale**: Una sola card carousel che contiene tutto (grafico lineare + istogramma nella stessa slide)

**Nuovo**:
```text
+----------------------------------------+------------------+
|  CARD CAROUSEL (lg:col-span-1)         |  CARD ISTOGRAMMA |
|  - Slide 1: Evoluzione Rendimento      |  Rendimento per  |
|  - Slide 2: Evoluzione Patrimonio      |  Anno            |
+----------------------------------------+------------------+
```

---

## Modifiche

### File: `src/components/dashboard/HistoricalChartsCarousel.tsx`

1. **Rimuovere** l'istogramma dalla prima slide del carousel
2. **Aggiungere** una card separata per l'istogramma
3. **Modificare il layout** del return per restituire un fragment con due card affiancate:
   - Card sinistra: Carousel con grafico lineare rendimento + grafico patrimonio
   - Card destra: Istogramma rendimenti annuali (statico, non nel carousel)

4. **Aggiornare le classi CSS**:
   - Card carousel: `lg:col-span-1` (occupa 1 colonna su 2)
   - Card istogramma: `lg:col-span-1` (occupa 1 colonna su 2)
   - Wrapper esterno: fragment React che ritorna entrambe le card

---

## Struttura Componente Aggiornata

```tsx
return (
  <>
    {/* Card Carousel - Evoluzione Rendimento e Patrimonio */}
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Evoluzione Rendimento / Patrimonio</CardTitle>
      </CardHeader>
      <CardContent>
        <Carousel>
          <CarouselItem>
            {/* Solo grafico lineare rendimento */}
            <PerformanceEvolutionChart ... />
          </CarouselItem>
          <CarouselItem>
            {/* Grafico patrimonio */}
            <PortfolioEvolutionChart ... />
          </CarouselItem>
        </Carousel>
      </CardContent>
    </Card>

    {/* Card separata - Rendimento per Anno */}
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Rendimento per Anno</CardTitle>
      </CardHeader>
      <CardContent>
        <YearlyReturnChart ... />
      </CardContent>
    </Card>
  </>
);
```

---

## Vantaggi

- L'istogramma dei rendimenti annuali e sempre visibile, non richiede navigazione nel carousel
- Layout piu chiaro con separazione logica: grafici temporali nel carousel, riepilogo annuale a fianco
- Coerente con il pattern delle altre card della dashboard (es. StatsCards)

---

## Gestione Caso Limite (No Dati)

Quando non ci sono dati storici, mostrare una singola card a tutta larghezza (`lg:col-span-2`) con il messaggio "Nessun dato storico disponibile" (comportamento attuale invariato).

