export interface ResolvedAttributionPeriod {
  startDate: string;
  endDate: string;
}

/**
 * Risolve il periodo di attribuzione a partire dalle date effettivamente
 * attribuibili (quelle con SIA snapshot completo SIA Netting storico).
 *
 * Sia T0 sia T1 sono selezionabili dall'utente. In assenza di selezione (o
 * con una selezione non valida: non tra le date attribuibili, o T0 non
 * precedente a T1) si ripiega rispettivamente sulla prima e sull'ultima data
 * attribuibile disponibile — il caso d'uso predefinito resta "storico
 * completo fino ad oggi".
 *
 * Ritorna null se non ci sono almeno due date attribuibili distinte, o se
 * anche dopo il fallback non esiste un T0 valido precedente a T1 (può
 * succedere solo se T1 selezionato coincide con la prima data disponibile).
 */
export function resolveAttributionPeriod(
  attributableDates: string[],
  selectedStartDate?: string | null,
  selectedEndDate?: string | null,
): ResolvedAttributionPeriod | null {
  const dates = [...new Set(attributableDates)].sort((a, b) => a.localeCompare(b));
  if (dates.length < 2) return null;

  const endDate = selectedEndDate && dates.includes(selectedEndDate)
    ? selectedEndDate
    : dates[dates.length - 1];
  const startDate = selectedStartDate && dates.includes(selectedStartDate) && selectedStartDate < endDate
    ? selectedStartDate
    : dates[0];

  if (startDate >= endDate) return null;
  return { startDate, endDate };
}
