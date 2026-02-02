

# Piano: Gestione Robusta della Selezione Portfolio

## Problema Identificato

Il comportamento di "switching" automatico del portfolio è causato da una **race condition** nel `PortfolioContext.tsx`:

### Flusso Problematico Attuale

```text
1. App si carica
   │
2. localStorage.getItem('selectedPortfolioId') → "portfolio-A" (l'ultimo usato)
   │
3. React Query inizia fetch portfolio (async)
   │
4. useEffect si esegue con portfolios = [] (vuoto, cache non pronta)
   │                                      ↓
   │                            selectedId = "portfolio-A" MA portfolios.length = 0
   │                            → Nessuna azione (condizione portfolios.length > 0 non vera)
   │
5. React Query restituisce dati dalla CACHE (dati vecchi/parziali)
   │
6. useEffect riesegue: portfolios = [...], selectedId = "portfolio-A"
   │                    ↓
   │         portfolios.some(p => p.id === selectedId) → FALSE temporaneamente!
   │         (la cache potrebbe non contenere portfolio-A o ordine diverso)
   │                    ↓
   │         → FALLBACK: setSelectedId(portfolios[0].id) → "portfolio-B" (il più vecchio!)
   │
7. React Query fa REFETCH dal server
   │
8. useEffect riesegue ma ormai selectedId = "portfolio-B" (cambiato!)
```

### Problemi Specifici

| Problema | Codice Attuale | Conseguenza |
|----------|---------------|-------------|
| Ordinamento ASC | `order('created_at', { ascending: true })` | Il fallback seleziona il portfolio più **vecchio**, non l'ultimo usato |
| No protezione durante caricamento | `useEffect` esegue anche con dati parziali | Race condition con cache React Query |
| No validazione localStorage | Non verifica se l'ID salvato esiste ancora | Possibile loop infinito se portfolio eliminato |

---

## Soluzione Proposta

### 1. Aggiungere Flag di Sincronizzazione

Introdurre uno stato `hasInitialized` per eseguire la logica di auto-selezione **una sola volta** dopo il primo caricamento completo.

```typescript
const [hasInitialized, setHasInitialized] = useState(false);
```

### 2. Modificare la Logica useEffect

```typescript
useEffect(() => {
  // Esegui SOLO dopo il primo fetch completato con successo
  if (portfoliosQuery.isLoading || portfoliosQuery.isFetching) return;
  if (portfolios.length === 0) return;
  
  // Se già inizializzato e l'ID selezionato esiste, non fare nulla
  if (hasInitialized && selectedId && portfolios.some(p => p.id === selectedId)) {
    return;
  }
  
  // Verifica se l'ID salvato in localStorage esiste ancora
  const savedId = localStorage.getItem(SELECTED_PORTFOLIO_KEY);
  const savedExists = savedId && portfolios.some(p => p.id === savedId);
  
  if (savedExists) {
    // Usa il portfolio salvato
    setSelectedId(savedId);
  } else {
    // Fallback: usa il portfolio più recente (per last_updated)
    const mostRecent = [...portfolios].sort((a, b) => 
      new Date(b.last_updated || b.created_at).getTime() - 
      new Date(a.last_updated || a.created_at).getTime()
    )[0];
    
    setSelectedId(mostRecent.id);
    localStorage.setItem(SELECTED_PORTFOLIO_KEY, mostRecent.id);
  }
  
  setHasInitialized(true);
}, [portfolios, portfoliosQuery.isLoading, portfoliosQuery.isFetching, hasInitialized]);
```

### 3. Modificare l'Ordinamento Query

Cambiare l'ordinamento da `ascending: true` a `descending` per avere i portfolio più recenti per primi:

```typescript
.order('last_updated', { ascending: false, nullsFirst: false })
```

In questo modo, se scatta il fallback, verrà selezionato il portfolio aggiornato più di recente, non quello creato per primo.

### 4. Aggiungere Cleanup al Logout

Quando l'utente esce, resettare lo stato per evitare che al prossimo login si usi un ID di un altro utente:

```typescript
// Nel PortfolioContext, ascoltare i cambiamenti di user
useEffect(() => {
  if (!user) {
    setSelectedId(null);
    setHasInitialized(false);
    // Non rimuovere da localStorage - verrà validato al prossimo login
  }
}, [user]);
```

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/contexts/PortfolioContext.tsx` | Aggiungere `hasInitialized`, modificare useEffect, cambiare ordinamento query, aggiungere cleanup |

---

## Codice Completo della Modifica

### PortfolioContext.tsx - Nuova Logica

```typescript
// Nuovo stato per tracking inizializzazione
const [hasInitialized, setHasInitialized] = useState(false);

// Query con ordinamento per last_updated DESC
const portfoliosQuery = useQuery({
  queryKey: ['portfolios', user?.id],
  queryFn: async () => {
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', user.id)
      .order('last_updated', { ascending: false, nullsFirst: false });
    
    if (error) throw error;
    return data as unknown as Portfolio[];
  },
  enabled: !!user,
  staleTime: 5000, // Evita refetch troppo frequenti
});

// Reset quando user cambia (logout/login)
useEffect(() => {
  if (!user) {
    setSelectedId(null);
    setHasInitialized(false);
  }
}, [user]);

// Auto-selezione robusta
useEffect(() => {
  // Non eseguire durante loading o fetching
  if (portfoliosQuery.isLoading || portfoliosQuery.isFetching) return;
  if (portfolios.length === 0) return;
  
  // Se già inizializzato e selezione valida, non fare nulla
  if (hasInitialized && selectedId && portfolios.some(p => p.id === selectedId)) {
    return;
  }
  
  // Verifica se ID in localStorage esiste
  const savedId = localStorage.getItem(SELECTED_PORTFOLIO_KEY);
  const savedExists = savedId && portfolios.some(p => p.id === savedId);
  
  if (savedExists) {
    if (selectedId !== savedId) {
      setSelectedId(savedId);
    }
  } else {
    // Fallback: primo della lista (già ordinata per last_updated DESC)
    const fallbackId = portfolios[0].id;
    setSelectedId(fallbackId);
    localStorage.setItem(SELECTED_PORTFOLIO_KEY, fallbackId);
  }
  
  if (!hasInitialized) {
    setHasInitialized(true);
  }
}, [portfolios, portfoliosQuery.isLoading, portfoliosQuery.isFetching, selectedId, hasInitialized]);
```

---

## Flusso Corretto Dopo le Modifiche

```text
1. App si carica
   │
2. localStorage.getItem('selectedPortfolioId') → "portfolio-A"
   │
3. React Query inizia fetch (isLoading = true)
   │
4. useEffect: isLoading = true → RETURN (nessuna azione)
   │
5. React Query completa fetch (isLoading = false, portfolios = [...])
   │
6. useEffect esegue:
   │  - hasInitialized = false
   │  - savedId = "portfolio-A"
   │  - portfolios.some(p => p.id === "portfolio-A") → TRUE
   │  - setSelectedId("portfolio-A") ✓
   │  - setHasInitialized(true)
   │
7. Eventuali refetch successivi:
   │  - hasInitialized = true
   │  - selectedId = "portfolio-A" esiste nella lista
   │  → RETURN (nessuna azione) ✓
```

---

## Note Tecniche

1. **staleTime: 5000**: Riduce refetch inutili nei primi 5 secondi dopo il caricamento
2. **Ordinamento per last_updated**: Il fallback ora seleziona il portfolio usato più di recente
3. **hasInitialized**: Previene loop e race condition
4. **Reset su logout**: Evita conflitti tra sessioni di utenti diversi
5. **Controllo isFetching**: Distingue tra loading iniziale e background refetch

