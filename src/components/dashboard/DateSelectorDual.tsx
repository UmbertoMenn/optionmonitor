import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar } from 'lucide-react';
import { HistoricalDataEntry } from '@/types/historicalData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DateSelectorDualProps {
  historicalData: HistoricalDataEntry[];
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
}

export function DateSelectorDual({ historicalData, selectedDate, onDateChange }: DateSelectorDualProps) {
  const grouped = useMemo(() => {
    const map: Record<string, HistoricalDataEntry[]> = {};
    for (const entry of historicalData) {
      const key = entry.snapshot_date.slice(0, 7); // yyyy-MM
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    }
    return map;
  }, [historicalData]);

  const months = useMemo(() => Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped]);

  const currentMonth = selectedDate ? selectedDate.slice(0, 7) : null;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth || months[0] || '');

  const datesInMonth = useMemo(() => grouped[selectedMonth] || [], [grouped, selectedMonth]);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    // Reset date selection when month changes
    onDateChange(null);
  };

  if (historicalData.length === 0) return null;

  return (
    <div className="mt-2 grid grid-cols-2 gap-1">
      <Select value={selectedMonth} onValueChange={handleMonthChange}>
        <SelectTrigger className="h-7 text-xs">
          <Calendar className="w-3 h-3 mr-1 shrink-0" />
          <SelectValue placeholder="Mese" />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={m}>
              {format(new Date(m + '-01'), 'MMM yyyy', { locale: it })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedDate || 'none'}
        onValueChange={(v) => onDateChange(v === 'none' ? null : v)}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Data" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nessuna</SelectItem>
          {datesInMonth.map((entry) => (
            <SelectItem key={entry.id} value={entry.snapshot_date}>
              {format(new Date(entry.snapshot_date), 'dd/MM/yyyy')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
