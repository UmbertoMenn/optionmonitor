

## Light Mode per Option Tech

### Obiettivo
Aggiungere un toggle per passare tra tema scuro (default) e tema chiaro, accessibile sia da mobile (menu "Indice") che da desktop (barra header).

### Modifiche

**1. CSS: definire variabili light mode (`src/index.css`)**

Sostituire il blocco `.light` attualmente disabilitato (righe 100-104) con un set completo di variabili chiare:
- Background: toni chiari (bianco/grigio chiaro)
- Foreground: toni scuri
- Card, popover, muted, accent: palette chiara coerente
- Profit/loss: stessi colori ma con sfondi adattati
- Ombre: ridotte e piu morbide (senza glow intensi)
- Scrollbar: colori chiari

**2. App.tsx: integrare `next-themes` ThemeProvider**

Il pacchetto `next-themes` e gia installato (usato da sonner.tsx). Wrappare l'app con `<ThemeProvider>` configurato con:
- `attribute="class"` (applica classe `dark`/`light` al tag html)
- `defaultTheme="dark"` (mantiene il tema scuro come default)
- `storageKey="option-tech-theme"` (persiste la scelta in localStorage)

**3. Dashboard header: aggiungere toggle tema**

File: `src/components/dashboard/Dashboard.tsx`

- **Desktop**: aggiungere un pulsante icona (Sun/Moon da lucide-react) nella barra dei pulsanti, prima del bottone "Esci"
- **Mobile**: aggiungere una voce nel dropdown "Indice" con icona Sun/Moon e testo "Tema chiaro/scuro"
- Usare `useTheme()` da next-themes per leggere e cambiare il tema

**4. Pagine secondarie: stesso toggle**

Verificare che Derivatives, RiskAnalyzer e AdminPanel ereditino il tema automaticamente (il ThemeProvider e globale, quindi si). Aggiungere il toggle anche negli header di queste pagine se hanno una propria barra di navigazione.

### Dettagli tecnici

**Variabili light mode (valori principali):**
```css
.light {
  --background: 0 0% 100%;
  --background-secondary: 220 14% 96%;
  --background-tertiary: 220 13% 91%;
  --foreground: 222 47% 11%;
  --foreground-muted: 215 16% 47%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --card-hover: 220 14% 96%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;
  --primary: 217 91% 60%;
  --primary-foreground: 0 0% 100%;
  --secondary: 220 14% 96%;
  --secondary-foreground: 222 47% 11%;
  --muted: 220 14% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 220 14% 96%;
  --accent-foreground: 222 47% 11%;
  --border: 220 13% 87%;
  --border-subtle: 220 13% 91%;
  --input: 220 13% 87%;
  --ring: 217 91% 60%;
  --sidebar-background: 220 14% 96%;
  --sidebar-foreground: 222 47% 11%;
  /* profit/loss/warning restano invariati */
  /* shadow-glow ridotti o rimossi */
}
```

**ThemeProvider in App.tsx:**
```tsx
import { ThemeProvider } from "next-themes";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="option-tech-theme">
      <TooltipProvider>
        ...
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
```

**Toggle nel Dashboard header:**
```tsx
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

// Nel componente:
const { theme, setTheme } = useTheme();

// Desktop button:
<Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
</Button>

// Mobile dropdown item:
<DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
  {theme === 'dark' ? <Sun /> : <Moon />}
  {theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
</DropdownMenuItem>
```

**tailwind.config.ts:** gia configurato con `darkMode: ["class"]` - nessuna modifica necessaria.

