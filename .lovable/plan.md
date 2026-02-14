

## Vista Aggregata per-utente: implementazione

### Obiettivo

1. Ogni utente con 2+ portafogli vede "Il Mio Aggregato" nel selettore
2. L'admin vede anche un "Aggregato" per ogni cliente con 2+ portafogli
3. I grafici storici funzionano correttamente per gli aggregati per-utente, riutilizzando la stessa logica di interpolazione gia in uso per l'aggregato globale

### Architettura: ID speciale

- Nuovo prefisso: `AGGREGATED_USER:` seguito dallo userId
- Esempio: `AGGREGATED_USER:abc123` = aggregato dei portafogli dell'utente abc123
- L'attuale `AGGREGATED` resta invariato per l'aggregato globale admin

### Modifiche per file

#### 1. `src/contexts/PortfolioContext.tsx`

- Esportare `AGGREGATED_USER_PREFIX = 'AGGREGATED_USER:'`
- Esportare helper: `isUserAggregatedId(id)` e `getUserIdFromAggregatedId(id)`
- Aggiornare `isAggregatedView` per riconoscere anche `AGGREGATED_USER:*`
- Nella logica di auto-selezione, trattare gli ID `AGGREGATED_USER:` come validi (come gia avviene per `AGGREGATED`)
- Nella query `admin-view-portfolio`, escludere anche gli ID che iniziano con `AGGREGATED_USER:`

#### 2. `src/components/portfolio/PortfolioSelector.tsx`

- Importare le nuove costanti e l'hook `useAuth` per ottenere `user.id`
- Se l'utente (admin o non) ha 2+ portafogli propri, mostrare "Il Mio Aggregato" con ID `AGGREGATED_USER:<userId>` in cima, con icona `Layers`
- Per admin, nella sezione clienti: per ogni cliente con 2+ portafogli, aggiungere voce "Aggregato" con ID `AGGREGATED_USER:<clientUserId>` prima dei singoli portafogli
- Il click su un aggregato per-utente di un cliente chiama `setAdminViewPortfolio(AGGREGATED_USER:<clientId>, clientId)` per entrare in admin mode

#### 3. `src/hooks/usePortfolio.ts`

- Importare i nuovi helper
- Aggiornare `allPortfoliosQuery`: abilitarla anche per aggregati per-utente; filtrare i portafogli per `user_id` quando e un aggregato per-utente
- Aggiornare `positionsQuery`: quando l'ID e `AGGREGATED_USER:<userId>`, fetchare le posizioni filtrate per `portfolio_id IN (...)` dei portafogli di quell'utente
- Aggiornare `aggregatedPortfolio`: usare il nome "Il Mio Aggregato" o "Aggregato - NomeCliente"
- Aggiornare `isReadOnly` per includere gli aggregati per-utente

#### 4. `src/hooks/useHistoricalData.ts`

- Importare i nuovi helper
- Riconoscere `AGGREGATED_USER:` come aggregato
- Quando e un aggregato per-utente: fetchare i dati storici con filtro `.in('portfolio_id', [...userPortfolioIds])` invece di tutti
- Applicare la stessa funzione `aggregateHistoricalWithInterpolation` gia usata per l'aggregato globale
- Questo garantisce che i grafici (Evoluzione Rendimento, Evoluzione Patrimonio, Rendimento Annuo) funzionino identicamente

#### 5. `src/hooks/useDeposits.ts`

- Importare i nuovi helper
- Per aggregati per-utente: fetchare depositi con `.in('portfolio_id', [...userPortfolioIds])`

#### 6. `src/hooks/useDerivativeOverrides.ts`

- Importare i nuovi helper
- Per aggregati per-utente: fetchare override con `.in('portfolio_id', [...userPortfolioIds])`

#### 7. `src/hooks/useCoveredCallPremiums.ts`

- Importare i nuovi helper
- Per aggregati per-utente: fetchare premiums con `.in('portfolio_id', [...userPortfolioIds])`

### Come si ottengono i portfolio_id dell'utente

Per gli aggregati per-utente, ogni hook che necessita della lista di portfolio_id eseguira una query preliminare:

```text
supabase.from('portfolios').select('id').eq('user_id', targetUserId)
```

Questa query verra gestita tramite una query React Query condivisa con chiave `['user-portfolio-ids', targetUserId]` per evitare duplicazioni.

### Layout finale del dropdown

```text
-- Utente normale (2+ portafogli) --
[ ] Il Mio Aggregato
---
[v] Portfolio 1               EUR XX.XXX
[ ] Portfolio 2               EUR XX.XXX
---
+ Nuovo Portfolio

-- Admin --
[ ] Aggregato - Tutti gli Utenti
[ ] Il Mio Aggregato
---
[v] Mio Portfolio 1           EUR XX.XXX
[ ] Mio Portfolio 2           EUR XX.XXX
---
+ Nuovo Portfolio
---
PORTAFOGLI CLIENTI
  Mario Rossi (mario@...)
    [ ] Aggregato              EUR XX.XXX
    [ ] Portfolio Trading      EUR XX.XXX
    [ ] Portfolio Long Term    EUR XX.XXX
  Anna Bianchi (anna@...)
    [ ] Portfolio Principale   EUR XX.XXX
```

### Riepilogo modifiche

| File | Modifica |
|---|---|
| `PortfolioContext.tsx` | Nuove costanti/helper, aggiornamento isAggregatedView e auto-selezione |
| `PortfolioSelector.tsx` | Voce "Il Mio Aggregato" per tutti, voce "Aggregato" per-cliente per admin |
| `usePortfolio.ts` | Supporto fetch posizioni/portafogli per aggregato per-utente |
| `useHistoricalData.ts` | Supporto aggregato per-utente con stessa logica di interpolazione |
| `useDeposits.ts` | Supporto aggregato per-utente |
| `useDerivativeOverrides.ts` | Supporto aggregato per-utente |
| `useCoveredCallPremiums.ts` | Supporto aggregato per-utente |

