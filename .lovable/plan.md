

## Esclusione conto 0652278918440 dalla liquidita per MauroG

### Contesto

Nella sezione LIQUIDITA del file Excel, ogni riga rappresenta un conto corrente. Attualmente il parser somma tutti i conti. Per l'utente MauroG (user_id: `7515bcc7-11b3-42c0-927d-4b2526f3a2b4`) il conto `0652278918440` deve essere escluso dal calcolo della liquidita.

### Approccio

Modificare il parser Excel (`src/lib/excelParser.ts`) per accettare un parametro opzionale `excludedCashAccounts` (lista di stringhe). Nella sezione cash, se il numero conto della riga corrisponde a uno degli account esclusi, la riga viene saltata.

Nel `FileUploader` e ovunque venga chiamato `parsePortfolioExcel`, passare la lista di conti da escludere in base all'utente corrente.

### Dettaglio tecnico

**File: `src/lib/excelParser.ts`**

1. Aggiungere un parametro opzionale alla funzione `parsePortfolioExcel`:
   ```typescript
   export async function parsePortfolioExcel(
     file: File,
     options?: { excludedCashAccounts?: string[] }
   )
   ```

2. Passare `excludedCashAccounts` a `parsePortfolioData`

3. Nella sezione cash (righe 236-242), prima di sommare il valore, controllare se il numero conto della riga corrente e nella lista esclusi:
   ```typescript
   if (currentSection === 'cash') {
     // Check if this account should be excluded
     const accountId = String(row[0] || '').trim();
     if (excludedCashAccounts?.some(acc => accountId.includes(acc))) {
       continue;
     }
     const value = findColumnValue(row, headerRow, [...]);
     if (value) {
       cashValue += parseExcelNumber(value);
     }
     continue;
   }
   ```

**File: `src/components/dashboard/FileUploader.tsx`**

4. Importare `useAuth` e ottenere `user.id`
5. Definire una mappa di esclusioni per utente:
   ```typescript
   const EXCLUDED_CASH_ACCOUNTS: Record<string, string[]> = {
     '7515bcc7-11b3-42c0-927d-4b2526f3a2b4': ['0652278918440'], // MauroG
   };
   ```
6. Passare le esclusioni al parser:
   ```typescript
   const excludedCashAccounts = EXCLUDED_CASH_ACCOUNTS[user?.id || ''] || [];
   const { positions, cashValue, snapshotDate } = await parsePortfolioExcel(file, { excludedCashAccounts });
   ```

### Cosa NON cambia
- Nessun altro utente viene impattato (la mappa e vuota per tutti gli altri)
- Il comportamento di default resta invariato (somma tutti i conti)
- Nessuna modifica al database

