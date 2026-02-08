
# Modifica Branding Pagina Login

## Obiettivo
Cambiare il titolo da "Portfolio Monitor" a "Option Tech" e sostituire l'icona `TrendingUp` con un'icona custom SVG che rappresenta un Iron Condor.

## Modifiche

### 1. Nuovo Componente Icona Iron Condor
Creerò un componente `IronCondorIcon` che disegna il payoff diagram stilizzato di un Iron Condor:
- Forma trapezoidale con "ali" laterali
- Design minimalista e tecnologico
- Colori coerenti con il tema (usa `currentColor` per integrarsi)

La forma rappresenterà:
```text
    ___________
   /           \
  /             \
```
Questa è la tipica forma del profitto di un Iron Condor.

### 2. Modifica AuthForm.tsx
- **Titolo**: "Portfolio Monitor" → "Option Tech"
- **Sottotitolo**: Può rimanere "Gestisci il tuo portafoglio derivati" o modificarlo se preferisci
- **Icona**: Sostituire `TrendingUp` con il nuovo `IronCondorIcon`

## File da Creare/Modificare
| File | Azione |
|------|--------|
| `src/components/ui/iron-condor-icon.tsx` | Nuovo - Componente SVG icona |
| `src/components/auth/AuthForm.tsx` | Modifica - Titolo e icona |

## Dettagli Tecnici

### Componente IronCondorIcon
```tsx
// Accetta props standard SVG (size, className, etc.)
// Disegna un payoff diagram di Iron Condor stilizzato
// Design: linee geometriche che formano il profilo caratteristico
```

### Modifiche AuthForm
```tsx
// Import
import { IronCondorIcon } from '@/components/ui/iron-condor-icon';

// Nel JSX (riga 159-162):
<IronCondorIcon className="w-8 h-8 text-primary" />
<h1>Option Tech</h1>
```
