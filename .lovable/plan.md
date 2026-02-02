

# Correzione Mapping ALPHABET

## Problema Identificato

Il mapping per Alphabet (Google) nella tabella `isin_mappings` ha un ticker errato:

| Campo | Valore Attuale | Valore Corretto |
|-------|---------------|-----------------|
| ISIN | US02079K3059 | US02079K3059 |
| Ticker | `AZ.ALPHABET` | `GOOGL` |
| Sector | Technology | Technology |
| Source | manual | manual |

Il ticker `AZ.ALPHABET` non è riconosciuto da Yahoo Finance, causando errori 404 durante l'aggiornamento prezzi (come visibile nei log).

## Soluzione

Eseguire un UPDATE sulla tabella `isin_mappings` per correggere il ticker:

```sql
UPDATE isin_mappings 
SET ticker = 'GOOGL', 
    last_verified_at = NOW() 
WHERE isin = 'US02079K3059';
```

## Risultato Atteso

Dopo la correzione:
- Il cron job di aggiornamento prezzi potrà recuperare correttamente il prezzo di Alphabet da Yahoo Finance
- Il ticker verrà mostrato correttamente nella UI
- Non ci saranno più errori 404 nei log per questo titolo

