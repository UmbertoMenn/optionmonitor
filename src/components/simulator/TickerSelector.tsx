import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

export interface CsvPriceData {
  ticker: string;
  priceData: { date: string; close: number }[];
}

interface TickerSelectorProps {
  onDataLoaded: (data: CsvPriceData) => void;
}

/**
 * Detect separator: comma, semicolon, or tab
 */
function detectSeparator(header: string): string {
  if (header.includes('\t')) return '\t';
  if (header.includes(';')) return ';';
  return ',';
}

/**
 * Find column index matching any of the given patterns (case-insensitive)
 */
function findColumn(headers: string[], patterns: string[]): number {
  for (const pat of patterns) {
    const idx = headers.findIndex(h => h.toLowerCase().trim().includes(pat.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse a date string in various formats to YYYY-MM-DD
 */
function parseDate(dateStr: string, timeStr?: string): string | null {
  let combined = dateStr.trim();
  if (timeStr) combined += ' ' + timeStr.trim();

  // Try native Date parse
  const d = new Date(combined);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const m = combined.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (m) {
    const d2 = new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
    if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10);
  }

  return null;
}

function parseCsvContent(text: string): { date: string; close: number }[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) throw new Error('Il file deve avere almeno 2 righe (header + dati)');

  const sep = detectSeparator(lines[0]);
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));

  // Find date column
  const dateIdx = findColumn(headers, ['datetime', 'date', 'time', 'data', 'timestamp']);
  // Find separate time column if date doesn't include time
  const timeIdx = findColumn(headers, ['time', 'ora']);
  // Find close/price column
  const closeIdx = findColumn(headers, ['close', 'chiusura', 'price', 'prezzo', 'last', 'ultimo', 'adj close']);

  if (dateIdx < 0) throw new Error(`Colonna data non trovata. Header: ${headers.join(', ')}`);
  if (closeIdx < 0) throw new Error(`Colonna prezzo non trovata. Header: ${headers.join(', ')}`);

  const rawRows: { date: string; close: number }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length <= Math.max(dateIdx, closeIdx)) continue;

    const dateStr = cols[dateIdx];
    const timeStr = timeIdx >= 0 && timeIdx !== dateIdx ? cols[timeIdx] : undefined;
    const parsedDate = parseDate(dateStr, timeStr);
    if (!parsedDate) continue;

    const closeVal = parseFloat(cols[closeIdx].replace(',', '.'));
    if (isNaN(closeVal) || closeVal <= 0) continue;

    rawRows.push({ date: parsedDate, close: closeVal });
  }

  if (rawRows.length === 0) throw new Error('Nessuna riga valida trovata nel file');

  // Aggregate to daily: take last close per day
  const byDay = new Map<string, number>();
  for (const row of rawRows) {
    byDay.set(row.date, row.close); // last one wins
  }

  return Array.from(byDay.entries())
    .map(([date, close]) => ({ date, close }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function TickerSelector({ onDataLoaded }: TickerSelectorProps) {
  const [ticker, setTicker] = useState('');
  const [parsedData, setParsedData] = useState<{ date: string; close: number }[] | null>(null);
  const [fileName, setFileName] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCsvContent(text);
        setParsedData(data);

        if (ticker) {
          onDataLoaded({ ticker: ticker.toUpperCase(), priceData: data });
        }

        toast.success(`${data.length} giorni caricati (${data[0].date} → ${data[data.length - 1].date})`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Errore nel parsing del file');
        setParsedData(null);
      }
    };
    reader.readAsText(file);
  }, [ticker, onDataLoaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt'] },
    maxFiles: 1,
  });

  const handleTickerChange = useCallback((val: string) => {
    const t = val.toUpperCase();
    setTicker(t);
    if (t && parsedData) {
      onDataLoaded({ ticker: t, priceData: parsedData });
    }
  }, [parsedData, onDataLoaded]);

  const miniChartData = useMemo(() => {
    if (!parsedData) return [];
    // Sample ~60 points for mini chart
    const step = Math.max(1, Math.floor(parsedData.length / 60));
    return parsedData.filter((_, i) => i % step === 0);
  }, [parsedData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dati di Mercato</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <Label>Ticker</Label>
            <Input
              value={ticker}
              onChange={e => handleTickerChange(e.target.value)}
              placeholder="PLTR"
            />
          </div>

          <div className="sm:col-span-2">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}
                ${parsedData ? 'border-primary/50 bg-primary/5' : ''}`}
            >
              <input {...getInputProps()} />
              {parsedData ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">
                    <strong>{fileName}</strong> — {parsedData.length} giorni ({parsedData[0].date} → {parsedData[parsedData.length - 1].date})
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  {isDragActive ? (
                    <><Upload className="w-4 h-4" /> Rilascia il file</>
                  ) : (
                    <><FileText className="w-4 h-4" /> Trascina un file CSV/TXT o clicca per selezionare</>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {parsedData && miniChartData.length > 0 && (
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={miniChartData}>
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Line type="monotone" dataKey="close" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
